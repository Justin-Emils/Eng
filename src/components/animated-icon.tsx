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
 * 角色动画用 `assets/anim/walk-transparent.webp`:**带透明通道**,不挑底色。
 *
 * 它是怎么来的(以前这里写着"没有 ffmpeg、做不出透明版",那是不对的):
 *   1. 素材 `character.webm` 是「浅色角色 + 纯黑背景」的 AV1 视频,没有 alpha;
 *   2. ffmpeg(Anaconda 的 imageio_ffmpeg 里带了一个)逐帧导出 PNG,用**亮度作 alpha**:
 *      `alphamerge` 把灰度通道并成透明度 —— 黑底自然全透明,角色边缘保留抗锯齿;
 *   3. **不能用 ffmpeg 直接转 WebP**:动图 WebP 的帧间混合不会擦除上一帧的透明区,
 *      会出现"每一帧叠加"的鬼影(旧版 walk-white/walk-dark 就是这么坏的:
 *      实测内容像素从 14582 单调涨到 19060)。所以改用 Pillow 逐帧完整写入;
 *   4. Pillow 写动图时 `quality` 基本不起作用(实测 78→50 只差 200 KB,走的无损路径),
 *      而亮度渐变出来的软边极难无损压缩(2.8 MB)。把 alpha **二值化**后降到 881 KB。
 *
 * 尺寸:按所有帧的**并集包围盒**裁到 235×333(原 720×720 的 15% 像素)——
 * 走动时角色会左右摆,只按单帧裁会切到手脚。
 */
const WALK_ASPECT = 235 / 333;

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
        {/*
          舞台:圆裁剪 + 金线描边。底色取主题的 accentSoft(以前这里写死品牌蓝 ——
          因为那时动画自带宽底;现在动画是透明的,圆盘只是一个设计元素,自然跟着主题走)。
        */}
        <View
          style={[
            styles.stage,
            {
              width: STAGE_SIZE,
              height: STAGE_SIZE,
              borderRadius: STAGE_SIZE / 2,
              borderColor: theme.gold,
              backgroundColor: theme.accentSoft,
            },
          ]}>
          <Image
            style={{
              height: STAGE_SIZE * 0.82,
              width: STAGE_SIZE * 0.82 * WALK_ASPECT,
            }}
            source={require('@/assets/anim/walk-transparent.webp')}
            contentFit="contain"
          />
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
