import React, { useEffect, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import type { Balances, ConnectedWallet, Profile } from "@/hooks/useProfile";
import type { PortfolioToken } from "@/hooks/usePortfolio";

const EMOJI_AVATARS = [
  "🔮", "👾", "🦊", "🐉", "🦁", "🐺", "🎭", "🌙",
  "⚡", "🔥", "💎", "🚀", "🛸", "🌊", "🎯", "🏆",
  "👑", "🤖", "🦋", "🐬", "🌈", "🎪", "🧿", "🪐",
];

interface Props {
  visible: boolean;
  onClose: () => void;
  profile: Profile;
  balances: Balances;
  connectedWallet: ConnectedWallet | null;
  onSaveProfile: (updates: Partial<Profile>) => Promise<void>;
  onSaveBalances: (updates: Partial<Balances>) => Promise<void>;
  onConnectWallet: (wallet: ConnectedWallet | null) => Promise<void>;
  // Wallet token management
  allWalletTokens?: PortfolioToken[];
  removedMints?: Set<string>;
  walletDisplayLimit?: number;
  onSetWalletLimit?: (limit: number) => void;
  onRemoveWalletToken?: (id: string) => void;
  onRestoreWalletToken?: (id: string) => void;
  onEditToken?: (token: PortfolioToken) => void;
}

export function ProfileModal({
  visible,
  onClose,
  profile,
  balances,
  connectedWallet,
  onSaveProfile,
  onSaveBalances,
  onConnectWallet,
  allWalletTokens = [],
  removedMints = new Set(),
  walletDisplayLimit = 0,
  onSetWalletLimit,
  onRemoveWalletToken,
  onRestoreWalletToken,
  onEditToken,
}: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState(profile.name);
  const [username, setUsername] = useState(profile.username);
  const [avatar, setAvatar] = useState(profile.avatar);
  const [solBalance, setSolBalance] = useState(balances.solana.toString());
  const [btcBalance, setBtcBalance] = useState(balances.bitcoin.toString());
  const [ethBalance, setEthBalance] = useState(balances.ethereum.toString());
  const [cashBalance, setCashBalance] = useState((balances.cash ?? 5650).toString());
  const [walletAddress, setWalletAddress] = useState(connectedWallet?.address ?? "");
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState("");
  const [saving, setSaving] = useState(false);
  // Wallet token management
  const [selectedTokenIds, setSelectedTokenIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (visible) {
      setName(profile.name);
      setUsername(profile.username);
      setAvatar(profile.avatar);
      setSolBalance(balances.solana.toString());
      setBtcBalance(balances.bitcoin.toString());
      setEthBalance(balances.ethereum.toString());
      setCashBalance((balances.cash ?? 5650).toString());
      setWalletAddress(connectedWallet?.address ?? "");
      setConnectError("");
      setSelectedTokenIds(new Set());
    }
  }, [visible, profile, balances, connectedWallet]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all([
        onSaveProfile({ name: name.trim(), username: username.trim(), avatar }),
        onSaveBalances({
          solana: Math.max(0, parseFloat(solBalance) || 0),
          bitcoin: Math.max(0, parseFloat(btcBalance) || 0),
          ethereum: Math.max(0, parseFloat(ethBalance) || 0),
          cash: Math.max(0, parseFloat(cashBalance) || 0),
        }),
      ]);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleConnect = async () => {
    const addr = walletAddress.trim();
    if (!addr) return;
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr)) {
      setConnectError("Invalid Solana address. Please check and try again.");
      return;
    }
    setConnecting(true);
    setConnectError("");
    try {
      await onConnectWallet({ address: addr });
    } catch {
      setConnectError("Failed to connect wallet. Try again.");
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setWalletAddress("");
    await onConnectWallet(null);
  };

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        style={[styles.root, { backgroundColor: colors.background }]}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* ── Header ── */}
        <View
          style={[
            styles.header,
            { paddingTop: topPad + 12, borderBottomColor: colors.border },
          ]}
        >
          <Pressable onPress={onClose} hitSlop={14} style={styles.headerBtn}>
            <Feather name="x" size={22} color={colors.mutedForeground} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Profile</Text>
          <Pressable onPress={handleSave} disabled={saving} hitSlop={14} style={styles.headerBtn}>
            <Text style={[styles.saveLabel, { color: colors.primary, opacity: saving ? 0.5 : 1 }]}>
              {saving ? "Saving…" : "Save"}
            </Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Current Avatar Preview ── */}
          <View style={styles.avatarPreview}>
            <View style={[styles.bigAvatar, { backgroundColor: colors.card }]}>
              <Text style={styles.bigAvatarEmoji}>{avatar}</Text>
            </View>
            <Text style={[styles.avatarHint, { color: colors.mutedForeground }]}>
              Tap an emoji below to change
            </Text>
          </View>

          {/* ── Emoji Picker ── */}
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.cardLabel, { color: colors.mutedForeground }]}>CHOOSE AVATAR</Text>
            <View style={styles.emojiGrid}>
              {EMOJI_AVATARS.map((e) => (
                <Pressable
                  key={e}
                  onPress={() => setAvatar(e)}
                  style={[
                    styles.emojiCell,
                    avatar === e && { backgroundColor: colors.primary + "33", borderColor: colors.primary },
                  ]}
                >
                  <Text style={styles.emojiChar}>{e}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* ── Profile Info ── */}
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.cardLabel, { color: colors.mutedForeground }]}>PROFILE INFO</Text>

            <View style={[styles.fieldRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Display Name</Text>
              <TextInput
                style={[styles.fieldInput, { color: colors.foreground }]}
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor={colors.mutedForeground}
                selectionColor={colors.primary}
              />
            </View>

            <View style={styles.fieldRow}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Username</Text>
              <TextInput
                style={[styles.fieldInput, { color: colors.foreground }]}
                value={username}
                onChangeText={setUsername}
                placeholder="@username"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="none"
                selectionColor={colors.primary}
              />
            </View>
          </View>

          {/* ── Wallet Assets ── */}
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.cardLabel, { color: colors.mutedForeground }]}>WALLET ASSETS</Text>

            {[
              { label: "Solana (SOL)", value: solBalance, onChange: setSolBalance },
              { label: "Bitcoin (BTC)", value: btcBalance, onChange: setBtcBalance },
              { label: "Ethereum (ETH)", value: ethBalance, onChange: setEthBalance },
              { label: "Cash (USD)", value: cashBalance, onChange: setCashBalance },
            ].map((field, idx, arr) => (
              <View
                key={field.label}
                style={[
                  styles.fieldRow,
                  idx < arr.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
                ]}
              >
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{field.label}</Text>
                <TextInput
                  style={[styles.fieldInput, { color: colors.foreground }]}
                  value={field.value}
                  onChangeText={field.onChange}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={colors.mutedForeground}
                  selectionColor={colors.primary}
                />
              </View>
            ))}
          </View>

          {/* ── Connect Wallet ── */}
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.cardLabel, { color: colors.mutedForeground }]}>CONNECT WALLET</Text>

            {connectedWallet ? (
              <>
                <View
                  style={[
                    styles.connectedBadge,
                    { backgroundColor: colors.green + "18", borderColor: colors.green + "40" },
                  ]}
                >
                  <Feather name="check-circle" size={14} color={colors.green} />
                  <Text
                    style={[styles.connectedAddr, { color: colors.green }]}
                    numberOfLines={1}
                    ellipsizeMode="middle"
                  >
                    {connectedWallet.address}
                  </Text>
                </View>
                <Pressable
                  style={[styles.disconnectBtn, { borderColor: colors.border }]}
                  onPress={handleDisconnect}
                >
                  <Text style={[styles.disconnectLabel, { color: colors.mutedForeground }]}>
                    Disconnect Wallet
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                <TextInput
                  style={[
                    styles.addressInput,
                    {
                      color: colors.foreground,
                      backgroundColor: colors.secondary,
                      borderColor: connectError ? colors.destructive : colors.border,
                    },
                  ]}
                  value={walletAddress}
                  onChangeText={(v) => { setWalletAddress(v); setConnectError(""); }}
                  placeholder="Paste Solana wallet address"
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="none"
                  autoCorrect={false}
                  selectionColor={colors.primary}
                />
                {connectError ? (
                  <Text style={[styles.errorText, { color: colors.destructive }]}>{connectError}</Text>
                ) : null}
                <Pressable
                  style={[
                    styles.connectBtn,
                    {
                      backgroundColor: walletAddress.trim() ? colors.primary : colors.secondary,
                      opacity: connecting ? 0.7 : 1,
                    },
                  ]}
                  onPress={handleConnect}
                  disabled={connecting || !walletAddress.trim()}
                >
                  <Text
                    style={[
                      styles.connectBtnLabel,
                      { color: walletAddress.trim() ? colors.primaryForeground : colors.mutedForeground },
                    ]}
                  >
                    {connecting ? "Connecting…" : "Connect Wallet"}
                  </Text>
                </Pressable>
              </>
            )}
          </View>

          {/* ── Wallet Token Management ── */}
          {allWalletTokens.length > 0 && (
            <View style={[styles.card, { backgroundColor: colors.card }]}>
              <Text style={[styles.cardLabel, { color: colors.mutedForeground }]}>WALLET TOKENS</Text>

              {/* Display limit */}
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground, marginBottom: 8 }]}>
                Max tokens on dashboard
              </Text>
              <View style={styles.limitRow}>
                {[0, 5, 10, 15, 20].map((n) => (
                  <Pressable
                    key={n}
                    onPress={() => onSetWalletLimit?.(n)}
                    style={[
                      styles.limitBtn,
                      {
                        backgroundColor: walletDisplayLimit === n ? colors.primary : colors.secondary,
                        borderColor: walletDisplayLimit === n ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.limitBtnLabel,
                        { color: walletDisplayLimit === n ? colors.primaryForeground : colors.mutedForeground },
                      ]}
                    >
                      {n === 0 ? "All" : String(n)}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Token list header */}
              <View style={[styles.tokenMgrHeader, { marginTop: 18 }]}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                  Token visibility ({allWalletTokens.length})
                </Text>
                {selectedTokenIds.size > 0 && (
                  <Pressable
                    onPress={() => {
                      selectedTokenIds.forEach((id) => onRemoveWalletToken?.(id));
                      setSelectedTokenIds(new Set());
                    }}
                    style={[styles.removeSelBtn, { backgroundColor: colors.destructive }]}
                  >
                    <Text style={styles.removeSelLabel}>Remove {selectedTokenIds.size}</Text>
                  </Pressable>
                )}
              </View>

              {/* Token rows */}
              <View style={[styles.tokenMgrList, { backgroundColor: colors.secondary }]}>
                {allWalletTokens.map((token, idx) => {
                  const isHidden = removedMints.has(token.id);
                  const isSelected = selectedTokenIds.has(token.id);
                  return (
                    <Pressable
                      key={token.id}
                      style={[
                        styles.tokenMgrRow,
                        idx < allWalletTokens.length - 1 && {
                          borderBottomWidth: StyleSheet.hairlineWidth,
                          borderBottomColor: colors.border,
                        },
                        isHidden && { opacity: 0.5 },
                      ]}
                      onPress={() => {
                        if (isHidden) {
                          onRestoreWalletToken?.(token.id);
                        } else {
                          setSelectedTokenIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(token.id)) next.delete(token.id);
                            else next.add(token.id);
                            return next;
                          });
                        }
                      }}
                    >
                      {token.image ? (
                        <Image
                          source={{ uri: token.image }}
                          style={styles.tokenMgrLogo}
                          resizeMode="contain"
                        />
                      ) : (
                        <View style={[styles.tokenMgrLogoFallback, { backgroundColor: colors.border }]}>
                          <Text style={{ fontSize: 10, fontFamily: "Inter_700Bold", color: colors.foreground }}>
                            {token.symbol.slice(0, 2)}
                          </Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.tokenMgrName, { color: colors.foreground }]} numberOfLines={1}>
                          {token.name}
                        </Text>
                        <Text style={[styles.tokenMgrSub, { color: colors.mutedForeground }]}>
                          {isHidden ? "Tap to restore" : token.symbol}
                        </Text>
                      </View>
                      {/* Edit button — only for visible tokens */}
                      {!isHidden && onEditToken && (
                        <Pressable
                          onPress={() => onEditToken(token)}
                          style={[styles.editTokenBtn, { backgroundColor: colors.primary + "22" }]}
                          hitSlop={6}
                        >
                          <Text style={[styles.editTokenBtnText, { color: colors.primary }]}>Edit</Text>
                        </Pressable>
                      )}
                      {/* Checkbox / restore icon */}
                      <View
                        style={[
                          styles.checkbox,
                          {
                            borderColor: isSelected ? colors.primary : colors.border,
                            backgroundColor: isSelected ? colors.primary : "transparent",
                          },
                        ]}
                      >
                        {isHidden ? (
                          <Feather name="eye-off" size={11} color={colors.mutedForeground} />
                        ) : isSelected ? (
                          <Feather name="check" size={11} color={colors.primaryForeground} />
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          <View style={{ height: 60 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: { minWidth: 48 },
  headerTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  saveLabel: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  scroll: { flex: 1 },

  avatarPreview: { alignItems: "center", paddingVertical: 28 },
  bigAvatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  bigAvatarEmoji: { fontSize: 44 },
  avatarHint: { fontSize: 13, fontFamily: "Inter_400Regular" },

  card: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
  },
  cardLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    marginBottom: 12,
  },

  emojiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  emojiCell: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  emojiChar: { fontSize: 24 },

  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 13,
  },
  fieldLabel: { fontSize: 15, fontFamily: "Inter_400Regular", flex: 1 },
  fieldInput: {
    flex: 1.2,
    textAlign: "right",
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    minHeight: 36,
  },

  addressInput: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginBottom: 8,
    minHeight: 44,
  },
  errorText: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 8 },
  connectBtn: {
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    marginTop: 4,
  },
  connectBtnLabel: { fontSize: 15, fontFamily: "Inter_600SemiBold" },

  connectedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  connectedAddr: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium" },
  disconnectBtn: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    alignItems: "center",
  },
  disconnectLabel: { fontSize: 14, fontFamily: "Inter_500Medium" },

  // Wallet token management
  limitRow: { flexDirection: "row", gap: 6, flexWrap: "wrap", marginBottom: 4 },
  limitBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  limitBtnLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  tokenMgrHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  removeSelBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  removeSelLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },
  tokenMgrList: { borderRadius: 12, overflow: "hidden", marginBottom: 4 },
  tokenMgrRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  tokenMgrLogo: { width: 34, height: 34, borderRadius: 17, flexShrink: 0 },
  tokenMgrLogoFallback: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  tokenMgrName: { fontSize: 14, fontFamily: "Inter_500Medium" },
  tokenMgrSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  editTokenBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginRight: 8,
    flexShrink: 0,
  },
  editTokenBtnText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
});
