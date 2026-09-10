import { ASSESSMENT_WORDS as CURATED_ASSESSMENT_WORDS } from '@/data/assessment-words';
import { EXTERNAL_WORDLIST } from '@/data/external-wordlist';
import { vocabToCefr } from '@/domain/levels';
import { VOCAB_BANDS, bandLabel, wordThreshold } from '@/domain/wordlevel';
import type { CefrLevel } from '@/types';

export interface AssessWordInput {
  word: string;
  threshold: number;
}

export type AssessWord = AssessWordInput;

/** Maximum number of answers in one adaptive round. */
export const WORDS_PER_ROUND = 5;
export const MIN_ASSESSMENT_VOCAB = 500;
export const MAX_ASSESSMENT_VOCAB = 12000;

const UP_RATIO = 0.8;
const DOWN_RATIO = 0.4;

/** The first round starts around the middle of the supported vocabulary scale. */
export const START_BAND = 3000;

/**
 * A band represents a range between the midpoints of two adjacent thresholds.
 * This lets frequency-derived thresholds participate in the same assessment as
 * words carrying an exam tag.
 */
export const ASSESSMENT_BAND_RANGES: Record<number, { min: number; max?: number }> = Object.fromEntries(
  VOCAB_BANDS.map((band, index) => {
    const previous = VOCAB_BANDS[index - 1];
    const next = VOCAB_BANDS[index + 1];
    return [
      band,
      {
        min: previous == null ? 0 : Math.round((previous + band) / 2),
        max: next == null ? undefined : Math.round((band + next) / 2) - 1,
      },
    ];
  }),
) as Record<number, { min: number; max?: number }>;

const SINGLE_WORD_RE = /^[a-z]+(?:'[a-z]+)?$/;
let cachedBank: Map<number, AssessWord[]> | null = null;

function bandForThreshold(threshold: number): number | null {
  for (const band of VOCAB_BANDS) {
    const range = ASSESSMENT_BAND_RANGES[band];
    if (threshold >= range.min && (range.max == null || threshold <= range.max)) {
      return band;
    }
  }
  return null;
}

function addToBank(bank: Map<number, AssessWord[]>, item: AssessWordInput, seen: Set<string>) {
  const word = item.word.toLowerCase().trim();
  if (!SINGLE_WORD_RE.test(word) || seen.has(word)) return;
  const band = bandForThreshold(item.threshold);
  if (band == null) return;
  seen.add(word);
  const list = bank.get(band) ?? [];
  list.push({ word, threshold: band });
  bank.set(band, list);
}

/**
 * Builds the assessment bank from the full imported word list at runtime.
 * The old curated list remains a fallback for datasets with missing metadata.
 */
export function getAssessmentWordBank(): ReadonlyMap<number, readonly AssessWord[]> {
  if (cachedBank) return cachedBank;

  const bank = new Map<number, AssessWord[]>();
  const seen = new Set<string>();

  for (const word of EXTERNAL_WORDLIST) {
    const threshold = wordThreshold(word);
    if (threshold != null) {
      addToBank(bank, { word, threshold }, seen);
    }
  }

  for (const item of CURATED_ASSESSMENT_WORDS) {
    addToBank(bank, item, seen);
  }

  for (const list of bank.values()) {
    list.sort((a, b) => a.word.localeCompare(b.word));
  }

  cachedBank = bank;
  return bank;
}

/**
 * Randomly samples words from the requested ability range without replacement.
 * Small or customized datasets may return fewer than `count` words, but never
 * repeat an excluded word just to fill the requested slot count.
 */
export function sampleAssessmentWords(
  threshold: number,
  count = WORDS_PER_ROUND,
  excluded = new Set<string>(),
  rng: () => number = Math.random,
): AssessWord[] {
  const bank = getAssessmentWordBank();
  const pool = [...(bank.get(threshold) ?? [])];
  if (pool.length === 0 || count <= 0) return [];

  const available = pool.filter((item) => !excluded.has(item.word));
  const shuffled = [...available];

  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.max(0, Math.min(0.999999, rng())) * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/** Results from one band. */
export interface BandResult {
  threshold: number;
  total: number;
  known: number;
}

export type WalkDecision = 'up' | 'down' | 'settle';

export function decideBandStep(result: BandResult): WalkDecision {
  if (result.total === 0) return 'settle';
  const ratio = result.known / result.total;
  if (ratio >= UP_RATIO) return 'up';
  if (ratio <= DOWN_RATIO) return 'down';
  return 'settle';
}

export function nextBand(threshold: number, dir: 'up' | 'down'): number | null {
  const i = VOCAB_BANDS.indexOf(threshold as (typeof VOCAB_BANDS)[number]);
  if (i < 0) return null;
  const j = dir === 'up' ? i + 1 : i - 1;
  return j >= 0 && j < VOCAB_BANDS.length ? VOCAB_BANDS[j] : null;
}

export interface AssessEstimate {
  vocab: number;
  level: CefrLevel;
  finalThreshold: number;
  totalWords: number;
  knownWords: number;
  bandLabel: string;
}

export function estimateFromRounds(rounds: BandResult[]): AssessEstimate | null {
  if (rounds.length === 0) return null;

  const last = rounds[rounds.length - 1];
  const i = VOCAB_BANDS.indexOf(last.threshold as (typeof VOCAB_BANDS)[number]);
  const ratio = last.total > 0 ? Math.max(0, Math.min(1, last.known / last.total)) : 0;
  let vocab: number;

  if (ratio >= 0.5 && i >= 0) {
    const low = VOCAB_BANDS[i];
    const high =
      i < VOCAB_BANDS.length - 1 ? VOCAB_BANDS[i + 1] : MAX_ASSESSMENT_VOCAB;
    vocab = Math.round(low + Math.min(1, (ratio - 0.5) / 0.5) * (high - low));
  } else if (i >= 0) {
    const low = VOCAB_BANDS[i];
    const previous = i > 0 ? VOCAB_BANDS[i - 1] : Math.round(low * 0.6);
    vocab = Math.round(previous + Math.min(1, ratio / 0.5) * (low - previous));
  } else {
    vocab = last.threshold;
  }

  const totalWords = rounds.reduce((sum, round) => sum + round.total, 0);
  const knownWords = rounds.reduce((sum, round) => sum + round.known, 0);

  const boundedVocab = Math.max(MIN_ASSESSMENT_VOCAB, Math.min(MAX_ASSESSMENT_VOCAB, vocab));
  return {
    vocab: boundedVocab,
    level: vocabToCefr(boundedVocab),
    finalThreshold: last.threshold,
    totalWords,
    knownWords,
    bandLabel: bandLabel(last.threshold),
  };
}

export function estimateFromPick(thresholdOrVocab: number): AssessEstimate {
  const isBand = VOCAB_BANDS.includes(thresholdOrVocab as (typeof VOCAB_BANDS)[number]);
  const vocab = Math.max(
    MIN_ASSESSMENT_VOCAB,
    Math.min(MAX_ASSESSMENT_VOCAB, thresholdOrVocab),
  );
  return {
    vocab,
    level: vocabToCefr(vocab),
    finalThreshold: vocab,
    totalWords: 0,
    knownWords: 0,
    bandLabel: isBand ? bandLabel(thresholdOrVocab) : `Level ${vocab} words`,
  };
}
