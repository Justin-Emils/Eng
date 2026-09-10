/**
 * 翻译服务(模块 C 三 / D 二)。
 *
 * 策略(M1.2c):
 * - 默认 = 在线整句翻译优先:调用免费公开翻译端点(Google gtx 非官方端点 +
 *   MyMemory),返回自然通顺的整句中文;两个端点都失败或超时才回退离线逐词。
 * - TranslationService 是接口,阅读页只依赖它;未来可替换为带 key 的正式服务
 *   (有道/DeepL/OpenAI),UI 无需改动。
 * - 结果按句子文本缓存,同一句不重复请求。
 */

import { offlineDictionary } from '@/domain/dictionary';
import { splitSentences, tokenize } from '@/domain/wordmark';

/** 翻译结果 */
export interface TranslationResult {
  /** 译文文本 */
  text: string;
  /** 翻译方式:online = 在线整句;offline-wordwise = 离线逐词兜底 */
  mode: 'online' | 'offline-wordwise';
  /** 未能命中的词数(仅逐词兜底时可能 >0) */
  missingCount: number;
  /** 给用户的提示(如回退原因、缺失词数) */
  note?: string;
}

export interface TranslationService {
  translateSentence(sentence: string): Promise<TranslationResult>;
}

/** 带超时的 fetch(秒级),避免端点不可达时长时间卡住 */
async function fetchWithTimeout(url: string, timeoutMs = 6000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 在线整句翻译(免费公开端点,无需 key)。
 * 依次尝试 Google gtx 与 MyMemory,任一成功即返回;全部失败抛错由调用方回退。
 */
class OnlineFreeTranslationService implements TranslationService {
  async translateSentence(sentence: string): Promise<TranslationResult> {
    const text = sentence.trim();
    if (!text) {
      return { text: '', mode: 'online', missingCount: 0, note: '空句' };
    }

    // 1) Google translate 非官方端点(client=gtx 无需 key)
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&q=${encodeURIComponent(text)}`;
      const res = await fetchWithTimeout(url);
      if (res.ok) {
        const json = (await res.json()) as unknown;
        const translated = parseGoogleGtx(json);
        if (translated) {
          return { text: translated, mode: 'online', missingCount: 0 };
        }
      }
    } catch {
      // fall through 到 MyMemory
    }

    // 2) MyMemory 免费端点
    try {
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|zh-CN`;
      const res = await fetchWithTimeout(url, 8000);
      if (res.ok) {
        const json = (await res.json()) as { responseData?: { translatedText?: string } };
        const translated = json.responseData?.translatedText?.trim();
        if (translated) {
          return { text: translated, mode: 'online', missingCount: 0 };
        }
      }
    } catch {
      // 两个在线端点都失败 → 抛错让上层回退离线
    }

    throw new Error('online translation unavailable');
  }
}

/** 解析 Google gtx 返回的 JSON(嵌套分段数组) */
function parseGoogleGtx(json: unknown): string | null {
  if (!Array.isArray(json) || json.length === 0 || !Array.isArray(json[0])) {
    return null;
  }
  const segments = json[0] as unknown[][];
  const parts: string[] = [];
  for (const seg of segments) {
    if (Array.isArray(seg) && typeof seg[0] === 'string') {
      parts.push(seg[0]);
    }
  }
  const text = parts.join('').trim();
  return text || null;
}

/**
 * 离线逐词翻译兜底:每个词查离线词典取中文义拼接,未命中词原样保留。
 * 仅在断网/在线端点不可用时使用,并明确标注。
 */
class OfflineWordwiseTranslationService implements TranslationService {
  async translateSentence(sentence: string): Promise<TranslationResult> {
    const words = tokenize(sentence);
    const parts: string[] = [];
    let missingCount = 0;
    for (const tok of words) {
      if (!tok.isWord) {
        parts.push(tok.text);
        continue;
      }
      const result = offlineDictionary.lookup(tok.text);
      if (result.entry) {
        parts.push(result.entry.zh);
      } else {
        parts.push(tok.text);
        missingCount += 1;
      }
    }
    const text = parts.join(' ').replace(/\s+([,.;:!?…])/g, '$1').trim();
    const note = missingCount > 0
      ? `离线逐词兜底(网络不可用,且 ${missingCount} 词未收录),仅供参考`
      : '离线逐词兜底(网络不可用),仅供参考';
    return { text, mode: 'offline-wordwise', missingCount, note };
  }
}

/**
 * 默认组合服务:在线优先 → 失败回退离线。
 * 在线端点:Google gtx、MyMemory。未来可替换为带 key 服务(setTranslationService)。
 */
class FallbackTranslationService implements TranslationService {
  private online = new OnlineFreeTranslationService();
  private offline = new OfflineWordwiseTranslationService();

  async translateSentence(sentence: string): Promise<TranslationResult> {
    try {
      return await this.online.translateSentence(sentence);
    } catch {
      const fallback = await this.offline.translateSentence(sentence);
      return { ...fallback, note: fallback.note ?? '在线翻译不可用,已用离线兜底' };
    }
  }
}

/** 翻译缓存:按句子文本作 key,避免同一句重复请求 */
const translationCache = new Map<string, TranslationResult>();

let currentService: TranslationService = new FallbackTranslationService();

/** 返回当前翻译服务(默认在线优先+离线兜底) */
export function getTranslationService(): TranslationService {
  return currentService;
}

/** 切换翻译服务(未来接入带 key 服务时用) */
export function setTranslationService(service: TranslationService): void {
  currentService = service;
  translationCache.clear();
}

/**
 * 翻译一句(带缓存)。
 */
export async function translateSentence(sentence: string): Promise<TranslationResult> {
  const key = sentence.trim();
  if (!key) {
    return { text: '', mode: 'online', missingCount: 0, note: '空句' };
  }
  const cached = translationCache.get(key);
  if (cached) {
    return cached;
  }
  const result = await currentService.translateSentence(key);
  translationCache.set(key, result);
  return result;
}

/** 工具:把一段切句并逐句翻译,返回拼接译文(供段落翻译用) */
export async function translateParagraph(paragraph: string): Promise<TranslationResult> {
  const sentences = splitSentences(paragraph);
  const parts: string[] = [];
  let missingCount = 0;
  let mode: TranslationResult['mode'] = 'online';
  for (const s of sentences) {
    const r = await translateSentence(s);
    parts.push(r.text);
    missingCount += r.missingCount;
    if (r.mode === 'offline-wordwise') mode = 'offline-wordwise';
  }
  return {
    text: parts.join(' '),
    mode,
    missingCount,
    note: mode === 'offline-wordwise' ? '段落译文含离线兜底,仅供参考' : undefined,
  };
}
