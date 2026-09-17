/**
 * 量化画像卡片(评估结果页与「我的」页共用)—— **单块布局**。
 *
 * 之前的版本内部拆成 4 张卡(词汇量 / 曲线 / 标签 / 参考层),外面还挂着一张阅读统计卡,
 * 一屏下来 5 个方块,视觉上非常碎。现在合并为**一个功能区**,内部用细线分隔:
 *
 *   词汇量 + 区间条
 *   ─────────────
 *   分频段掌握曲线
 *   ─────────────
 *   派生标签 + 行动建议
 *   ─────────────
 *   阅读统计 / 常读话题 / 参考档位
 *   [开始评估 / 重新评估]  ← 评估入口放在这里,不再藏到别的区块
 */

import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import type { LearnerProfile } from '@/domain/profile';
import { useResolvedScheme, useTheme } from '@/hooks/use-theme';

/** 词汇量展示量程(与 wordlevel 的门槛刻度一致) */
const SCALE_MIN = 300;
const SCALE_MAX = 12000;

const TRAIT_COLORS = {
  light: { strength: '#1B5E20', gap: '#C62828', note: '#60646C' },
  dark: { strength: '#81C784', gap: '#FF8A80', note: '#B0B4BA' },
} as const;

/** 折叠进画像卡的阅读统计(不传则不显示这一段) */
export interface ReadingSummary {
  totalWordsRead: number;
  avgPerArticle: number | null;
  masteredCount: number;
  /** 已格式化的常读话题,如 "科技(4) · 社会(3)" */
  topics: string;
}

function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

