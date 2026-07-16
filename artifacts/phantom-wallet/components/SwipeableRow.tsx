import React, { useRef } from "react";
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

const ACTION_W = 76; // width of each action button
const SNAP_THRESHOLD = 40; // drag distance to snap open

interface SwipeableRowProps {
  children: React.ReactNode;
  /** Swipe left → reveals Edit on the right */
  onEdit?: () => void;
  /** Swipe right → reveals Remove on the left */
  onRemove?: () => void;
  editColor?: string;
  removeColor?: string;
}

export function SwipeableRow({
  children,
  onEdit,
  onRemove,
  editColor = "#AB9FF2",
  removeColor = "#FF4444",
}: SwipeableRowProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  // Shadow-track the animated value without listeners (avoids memory leaks)
  const currentX = useRef(0);

  React.useEffect(() => {
    const id = translateX.addListener(({ value }) => {
      currentX.current = value;
    });
    return () => translateX.removeListener(id);
  }, [translateX]);

  const snapTo = (toValue: number, callback?: () => void) => {
    Animated.spring(translateX, {
      toValue,
      useNativeDriver: true,
      tension: 50,
      friction: 9,
    }).start(({ finished }) => {
      if (finished && callback) callback();
    });
  };

  const close = () => snapTo(0);

  const panResponder = useRef(
    PanResponder.create({
      // Only capture clearly horizontal gestures
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5 && Math.abs(gs.dx) > 8,
      onMoveShouldSetPanResponderCapture: (_, gs) =>
        Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5 && Math.abs(gs.dx) > 12,

      onPanResponderGrant: () => {
        translateX.setOffset(currentX.current);
        translateX.setValue(0);
      },

      onPanResponderMove: (_, gs) => {
        // Allow left swipe (negative) to show Edit, right swipe to show Remove
        const max = onRemove ? ACTION_W : 0;
        const min = onEdit ? -ACTION_W : 0;
        translateX.setValue(Math.max(min, Math.min(max, gs.dx)));
      },

      onPanResponderRelease: (_, gs) => {
        translateX.flattenOffset();
        const x = currentX.current;

        if (x < -SNAP_THRESHOLD && onEdit) {
          snapTo(-ACTION_W); // reveal Edit
        } else if (x > SNAP_THRESHOLD && onRemove) {
          snapTo(ACTION_W); // reveal Remove
        } else {
          snapTo(0);
        }
      },

      onPanResponderTerminate: () => {
        translateX.flattenOffset();
        snapTo(0);
      },
    })
  ).current;

  return (
    <View style={styles.container}>
      {/* Left side — Remove (revealed by swiping right) */}
      {onRemove && (
        <View style={[styles.leftAction, { backgroundColor: removeColor }]}>
          <Pressable
            style={styles.actionBtn}
            onPress={() => {
              close();
              setTimeout(() => onRemove(), 200);
            }}
          >
            <Text style={styles.actionIcon}>🗑</Text>
            <Text style={styles.actionLabel}>Remove</Text>
          </Pressable>
        </View>
      )}

      {/* Right side — Edit (revealed by swiping left) */}
      {onEdit && (
        <View style={[styles.rightAction, { backgroundColor: editColor }]}>
          <Pressable
            style={styles.actionBtn}
            onPress={() => {
              close();
              setTimeout(() => onEdit(), 150);
            }}
          >
            <Text style={styles.actionIcon}>✏️</Text>
            <Text style={styles.actionLabel}>Edit</Text>
          </Pressable>
        </View>
      )}

      {/* Sliding row */}
      <Animated.View
        style={[styles.row, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    overflow: "hidden",
  },
  leftAction: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: ACTION_W,
    justifyContent: "center",
    alignItems: "center",
  },
  rightAction: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: ACTION_W,
    justifyContent: "center",
    alignItems: "center",
  },
  actionBtn: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
  },
  actionIcon: { fontSize: 18 },
  actionLabel: {
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.3,
  },
  row: {
    // Background must match the card so the sliding row covers action buttons during mid-swipe
    // The parent card sets its own backgroundColor — this is transparent
  },
});
