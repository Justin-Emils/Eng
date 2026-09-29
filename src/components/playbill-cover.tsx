/**
 * 程序化"节目单"封面(纯渲染,零网络、零素材)。
 *
 * 为什么要有它:`article-cover.tsx` 原来最后一级回退是"渐变 + 话题 emoji",
 * 前三级是 Wikimedia / picsum / Unsplash 的**随机真实照片** —— 每次网络不同、
 * 与文章内容无关、还要处理超时与"墙"。那是"素材拼凑感"最大的来源。
 *
 * 外观规格由 `domain/cover-art.ts` 按 id 确定性生成(色相锚点 × 布局 × 徽记 × 抖动),
 * 这个文件只负责把它画出来。全部由普通 `View` 拼成,**不引入 react-native-svg**:
 * 形状都是圆/方/线,View 足够,也少一个原生依赖。
 *
 * 刻意不用渐变(`experimental_backgroundImage` 在部分平台不生效,
 * 而封面是最不该出岔子的地方),层次靠色块叠加做。
 */

import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { coverArtFor, type CoverFrame, type CoverLayout, type CoverMark } from '@/domain/cover-art';
import type { Article } from '@/types';

export type CoverSize = 'thumb' | 'banner' | 'hero';

/** 已经提醒过的"封面被压窄"组合,避免列表里刷屏 */
const warnedWidth = new Set<string>();

/** 各尺寸下的元素缩放 */
const METRICS: Record<CoverSize, { pad: number; mark: number; tick: number; label: number }> = {
  // label = 题签字号;0 表示这个尺寸不显示题签(缩略图上会糊成一团)
  thumb: { pad: 6, mark: 20, tick: 6, label: 0 },
  banner: { pad: 8, mark: 26, tick: 7, label: 9 },
  hero: { pad: 14, mark: 52, tick: 12, label: 10 },
};

