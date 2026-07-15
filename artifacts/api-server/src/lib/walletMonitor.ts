import WebSocket from "ws";
import { fetchPortfolio, HELIUS_WSS_URL, type HeliusPortfolio } from "./helius";
import { logger } from "./logger";

// ─── Types ────────────────────────────────────────────────────────────────────

type AppClient = WebSocket;

interface WalletState {
  address: string;
  portfolio: HeliusPortfolio | null;
  clients: Set<AppClient>;
  heliusWs: WebSocket | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  fetchInProgress: boolean;
  fetchTimer: ReturnType<typeof setTimeout> | null;
}

// ─── WalletMonitor singleton ──────────────────────────────────────────────────

class WalletMonitor {
  private wallets = new Map<string, WalletState>();

  /** Start monitoring a wallet address (idempotent). */
  monitor(address: string): void {
    if (this.wallets.has(address)) return;

    const state: WalletState = {
      address,
      portfolio: null,
      clients: new Set(),
      heliusWs: null,
      reconnectTimer: null,
      fetchInProgress: false,
      fetchTimer: null,
    };
    this.wallets.set(address, state);

    logger.info({ address }, "WalletMonitor: starting monitoring");

    // Initial portfolio fetch
    void this.refresh(address);

    // Open Helius enhanced WebSocket for real-time tx notifications
    this.openHeliusWs(address);
  }

  /** Register a WebSocket client that wants updates for an address. */
  addClient(address: string, ws: AppClient): void {
    if (!this.wallets.has(address)) this.monitor(address);

    const state = this.wallets.get(address)!;
    state.clients.add(ws);

    // Send cached portfolio immediately if we have one
    if (state.portfolio) {
      this.sendToClient(ws, state.portfolio);
    }
  }

  /** Unregister a WebSocket client. */
  removeClient(address: string, ws: AppClient): void {
    this.wallets.get(address)?.clients.delete(ws);
  }

  /** Return the latest cached portfolio for an address. */
  getPortfolio(address: string): HeliusPortfolio | null {
    return this.wallets.get(address)?.portfolio ?? null;
  }

  // ─── Internal ──────────────────────────────────────────────────────────────

  /** Fetch fresh portfolio data and push to all clients. */
  private async refresh(address: string): Promise<void> {
    const state = this.wallets.get(address);
    if (!state || state.fetchInProgress) return;

    state.fetchInProgress = true;
    try {
      const portfolio = await fetchPortfolio(address);
      state.portfolio = portfolio;
      this.broadcast(address, portfolio);
      logger.info({ address, tokens: portfolio.tokens.length, totalUsd: portfolio.totalUsdValue }, "Portfolio refreshed");
    } catch (err) {
      logger.error({ err, address }, "Portfolio fetch failed");
    } finally {
      state.fetchInProgress = false;
    }
  }

  /** Debounced refresh — waits 2 s after a tx notification before fetching. */
  private scheduleRefresh(address: string, delayMs = 2_000): void {
    const state = this.wallets.get(address);
    if (!state) return;
    if (state.fetchTimer) clearTimeout(state.fetchTimer);
    state.fetchTimer = setTimeout(() => void this.refresh(address), delayMs);
  }

  /** Send portfolio update to all connected app clients. */
  private broadcast(address: string, portfolio: HeliusPortfolio): void {
    const state = this.wallets.get(address);
    if (!state) return;
    for (const client of state.clients) {
      this.sendToClient(client, portfolio);
    }
  }

  private sendToClient(ws: AppClient, portfolio: HeliusPortfolio): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "portfolio", data: portfolio }));
    }
  }

  /** Open a Helius enhanced WebSocket and subscribe to transaction events. */
  private openHeliusWs(address: string): void {
    const state = this.wallets.get(address);
    if (!state) return;

    if (state.reconnectTimer) {
      clearTimeout(state.reconnectTimer);
      state.reconnectTimer = null;
    }

    if (!HELIUS_WSS_URL.includes("api-key=")) {
      logger.warn({ address }, "HELIUS_API_KEY not set — real-time monitoring unavailable");
      return;
    }

    let ws: WebSocket;
    try {
      ws = new WebSocket(HELIUS_WSS_URL);
    } catch (err) {
      logger.error({ err, address }, "Failed to create Helius WS");
      return;
    }

    state.heliusWs = ws;
    let subId: number | null = null;

    ws.on("open", () => {
      logger.info({ address }, "Helius WS opened — subscribing to transactionSubscribe");
      ws.send(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "transactionSubscribe",
          params: [
            { accountInclude: [address] },
            {
              commitment: "confirmed",
              encoding: "jsonParsed",
              transactionDetails: "signatures",
              showRewards: false,
              maxSupportedTransactionVersion: 0,
            },
          ],
        })
      );
    });

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as {
          id?: number;
          result?: number;
          method?: string;
          params?: {
            subscription?: number;
            result?: {
              signature?: string;
              err?: unknown;
            };
          };
        };

        // Subscription confirmation
        if (msg.id === 1 && typeof msg.result === "number") {
          subId = msg.result;
          logger.info({ address, subId }, "Helius transactionSubscribe confirmed");
          return;
        }

        // Transaction notification
        if (msg.method === "transactionNotification") {
          const sig = msg.params?.result?.signature;
          const err = msg.params?.result?.err;
          if (err) return; // Skip failed txs
          logger.info({ address, sig }, "Transaction detected — refreshing portfolio");
          // Notify app clients immediately that a tx is incoming
          const state2 = this.wallets.get(address);
          if (state2) {
            for (const client of state2.clients) {
              if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: "transaction", signature: sig }));
              }
            }
          }
          // Refresh after slight delay so RPC state is settled
          this.scheduleRefresh(address, 2_000);
        }
      } catch {
        // Ignore malformed frames
      }
    });

    ws.on("error", (err) => {
      logger.warn({ err: (err as Error).message, address }, "Helius WS error");
    });

    ws.on("close", () => {
      logger.info({ address }, "Helius WS closed — reconnecting in 5 s");
      state.heliusWs = null;
      if (this.wallets.has(address)) {
        state.reconnectTimer = setTimeout(() => this.openHeliusWs(address), 5_000);
      }
    });
  }

  /** Stop monitoring an address and clean up resources. */
  stopMonitoring(address: string): void {
    const state = this.wallets.get(address);
    if (!state) return;
    if (state.reconnectTimer) clearTimeout(state.reconnectTimer);
    if (state.fetchTimer) clearTimeout(state.fetchTimer);
    state.heliusWs?.close();
    this.wallets.delete(address);
    logger.info({ address }, "WalletMonitor: stopped monitoring");
  }
}

export const walletMonitor = new WalletMonitor();
