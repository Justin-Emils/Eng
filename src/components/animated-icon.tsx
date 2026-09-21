import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  Keyframe,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

const INITIAL_SCALE_FACTOR = Dimensions.get('screen').height / 90;
const DURATION = 600;

/** 启动遮罩最短展示时长:原来没有下限,原生启动页一收起就淡出,只看到"闪一下" */
const MIN_SHOW_MS = 1300;

/** 小人显示尺寸:按屏宽 66%(上限 300);动画 720×720,放大到 300 以内不会糊 */
const WALK_SIZE = Math.min(Math.round(Dimensions.get('screen').width * 0.66), 300);

/** 整组(小人 + 文字)的光学居中微调:小人视觉重量大,严格几何居中会显得偏下 */
const CONTENT_NUDGE_Y = -14;

/**
 * 启动遮罩:品牌蓝底 + 行走小人 + 加载中提示。
 *
 * 动画来自素材 webm,已转成 720×720 / 30fps / 96 帧循环,并且**已把角色合成在品牌蓝底上**
 * (不透明)—— WebP 动图的帧间混合会让透明区不擦除上一帧,出现"每帧叠加"的鬼影,
 * 合成成不透明就从根上避免了这个问题。文字与进度点由 Reanimated 驱动,不触发 React 重渲染。
 */
export function AnimatedSplashOverlay({ ready = true }: { ready?: boolean }) {
  const [minElapsed, setMinElapsed] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setMinElapsed(true), MIN_SHOW_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  /** 两个条件都满足才淡出:启动数据就绪 + 已展示够时间 */
  const canHide = ready && minElapsed;

  const splashKeyframe = new Keyframe({
    0: { transform: [{ scale: 1 }], opacity: 1 },
    20: { opacity: 1 },
    70: { opacity: 0, easing: Easing.elastic(0.7) },
    100: { opacity: 0, transform: [{ scale: 1 }], easing: Easing.elastic(0.7) },
  });

  const content = (
    <View style={styles.splashContent}>
      <Image
        style={styles.walk}
        source={require('@/assets/anim/walk-blue.webp')}
        contentFit="contain"
      />
      <View style={styles.loadingRow}>
        <Text style={styles.loadingText}>加载中</Text>
        <LoadingDots />
      </View>
    </View>
  );

  return canHide ? (
    <Animated.View
      entering={splashKeyframe.duration(DURATION).withCallback((finished) => {
        'worklet';
        if (finished) {
          scheduleOnRN(setVisible, false);
        }
      })}
      style={styles.splashOverlay}>
      {content}
    </Animated.View>
  ) : (
    <View
      onLayout={() => {
        void SplashScreen.hideAsync();
      }}
      style={styles.splashOverlay}>
      {content}
    </View>
  );
}

/**
 * "加载中"后面轮流亮起的三个点。
 * 用 Reanimated 而不是 setInterval + setState:不触发 React 重渲染,
 * 也不会在遮罩卸载后残留定时器。
 */
function LoadingDots() {
  return (
    <View style={styles.dotsRow}>
      <Dot delay={0} />
      <Dot delay={180} />
      <Dot delay={360} />
    </View>
  );
}

function Dot({ delay }: { delay: number }) {
  const opacity = useSharedValue(0.25);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 420, easing: Easing.inOut(Easing.ease) }), -1, true),
    );
  }, [delay, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View style={[styles.dot, animatedStyle]} />;
}

const keyframe = new Keyframe({
  0: { transform: [{ scale: INITIAL_SCALE_FACTOR }] },
  100: { transform: [{ scale: 1 }], easing: Easing.elastic(0.7) },
});

const logoKeyframe = new Keyframe({
  0: { transform: [{ scale: 1.3 }], opacity: 0 },
  40: { transform: [{ scale: 1.3 }], opacity: 0, easing: Easing.elastic(0.7) },
  100: { opacity: 1, transform: [{ scale: 1 }], easing: Easing.elastic(0.7) },
});

const glowKeyframe = new Keyframe({
  0: { transform: [{ rotateZ: '0deg' }] },
  100: { transform: [{ rotateZ: '7200deg' }] },
});

export function AnimatedIcon() {
  return (
    <View style={styles.iconContainer}>
      <Animated.View entering={glowKeyframe.duration(60 * 1000 * 4)} style={styles.glow}>
        <Image style={styles.glow} source={require('@/assets/images/logo-glow.png')} />
      </Animated.View>

      <Animated.View entering={keyframe.duration(DURATION)} style={styles.background} />
      <Animated.View style={styles.imageContainer} entering={logoKeyframe.duration(DURATION)}>
        <Image style={styles.image} source={require('@/assets/images/icon.png')} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  imageContainer: { justifyContent: 'center', alignItems: 'center' },
  glow: { width: 201, height: 201, position: 'absolute' },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 128,
    height: 128,
    zIndex: 100,
  },
  image: { width: 76, height: 71 },
  /** 行走小人(720×720,已合成品牌蓝底) */
  walk: { width: WALK_SIZE, height: WALK_SIZE },
  /** 小人 + 文字作为一整组,在屏幕正中垂直居中 */
  splashContent: { alignItems: 'center', transform: [{ translateY: CONTENT_NUDGE_Y }] },
  loadingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  loadingText: {
    color: '#ffffff',
    opacity: 0.92,
    fontSize: 15,
    letterSpacing: 1,
    fontWeight: '500',
  },
  dotsRow: { flexDirection: 'row', alignItems: 'center', marginLeft: 4, gap: 4 },
  dot: { width: 5, height: 5, borderRadius: 999, backgroundColor: '#ffffff' },
  background: {
    borderRadius: 40,
    experimental_backgroundImage: `linear-gradient(180deg, #3C9FFE, #0274DF)`,
    width: 128,
    height: 128,
    position: 'absolute',
  },
  splashOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#208AEF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
});