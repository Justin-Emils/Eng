import { StyleSheet, View, type ViewProps } from 'react-native';

import { ThemeColor } from '@/constants/theme';
import { useTheme, useThemeSkin } from '@/hooks/use-theme';

/** 表面的几何角色 —— 具体圆角由主题的 ThemeSkin 决定,调用方只说"这是什么表面" */
export type SurfaceRadius = 'card' | 'panel' | 'chip' | 'none';

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
  type?: ThemeColor;
  /**
   * 表面形态。
   * - `plain`:只有底色(默认)
   * - `playbill`:声明"这是一个卡片表面"。**是否真的画成节目单式的
   *   描边 + 对角金刻线,由主题的 skin.cardFrame 决定** ——
   *   默认主题下它就是一块普通卡片(原样),叙拉古下才是金线刻框。
   */
  frame?: 'plain' | 'playbill';
  /**
   * 圆角角色,**默认 `'card'`**。
   * 主题圆角会被应用在样式数组的**最后一位**,所以写在组件局部 style 里的
   * borderRadius 会被覆盖 —— 圆角的唯一事实来源是主题。
   */
  radius?: SurfaceRadius;
};

/** 角刻线的长度 */
const TICK = 9;

export function ThemedView({
  style,
  lightColor,
  darkColor,
  type,
  frame = 'plain',
  radius = 'card',
  children,
  ...otherProps
}: ThemedViewProps) {
  const theme = useTheme();
  const skin = useThemeSkin();

  /** 只有主题启用了卡框、且调用方声明了这是卡片,才画描边与金刻线 */
  const isPlaybill = frame === 'playbill' && skin.cardFrame;
  const radiusValue =
    radius === 'none'
      ? undefined
      : radius === 'card'
        ? skin.radiusCard
        : radius === 'panel'
          ? skin.radiusPanel
          : skin.radiusChip;

  return (
    <View
      style={[
        { backgroundColor: theme[type ?? 'background'] },
        isPlaybill && { borderWidth: 1, borderColor: theme.border },
        style,
        // 放最后:主题的圆角说了算
        radiusValue === undefined ? null : { borderRadius: radiusValue },
      ]}
      {...otherProps}>
      {children}
      {isPlaybill ? (
        <>
          {/*
            四角金色 L 括号。
            起初我只放了对角两点,理由是"四角都放会太吵" —— 那是**我自己编的**。
            看了活动页之后改成四角:参考里的道具格、面板框都是**四角括号**
            (深藏青方块 + 四角金色 L 形),这是它界面的基本框法。
            括号刻意向内留 1px,和边框错开,才有"括号"而不是"加粗的角"。
          */}
          <View pointerEvents="none" style={[styles.tick, styles.tickTL, { borderColor: theme.gold }]} />
          <View pointerEvents="none" style={[styles.tick, styles.tickTR, { borderColor: theme.gold }]} />
          <View pointerEvents="none" style={[styles.tick, styles.tickBL, { borderColor: theme.gold }]} />
          <View pointerEvents="none" style={[styles.tick, styles.tickBR, { borderColor: theme.gold }]} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tick: {
    position: 'absolute',
    width: TICK,
    height: TICK,
    borderColor: 'transparent',
  },
  tickTL: { top: 1, left: 1, borderTopWidth: 1, borderLeftWidth: 1 },
  tickTR: { top: 1, right: 1, borderTopWidth: 1, borderRightWidth: 1 },
  tickBL: { bottom: 1, left: 1, borderBottomWidth: 1, borderLeftWidth: 1 },
  tickBR: { bottom: 1, right: 1, borderBottomWidth: 1, borderRightWidth: 1 },
});
