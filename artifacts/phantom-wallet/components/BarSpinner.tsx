import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';

const NUM_BARS = 12;
const BAR_WIDTH = 2.5;
const BAR_HEIGHT = 7;
const RADIUS = 9;

interface BarSpinnerProps {
  size?: number;
  color?: string;
  visible?: boolean;
}

export function BarSpinner({ size = 32, color = '#FFFFFF', visible = true }: BarSpinnerProps) {
  const rotation = useRef(new Animated.Value(0)).current;
  const fadeOpacity = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    rotation.setValue(0);
    animRef.current = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    animRef.current.start();
    return () => {
      animRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    Animated.timing(fadeOpacity, {
      toValue: visible ? 1 : 0,
      duration: 250,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [visible]);

  const rotate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const scale = size / 32;
  const barW = BAR_WIDTH * scale;
  const barH = BAR_HEIGHT * scale;
  const radius = RADIUS * scale;

  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        opacity: fadeOpacity,
        transform: [{ rotate }],
      }}
    >
      {Array.from({ length: NUM_BARS }).map((_, i) => {
        // Bars go from faint (index 0) to bright (index NUM_BARS-1)
        const angle = (i * 360) / NUM_BARS;
        const barOpacity = Math.pow((i + 1) / NUM_BARS, 0.6);

        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              width: barW,
              height: barH,
              borderRadius: barW / 2,
              backgroundColor: color,
              opacity: barOpacity,
              left: size / 2 - barW / 2,
              top: size / 2 - barH / 2,
              transform: [
                { rotate: `${angle}deg` },
                { translateY: -(radius + barH / 2) },
              ],
            }}
          />
        );
      })}
    </Animated.View>
  );
}
