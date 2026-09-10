/**
 * 封面图获取服务(Wikimedia Commons,开放许可)+ 兜底。
 * 优先按内容搜 Commons(CC/公有领域);失败回退 picsum.photos(seed 稳定,按 id 不同图),
 * 保证每篇文章都能拿到一张"各不相同"的配图。结果随文章入库保存(离线可用)。
 */

import { extractWords } from '@/domain/wordmark';

const COMMONS_API =
  'https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=5&gsrsearch=';

/** 图片请求超时 */
const TIMEOUT_MS = 12000;

interface CommonsHit {
  url?: string;
}

interface CommonsPage {
  imageinfo?: { thumburl?: string }[];
}

async function fetchCommons(query: string): Promise<CommonsHit | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const url = `${COMMONS_API}${encodeURIComponent(query)}&prop=imageinfo&iiprop=url&iiurlwidth=800`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'LearnReadingApp/1.0 (personal use)' },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { query?: { pages?: Record<string, CommonsPage> } };
    const pages = json.query?.pages;
    if (!pages) return null;
    for (const page of Object.values(pages)) {
      const thumb = page.imageinfo?.[0]?.thumburl;
      if (thumb) return { url: thumb };
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** 查询词候选:标题实词 → 标题前词+摘要主题 */
function buildQueries(title: string, summary: string): string[] {
  const words = extractWords(title);
  const queries: string[] = [];
  if (words.length >= 2) {
    queries.push(words.slice(0, 4).join(' '));
    queries.push(words.slice(0, 2).join(' '));
  }
  const sumWords = extractWords(summary).filter((w) => w.length > 3).slice(0, 6);
  if (sumWords.length >= 2) queries.push(sumWords.join(' '));
  return queries;
}

/**
 * 为文章取封面图(带兜底):
 * 1) Commons 按内容搜索,命中返回其缩略图;
 * 2) 否则回退 picsum 的 seed 图(articleSeed 稳定 → 每篇不同)。
 */
export async function fetchCoverUrl(
  title: string,
  summary: string,
  articleSeed?: string,
): Promise<string | null> {
  const queries = buildQueries(title, summary);
  for (const q of queries) {
    const hit = await fetchCommons(q);
    if (hit?.url) return hit.url;
  }
  // 兜底:seed 稳定图(避免整批同图)
  const seed = articleSeed && articleSeed.length > 0 ? articleSeed : title;
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/800/450`;
}