export function PlaybillCover({
  article,
  size = 'banner',
  style,
}: {
  article: Article;
  size?: CoverSize;
  style?: StyleProp<ViewStyle>;
}) {
  const spec = coverArtFor(article.id);
  const m = METRICS[size];
  const label = article.topicTags[0] ?? '';
  const j = spec.jitter;

  /**
   * 开发期护栏:封面里只有徽记有固有宽度,一旦被放进**行布局**又没给宽度,
   * 布局不会报错,只会静默塌成"徽记那么宽"(6–20px)的窄条 —— 这个坑踩过一次。
   * 只提醒一次、不参与渲染,生产包里被 `__DEV__` 短路掉。
   */
  const handleLayout = __DEV__
    ? (e: LayoutChangeEvent) => {
        const w = Math.round(e.nativeEvent.layout.width);
        const key = `${article.id}|${size}`;
        if (w > 0 && w < 24 && !warnedWidth.has(key)) {
          warnedWidth.add(key);
          console.warn(
            `[ArticleCover] ${size} 封面宽度只有 ${w}px —— 行布局的父容器必须自己包一层固定宽度的 View(见 recommend-card.tsx 的 cover)。`,
          );
        }
      }
    : undefined;

  return (
    <View style={[styles.wrap, { backgroundColor: spec.base }, style]} onLayout={handleLayout}>
      <Layout spec={spec} layout={spec.layout} m={m} j={j} />

      {/* 边框:三种画法,和布局/徽记正交组合,进一步拉开封面之间的差异 */}
      <Frame spec={spec} frame={spec.frame} pad={m.pad} tick={m.tick} />

      <Mark mark={spec.mark} size={m.mark} color={spec.ink} />

      {/* 题签:话题。thumb 不显示 */}
      {m.label > 0 && label ? (
        <View style={[styles.labelWrap, { left: m.pad + 7, bottom: m.pad + 7 }]}>
          <View style={[styles.labelDot, { backgroundColor: spec.ink }]} />
          <ThemedText style={[styles.labelText, { color: spec.ink, fontSize: m.label }]}>
            {label}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

/** 背景布局:四种模板,靠不同的色块排布拉开差异 */
function Layout({
  spec,
  layout,
  m,
  j,
}: {
  spec: ReturnType<typeof coverArtFor>;
  layout: CoverLayout;
  m: (typeof METRICS)[CoverSize];
  j: number;
}) {
  const big = m.mark * (3.0 + j * 1.6);
  const small = m.mark * (1.8 + j * 0.8);

  if (layout === 0) {
    // 右上大圆 + 左下小圆
    return (
      <>
        <View
          style={[
            styles.abs,
            {
              backgroundColor: spec.block,
              width: big,
              height: big,
              borderRadius: big / 2,
              right: -big * 0.28,
              top: -big * (0.26 + j * 0.18),
            },
          ]}
        />
        <View
          style={[
            styles.abs,
            {
              backgroundColor: spec.blockSoft,
              width: small,
              height: small,
              borderRadius: small / 2,
              left: -small * 0.38,
              bottom: -small * (0.32 + j * 0.2),
            },
          ]}
        />
      </>
    );
  }

  if (layout === 1) {
    // 左侧竖向色带 + 右下圆弧
    return (
      <>
        <View
          style={[
            styles.abs,
            {
              backgroundColor: spec.block,
              width: `${22 + Math.round(j * 10)}%`,
              top: 0,
              bottom: 0,
              left: 0,
            },
          ]}
        />
        <View
          style={[
            styles.abs,
            {
              backgroundColor: spec.blockSoft,
              width: big,
              height: big,
              borderRadius: big / 2,
              right: -big * 0.42,
              bottom: -big * (0.3 + j * 0.2),
            },
          ]}
        />
      </>
    );
  }

  if (layout === 2) {
    // 底部横向色带 + 右上圆
    return (
      <>
        <View
          style={[
            styles.abs,
            {
              backgroundColor: spec.blockSoft,
              height: `${30 + Math.round(j * 12)}%`,
              left: 0,
              right: 0,
              bottom: 0,
            },
          ]}
        />
        <View
          style={[
            styles.abs,
            {
              backgroundColor: spec.block,
              width: big,
              height: big,
              borderRadius: big / 2,
              right: -big * (0.3 + j * 0.16),
              top: -big * 0.36,
            },
          ]}
        />
      </>
    );
  }

  // layout 3:对角 —— 一个大圆压住右上,一条横向色带贯穿中部
  return (
    <>
      <View
        style={[
          styles.abs,
          {
            backgroundColor: spec.block,
            width: big * 1.25,
            height: big * 1.25,
            borderRadius: big * 0.625,
            right: -big * 0.5,
            top: -big * 0.62,
          },
        ]}
      />
      <View
        style={[
          styles.abs,
          {
            backgroundColor: spec.blockSoft,
            height: m.mark * (0.5 + j * 0.5),
            left: 0,
            right: '38%',
            top: `${38 + Math.round(j * 18)}%`,
          },
        ]}
      />
    </>
  );
}

/** 边框:0 内框+对角刻线 · 1 只有对角刻线 · 2 双线内框 */
function Frame({
  spec,
  frame,
  pad,
  tick,
}: {
  spec: ReturnType<typeof coverArtFor>;
  frame: CoverFrame;
  pad: number;
  tick: number;
}) {
  const ticks = (
    <>
      <View style={[styles.tick, styles.tickTL, { borderColor: spec.ink, width: tick, height: tick }]} />
      <View style={[styles.tick, styles.tickBR, { borderColor: spec.ink, width: tick, height: tick }]} />
    </>
  );

  if (frame === 1) {
    // 只有对角刻线:最轻的一种
    return (
      <View style={[styles.frameLayer, { top: pad, left: pad, right: pad, bottom: pad }]}>{ticks}</View>
    );
  }

  if (frame === 2) {
    // 双线:外框 + 内缩 4px 的细框
    return (
      <>
        <View
          style={[
            styles.frame,
            { top: pad, left: pad, right: pad, bottom: pad, borderColor: spec.ink },
          ]}
        />
        <View
          style={[
            styles.frame,
            {
              top: pad + 4,
              left: pad + 4,
              right: pad + 4,
              bottom: pad + 4,
              borderColor: spec.ink,
              opacity: 0.35,
            },
          ]}
        />
        {ticks}
      </>
    );
  }

  // 0:内框 + 对角刻线(最规整)
  return (
    <>
      <View
        style={[styles.frame, { top: pad, left: pad, right: pad, bottom: pad, borderColor: spec.ink }]}
      />
      {ticks}
    </>
  );
}

/** 中央徽记:四种简单几何记号,和布局正交组合 */
function Mark({ mark, size, color }: { mark: CoverMark; size: number; color: string }) {
  if (mark === 'diamond') {
    return (
      <View
        style={{
          width: size * 0.3,
          height: size * 0.3,
          backgroundColor: color,
          transform: [{ rotate: '45deg' }],
        }}
      />
    );
  }

  if (mark === 'ring') {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 1,
          borderColor: color,
        }}
      />
    );
  }

  if (mark === 'bars') {
    return (
      <View style={{ gap: size * 0.16, alignItems: 'center' }}>
        {[1, 0.66, 0.34].map((w) => (
          <View
            key={w}
            style={{ width: size * w, height: StyleSheet.hairlineWidth + 1, backgroundColor: color }}
          />
        ))}
      </View>
    );
  }

  // cross
  return (
    <View style={{ width: size * 0.5, height: size * 0.5, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          position: 'absolute',
          width: size * 0.5,
          height: StyleSheet.hairlineWidth + 1,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: StyleSheet.hairlineWidth + 1,
          height: size * 0.5,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  /**
   * 注意:**不要加 `flex: 1`**。
   * 高度由调用方通过 `style` 传进来(frame 的 80/88/180),而 RN 的 `flex` 简写
   * 会展开成 `flexBasis: 0%` —— 主轴尺寸一旦由 basis 决定,显式的 height 就被忽略,
   * 在一列自动高度的父容器里 flexGrow 也没东西可分,封面会直接塌成 0 高。
   * 宽度靠父容器 alignItems 默认 stretch 撑开(与原来 article-cover 的 wrap 一致)。
   */
  wrap: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  abs: { position: 'absolute' },
  /** 只画刻线时的定位层:本身不画边框 */
  frameLayer: { position: 'absolute' },
  frame: { position: 'absolute', borderWidth: StyleSheet.hairlineWidth, opacity: 0.7 },
  tick: { position: 'absolute', opacity: 0.9 },
  tickTL: { top: -1, left: -1, borderTopWidth: 1, borderLeftWidth: 1 },
  tickBR: { bottom: -1, right: -1, borderBottomWidth: 1, borderRightWidth: 1 },
  labelWrap: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 6 },
  labelDot: { width: 4, height: 4, transform: [{ rotate: '45deg' }] },
  /** 题签:大字距 + 全大写,像节目单上印的一行小字(中文靠字距撑开) */
  labelText: { letterSpacing: 2.6, textTransform: 'uppercase', fontWeight: '600' },
});
