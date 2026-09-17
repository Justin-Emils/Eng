/**
 * 量化用户画像(模块 B 升级)。
 *
 * 要解决的问题:以前用户水平被压成"B1+ 中级上"这样一个档位标签,推荐也按"档差 ±1"匹配。
 * 档位宽 400–1200 词,于是"用户 4790 / 文章 4810"(差 20 词)和
 * "用户 4800 / 文章 5790"(差 990 词)会被判成同一个"略有挑战"。
 *
 * 现在改成连续量三件套:
 *   1. **词汇量点估计 v**(连续值,来自自适应评估的档内插值);
 *   2. **置信区间 ±m**(由作答数、正确率与评估模式算出的启发式区间 —— 见 estimateMargin);
 *   3. **分频段掌握曲线**(每档的作答正确率),它才是画像的形状来源:
 *      "高频扎实但 5500+ 断层"和"整体均匀"是两种完全不同的人,词汇量可能一样。
 *
 * CEFR / 细分档位仍然保留,但降级为**参考层**:展示时给人一个熟悉的锚点,
 * 匹配时只作为兜底排序,不再作为主判据。
 */

import { difficultyOf, thresholdOfWord } from '@/domain/difficulty';
import { defaultCurve, expectedCoverage, type KnowledgeCurve } from '@/domain/knowledge';
import { bandLabelOf, cefrToVocab, vocabToCefr } from '@/domain/levels';
import { VOCAB_BANDS, bandLabel } from '@/domain/wordlevel';
import { extractWords } from '@/domain/wordmark';
import type { Article, CefrLevel, UserLevel } from '@/types';

/** 学习区:目标预测理解率(生词率 4%–7%)。与 recommend.ts 的目标区间保持一致 */
export const LEARNING_ZONE = { min: 0.93, max: 0.96 } as const;

/** 舒适阅读门槛:预测理解率 ≥ 这个值才算"读着顺手" */
export const COMFORT_COVERAGE = 0.96;

/** 一档掌握率的展示粒度 */
export interface BandMastery {
  threshold: number;
  /** 档位文案,如 '考研/六级水平' */
  label: string;
  known: number;
  total: number;
  /** 0–1 */
  rate: number;
}

export type TraitKind = 'strength' | 'gap' | 'note';

export interface ProfileTrait {
  kind: TraitKind;
  text: string;
}

export interface LearnerProfile {
  /** 词汇量点估计(连续值,主刻度) */
  vocab: number;
  /** 置信区间半宽 */
  margin: number;
  low: number;
  high: number;
  /** 由作答量决定的可信程度 */
  confidence: '低' | '中' | '高';
  /** 总作答词数 */
  answers: number;
  /** 作答正确率(0–1) */
  accuracy: number;
  /** 评估来源:快速 / 精细 / 自选档位 */
  mode: 'quick' | 'fine' | 'pick';
  /** —— 以下为参考层(旧体系,保留但不作主判据) —— */
  cefr: CefrLevel;
  bandLabel: string;
  /** 分频段掌握曲线(按阈值升序;没有评估明细时为空) */
  bands: BandMastery[];
  /** 由曲线与行为派生的标签 */
  traits: ProfileTrait[];
  /** 由数据派生的一句行动建议 */
  suggestion: string;
}

const STEP_FALLBACK = 1100;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** 相邻档阈值的平均间距(评估的"刻度分辨率"),用作误差模型里的尺度单位 */
function averageStep(rounds: { threshold: number }[]): number {
  const sorted = [...new Set(rounds.map((r) => r.threshold))].sort((a, b) => a - b);
  if (sorted.length < 2) return 0;
  let sum = 0;
  for (let i = 1; i < sorted.length; i += 1) sum += sorted[i] - sorted[i - 1];
  return sum / (sorted.length - 1);
}

/**
 * 置信区间半宽(启发式,不是统计保证 —— 常数经过标定,宁宽勿窄)。
 *
 * 两部分相加:
 *  1. **采样误差**:把正确率的标准误换算到词汇量尺度(vocab 是档内按比例插值出来的,
 *     所以 dvocab/dratio ≈ 2 × 档宽);
 *  2. **模型误差**:这套标尺本身的粗糙度 —— 档位游走、词表覆盖不全、自评"认识"的
 *     主观性。按评估模式取固定比例(快评 12%、精细 7%),它是区间的主体,
 *     这也符合事实:再多答几道题也消不掉标尺本身的不确定。
 */
