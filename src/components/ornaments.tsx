/**
 * 主题纹样:幕布轨、金色四角星、蜡封印章、勋章。
 *
 * ⚠️ 这些形状来自**参考图实测**,不是推的。活动宣传页里反复出现的符号是
 * **四角星 ✦**（标题旁、页脚、火花）与爆炸星芒,不是早先我自己编的"旋转 45° 菱形"。
 * 详见 `docs/theme-siracusa.md` 第 15 节。
 *
 * 三个约束:
 *  1. **不引入 react-native-svg** —— 四角星用字体里的 `✦`(U+2726),其余是圆/方/线,
 *     普通 View 足够,也少一个原生依赖;
 *  2. **每个纹样在 `skin.motifs === false` 时渲染 null** —— 默认主题不该多出任何装饰,
 *     这是"切回默认主题要完全回到原样"的硬要求(见第 11.5 节);
 *  3. 尺寸都按传入的 size 等比算,同一个纹样要能用在 16px 的芯片里和 180px 的封面上。
 */

import { Image } from 'expo-image';
import { StyleSheet, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme, useThemeSkin } from '@/hooks/use-theme';

/**
 * 幕布轨:通栏的一条强调色横带 + 下方 1px 金线。
 * 用交替的深浅块做出"幕布褶皱"的感觉 —— 一共 16 个 View,开销可以忽略。
 *
 * 参考图里的幕布是插画中的红色丝绒、不是界面元件;这里保留它是因为"揭幕"这个动作
 * 对本 App 的叙事仍然成立,但**颜色跟主题走**。
 */
export function CurtainBand({ style }: { style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  const skin = useThemeSkin();
  if (!skin.motifs) return null;

  return (
    <View style={[styles.curtainWrap, { borderBottomColor: theme.gold }, style]}>
      <View style={styles.curtainStripes}>
        {Array.from({ length: 16 }, (_, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              backgroundColor: theme.accent,
              // 偶数格压暗一点,形成竖条褶皱
              opacity: i % 2 === 0 ? 1 : 0.62,
            }}
          />
        ))}
      </View>
    </View>
  );
}

/**
 * 金色四角星 ✦ —— 取代 emoji 与早先的菱形,是参考里最通用、出现频率最高的符号单位。
 *
 * **用生成的 PNG 素材,不是字体字形。** 早先用 `✦`(U+2726) 顶替过一阵,有两个问题:
 *   1. 依赖 ROM 的字体覆盖,缺字形就变成方框;
 *   2. 字形是正立的印刷符号，凹边弧度与参考里的星芒不同,而且**不能按主题染色**。
 * 现在的素材由 `scripts/gen-art.ps1` 用三次贝塞尔画出凹边星形,白色 + alpha,
 * 运行时用 `tintColor` 上色 —— 所以它能跟着主题的 `gold` 走。
 *
 * `size` 是**绘制盒子的边长**。调用点原来按字形尺寸传 5–7(字形自带大片内边距),
 * 换成绘制素材后要放大到 10–12 才等效,所以这里做一次换算并设下限。
 */
export function Star({
  size = 9,
  color,
  style,
}: {
  size?: number;
  color?: string;
  /** 注意类型是 ImageStyle(这是 expo-image 不是 View) */
  style?: StyleProp<ImageStyle>;
}) {
  const theme = useTheme();
  const skin = useThemeSkin();
  if (!skin.motifs) return null;

  const box = Math.max(10, Math.round(size * 1.6));

  return (
    <Image
      source={require('@/assets/art/star4.png')}
      style={[{ width: box, height: box }, style]}
      contentFit="contain"
      tintColor={color ?? theme.gold}
    />
  );
}

/**
 * 蜡封印章:金圈 + 强调衬底 + 中央符号。
 * 用在"连续打卡"和"已完成阅读"这类**有仪式感的完成态**上。
 */
export function Seal({
  size = 22,
  label,
  style,
}: {
  size?: number;
  /** 中央符号(如 ✓ 或天数) */
  label?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const skin = useThemeSkin();
  if (!skin.motifs) return null;

  return (
    <View
      style={[
        styles.seal,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: theme.gold,
          backgroundColor: theme.accentSoft,
        },
        style,
      ]}>
      {label ? (
        <ThemedText
          themeColor="accent"
          style={{ fontSize: Math.round(size * 0.5), lineHeight: Math.round(size * 0.62) }}>
          {label}
        </ThemedText>
      ) : null}
    </View>
  );
}

/**
 * 勋章:金圈（含一圈内环）+ 中央四角星，给空状态这类"没有具体图标"的位置用。
 * 不试图还原原来那个 emoji 的含义 —— 含义由旁边的标题与说明文字承担。
 */
export function Medallion({ size = 56, style }: { size?: number; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  const skin = useThemeSkin();
  if (!skin.motifs) return null;

  const inner = Math.max(7, Math.round(size * 0.34));

  return (
    <View
      style={[
        styles.medallion,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: theme.gold,
        },
        style,
      ]}>
      <View
        style={{
          position: 'absolute',
          top: 2,
          left: 2,
          right: 2,
          bottom: 2,
          borderRadius: size / 2,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.gold,
          opacity: 0.5,
        }}
      />
      <Star size={inner} />
    </View>
  );
}

const styles = StyleSheet.create({
  curtainWrap: {
    height: 3,
    borderBottomWidth: 1,
    overflow: 'hidden',
  },
  curtainStripes: {
    flexDirection: 'row',
    height: 3,
  },
  seal: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  medallion: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