export function LearnerProfileCard({
  profile,
  /** 阅读统计段(「我的」页传入;评估结果页不需要) */
  reading,
  /** 评估入口(不传则不显示按钮行,如评估结果页) */
  onAssess,
}: {
  profile: LearnerProfile;
  reading?: ReadingSummary;
  onAssess?: () => void;
}) {
  const theme = useTheme();
  const scheme = useResolvedScheme();
  const traitColors = TRAIT_COLORS[scheme];
  const divider = { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border };

  // 区间条:点估计位置 + 区间宽度(百分比)
  const span = SCALE_MAX - SCALE_MIN;
  const lowPct = Math.max(0, ((profile.low - SCALE_MIN) / span) * 100);
  const highPct = Math.min(100, ((profile.high - SCALE_MIN) / span) * 100);
  const pointPct = Math.max(0, Math.min(100, ((profile.vocab - SCALE_MIN) / span) * 100));

  const modeText =
    profile.mode === 'fine' ? '精细评估' : profile.mode === 'pick' ? '自选档位' : '快速评估';

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      {/* ── 词汇量 + 区间 ── */}
      <View style={styles.block}>
        <View style={styles.headerRow}>
          <ThemedText type="small" themeColor="textSecondary">
            估计词汇量
          </ThemedText>
          {onAssess ? (
            <Pressable onPress={onAssess} hitSlop={8} style={({ pressed }) => pressed && styles.pressed}>
              <ThemedText type="small" themeColor="accent">
                {/* 还没有曲线 → 引导去评估;已有曲线 → 重新评估 */}
                {profile.bands.length === 0 ? '去评估 ›' : '重新评估 ›'}
              </ThemedText>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.vocabRow}>
          <ThemedText type="title" themeColor="accent" style={styles.vocab}>
            {profile.vocab}
          </ThemedText>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.unit}>
            词
          </ThemedText>
          <View style={styles.refChip}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.refChipText}>
              参考 {profile.cefr}
            </ThemedText>
          </View>
        </View>

        <ThemedText type="small" themeColor="textSecondary">
          区间 {profile.low}–{profile.high} 词 · 可信度{profile.confidence} · {modeText}
        </ThemedText>

        {/* 区间可视化:灰轨道 + 区间段 + 点估计刻度 */}
        <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
          <View
            style={[
              styles.range,
              {
                backgroundColor: theme.accentSoft,
                left: `${lowPct}%`,
                width: `${Math.max(2, highPct - lowPct)}%`,
              },
            ]}
          />
          <View style={[styles.point, { backgroundColor: theme.accent, left: `${pointPct}%` }]} />
        </View>
      </View>

      {/* ── 分频段掌握曲线 ── */}
      {profile.bands.length > 0 ? (
        <View style={[styles.block, styles.blockTop, divider]}>
          <ThemedText type="smallBold">分频段掌握</ThemedText>
          {profile.bands.map((band) => (
            <View key={band.threshold} style={styles.bandRow}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.bandLabel}>
                {band.label}
              </ThemedText>
              <View style={[styles.bandTrack, { backgroundColor: theme.backgroundSelected }]}>
                <View
                  style={[
                    styles.bandFill,
                    {
                      width: `${Math.max(2, band.rate * 100)}%`,
                      backgroundColor: band.rate >= 0.5 ? theme.accent : theme.textSecondary,
                      opacity: band.rate >= 0.8 ? 1 : band.rate >= 0.5 ? 0.7 : 0.45,
                    },
                  ]}
                />
              </View>
              <ThemedText type="small" style={styles.bandPct}>
                {pct(band.rate)}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.bandCount}>
                {band.known}/{band.total}
              </ThemedText>
            </View>
          ))}
        </View>
      ) : null}

      {/* ── 派生标签 + 建议 ── */}
      {profile.traits.length > 0 || profile.suggestion ? (
        <View style={[styles.block, styles.blockTop, divider]}>
          {profile.traits.map((trait) => (
            <View key={trait.text} style={styles.traitRow}>
              <ThemedText type="small" style={[styles.traitMark, { color: traitColors[trait.kind] }]}>
                {trait.kind === 'strength' ? '✓' : trait.kind === 'gap' ? '!' : '·'}
              </ThemedText>
              <ThemedText type="small" style={styles.traitText}>
                {trait.text}
              </ThemedText>
            </View>
          ))}
          {profile.suggestion ? (
            <View style={styles.traitRow}>
              <ThemedText type="small" style={[styles.traitMark, { color: theme.accent }]}>
                👉
              </ThemedText>
              <ThemedText type="small" themeColor="accent" style={styles.traitText}>
                {profile.suggestion}
              </ThemedText>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* ── 阅读统计 / 话题 / 参考档位 ── */}
      {reading ? (
        <View style={[styles.block, styles.blockTop, divider, styles.footer]}>
          <ThemedText type="small" themeColor="textSecondary">
            累计阅读 {reading.totalWordsRead} 词
            {reading.avgPerArticle != null ? ` · 篇均 ${reading.avgPerArticle} 词` : ''}
            {' · '}已掌握 {reading.masteredCount} 词
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {reading.topics ? `常读话题:${reading.topics}` : '读完几篇后,这里会显示你偏好的话题'}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.bandRef}>
            参考档位:{profile.bandLabel}(仅作对照,推荐按预测理解率匹配)
          </ThemedText>
        </View>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Spacing.three, padding: Spacing.three },
  block: { gap: Spacing.two },
  /** 段与段之间的分隔(细线 + 上间距) */
  blockTop: { marginTop: Spacing.three, paddingTop: Spacing.three },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  vocabRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.one + 2 },
  vocab: { fontSize: 44, lineHeight: 52 },
  unit: { paddingBottom: Spacing.one },
  refChip: { marginLeft: Spacing.one },
  refChipText: { fontSize: 12 },
  track: { height: 10, borderRadius: 999, overflow: 'hidden', marginTop: Spacing.one },
  range: { position: 'absolute', top: 0, bottom: 0, borderRadius: 999 },
  point: { position: 'absolute', top: -3, width: 3, height: 16, borderRadius: 2 },

  bandRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  bandLabel: { width: 92, fontSize: 12, lineHeight: 16 },
  bandTrack: { flex: 1, height: 8, borderRadius: 999, overflow: 'hidden' },
  bandFill: { height: '100%', borderRadius: 999 },
  bandPct: { width: 38, textAlign: 'right', fontSize: 12 },
  bandCount: { width: 42, textAlign: 'right', fontSize: 11 },

  traitRow: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' },
  traitMark: { width: 16, fontWeight: '700' },
  traitText: { flex: 1, lineHeight: 19 },

  footer: { gap: Spacing.one + 2 },
  bandRef: { fontSize: 12, lineHeight: 16 },
  pressed: { opacity: 0.6 },
});
