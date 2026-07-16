import React, { useEffect, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import type { PortfolioToken } from "@/hooks/usePortfolio";

interface EditTokenModalProps {
  visible: boolean;
  token: PortfolioToken | null;
  onClose: () => void;
  /** Called with (tokenId, newBalance, signedPnlUsd) */
  onSave: (id: string, balance: number, pnlUsd: number | null) => void;
}

export function EditTokenModal({
  visible,
  token,
  onClose,
  onSave,
}: EditTokenModalProps) {
  const colors = useColors();

  const [balance, setBalance] = useState("");
  const [pnlAmount, setPnlAmount] = useState("");
  const [pnlDir, setPnlDir] = useState<"profit" | "loss">("profit");

  // Slide-up animation
  const slideY = React.useRef(new Animated.Value(300)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 10,
      }).start();
    } else {
      slideY.setValue(300);
    }
  }, [visible, slideY]);

  useEffect(() => {
    if (!token) return;
    setBalance(
      token.amount < 0.0001
        ? token.amount.toFixed(8)
        : token.amount <= 1
        ? token.amount.toFixed(6)
        : token.amount.toFixed(4)
    );
    const existingPnl = token.pnlUsdOverride;
    if (existingPnl !== undefined) {
      setPnlAmount(Math.abs(existingPnl).toFixed(2));
      setPnlDir(existingPnl >= 0 ? "profit" : "loss");
    } else {
      const rawPct = token.change24h ?? 0;
      const rawUsd = token.value > 0
        ? Math.abs(token.value - token.value / (1 + rawPct / 100))
        : 0;
      setPnlAmount(rawUsd.toFixed(2));
      setPnlDir(rawPct >= 0 ? "profit" : "loss");
    }
  }, [token]);

  if (!token) return null;

  const numBalance = parseFloat(balance.replace(/,/g, "")) || 0;
  const usdValue = numBalance * token.price;
  const pnlUsdSigned =
    (parseFloat(pnlAmount.replace(/,/g, "")) || 0) *
    (pnlDir === "profit" ? 1 : -1);

  const handleSave = () => {
    const pnl = parseFloat(pnlAmount.replace(/,/g, ""));
    onSave(
      token.id,
      numBalance,
      isNaN(pnl) ? null : pnl * (pnlDir === "profit" ? 1 : -1)
    );
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Tap-outside to close */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <Animated.View
          style={[
            styles.card,
            { backgroundColor: colors.card, transform: [{ translateY: slideY }] },
          ]}
        >
          {/* Handle bar */}
          <View style={[styles.handleBar, { backgroundColor: colors.border }]} />

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: colors.foreground }]}>
                Edit {token.name}
              </Text>
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                {token.symbol} · {token.isWallet ? "wallet token" : "manual holding"}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>

          {/* Balance field */}
          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
              Balance ({token.symbol})
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  color: colors.foreground,
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                },
              ]}
              value={balance}
              onChangeText={setBalance}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={colors.mutedForeground}
              selectTextOnFocus
            />
          </View>

          {/* Calculated USD value */}
          <View style={[styles.calcRow, { backgroundColor: colors.background, borderRadius: 12 }]}>
            <Text style={[styles.calcLabel, { color: colors.mutedForeground }]}>
              USD Value
            </Text>
            <Text style={[styles.calcValue, { color: colors.foreground }]}>
              {usdValue > 0
                ? "$" + usdValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : "—"}
            </Text>
          </View>

          {/* P&L section */}
          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
              Profit / Loss (USD)
            </Text>

            {/* Direction toggle */}
            <View style={styles.dirRow}>
              <Pressable
                style={[
                  styles.dirBtn,
                  {
                    borderColor: pnlDir === "profit" ? colors.green : colors.border,
                    backgroundColor:
                      pnlDir === "profit" ? colors.green + "18" : colors.background,
                  },
                ]}
                onPress={() => setPnlDir("profit")}
              >
                <Text
                  style={[
                    styles.dirLabel,
                    { color: pnlDir === "profit" ? colors.green : colors.mutedForeground },
                  ]}
                >
                  ▲ Profit
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.dirBtn,
                  {
                    borderColor: pnlDir === "loss" ? colors.destructive : colors.border,
                    backgroundColor:
                      pnlDir === "loss" ? colors.destructive + "18" : colors.background,
                  },
                ]}
                onPress={() => setPnlDir("loss")}
              >
                <Text
                  style={[
                    styles.dirLabel,
                    { color: pnlDir === "loss" ? colors.destructive : colors.mutedForeground },
                  ]}
                >
                  ▼ Loss
                </Text>
              </Pressable>
            </View>

            <TextInput
              style={[
                styles.input,
                {
                  color: pnlDir === "profit" ? colors.green : colors.destructive,
                  borderColor: pnlDir === "profit"
                    ? colors.green + "66"
                    : colors.destructive + "66",
                  backgroundColor: colors.background,
                },
              ]}
              value={pnlAmount}
              onChangeText={setPnlAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={colors.mutedForeground}
              selectTextOnFocus
            />

            {/* P&L preview badge */}
            {parseFloat(pnlAmount) > 0 && (
              <View
                style={[
                  styles.pnlBadge,
                  {
                    backgroundColor:
                      pnlDir === "profit" ? "#1A3A26" : "#3A1A1A",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.pnlBadgeText,
                    { color: pnlDir === "profit" ? colors.green : colors.destructive },
                  ]}
                >
                  {pnlDir === "profit" ? "+" : "−"}$
                  {Math.abs(pnlUsdSigned).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                  {" "}today
                </Text>
              </View>
            )}
          </View>

          {/* Save button */}
          <Pressable
            style={[styles.saveBtn, { backgroundColor: colors.primary }]}
            onPress={handleSave}
          >
            <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>
              Save Changes
            </Text>
          </Pressable>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-end",
  },
  card: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 12,
    gap: 18,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  title: { fontSize: 20, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },

  field: { gap: 10 },
  fieldLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  input: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
    fontFamily: "Inter_500Medium",
  },

  calcRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  calcLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  calcValue: { fontSize: 17, fontFamily: "Inter_700Bold" },

  dirRow: { flexDirection: "row", gap: 10 },
  dirBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  dirLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },

  pnlBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  pnlBadgeText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  saveBtn: {
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 4,
  },
  saveBtnText: { fontSize: 16, fontFamily: "Inter_700Bold" },
});
