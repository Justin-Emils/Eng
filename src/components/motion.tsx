/**
 * 动效工具层。
 *
 * 为什么单独成文件:动效是**App 层面的资产**(和配色/几何那套主题正交),
 * 而且它有一个统一的设计意图 —— **让界面"有重量"**:
 *
 *   · 卡片是"被放上去"的,不是"突然出现"的   → `Enter` 错开入场
 *   · 手指按下去有反馈,不是"点了个寂寞"       → `PressScale` 按压回弹
 *   · 加载中的内容在"流动",不是一块死灰        → `Shimmer`
 *
 * 三条纪律:
 *  1. **时长都在 90~360ms**:低于 90ms 感觉不到,高于 400ms 会显得迟钝;
 *  2. **入场只错开 60ms 一档**:总时长超过约 0.5s 就会让人觉得"App 卡"。
 *     一屏最多 6 档,后面的直接跟随最后一档,不做无限累加;
 *  3. **用 reanimated 的 UI 线程动画**:按压与入场都不触发 React 重渲染,
 *     列表滚动时不会掉帧(项目里 reanimated 早已在依赖里,只是几乎没用)。
 */

import { useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { Animated as RNAnimated, Pressable, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

/** 一档错开的时长;总时长控制在 6 档以内 */
const STAGGER_MS = 60;
const MAX_STEPS = 6;

/**
 * 错开入场:淡入 + 从下方 10px 浮起。
 * `step` 是第几档(0 开始),超过 6 档后不再累加延迟 —— 否则长列表会越等越久。
 */
export function Enter({
  step = 0,
  children,
  style,
}: {
  step?: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const delay = Math.min(step, MAX_STEPS) * STAGGER_MS;
  return (
    <Animated.View style={style} entering={FadeInDown.delay(delay).duration(340)}>
      {children}
    </Animated.View>
  );
}

/**
 * 可按压容器:按下时轻微缩小 + 变暗,松开回弹。
 *
 * 用**RN 自带的 Animated** 而不是 reanimated 的 `useSharedValue`:
 * 项目开了 React Compiler(`app.json` 的 `experiments.reactCompiler`),
 * 它的 `react-hooks/immutability` 规则**不允许在事件回调里写 `sharedValue.value`** ——
 * 那是 reanimated 的标准写法,却过不了这个 lint。
 * 好消息是 transform/opacity 配 `useNativeDriver: true` 本来就跑在 UI 线程,
 * 手感与 reanimated 没差别(骨架屏的呼吸动画也是这么做的)。
 *
 * 注意这里**只包一层 Pressable**(项目里踩过"嵌套 Pressable 抢触摸"的坑,
 * 见 primary-button.tsx 的文件头说明)。
 */
export function PressScale({
  children,
  onPress,
  disabled = false,
  style,
  /** 按下时的缩放比。卡片用 0.975,小按钮用 0.94 */
  scaleTo = 0.975,
  /** 无障碍标签(只有图标没有文字时必填) */
  accessibilityLabel,
}: {
  children: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  accessibilityLabel?: string;
}) {
  // 用 useMemo 而不是 useRef(...).current:
  // React Compiler 的 react-hooks/refs 规则禁止在渲染期读 ref 当前值
  // (skeleton.tsx 里已经踩过同一条规则,项目统一用这个写法)
  const scale = useMemo(() => new RNAnimated.Value(1), []);
  const dim = useMemo(() => new RNAnimated.Value(1), []);

  const toPressed = useCallback(() => {
    RNAnimated.parallel([
      RNAnimated.spring(scale, {
        toValue: scaleTo,
        damping: 18,
        stiffness: 340,
        useNativeDriver: true,
      }),
      RNAnimated.timing(dim, { toValue: 0.9, duration: 90, useNativeDriver: true }),
    ]).start();
  }, [scale, dim, scaleTo]);

  const toRest = useCallback(() => {
    RNAnimated.parallel([
      RNAnimated.spring(scale, {
        toValue: 1,
        damping: 16,
        stiffness: 240,
        useNativeDriver: true,
      }),
      RNAnimated.timing(dim, { toValue: 1, duration: 140, useNativeDriver: true }),
    ]).start();
  }, [scale, dim]);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      onPressIn={toPressed}
      onPressOut={toRest}>
      <RNAnimated.View style={[style, { transform: [{ scale }], opacity: dim }]}>
        {children}
      </RNAnimated.View>
    </Pressable>
  );
}

/**
 * 加载微光:一条高光带从左到右扫过。
 *
 * 之前骨架屏只是"透明度呼吸"(0.45↔0.9),那更像"在闪烁"而不是"在加载"。
 * 扫光用**渐变**而不是纯色块 —— 纯色块扫过去像"有个方块在移动",渐变才像光。
 * （`experimental_backgroundImage` 项目里已经在用,见 animated-icon.tsx。）
 *
 * 扫描范围给的是固定值(-160 → 760):骨架块宽度未知,但一个屏最多也就 800dp 上下,
 * 用固定范围比去测 onLayout 简单得多,而且扫到屏幕外也看不出来。
 */
export function Shimmer({ style }: { style?: StyleProp<ViewStyle> }) {
  const x = useSharedValue(0);

  useEffect(() => {
    x.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
  }, [x]);

  const animated = useAnimatedStyle(() => ({
    transform: [{ translateX: -160 + x.value * 920 }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          width: 140,
          experimental_backgroundImage:
            'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.55) 50%, rgba(255,255,255,0) 100%)',
        },
        animated,
        style,
      ]}
    />
  );
}
