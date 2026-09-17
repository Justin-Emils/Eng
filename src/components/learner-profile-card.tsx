/**
 * 量化画像卡片(评估结果页与「我的」页共用)。
 *
 * 展示三件量化数据 + 两条派生结论:
 *   1. 词汇量点估计与置信区间(带区间可视化条);
 *   2. 分频段掌握曲线 —— 画像的"形状",比总量更有信息量;
 *   3. 由曲线派生的标签(优势 / 断层 / 说明);
 *   4. 由数据派生的行动建议(不是写死的文案)。
 * CEFR / 细分档位作为参考层显示在最后,不作为主判据。
 */

import { StyleSheet, View } from 'react-native';

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

function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

export function LearnerProfileCard({
  profile,
  /** 精简模式(评估结果页用):不显示参考档位与提示语 */
  compact = false,
}: {
  profile: LearnerProfile;
  compact?: boolean;
}) {
  const theme = useTheme();
  const scheme = useResolvedScheme();
  const traitColors = TRAIT_COLORS[scheme];

  // 区间条:点估计位置 + 区间宽度(百分比)
  const span = SCALE_MAX - SCALE_MIN;
  const lowPct = Math.max(0, ((profile.low - SCALE_MIN) / span) * 100);
  const highPct = Math.min(100, ((profile.high - SCALE_MIN) / span) * 100);
  const pointPct = Math.max(0, Math.min(100, ((profile.vocab - SCALE_MIN) / span) * 100));

  return (
    <View style={styles.wrap}>
      {/* 1. 词汇量 + 区间 */}
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="small" themeColor="textSecondary">
          估计词汇量
        </ThemedText>
        <View style={styles.vocabRow}>
          <ThemedText type="title" themeColor="accent" style={styles.vocab}>
            {profile.vocab}
          </ThemedText>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.unit}>
            词
          </ThemedText>
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          区间 {profile.low}–{profile.high} 词 · 可信度{profile.confidence}
          {profile.mode === 'fine' ? ' · 精细评估' : profile.mode === 'pick' ? ' · 自选档位' : ' · 快速评估'}
        </ThemedText>

        {/* 区间可视化:灰轨道 + 强调色区间段 + 点估计刻度 */}
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
        <View style={styles.scaleRow}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.scaleText}>
            300
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.scaleText}>
            12000
          </ThemedText>
        </View>
      </ThemedView>

      {/* 2. 分频段掌握曲线 */}
      {profile.bands.length > 0 ? (
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="smallBold">分频段掌握情况</ThemedText>
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
                      backgroundColor:
                        band.rate >= 0.8
                          ? theme.accent
                          : band.rate >= 0.5
                            ? theme.accent
                            : theme.textSecondary,
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
        </ThemedView>
      ) : null}

      {/* 3. 派生标签 */}
      {profile.traits.length > 0 ? (
        <ThemedView type="backgroundElement" style={styles.card}>
          {profile.traits.map((trait) => (
            <View key={trait.text} style={styles.traitRow}>
              <ThemedText
                type="small"
                style={[styles.traitMark, { color: traitColors[trait.kind] }]}>
                {trait.kind === 'strength' ? '✓' : trait.kind === 'gap' ? '!' : '·'}
              </ThemedText>
              <ThemedText type="small" style={styles.traitText}>
                {trait.text}
              </ThemedText>
            </View>
          ))}
        </ThemedView>
      ) : null}

      {/* 4. 参考层(旧体系) */}
      {!compact ? (
        <ThemedView type="background" style={[styles.refCard, { borderColor: theme.border }]}>
          <ThemedText type="small" themeColor="textSecondary">
            参考档位(仅作对照):{profile.bandLabel} · {profile.cefr}
          </ThemedText>
          <ThemedText type="small" themeColor="accent" style={styles.suggestion}>
            {profile.suggestion}
          </ThemedText>
        </ThemedView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two + 2 },
  card: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
  vocabRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.one + 2 },
  vocab: { fontSize: 44, lineHeight: 52 },
  unit: { paddingBottom: Spacing.one },
  track: {
    height: 10,
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: Spacing.one,
  },
  range: { position: 'absolute', top: 0, bottom: 0, borderRadius: 999 },
  point: { position: 'absolute', top: -3, width: 3, height: 16, borderRadius: 2 },
  scaleRow: { flexDirection: 'row', justifyContent: 'space-between' },
  scaleText: { fontSize: 11, lineHeight: 14 },

  bandRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  bandLabel: { width: 96, fontSize: 12, lineHeight: 16 },
  bandTrack: { flex: 1, height: 8, borderRadius: 999, overflow: 'hidden' },
  bandFill: { height: '100%', borderRadius: 999 },
  bandPct: { width: 40, textAlign: 'right', fontSize: 12 },
  bandCount: { width: 44, textAlign: 'right', fontSize: 11 },

  traitRow: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' },
  traitMark: { width: 12, fontWeight: '700' },
  traitText: { flex: 1, lineHeight: 19 },

  refCard: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.one + 2,
    borderWidth: StyleSheet.hairlineWidth,
  },
  suggestion: { lineHeight: 19 },
});
