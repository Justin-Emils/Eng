/**
 * 骨架屏 / 加载占位组件。
 *
 * 两种效果叠在一起:
 *   · 整块**呼吸**(透明度 0.45↔0.9)—— 表示"这块在等数据";
 *   · 一条**高光带从左扫到右**(见 motion.tsx 的 Shimmer)—— 表示"正在加载"。
 *
 * 只用呼吸会像"在闪烁",只用扫光在慢网络下会像"卡住了"。
 * 两者叠加才是加载态该有的样子。
 *
 * 注意:高光要能被裁掉,所以块必须 `overflow: 'hidden'`。
 */

import { useEffect, useMemo } from 'react';
import { Animated, StyleSheet, View, type ViewStyle } from 'react-native';

import { Shimmer } from '@/components/motion';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** 一个会呼吸 + 扫光的占位块 */
export function SkeletonBlock({
  width = '100%',
  height = 16,
  radius = 6,
  style,
}: {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}) {
  const theme = useTheme();
  // 用 useMemo 而非 useRef.current:React 规则禁止在渲染期读取 ref 当前值
  const opacity = useMemo(() => new Animated.Value(0.5), []);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.92, duration: 780, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 780, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: theme.backgroundElement,
          opacity,
          // 高光必须被裁在块内
          overflow: 'hidden',
        },
        style,
      ]}>
      <Shimmer />
    </Animated.View>
  );
}

/** 首页/列表用的一整块加载占位(3 张卡片,内部几行错落一些,不是三个同高的灰块) */
export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.card}>
          <SkeletonBlock height={13} width="42%" radius={3} />
          <SkeletonBlock height={10} width="76%" radius={3} />
          <SkeletonBlock height={10} width="58%" radius={3} />
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  /** 一张卡里放几行长短不一的条 —— 比一个等高灰块更像"内容正在来" */
  card: {
    backgroundColor: 'transparent',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
});