export function estimateMargin(input: {
  vocab: number;
  answers: number;
  accuracy: number;
  mode: 'quick' | 'fine' | 'pick';
  rounds: { threshold: number }[];
}): number {
  const p = clamp(input.accuracy, 0.05, 0.95);
  const n = Math.max(input.answers, 1);
  const standardError = Math.sqrt((p * (1 - p)) / n);
  const step = averageStep(input.rounds) || STEP_FALLBACK;
  const sampling = 2 * step * standardError;
  const modelRatio = input.mode === 'fine' ? 0.07 : input.mode === 'pick' ? 0.15 : 0.12;
  const model = input.vocab * modelRatio;
  return clamp(Math.round(Math.sqrt(sampling * sampling + model * model)), 200, 1500);
}

/** 由作答明细生成分频段曲线 */
export function bandsFromRounds(rounds: UserLevel['rounds']): BandMastery[] {
  if (!rounds || rounds.length === 0) return [];
  // 同一档可能答了多轮(精细评估的确认轮),合并后再算掌握率
  const merged = new Map<number, { known: number; total: number }>();
  for (const r of rounds) {
    const prev = merged.get(r.threshold) ?? { known: 0, total: 0 };
    merged.set(r.threshold, { known: prev.known + r.known, total: prev.total + r.total });
  }
  return [...merged.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([threshold, agg]) => ({
      threshold,
      label: bandLabel(threshold),
      known: agg.known,
      total: agg.total,
      rate: agg.total > 0 ? agg.known / agg.total : 0,
    }));
}

function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

/** 由曲线形状 + 作答情况派生标签与建议 */
function deriveTraits(
  bands: BandMastery[],
  accuracy: number,
  answers: number,
): { traits: ProfileTrait[]; suggestion: string; gapThreshold: number | null } {
  const traits: ProfileTrait[] = [];

  if (bands.length === 0) {
    traits.push({ kind: 'note', text: '还没有评估明细,做一次评估即可生成词汇曲线' });
    return {
      traits,
      suggestion: '做一次评估(约 1 分钟),推荐会按你的实际词汇量精确匹配',
      gapThreshold: null,
    };
  }

  const easiest = bands[0];
  const hardest = bands[bands.length - 1];
  const strongest = bands.reduce((a, b) => (b.rate > a.rate ? b : a));
  const weakest = bands.reduce((a, b) => (b.rate < a.rate ? b : a));

  // 断层:低档已经稳(≥80%),但更高档掉到 50% 以下 —— 典型的"上不去"瓶颈
  let gapBand: BandMastery | null = null;
  for (const band of bands) {
    const below = bands.find((b) => b.threshold < band.threshold && b.rate >= 0.8);
    if (below && band.rate < 0.5 && (!gapBand || band.rate < gapBand.rate)) gapBand = band;
  }

  if (gapBand) {
    const below = bands.find((b) => b.threshold < gapBand.threshold && b.rate >= 0.8)!;
    traits.push({
      kind: 'gap',
      text: `${gapBand.label}有断层:掌握 ${pct(gapBand.rate)},而${below.label}已到 ${pct(below.rate)}`,
    });
  } else if (hardest.rate >= 0.8 && bands.length >= 3) {
    traits.push({ kind: 'strength', text: `最高测试档(${hardest.label})也掌握了 ${pct(hardest.rate)}` });
  }

  if (bands.length >= 3 && bands.every((b) => b.rate >= 0.7)) {
    traits.push({ kind: 'strength', text: '各频段掌握均匀,没有明显短板' });
  }

  const spread = strongest.rate - weakest.rate;
  if (spread >= 0.35 && !gapBand) {
    traits.push({
      kind: 'note',
      text: `档间差异较大:${strongest.label} ${pct(strongest.rate)} vs ${weakest.label} ${pct(weakest.rate)}`,
    });
  }

  if (answers > 0 && answers < 15) {
    traits.push({ kind: 'note', text: `只答了 ${answers} 个词,区间较宽;精细评估可收窄` });
  }

  // 建议:优先指向断层档
  let suggestion: string;
  if (gapBand) {
    suggestion = `优先补 ${gapBand.label} 那一档的词 —— 这是目前最值得投入的区间`;
  } else if (accuracy >= 0.75) {
    suggestion = `基础较稳(总体正确率 ${pct(accuracy)}),可以多读略高于当前水平的文章`;
  } else if (accuracy <= 0.45) {
    suggestion = `总体正确率 ${pct(accuracy)},建议先把生词本的复习做完再增加新文章`;
  } else {
    suggestion = `保持当前节奏:每天新词 + 复习搭配,两周后重测会看到区间收窄`;
  }

  void easiest;
  return { traits, suggestion, gapThreshold: gapBand ? gapBand.threshold : null };
}

