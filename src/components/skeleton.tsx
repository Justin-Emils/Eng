/**
 * 骨架屏 / 加载占位组件。
 * 用 Animated 做轻微呼吸效果,替代"白屏等待",让加载过程看起来正常。
 */

import { useEffect, useMemo } from 'react';
import { Animated, StyleSheet, type ViewStyle } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** 一个会呼吸的占位块 */
export function SkeletonBlock({
  width = '100%',
  height = 16,
  radius = 8,
  style,
}: {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}) {
  const theme = useTheme();
  // 用 useMemo 而非 useRef.current:React 规则禁止在渲染期读取 ref 当前值
  const opacity = useMemo(() => new Animated.Value(0.45), []);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.9, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius, backgroundColor: theme.backgroundElement, opacity },
        style,
      ]}
    />
  );
}

/** 首页/列表用的一整块加载占位(3 张卡片) */
export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonBlock key={i} height={96} radius={Spacing.three} style={styles.card} />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: Spacing.three },
});
