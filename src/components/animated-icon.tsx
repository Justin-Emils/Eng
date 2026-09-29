import * as SplashScreen from 'expo-splash-screen';
import { useContext, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
 * 启动遮罩。
 *
 * 配色全部取自当前主题(背景、幕布轨、标题、加载点),所以换主题时启动屏跟着变。
 *
 * 角色行走动画已按反馈**移除**。原因:素材 `character.webm` 是「浅色角色 + 纯黑背景」,
 * 而且**没有 alpha 通道、没有色键信息**,只能靠抠底;一共调了七版
 * (v1 亮度作 alpha → v6 OpenCV 连通域 → v7 补"被包围的纯黑" + 高斯软边),
 * 仍反复出现瑕疵(角色深色部位被抠、后脑残留黑斑、边缘锯齿),先不折腾。
 *
 * 素材与工具都留在仓库里,想恢复时不必重做:
 *   · `assets/anim/walk-transparent.webp` —— 最新版(v7,218×317,96 帧,1021 KB);
 *   · `scripts/gen-walk-mask6.py` / `gen-walk-mask7.py` —— 抠底脚本;
 *   · `scripts/anim-alpha-check.py` —— 诊断工具(把透明区染成洋红,肉眼可查)。
 * 恢复方法:在 styles.content 里放一个 `Image` 指向该文件即可。
 * 注意:它当前**没有被 require**,所以不会打进包(APK 因此约省 1 MB)。
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
        {/* 角色行走动画已移除(原因与恢复方式见组件头注释) */}

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