/**
 * 行为数据(来自本机学习记录)。缺省时画像只输出词汇维度。
 * 放成可选参数而不是从 storage 直接读:profile 只做纯计算,读数据留在调用方。
 */
export interface BehaviorInput {
  streakDays: number;
  wordCount: number;
  masteredCount: number;
  totalArticlesCompleted: number;
  totalWordsRead: number;
}

/**
 * 某一档词在**真实语料**上的投入产出比 —— 用来回答"补哪一档最划算"。
 *
 * 为什么需要它:"缺口大就优先补"这个口径是错的。低档词通常更高频、
 * 在文章里反复出现,学 1 个词能立刻在阅读中兑现,而且复现多更容易巩固;
 * 高档词往往一个词只出现一两次,学起来贵得多。所以真正的判据是
 * **每学 1 个词能多认识多少比例的文本**(gainPerWord),而不是缺口大小。
 */
export interface BandRoi {
  threshold: number;
  label: string;
  /** 该档在语料里出现过的去重词数(只统计有门槛数据的词) */
  uniqueWords: number;
  /** 其中用户还不认识的去重词数 */
  unknownUnique: number;
  /** 学完这一档的未知词后,阅读覆盖率能提升多少(百分点) */
  coverageGainPct: number;
  /** 性价比:每学 1 个词带来的覆盖率提升(百分点/词) */
  gainPerWord: number;
  /** 未知词在语料中的平均复现次数(越高越容易巩固) */
  avgRepetition: number;
}

/**
 * 统计各档词的语料投入产出比(纯函数,词门槛结果内部缓存)。
 *
 * 传入 curve(掌握概率曲线)时按**概率加权**:4200 档的词不再因为"词汇量够"
 * 就被算成全认识,而是按 pKnown(4200) 的实测掌握率折算期望未知词数 ——
 * 这修正了"词汇量一刀切"的偏差。
 */
export function bandRoi(
  vocab: number,
  articles: readonly Article[],
  curve?: KnowledgeCurve,
): BandRoi[] {
  const bands = [...VOCAB_BANDS];
  const pKnown = curve?.pKnown ?? defaultCurve(vocab).pKnown;
  // unknown 存 { 出现次数, 期望权重(1-p) }
  const perBand = new Map<number, { unique: Map<string, number>; unknown: Map<string, { occ: number; weight: number }> }>();
  for (const band of bands) perBand.set(band, { unique: new Map(), unknown: new Map() });

  const thresholdCache = new Map<string, number | null>();
  let totalTokens = 0;

  for (const article of articles) {
    for (const raw of extractWords(article.paragraphs.join(' '))) {
      const word = raw.toLowerCase();
      let threshold = thresholdCache.get(word);
      if (threshold === undefined) {
        threshold = thresholdOfWord(word);
        thresholdCache.set(word, threshold);
      }
      if (threshold == null) continue;
      totalTokens += 1;
      // 门槛落进哪一档:取第一个"不低于它"的档位,超出全部档位则归入最高档
      const band = bands.find((b) => threshold <= b) ?? bands[bands.length - 1];
      const entry = perBand.get(band)!;
      entry.unique.set(word, (entry.unique.get(word) ?? 0) + 1);

      const weight = 1 - pKnown(threshold);
      if (weight > 0.01) {
        const prev = entry.unknown.get(word) ?? { occ: 0, weight };
        entry.unknown.set(word, { occ: prev.occ + 1, weight });
      }
    }
  }

  return bands.map((band) => {
    const entry = perBand.get(band)!;
    const unknownTokens = [...entry.unknown.values()].reduce(
      (sum, u) => sum + u.occ * u.weight,
      0,
    );
    const unknownUnique = [...entry.unknown.values()].reduce((sum, u) => sum + u.weight, 0);
    const coverageGainPct = totalTokens > 0 ? (unknownTokens / totalTokens) * 100 : 0;
    return {
      threshold: band,
      label: bandLabel(band),
      uniqueWords: entry.unique.size,
      unknownUnique: Math.round(unknownUnique),
      coverageGainPct,
      gainPerWord: unknownUnique > 0 ? coverageGainPct / unknownUnique : 0,
      avgRepetition: unknownUnique > 0 ? unknownTokens / unknownUnique : 0,
    };
  });
}

