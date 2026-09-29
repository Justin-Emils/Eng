import { StyleSheet, Text, type TextProps } from 'react-native';

import { ThemeColor } from '@/constants/theme';
import { FONT_SLOTS, serifForWeight, TYPE_STEPS, typeStyle, type TypeStepName } from '@/constants/typography';
import { useTheme, useThemeSkin } from '@/hooks/use-theme';

/**
 * 文本组件:字号层级来自 `constants/typography`,字形由主题的 `ThemeSkin` 决定。
 *
 * 两条分工:
 *   · **字号 / 字距 / 数字对齐** = App 层面的排版资产(`TYPE_STEPS`),与主题无关;
 *   · **衬线还是无衬线** = 主题资产(`skin.displayFont` / `skin.bodyFont`),
 *     因为"用不用衬线"正是两套主题的区别之一。
 *
 * 衬线走内嵌的 **Literata**(见 constants/fonts.ts),**按字重选独立族名**:
 * `@expo-google-fonts` 每个字重是独立 ttf,Android 不会按 `fontWeight` 挑文件,
 * 而是拿 400 合成假粗体(笔画发虚)。所以衬线分支统一用 `serifForWeight`,
 * 并把 `fontWeight` 归零;无衬线分支继续用系统字体 + 数值字重。
 *
 * 为什么保留 `default` 这个名字:它在全站用了上百处,语义是"普通正文"。
 * 改名会带来一次纯机械的全仓替换,收益为零、风险不小,所以留着。
 */
export type ThemedTextProps = TextProps & {
  type?:
    | 'default'
    | 'title'
    | 'subtitle'
    | 'heading'
    | 'small'
    | 'smallBold'
    | 'label'
    | 'caption'
    | 'numeric'
    | 'read'
    | 'link'
    | 'linkPrimary'
    | 'code';
  themeColor?: ThemeColor;
};

/**
 * 展示层文字:字号取某档层级,字形按主题的衬线/无衬线选择。
 * 衬线分支返回 `fontWeight: 'normal'`(字重已由族名表达),因此要放在 `typeStyle` 之后。
 */
function displayStyle(step: TypeStepName, serif: boolean) {
  return [
    typeStyle(step),
    serif ? serifForWeight(TYPE_STEPS[step].weight) : { fontFamily: FONT_SLOTS.label },
  ];
}

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  const skin = useThemeSkin();
  /** linkPrimary 默认用主题强调色 —— 以前这里写死了 #3c87f7,换主题时它不会跟着变 */
  const colorKey = themeColor ?? (type === 'linkPrimary' ? 'accent' : 'text');

  const serif = skin.displayFont === 'serif';
  const bodySerif = skin.bodyFont === 'serif';

  return (
    <Text
      style={[
        { color: theme[colorKey] },
        type === 'default' && typeStyle('body'),
        type === 'title' && displayStyle('display', serif),
        type === 'subtitle' && displayStyle('title', serif),
        type === 'heading' && displayStyle('heading', serif),
        type === 'small' && typeStyle('small'),
        type === 'smallBold' && typeStyle('smallBold'),
        // 铭牌式标签(全大写 + 大字距)与"就是加粗小字"两种形态,由主题挑
        type === 'label' && (skin.plateLabels ? typeStyle('label') : typeStyle('smallBold')),
        type === 'caption' && typeStyle('caption'),
        type === 'numeric' && displayStyle('numeric', serif),
        /**
         * 阅读正文。**字号来自排版层,行高倍数来自主题** ——
         * 衬线比无衬线需要更多呼吸,这是两套主题的差别之一,所以留给 skin。
         */
        type === 'read' && [
          typeStyle('reading'),
          bodySerif
            ? { fontFamily: FONT_SLOTS.reading, fontWeight: 'normal' as const }
            : { fontFamily: FONT_SLOTS.label },
          { lineHeight: Math.round(typeStyle('reading').fontSize * skin.bodyLineHeight) },
        ],
        (type === 'link' || type === 'linkPrimary') && typeStyle('small'),
        type === 'code' && styles.code,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  /** 音标、词性:等宽字体,字号沿用 caption 一档 */
  code: {
    fontFamily: FONT_SLOTS.mono,
    fontSize: 12,
    lineHeight: 17,
    letterSpacing: 0.2,
  },
});
