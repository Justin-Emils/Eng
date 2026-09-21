import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

const INITIAL_SCALE_FACTOR = Dimensions.get('screen').height / 90;
const DURATION = 600;

/**
 * 启动遮罩最短展示时长。
 * 原来没有任何下限:原生启动页一收起就立刻淡出,用户只看到"闪一下"。
 * 现在至少展示这么久,保证小人能走出一段(动画总长 3.97 秒,循环播放)。
 * 但不无限等:只要不是"启动数据全都就绪",也会在这个时间后正常淡出。
 */
const MIN_SHOW_MS = 1300;

/**
 * 小人显示尺寸:按屏宽取 66%(上限 300)。
 * 原来写死 150 偏小;素材原生 1000x1000,动画导出为 720x720@30fps,
 * 放大到 300 以内不会糊。
 */
const WALK_SIZE = Math.min(Math.round(Dimensions.get('screen').width * 0.66), 300);

/**
 * 启动遮罩:品牌蓝底 + 行走小人动画。
 *
 * 用 expo-image 加载动图(WebP),项目已内置该依赖,不需要 video/lottie 之类的额外模块。
 * 动画来自素材里的 webm,已转成 480×480 / 48 帧 / 12fps 循环,并且**背景是透明的**
 * (黑底按亮度抠掉),所以这里只需要铺一层底色。
 * 动画已把角色合成在品牌蓝底上(不透明):WebP 动图的帧间混合会让透明区不擦除上一帧,若以后把底色改成白色,
 * 导致每帧叠加出鬼影;合成成不透明就绕开了这个问题,体积也更小。assets/anim 下另有透明版备用。
 */
export function AnimatedSplashOverlay({ ready = true }: { ready?: boolean }) {
  const [minElapsed, setMinElapsed] = useState(false);
  const [visible, setVisible] = useState(true);

  // 最短展示计时器:卸载时清掉
  useEffect(() => {
    const timer = setTimeout(() => setMinElapsed(true), MIN_SHOW_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  /** 两个条件都满足才淡出:启动数据就绪 + 已展示够时间 */
  const canHide = ready && minElapsed;

  const splashKeyframe = new Keyframe({
    0: {
      transform: [{ scale: 1 }],
      opacity: 1,
    },
    20: {
      opacity: 1,
    },
    70: {
      opacity: 0,
      easing: Easing.elastic(0.7),
    },
    100: {
      opacity: 0,
      transform: [{ scale: 1 }],
      easing: Easing.elastic(0.7),
    },
  });

  const content = (
    <Image
      style={styles.walk}
      source={require('@/assets/anim/walk-blue.webp')}
      contentFit="contain"
    />
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

const keyframe = new Keyframe({
  0: {
    transform: [{ scale: INITIAL_SCALE_FACTOR }],
  },
  100: {
    transform: [{ scale: 1 }],
    easing: Easing.elastic(0.7),
  },
});

const logoKeyframe = new Keyframe({
  0: {
    transform: [{ scale: 1.3 }],
    opacity: 0,
  },
  40: {
    transform: [{ scale: 1.3 }],
    opacity: 0,
    easing: Easing.elastic(0.7),
  },
  100: {
    opacity: 1,
    transform: [{ scale: 1 }],
    easing: Easing.elastic(0.7),
  },
});

const glowKeyframe = new Keyframe({
  0: {
    transform: [{ rotateZ: '0deg' }],
  },
  100: {
    transform: [{ rotateZ: '7200deg' }],
  },
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
  imageContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  glow: {
    width: 201,
    height: 201,
    position: 'absolute',
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 128,
    height: 128,
    zIndex: 100,
  },
  image: {
    width: 76,
    height: 71,
  },
  /** 行走小人 */
  walk: {
    width: WALK_SIZE,
    height: WALK_SIZE,
  },
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