/** 由 ROI 数据生成建议:优先性价比最高的档位,并说明与"缺口最大档"的取舍 */
function roiSuggestion(roi: BandRoi[], gapThreshold: number | null): { advice: string; trait: ProfileTrait | null } | null {
  // 样本太小的档位不参与比较(3 个词算出的性价比没有意义)
  const candidates = roi.filter((r) => r.unknownUnique >= 15);
  if (candidates.length === 0) return null;

  const best = candidates.reduce((a, b) => (b.gainPerWord > a.gainPerWord ? b : a));
  const gapRoi = gapThreshold != null ? candidates.find((r) => r.threshold === gapThreshold) : undefined;
  const perWord = best.gainPerWord.toFixed(3);

  if (gapRoi && gapRoi.threshold === best.threshold) {
    return {
      advice: `优先补 ${best.label}:缺口最大且性价比最高(每学 1 个词约多认识 ${perWord}% 文本)`,
      trait: null,
    };
  }

  const ratio = gapRoi && gapRoi.gainPerWord > 0 ? best.gainPerWord / gapRoi.gainPerWord : 0;
  const gapPart =
    gapRoi && ratio > 1.3
      ? `${gapRoi.label} 缺口更大,但每个词贵约 ${ratio.toFixed(1)} 倍(语料里平均只出现 ${gapRoi.avgRepetition.toFixed(1)} 次),备考要补,建议排在后面`
      : gapRoi
        ? `${gapRoi.label} 缺口也值得补,两者性价比接近`
        : '';

  return {
    advice: `先补 ${best.label}(性价比最高:每学 1 个词约多认识 ${perWord}% 文本,这些词在语料里平均复现 ${best.avgRepetition.toFixed(1)} 次)。${gapPart}`,
    trait:
      gapRoi && ratio > 1.3
        ? {
            kind: 'note',
            text: `补词顺序按性价比算:${best.label} 的词平均复现 ${best.avgRepetition.toFixed(1)} 次,${gapRoi.label} 只有 ${gapRoi.avgRepetition.toFixed(1)} 次 —— 同样学 100 个词,前者在阅读里兑现得快得多`,
          }
        : null,
  };
}

/** 由行为数据派生标签与建议(与词汇曲线互补) */
function behaviorTraits(behavior: BehaviorInput): { traits: ProfileTrait[]; advice: string | null } {
  const traits: ProfileTrait[] = [];
  let advice: string | null = null;

  const { streakDays, wordCount, masteredCount, totalArticlesCompleted, totalWordsRead } = behavior;

  if (streakDays >= 7) {
    traits.push({ kind: 'strength', text: `已连续打卡 ${streakDays} 天,节奏稳定` });
  }

  if (wordCount >= 50) {
    const masteryRate = masteredCount / wordCount;
    if (masteryRate < 0.2) {
      traits.push({
        kind: 'gap',
        text: `生词本积压:${wordCount} 个词里只掌握了 ${masteredCount} 个(${Math.round(masteryRate * 100)}%)`,
      });
      advice = '先把复习队列清掉再加新词 —— 积压会让生词本越来越难回头看';
    } else if (masteryRate >= 0.6) {
      traits.push({
        kind: 'strength',
        text: `复习见效:生词本已掌握 ${Math.round(masteryRate * 100)}%(${masteredCount}/${wordCount})`,
      });
    }
  } else if (wordCount === 0 && totalArticlesCompleted > 0) {
    traits.push({ kind: 'note', text: '还没收藏过生词:阅读时点任意词即可加入生词本' });
  }

  if (totalArticlesCompleted >= 10) {
    const avg = Math.round(totalWordsRead / Math.max(1, totalArticlesCompleted));
    traits.push({
      kind: 'note',
      text: `累计读完 ${totalArticlesCompleted} 篇(篇均 ${avg} 词)`,
    });
  }

  return { traits, advice };
}

/** buildLearnerProfile 的可选输入 */
export interface ProfileOptions {
  /** 本机学习行为(打卡、生词积压等) */
  behavior?: BehaviorInput;
  /** 语料投入产出比(见 bandRoi);给了才会按"性价比"而不是"缺口大小"给建议 */
  roi?: BandRoi[];
}

/**
 * 生成量化画像。纯函数:输入持久化的 UserLevel(+ 可选行为数据与语料 ROI),
 * 输出可直接渲染的画像。没有评估数据时(vocab 缺失)按 CEFR 代表词汇量兜底,
 * 并标注 mode='pick' 使区间更宽。
 */
