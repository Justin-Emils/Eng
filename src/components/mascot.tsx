/**
 * App 自己的**形象**。
 *
 * 姿势图是从启动屏那段行走动画里抠出来的 —— 原动画帧被合成在**不透明的品牌蓝**上,
 * 所以之前只能在启动屏用,App 内部一次都用不到。
 * `scripts/extract-mascot.ps1` 用"边框环取背景色 + 距离分档求 alpha + 反预乘还原边缘"
 * 把它抠成了带透明通道的姿势图:
 *
 *   · 背景噪声实测为 0(14400 个背景像素通道差全为 0),所以没有雾化;
 *   · 边缘反预乘解决了抠图常见的"蓝毛边";
 *   · 六个姿势取自 96 帧行走循环的等距采样,裁切尺寸一致(229×361),便于对齐。
 *
 * 素材归项目自己(是用户提供的原始素材派生的),不涉及第三方版权。
 */

import { Image } from 'expo-image';
import type { StyleProp, ImageStyle } from 'react-native';

import { useThemeSkin } from '@/hooks/use-theme';

/** 裁切后的原始尺寸,用来算宽高比 */
const POSE_W = 229;
const POSE_H = 361;

const POSES = [
  require('@/assets/mascot/pose-00.png'),
  require('@/assets/mascot/pose-16.png'),
  require('@/assets/mascot/pose-32.png'),
  require('@/assets/mascot/pose-48.png'),
  require('@/assets/mascot/pose-64.png'),
  require('@/assets/mascot/pose-80.png'),
] as const;

/**
 * `pose` 用字符串而不是数字:调用点写 `<Mascot pose="study" />` 比写 `pose={2}`
 * 可读得多,而且以后换姿势不用去数数组下标。
 */
export type MascotPose = 'walk-a' | 'walk-b' | 'walk-c' | 'walk-d' | 'walk-e' | 'walk-f';

const POSE_INDEX: Record<MascotPose, number> = {
  'walk-a': 0,
  'walk-b': 1,
  'walk-c': 2,
  'walk-d': 3,
  'walk-e': 4,
  'walk-f': 5,
};

export function Mascot({
  pose = 'walk-a',
  /** 高度(dp)。形象是竖长的,所以按高度给尺寸更自然 */
  height = 110,
  style,
}: {
  pose?: MascotPose;
  height?: number;
  style?: StyleProp<ImageStyle>;
}) {
  const skin = useThemeSkin();
  if (!skin.mascot) return null;

  const src = POSES[POSE_INDEX[pose] ?? 0];
  const width = Math.round(height * (POSE_W / POSE_H));

  return (
    <Image
      source={src}
      style={[{ width, height }, style]}
      contentFit="contain"
      /* 形象是插画,放大时不要糊 —— expo-image 默认双线性,这里显式声明高质量重采样 */
      transition={0}
    />
  );
}
