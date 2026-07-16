import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { BarSpinner } from "@/components/BarSpinner";
import { ProfileModal } from "@/components/ProfileModal";
import { SwipeableRow } from "@/components/SwipeableRow";
import { EditTokenModal } from "@/components/EditTokenModal";
import { useProfile } from "@/hooks/useProfile";
import { usePortfolio, type PortfolioToken, type WsStatus } from "@/hooks/usePortfolio";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatCurrency(value: number): string {
  if (value >= 1_000_000) {
    return "$" + (value / 1_000_000).toFixed(2) + "M";
  }
  return (
    "$" +
    value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}

function formatAmount(amount: number, symbol: string): string {
  if (amount >= 1_000_000) return (amount / 1_000_000).toFixed(2) + "M " + symbol;
  if (amount >= 1_000) return amount.toLocaleString("en-US", { maximumFractionDigits: 2 }) + " " + symbol;
  return amount.toLocaleString("en-US", { maximumFractionDigits: 6 }) + " " + symbol;
}

function formatChange(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return (
    sign +
    "$" +
    Math.abs(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}

function formatChangePct(pct: number): string {
  return (pct >= 0 ? "+" : "") + pct.toFixed(2) + "%";
}

// ─── Counting Animation Hook ──────────────────────────────────────────────────
function useCountingAnimation(target: number, duration = 800) {
  const [display, setDisplay] = useState(target);
  const prevRef = useRef(target);
  const frameRef = useRef<number | null>(null);

  const animateTo = useCallback(
    (from: number, to: number) => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      if (from === to) {
        setDisplay(to);
        return;
      }
      let startTime: number | null = null;
      const step = (ts: number) => {
        if (!startTime) startTime = ts;
        const elapsed = ts - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplay(from + (to - from) * eased);
        if (progress < 1) {
          frameRef.current = requestAnimationFrame(step);
        } else {
          setDisplay(to);
          prevRef.current = to;
        }
      };
      frameRef.current = requestAnimationFrame(step);
    },
    [duration]
  );

  const update = useCallback(
    (newTarget: number) => {
      animateTo(prevRef.current, newTarget);
    },
    [animateTo]
  );

  return { display, update };
}

// ─── Live Status Dot ──────────────────────────────────────────────────────────
function LiveDot({ status, pulse }: { status: WsStatus; pulse: Animated.Value }) {
  const colors = useColors();
  const dotColor =
    status === "connected"
      ? colors.green
      : status === "connecting"
      ? "#F5A623"
      : colors.mutedForeground;

  return (
    <View style={styles.liveDotWrap}>
      <Animated.View
        style={[
          styles.liveDotInner,
          {
            backgroundColor: dotColor,
            opacity: status === "connected" ? pulse : 1,
          },
        ]}
      />
      <Text style={[styles.liveDotLabel, { color: dotColor }]}>
        {status === "connected" ? "Live" : status === "connecting" ? "…" : ""}
      </Text>
    </View>
  );
}

// ─── Token Row ─────────────────────────────────────────────────────────────────
function TokenRow({ token, isLast }: { token: PortfolioToken; isLast: boolean }) {
  const colors = useColors();

  // Use manual P&L override when set, otherwise derive from live 24 h change
  const tokenChangeUsd =
    token.pnlUsdOverride !== undefined
      ? token.pnlUsdOverride
      : token.value - token.value / (1 + token.change24h / 100);
  const isPositive = tokenChangeUsd >= 0;
  const changeColor = isPositive ? colors.green : colors.destructive;

  return (
    <>
      {/* backgroundColor here makes the sliding row opaque over swipe-action buttons */}
      <Pressable
        style={[styles.tokenRow, { backgroundColor: colors.card }]}
        android_ripple={{ color: colors.border }}
      >
        {/* Avatar */}
        <View style={styles.tokenAvatarWrap}>
          {token.image ? (
            <Image
              source={{ uri: token.image }}
              style={styles.tokenAvatar}
              resizeMode="contain"
            />
          ) : (
            <View style={[styles.tokenAvatarFallback, { backgroundColor: colors.secondary }]}>
              <Text style={[styles.tokenAvatarInitial, { color: colors.foreground }]}>
                {token.symbol.slice(0, 2)}
              </Text>
            </View>
          )}
        </View>

        {/* Info */}
        <View style={styles.tokenInfo}>
          <View style={styles.tokenNameRow}>
            <Text style={[styles.tokenName, { color: colors.foreground }]} numberOfLines={1}>
              {token.name}
            </Text>
            {token.verified && (
              <Ionicons
                name="checkmark-circle"
                size={13}
                color={colors.primary}
                style={{ marginLeft: 3 }}
              />
            )}
            {token.isWallet && (
              <View style={[styles.extBadge, { backgroundColor: colors.primary + "22" }]}>
                <Text style={[styles.extBadgeText, { color: colors.primary }]}>wallet</Text>
              </View>
            )}
          </View>
          <Text style={[styles.tokenAmount, { color: colors.mutedForeground }]} numberOfLines={1}>
            {formatAmount(token.amount, token.symbol)}
          </Text>
        </View>

        {/* Values */}
        <View style={styles.tokenValues}>
          <Text style={[styles.tokenValue, { color: colors.foreground }]}>
            {token.value > 0 ? formatCurrency(token.value) : "—"}
          </Text>
          {tokenChangeUsd !== 0 && token.value > 0 && (
            <Text style={[styles.tokenChange, { color: changeColor }]}>
              {formatChange(tokenChangeUsd)}
            </Text>
          )}
        </View>
      </Pressable>
      {!isLast && (
        // Opaque wrapper prevents the red swipe-action button showing through
        // the transparent left margin of the divider line
        <View style={{ backgroundColor: colors.card }}>
          <View style={[styles.tokenDivider, { backgroundColor: colors.border }]} />
        </View>
      )}
    </>
  );
}

// ─── Action Button ────────────────────────────────────────────────────────────
function ActionButton({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  const colors = useColors();
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.timing(scale, { toValue: 0.92, duration: 80, useNativeDriver: true }).start();
  const onPressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, bounciness: 5 }).start();

  return (
    <Animated.View style={{ transform: [{ scale }], alignItems: "center", flex: 1 }}>
      <Pressable onPressIn={onPressIn} onPressOut={onPressOut} style={styles.actionWrap}>
        <View style={[styles.actionCircle, { backgroundColor: colors.card }]}>{icon}</View>
        <Text style={[styles.actionLabel, { color: colors.mutedForeground }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

// ─── Bottom Tab Bar ───────────────────────────────────────────────────────────
function BottomTabBar({ bottomInset }: { bottomInset: number }) {
  const colors = useColors();
  const ICONS = ["home", "file-text", "repeat", "message-square", "user"] as const;

  return (
    <View
      style={[
        styles.tabBar,
        {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.tabBarBorder,
          paddingBottom: bottomInset + 8,
        },
      ]}
    >
      {ICONS.map((icon, i) => (
        <Pressable key={icon} style={styles.tabItem} hitSlop={8}>
          <Feather
            name={icon}
            size={22}
            color={i === 0 ? colors.tabActive : colors.tabInactive}
          />
        </Pressable>
      ))}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function WalletScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const {
    profile,
    balances,
    connectedWallet,
    saveProfile,
    saveBalances,
    saveConnectedWallet,
  } = useProfile();

  const portfolio = usePortfolio(balances, connectedWallet?.address);

  const [profileOpen, setProfileOpen] = useState(false);
  const [editingToken, setEditingToken] = useState<PortfolioToken | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [spinnerVisible, setSpinnerVisible] = useState(false);

  // Pulse animation for live indicator dot
  const livePulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (portfolio.wsStatus !== "connected") return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(livePulse, { toValue: 0.3, duration: 900, useNativeDriver: true }),
        Animated.timing(livePulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [portfolio.wsStatus, livePulse]);

  const { display: displayBalance, update: updateBalance } = useCountingAnimation(0);

  // Sync balance counter when portfolio value changes
  const prevTotalRef = useRef<number | null>(null);
  useEffect(() => {
    if (portfolio.totalValue > 0) {
      if (prevTotalRef.current === null) {
        // First load — jump directly (no animation on initial render)
        prevTotalRef.current = portfolio.totalValue;
        updateBalance(portfolio.totalValue);
      } else if (prevTotalRef.current !== portfolio.totalValue) {
        updateBalance(portfolio.totalValue);
        prevTotalRef.current = portfolio.totalValue;
      }
    }
  }, [portfolio.totalValue, updateBalance]);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setSpinnerVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      await portfolio.refetch();
    } finally {
      setSpinnerVisible(false);
      setTimeout(() => {
        setIsRefreshing(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }, 280);
    }
  }, [isRefreshing, portfolio]);

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const totalChange24h = portfolio.totalChange24h;
  const totalPct =
    portfolio.totalValue > 0
      ? (totalChange24h / (portfolio.totalValue - totalChange24h)) * 100
      : 0;
  const changeColor = totalChange24h >= 0 ? colors.green : colors.destructive;
  const changeBgColor = totalChange24h >= 0 ? "#1A3A26" : "#3A1A1A";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="transparent"
            colors={["transparent"]}
            progressBackgroundColor="transparent"
          />
        }
      >
        {/* ── Header ── */}
        <View style={[styles.header, { paddingTop: topPad + 12 }]}>
          <Pressable style={styles.headerLeft} onPress={() => setProfileOpen(true)}>
            <View style={[styles.avatarCircle, { backgroundColor: "#5B4AE8" }]}>
              <Text style={styles.avatarEmoji}>{profile.avatar}</Text>
            </View>
            <View>
              <Text style={[styles.headerHandle, { color: colors.mutedForeground }]}>
                {profile.username}
              </Text>
              <Text style={[styles.headerName, { color: colors.foreground }]}>
                {profile.name}
              </Text>
            </View>
          </Pressable>
          <View style={styles.headerRight}>
            <Pressable style={styles.headerIconBtn} onPress={handleRefresh} hitSlop={8}>
              <Feather name="clock" size={22} color={colors.foreground} />
            </Pressable>
            <Pressable style={styles.headerIconBtn} hitSlop={8}>
              <Feather name="search" size={22} color={colors.foreground} />
            </Pressable>
          </View>
        </View>

        {/* ── Balance Section ── */}
        <View style={styles.balanceSection}>
          <View style={styles.spinnerRow}>
            <BarSpinner size={28} color="#FFFFFF" visible={spinnerVisible} />
          </View>

          <Text style={[styles.balanceText, { color: colors.foreground }]}>
            {formatCurrency(displayBalance)}
          </Text>

          {/* Pending transaction indicator */}
          {portfolio.pendingTx && (
            <View style={styles.pendingTxRow}>
              <View style={[styles.pendingTxDot, { backgroundColor: colors.primary }]} />
              <Text style={[styles.pendingTxText, { color: colors.primary }]}>
                Transaction detected…
              </Text>
            </View>
          )}

          {portfolio.totalValue > 0 && (
            <View style={styles.changeRow}>
              <Text style={[styles.changeAmt, { color: changeColor }]}>
                {formatChange(totalChange24h)}
              </Text>
              <View style={[styles.changeBadge, { backgroundColor: changeBgColor }]}>
                <Text style={[styles.changePct, { color: changeColor }]}>
                  {formatChangePct(totalPct)}
                </Text>
              </View>
            </View>
          )}

          {portfolio.pricesError && (
            <Text style={[styles.priceError, { color: colors.mutedForeground }]}>
              Live prices unavailable — tap refresh to retry
            </Text>
          )}
        </View>

        {/* ── Action Buttons ── */}
        <View style={styles.actionsRow}>
          <ActionButton
            icon={<Feather name="send" size={21} color={colors.primary} />}
            label="Send"
          />
          <ActionButton
            icon={<MaterialCommunityIcons name="swap-horizontal" size={23} color={colors.primary} />}
            label="Swap"
          />
          <ActionButton
            icon={<Feather name="grid" size={21} color={colors.primary} />}
            label="Receive"
          />
          <ActionButton
            icon={<Feather name="dollar-sign" size={21} color={colors.primary} />}
            label="Buy"
          />
        </View>

        {/* ── Cash Balance Card ── */}
        <View style={[styles.cashCard, { backgroundColor: colors.card }]}>
          <View>
            <Text style={[styles.cashLabel, { color: colors.mutedForeground }]}>Cash Balance</Text>
            <Text style={[styles.cashValue, { color: colors.foreground }]}>
              {formatCurrency(balances.cash ?? 0)}
            </Text>
          </View>
          <Pressable style={[styles.addCashBtn, { backgroundColor: colors.primary }]}>
            <Text style={[styles.addCashLabel, { color: colors.primaryForeground }]}>Add Cash</Text>
          </Pressable>
        </View>

        {/* ── Tokens ── */}
        {portfolio.tokens.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Tokens</Text>
              <Feather name="chevron-right" size={18} color={colors.foreground} />
            </View>

            <View style={[styles.tokensList, { backgroundColor: colors.card }]}>
              {portfolio.tokens.map((token, idx) => (
                <SwipeableRow
                  key={token.id}
                  onEdit={() => setEditingToken(token)}
                  onRemove={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    portfolio.removeToken(token.id);
                  }}
                  editColor={colors.primary}
                  removeColor={colors.destructive}
                >
                  <TokenRow
                    token={token}
                    isLast={idx === portfolio.tokens.length - 1}
                  />
                </SwipeableRow>
              ))}
            </View>

            {connectedWallet && portfolio.walletTokens.length > 0 && (
              <Text style={[styles.walletNote, { color: colors.mutedForeground }]}>
                {portfolio.walletTokens.length} token
                {portfolio.walletTokens.length !== 1 ? "s" : ""} from connected wallet
              </Text>
            )}

            <Pressable style={styles.manageTokens}>
              <Text style={[styles.manageTokensText, { color: colors.primary }]}>
                Manage token list
              </Text>
            </Pressable>
          </>
        )}

        {/* Loading placeholder */}
        {portfolio.isLoading && portfolio.tokens.every((t) => t.value === 0) && (
          <View style={styles.loadingPlaceholder}>
            <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
              Fetching live prices…
            </Text>
          </View>
        )}
      </ScrollView>

      {/* ── Bottom Tab Bar ── */}
      <BottomTabBar bottomInset={bottomPad} />

      {/* ── Profile Modal ── */}
      <ProfileModal
        visible={profileOpen}
        onClose={() => setProfileOpen(false)}
        profile={profile}
        balances={balances}
        connectedWallet={connectedWallet}
        onSaveProfile={saveProfile}
        onSaveBalances={saveBalances}
        onConnectWallet={saveConnectedWallet}
      />

      {/* ── Edit Token Modal ── */}
      <EditTokenModal
        visible={editingToken !== null}
        token={editingToken}
        onClose={() => setEditingToken(null)}
        onSave={(id, balance, pnlUsd) => {
          portfolio.editToken(id, balance, pnlUsd ?? 0);
          setEditingToken(null);
        }}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarEmoji: { fontSize: 22 },
  headerHandle: { fontSize: 12, fontFamily: "Inter_400Regular" },
  headerName: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  headerRight: { flexDirection: "row", gap: 16 },
  headerIconBtn: { padding: 4 },

  // Balance
  balanceSection: { alignItems: "center", paddingTop: 20, paddingBottom: 18, paddingHorizontal: 20 },
  spinnerRow: { height: 34, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  balanceText: { fontSize: 44, fontFamily: "Inter_700Bold", letterSpacing: -1.5 },
  changeRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  changeAmt: { fontSize: 14, fontFamily: "Inter_500Medium" },
  changeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  changePct: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  priceError: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 6 },

  // Actions
  actionsRow: { flexDirection: "row", paddingHorizontal: 16, paddingBottom: 20, gap: 6 },
  actionWrap: { alignItems: "center", gap: 7 },
  actionCircle: {
    width: 60,
    height: 60,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },

  // Cash
  cashCard: {
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  cashLabel: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 4 },
  cashValue: { fontSize: 20, fontFamily: "Inter_600SemiBold" },
  addCashBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20 },
  addCashLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },

  // Section
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 12,
    gap: 4,
  },
  sectionTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },

  // Token list
  tokensList: { marginHorizontal: 16, borderRadius: 16, overflow: "hidden" },
  tokenRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  tokenAvatarWrap: { width: 44, height: 44 },
  tokenAvatar: { width: 44, height: 44, borderRadius: 22 },
  tokenAvatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  tokenAvatarInitial: { fontSize: 14, fontFamily: "Inter_700Bold" },
  tokenInfo: { flex: 1, gap: 3 },
  tokenNameRow: { flexDirection: "row", alignItems: "center" },
  tokenName: { fontSize: 15, fontFamily: "Inter_600SemiBold", flexShrink: 1 },
  tokenAmount: { fontSize: 13, fontFamily: "Inter_400Regular" },
  tokenValues: { alignItems: "flex-end", gap: 3 },
  tokenValue: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  tokenChange: { fontSize: 13, fontFamily: "Inter_400Regular" },
  tokenDivider: { height: StyleSheet.hairlineWidth, marginLeft: 72 },
  extBadge: { marginLeft: 6, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  extBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },

  // Live dot
  liveDotWrap: { flexDirection: "row", alignItems: "center", gap: 5, marginRight: 4 },
  liveDotInner: { width: 7, height: 7, borderRadius: 4 },
  liveDotLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold" },

  // Pending tx
  pendingTxRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  pendingTxDot: { width: 6, height: 6, borderRadius: 3 },
  pendingTxText: { fontSize: 12, fontFamily: "Inter_500Medium" },

  walletNote: { textAlign: "center", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 8 },
  manageTokens: { alignItems: "center", paddingVertical: 20 },
  manageTokensText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  loadingPlaceholder: { alignItems: "center", paddingVertical: 32 },
  loadingText: { fontSize: 14, fontFamily: "Inter_400Regular" },

  // Bottom tabs
  tabBar: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  tabItem: { flex: 1, alignItems: "center", paddingVertical: 4 },
});
