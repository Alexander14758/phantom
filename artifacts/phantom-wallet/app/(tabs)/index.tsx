import React, { useCallback, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { BarSpinner } from '@/components/BarSpinner';

// ─── Types ───────────────────────────────────────────────────────────────────
interface Token {
  id: string;
  name: string;
  symbol: string;
  amount: string;
  value: number;
  change: number;
  verified: boolean;
  bgColor: string;
  symbolColor: string;
}

// ─── Mock data ────────────────────────────────────────────────────────────────
const INITIAL_BALANCE = 410757.53;

const TOKENS: Token[] = [
  {
    id: '1', name: 'Solana', symbol: 'SOL', amount: '3,652.05 SOL',
    value: 338398.95, change: 8904.03, verified: true,
    bgColor: '#9945FF', symbolColor: '#FFFFFF',
  },
  {
    id: '2', name: 'Psyopjak', symbol: 'P', amount: '100M Psyopjak',
    value: 38620.00, change: 34813.82, verified: false,
    bgColor: '#2A2A36', symbolColor: '#AAAACC',
  },
  {
    id: '3', name: 'Bitcoin', symbol: '₿', amount: '0.3 BTC',
    value: 21353.10, change: 228.68, verified: true,
    bgColor: '#F7931A', symbolColor: '#FFFFFF',
  },
  {
    id: '4', name: 'Ghibli', symbol: 'G', amount: '10M GHIBLI',
    value: 2875.00, change: 1186.35, verified: false,
    bgColor: '#1E3A1E', symbolColor: '#4CAF50',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatCurrency(value: number): string {
  return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatChange(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return sign + '$' + Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Simulate fetching new wallet balance from backend
async function fetchBalance(currentBalance: number): Promise<number> {
  await new Promise(r => setTimeout(r, 1500));
  const delta = (Math.random() - 0.4) * 3000;
  return Math.max(400000, currentBalance + delta);
}

// ─── Counting animation hook ──────────────────────────────────────────────────
function useCountingAnimation(target: number, duration = 800) {
  const [display, setDisplay] = useState(target);
  const prevRef = useRef(target);
  const frameRef = useRef<number | null>(null);

  const animateTo = useCallback((from: number, to: number) => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    if (from === to) { setDisplay(to); return; }
    let startTime: number | null = null;

    const step = (ts: number) => {
      if (!startTime) startTime = ts;
      const elapsed = ts - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setDisplay(from + (to - from) * eased);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step);
      } else {
        setDisplay(to);
        prevRef.current = to;
      }
    };
    frameRef.current = requestAnimationFrame(step);
  }, [duration]);

  const update = useCallback((newTarget: number) => {
    animateTo(prevRef.current, newTarget);
  }, [animateTo]);

  return { display, update };
}

// ─── Token Avatar ─────────────────────────────────────────────────────────────
function TokenAvatar({ token }: { token: Token }) {
  return (
    <View style={[styles.tokenAvatar, { backgroundColor: token.bgColor }]}>
      <Text style={[styles.tokenAvatarText, { color: token.symbolColor }]}>
        {token.symbol}
      </Text>
    </View>
  );
}

// ─── Action Button ────────────────────────────────────────────────────────────
function ActionButton({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress?: () => void }) {
  const colors = useColors();
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.timing(scale, { toValue: 0.93, duration: 80, useNativeDriver: true }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, bounciness: 4 }).start();
    onPress?.();
  };

  return (
    <Animated.View style={{ transform: [{ scale }], alignItems: 'center', flex: 1 }}>
      <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut} style={styles.actionButtonWrap}>
        <View style={[styles.actionButtonCircle, { backgroundColor: colors.card }]}>
          {icon}
        </View>
        <Text style={[styles.actionButtonLabel, { color: colors.mutedForeground }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

// ─── Bottom Tab Bar ───────────────────────────────────────────────────────────
function BottomTabBar({ activeTab, insetBottom }: { activeTab: number; insetBottom: number }) {
  const colors = useColors();
  const tabs = [
    { icon: 'home', lib: 'feather' },
    { icon: 'file-text', lib: 'feather' },
    { icon: 'repeat', lib: 'feather' },
    { icon: 'message-square', lib: 'feather' },
    { icon: 'user', lib: 'feather' },
  ];

  return (
    <View style={[styles.bottomTabBar, {
      backgroundColor: colors.tabBar,
      borderTopColor: colors.tabBarBorder,
      paddingBottom: insetBottom + 8,
    }]}>
      {tabs.map((tab, i) => (
        <Pressable key={i} style={styles.tabItem}>
          <Feather
            name={tab.icon as any}
            size={22}
            color={i === activeTab ? colors.tabActive : colors.tabInactive}
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

  const [balance, setBalance] = useState(INITIAL_BALANCE);
  const [change] = useState(46373.33);
  const [changePct] = useState(93.56);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [spinnerVisible, setSpinnerVisible] = useState(false);

  const { display: displayBalance, update: updateBalance } = useCountingAnimation(INITIAL_BALANCE);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setSpinnerVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const newBalance = await fetchBalance(balance);
      // Fade spinner out, then count balance
      setSpinnerVisible(false);
      // Short pause for fade-out, then start counter
      setTimeout(() => {
        setBalance(newBalance);
        updateBalance(newBalance);
        setIsRefreshing(false);
        if (newBalance !== balance) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }, 280);
    } catch {
      setSpinnerVisible(false);
      setIsRefreshing(false);
    }
  }, [isRefreshing, balance, updateBalance]);

  const topPadding = Platform.OS === 'web'
    ? Math.max(insets.top, 67)
    : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="transparent"
            colors={['transparent']}
            progressBackgroundColor="transparent"
          />
        }
      >
        {/* ── Header ── */}
        <View style={[styles.header, { paddingTop: topPadding + 12 }]}>
          <View style={styles.headerLeft}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>S</Text>
            </View>
            <View style={styles.headerNameBlock}>
              <Text style={[styles.headerHandle, { color: colors.mutedForeground }]}>@shai.crypto</Text>
              <Text style={[styles.headerName, { color: colors.foreground }]}>Shai</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <Pressable
              style={styles.headerIconBtn}
              onPress={handleRefresh}
              hitSlop={8}
            >
              <Feather name="clock" size={22} color={colors.foreground} />
            </Pressable>
            <Pressable style={styles.headerIconBtn} hitSlop={8}>
              <Feather name="search" size={22} color={colors.foreground} />
            </Pressable>
          </View>
        </View>

        {/* ── Balance Section ── */}
        <View style={styles.balanceSection}>
          {/* Spinner row — always occupies space, just invisible when not loading */}
          <View style={styles.spinnerRow}>
            <BarSpinner size={30} color="#FFFFFF" visible={spinnerVisible} />
          </View>

          {/* Balance */}
          <Text style={[styles.balanceText, { color: colors.foreground }]}>
            {formatCurrency(displayBalance)}
          </Text>

          {/* Change row */}
          <View style={styles.changeRow}>
            <Text style={[styles.changeText, { color: colors.green }]}>
              {formatChange(change)}
            </Text>
            <View style={[styles.changeBadge, { backgroundColor: '#1A3A26' }]}>
              <Text style={[styles.changeBadgeText, { color: colors.green }]}>
                +{changePct.toFixed(2)}%
              </Text>
            </View>
          </View>
        </View>

        {/* ── Action Buttons ── */}
        <View style={styles.actionsRow}>
          <ActionButton
            icon={<Feather name="send" size={22} color={colors.primary} />}
            label="Send"
          />
          <ActionButton
            icon={<MaterialCommunityIcons name="swap-horizontal" size={24} color={colors.primary} />}
            label="Swap"
          />
          <ActionButton
            icon={<Feather name="grid" size={22} color={colors.primary} />}
            label="Receive"
          />
          <ActionButton
            icon={<Feather name="dollar-sign" size={22} color={colors.primary} />}
            label="Buy"
          />
        </View>

        {/* ── Cash Balance Card ── */}
        <View style={[styles.cashCard, { backgroundColor: colors.card }]}>
          <View>
            <Text style={[styles.cashLabel, { color: colors.mutedForeground }]}>Cash Balance</Text>
            <Text style={[styles.cashValue, { color: colors.foreground }]}>$5,650.00</Text>
          </View>
          <Pressable style={[styles.addCashBtn, { backgroundColor: colors.primary }]}>
            <Text style={[styles.addCashText, { color: colors.primaryForeground }]}>Add Cash</Text>
          </Pressable>
        </View>

        {/* ── Tokens Section ── */}
        <View style={styles.tokensHeader}>
          <Text style={[styles.tokensTitle, { color: colors.foreground }]}>Tokens</Text>
          <Feather name="chevron-right" size={20} color={colors.foreground} />
        </View>

        <View style={[styles.tokensList, { backgroundColor: colors.card }]}>
          {TOKENS.map((token, idx) => (
            <React.Fragment key={token.id}>
              <Pressable style={styles.tokenRow}>
                <TokenAvatar token={token} />
                <View style={styles.tokenInfo}>
                  <View style={styles.tokenNameRow}>
                    <Text style={[styles.tokenName, { color: colors.foreground }]}>{token.name}</Text>
                    {token.verified && (
                      <Ionicons name="checkmark-circle" size={14} color={colors.primary} style={{ marginLeft: 4 }} />
                    )}
                  </View>
                  <Text style={[styles.tokenAmount, { color: colors.mutedForeground }]}>{token.amount}</Text>
                </View>
                <View style={styles.tokenValues}>
                  <Text style={[styles.tokenValue, { color: colors.foreground }]}>
                    {formatCurrency(token.value)}
                  </Text>
                  <Text style={[styles.tokenChange, { color: colors.green }]}>
                    {formatChange(token.change)}
                  </Text>
                </View>
              </Pressable>
              {idx < TOKENS.length - 1 && (
                <View style={[styles.tokenDivider, { backgroundColor: colors.border }]} />
              )}
            </React.Fragment>
          ))}
        </View>

        {/* ── Manage Token List ── */}
        <Pressable style={styles.manageTokens}>
          <Text style={[styles.manageTokensText, { color: colors.primary }]}>Manage token list</Text>
        </Pressable>
      </ScrollView>

      {/* ── Bottom Tab Bar ── */}
      <BottomTabBar activeTab={0} insetBottom={Platform.OS === 'web' ? 34 : insets.bottom} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#5B4AE8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  headerNameBlock: {
    gap: 1,
  },
  headerHandle: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  headerName: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  headerRight: {
    flexDirection: 'row',
    gap: 16,
  },
  headerIconBtn: {
    padding: 4,
  },

  // Balance
  balanceSection: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  spinnerRow: {
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  balanceText: {
    fontSize: 44,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -1,
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  changeText: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
  },
  changeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  changeBadgeText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },

  // Actions
  actionsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 20,
    gap: 8,
  },
  actionButtonWrap: {
    alignItems: 'center',
    gap: 8,
  },
  actionButtonCircle: {
    width: 60,
    height: 60,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonLabel: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },

  // Cash Balance
  cashCard: {
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  cashLabel: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    marginBottom: 4,
  },
  cashValue: {
    fontSize: 20,
    fontFamily: 'Inter_600SemiBold',
  },
  addCashBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
  },
  addCashText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },

  // Tokens
  tokensHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
    gap: 4,
  },
  tokensTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  tokensList: {
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  tokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  tokenAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tokenAvatarText: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },
  tokenInfo: {
    flex: 1,
    gap: 3,
  },
  tokenNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tokenName: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  tokenAmount: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  tokenValues: {
    alignItems: 'flex-end',
    gap: 3,
  },
  tokenValue: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  tokenChange: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  tokenDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 72,
  },

  // Manage tokens
  manageTokens: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  manageTokensText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },

  // Bottom Tab Bar
  bottomTabBar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
});
