/**
 * 文章视觉封面配置(纯函数):按 id 稳定配色、按话题给 emoji。
 * 不依赖图片/网络,深浅色主题通用。
 */

import type { TopicTag } from '@/types';

/** 话题 → emoji(默认 📖) */
const TOPIC_EMOJI: Record<string, string> = {
  科技: '🤖',
  科学: '🔬',
  文化: '🎭',
  生活: '☕',
  新闻: '📰',
  故事: '📖',
  历史: '🏛️',
  社会: '🌐',
  教育: '🎓',
  经济: '📈',
  环境: '🌿',
};

/** 取文章 emoji:优先第一个能匹配话题的 */
export function articleEmoji(topicTags: TopicTag[]): string {
  for (const t of topicTags) {
    const emoji = TOPIC_EMOJI[t];
    if (emoji) return emoji;
  }
  return '📚';
}

/** id → 稳定色相(0–360) */
export function articleHue(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) {
    h = (h * 31 + id.charCodeAt(i)) % 360;
  }
  return h;
}

/** HSL → hex(无三方依赖) */
export function hslToHex(h: number, s: number, l: number): string {
  const sn = s / 100;
  const ln = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sn * Math.min(ln, 1 - ln);
  const f = (n: number) => {
    const color = ln - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** 封面主色(中等饱和) */
export function coverColor(id: string): string {
  return hslToHex(articleHue(id), 60, 55);
}

/** 封面深色文字用色 / 浅色文字用色(按需要) */
export function coverDarkText(id: string): string {
  return hslToHex(articleHue(id), 65, 38);
}
