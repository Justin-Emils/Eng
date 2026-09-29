import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useContext, useEffect, useState } from 'react';
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
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** 启动遮罩最短展示时长:原来没有下限,原生启动页一收起就淡出,只看到"闪一下" */
const MIN_SHOW_MS = 1300;

/**
 * 舞台圆盘直径(角色动画的容器):按屏宽 68%(上限 280)。
 *
 * 为什么要用一个**圆形**容器装动画,而不是直接铺满:见下面 SPLASH_STAGE 的说明。
 */
const STAGE_SIZE = Math.min(Math.round(Dimensions.get('screen').width * 0.68), 280);

/**
 * 角色动画把角色合成在了**不透明的平坦底色**上,这个底色就是这里:
 *
 *   `assets/anim/walk-blue.webp` —— 720×720 / 96 帧,逐像素实测底角与中心区的众数色,
 *   得到 RGB(30,137,237)(编码时的意图值是品牌蓝 #208AEF,差 2/255,肉眼不可见)。
 *
 * 也就是说:**这个动画没有 alpha 通道**,画到哪都会带出一个实心色块。
 * 同目录下的 walk-white / walk-dark 经实测是**空白帧**(整帧最大色彩偏差 0–10,没有角色),
 * walk-alpha-lossless 的 alpha 实测全是 255(并没有真的透明),都不能用。
 * 目前没有 ffmpeg,无法把动画重新编码成带透明通道的版本。
 *
 * 所以这里的处理是**把它当成设计元素、而不是假装它是背景**:
 * 角色待在一个金线描边的圆形"舞台"里,底色 = 动画自身的底色,边缘由圆裁剪收干净。
 * 于是整屏的背景、幕布轨、标题、加载点全部来自主题,只有这一块是素材自带的蓝。
 *
 * 如果以后拿到带透明通道的动画,把 STAGE_SIZE 的裁剪去掉、容器底色换成
 * theme.background 即可,其余布局不用动。
 */
const SPLASH_STAGE = '#208AEF';

/**
 * 角色在动画帧里的位置(逐帧实测包围盒 x246–427 / y278–577,画布 720×720):
 * 它的视觉中心比画布中心**低约 9.4%**,直接摆进圆盘会明显偏下。
 * 这两个系数用来把它摆正,并让它占满圆盘的大部分(否则角色只有圆盘的 1/4 高,太小)。
 */
const STAGE_ZOOM = 1.55;
const STAGE_NUDGE_RATIO = 0.145;

/**
 * 启动遮罩。
 *
 * 配色全部取自当前主题(背景、幕布轨、标题、加载点),所以换主题时启动屏跟着变。
 *
 * ⚠️ 与它配套的**原生**启动屏(`app.json` 里 expo-splash-screen 的 backgroundColor)
 * 是构建期常量,**无法跟随运行时主题**,只能对齐到一套配色。那里对齐的是叙拉古主题
 * (羊皮纸 / 夜场),见 app.json 的注释。
 */
export function AnimatedSplashOverlay({ ready = true }: { ready?: boolean }) {
  const theme = useTheme();
  /**
   * 用 context 而不是 useSafeAreaInsets():后者在没有 SafeAreaProvider 时会**抛错**,
   * 而这个遮罩渲染在导航器**之外**(`_layout.tsx` 里是 `<Stack>` 的兄弟节点),
   * 是否处在 Provider 之内取决于 expo-router 的内部实现 —— 不能赌。
   * 读到就用,读不到退回 0(幕布轨贴到屏幕最上沿,也不难看)。
   */
  const insets = useContext(SafeAreaInsetsContext);
  const topInset = insets?.top ?? 0;
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
    <>
      {/* 幕布轨:状态栏下方一条强调色横带 + 金线,像剧院幕布上方的横梁 */}
      <View
        style={[
          styles.curtain,
          {
            top: topInset,
            backgroundColor: theme.accent,
            borderBottomColor: theme.gold,
          },
        ]}
      />

      <View style={styles.content}>
        {/* 舞台:圆裁剪 + 金线描边 + 动画自身底色 */}
        <View
          style={[
            styles.stage,
            {
              width: STAGE_SIZE,
              height: STAGE_SIZE,
              borderRadius: STAGE_SIZE / 2,
              borderColor: theme.gold,
              backgroundColor: SPLASH_STAGE,
            },
          ]}>
          {/* 外层只做位移、内层只做缩放:两件事分开,免得 transform 的组合顺序踩坑 */}
          <View style={{ transform: [{ translateY: -STAGE_NUDGE_RATIO * STAGE_SIZE }] }}>
            <Image
              style={{
                width: STAGE_SIZE,
                height: STAGE_SIZE,
                transform: [{ scale: STAGE_ZOOM }],
              }}
              source={require('@/assets/anim/walk-blue.webp')}
              contentFit="cover"
            />
          </View>
        </View>

        <ThemedText type="subtitle" style={styles.appName}>
          考研英语阅读
        </ThemedText>

        <View style={styles.loadingRow}>
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>加载中</Text>
          <LoadingDots color={theme.accent} />
        </View>
      </View>
    </>
  );

  return canHide ? (
    <Animated.View
      entering={splashKeyframe.duration(600).withCallback((finished) => {
        'worklet';
        if (finished) {
          scheduleOnRN(setVisible, false);
        }
      })}
      style={[styles.splashOverlay, { backgroundColor: theme.background }]}>
      {content}
    </Animated.View>
  ) : (
    <View
      onLayout={() => {
        void SplashScreen.hideAsync();
      }}
      style={[styles.splashOverlay, { backgroundColor: theme.background }]}>
      {content}
    </View>
  );
}

/**
 * "加载中"后面轮流亮起的三个点。
 * 用 Reanimated 而不是 setInterval + setState:不触发 React 重渲染,
 * 也不会在遮罩卸载后残留定时器。
 */
function LoadingDots({ color }: { color: string }) {
  return (
    <View style={styles.dotsRow}>
      <Dot delay={0} color={color} />
      <Dot delay={180} color={color} />
      <Dot delay={360} color={color} />
    </View>
  );
}

function Dot({ delay, color }: { delay: number; color: string }) {
  const opacity = useSharedValue(0.25);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 420, easing: Easing.inOut(Easing.ease) }), -1, true),
    );
  }, [delay, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View style={[styles.dot, { backgroundColor: color }, animatedStyle]} />;
}

const styles = StyleSheet.create({
  splashOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  /** 顶部的幕布轨:落在状态栏下方,通栏 */
  curtain: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 3,
    borderBottomWidth: 1,
  },
  /** 角色 + 文字作为一整组,在屏幕正中垂直居中 */
  content: { alignItems: 'center', gap: Spacing.one },
  stage: { overflow: 'hidden', borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  appName: { marginTop: Spacing.four },
  loadingRow: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.half },
  loadingText: {
    fontFamily: Fonts.sans,
    opacity: 0.92,
    fontSize: 12,
    letterSpacing: 2.4,
    fontWeight: '500',
  },
  dotsRow: { flexDirection: 'row', alignItems: 'center', marginLeft: 5, gap: 4 },
  dot: { width: 4, height: 4, borderRadius: 2 },
});