export function buildLearnerProfile(
  level: UserLevel,
  options: ProfileOptions = {},
): LearnerProfile {
  const vocab = Math.round(level.vocab ?? cefrToVocab(level.level));
  const rounds = level.rounds ?? [];
  const answers =
    level.answers ?? rounds.reduce((sum, r) => sum + r.total, 0);
  const knownAnswers =
    level.knownAnswers ?? rounds.reduce((sum, r) => sum + r.known, 0);
  const accuracy = answers > 0 ? knownAnswers / answers : 0;
  const mode: LearnerProfile['mode'] = level.mode ?? (rounds.length > 0 ? 'quick' : 'pick');

  const margin = estimateMargin({ vocab, answers, accuracy, mode, rounds });
  const bands = bandsFromRounds(rounds);
  const {
    traits: vocabTraits,
    suggestion: vocabAdvice,
    gapThreshold,
  } = deriveTraits(bands, accuracy, answers);

  const behaviorResult = options.behavior ? behaviorTraits(options.behavior) : { traits: [], advice: null };
  // 有语料数据时,用"投入产出比"取代"缺口最大"作为补词建议的口径
  const roiResult =
    options.roi && options.roi.length > 0 ? roiSuggestion(options.roi, gapThreshold) : null;

  // 建议优先级:先清复习积压(今天就能动手)> 补词性价比(投入产出比)> 词汇曲线兜底
  const suggestion = behaviorResult.advice ?? roiResult?.advice ?? vocabAdvice;
  const traits = [
    ...behaviorResult.traits,
    ...(roiResult?.trait ? [roiResult.trait] : []),
    ...vocabTraits,
  ];

  const confidence: LearnerProfile['confidence'] =
    answers >= 30 ? '高' : answers >= 15 ? '中' : '低';

  return {
    vocab,
    margin,
    low: Math.max(200, vocab - margin),
    high: vocab + margin,
    confidence,
    answers,
    accuracy,
    mode,
    cefr: vocabToCefr(vocab),
    bandLabel: bandLabelOf(vocab),
    bands,
    traits,
    suggestion,
  };
}

/** 语料适配度:在当前语料池上实测"你能读到什么" */
export interface CorpusFit {
  /** 舒适阅读上限:预测理解率 ≥ 96% 的文章里,所需词汇量最高值 */
  comfortCeiling: number;
  /** 学习区(理解率 93%–96%)文章对应的所需词汇量区间 */
  zoneFrom: number;
  zoneTo: number;
  /** 参与统计的文章数 */
  sampleSize: number;
}

/**
 * 用真实语料换算"词汇量 → 可读难度"。
 * 刻意走实测而不是纯公式:公式要给词频分布假设,而语料池就在手边。
 * 样本太少(不足 3 篇)时退回按词汇量估算。
 */
export function corpusFit(
  vocab: number,
  articles: readonly Article[],
  curve?: KnowledgeCurve,
): CorpusFit {
  const effective = curve ?? defaultCurve(vocab);
  const rows: { required: number; coverage: number }[] = [];
  for (const article of articles) {
    const info = difficultyOf(article);
    // 概率加权理解率:低于词汇量的档位也可能有没掌握的词,高于的也可能掌握
    rows.push({
      required: info.requiredVocab,
      coverage: expectedCoverage(article.paragraphs, effective),
    });
  }

  if (rows.length < 3) {
    return {
      comfortCeiling: Math.round(vocab * 0.92),
      zoneFrom: Math.round(vocab * 0.98),
      zoneTo: Math.round(vocab * 1.15),
      sampleSize: rows.length,
    };
  }

  const comfortable = rows.filter((r) => r.coverage >= COMFORT_COVERAGE).map((r) => r.required);
  const zone = rows
    .filter((r) => r.coverage >= LEARNING_ZONE.min && r.coverage <= LEARNING_ZONE.max)
    .map((r) => r.required);

  const zoneFrom = zone.length > 0 ? Math.min(...zone) : Math.round(vocab * 0.98);
  const zoneTo = zone.length > 0 ? Math.max(...zone) : Math.round(vocab * 1.15);

  return {
    comfortCeiling: comfortable.length > 0 ? Math.max(...comfortable) : Math.round(vocab * 0.92),
    zoneFrom,
    zoneTo,
    sampleSize: rows.length,
  };
}
