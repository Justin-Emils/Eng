import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { articleEmoji, coverColor } from '@/domain/cover';
import { useTheme } from '@/hooks/use-theme';
import type { Article } from '@/types';

/**
 * 文章视觉封面 —— 多级真实图回退,任何一层"加载不出来"都会跳到下一层:
 * 1. coverUrl(Wikimedia Commons 开放许可图);
 *    —— 但 Wikimedia 在国内常被墙,一旦确认不可达,以后直接跳过本层;
 * 2. picsum.photos seed 图(id 稳定 → 每篇不同的真实图);
 * 3. Unsplash CDN 稳定图(按 id 哈希取一张,同样每篇不同);
 * 4. 全部失败(完全离线)→ id 稳定渐变 + 话题 emoji。
 * 关键:每层都有超时(挂死的请求不会一直灰着),onError 也立即跳级。
 * 加载进度按 (article.id+coverUrl) 记忆,换文章/换 coverUrl 自动归零,不串状态。
 */
export function ArticleCover({
  article,
  size = 'banner',
}: {
  article: Article;
  size?: 'thumb' | 'banner' | 'hero';
}) {
  const theme = useTheme();

  const cacheKey = article.coverUrl ? `${article.id}|${article.coverUrl}` : article.id;
  const tiers = useMemo(
    () => buildTiersFor(article.id, article.coverUrl),
    [article.id, article.coverUrl],
  );

  // 失败记忆:每篇已跳到第几层。key 含 coverUrl → 换文章/换 coverUrl 自动归零。
  // 用「渲染期修正状态」重置(React 官方模式),不在 effect 里 setState。
  const [progress, setProgress] = useState(() => ({ key: cacheKey, idx: 0 }));
  if (progress.key !== cacheKey) {
    setProgress({ key: cacheKey, idx: 0 });
  }
  const sourceIdx = Math.min(progress.idx, tiers.length);
  const uri = tiers[sourceIdx];

  // 每层超时:挂死也算失败 → 标记 wikimedia 不可达并跳下一层
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (sourceIdx >= tiers.length) return undefined;
    const timer = setTimeout(() => {
      const failing = tiers[sourceIdx];
      if (failing && isWikimedia(failing)) rememberCommonsBlocked();
      setProgress((p) => ({
        key: p.key,
        idx: Math.min(sourceIdx + 1, tiers.length),
      }));
    }, LOAD_TIMEOUT_MS);
    timerRef.current = timer;
    return () => {
      clearTimeout(timer);
      if (timerRef.current === timer) timerRef.current = null;
    };
  }, [sourceIdx, tiers]);

  const handleImageError = () => {
    const failing = tiers[sourceIdx];
    if (failing && isWikimedia(failing)) rememberCommonsBlocked();
    setProgress((p) => ({
      key: p.key,
      idx: Math.min(sourceIdx + 1, tiers.length),
    }));
  };

  const handleImageLoad = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const isHero = size === 'hero';
  const isThumb = size === 'thumb';
  const frame = isHero ? styles.hero : isThumb ? styles.thumb : styles.banner;

  if (uri) {
    return (
      <View style={[styles.wrap, frame, { backgroundColor: theme.backgroundElement }]}>
        <Image
          key={uri}
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={150}
          onLoad={handleImageLoad}
          onError={handleImageError}
        />
      </View>
    );
  }

  // 最终回退:渐变 + emoji
  const main = coverColor(article.id);
  const emoji = articleEmoji(article.topicTags);
  const light = theme.background === '#ffffff';
  const tint = light ? 0.14 : 0.3;
  const base = mixWithWhite(main, light);

  return (
    <View style={[styles.wrap, frame, { backgroundColor: base }]}>
      <View style={[styles.orb, { backgroundColor: main, opacity: tint }]} />
      <View style={[styles.orbSmall, { backgroundColor: main, opacity: light ? 0.1 : 0.22 }]} />
      <View style={styles.emojiWrap}>
        <ThemedText
          style={isHero ? styles.emojiHero : isThumb ? styles.emojiThumb : styles.emojiBanner}>
          {emoji}
        </ThemedText>
      </View>
    </View>
  );
}

/* ------------------------- 图源队列 ------------------------- */

/** 单层加载超时(挂死的请求视作失败) */
const LOAD_TIMEOUT_MS = 6000;

/** Wikimedia 是否已确认不可达(模块级记忆 + AsyncStorage 持久化) */
const BLOCK_KEY = 'readingapp.cover.commons-blocked.v1';
let commonsBlocked = false;

void (async () => {
  try {
    commonsBlocked = (await AsyncStorage.getItem(BLOCK_KEY)) === '1';
  } catch {
    commonsBlocked = false;
  }
})();

function rememberCommonsBlocked() {
  if (!commonsBlocked) {
    commonsBlocked = true;
    void AsyncStorage.setItem(BLOCK_KEY, '1').catch(() => {});
  }
}

function isWikimedia(url: string): boolean {
  return /wikimedia\.org|wikipedia\.org/i.test(url);
}

/** 按文章 id 从 Unsplash CDN 挑一张稳定的真实图(备用图源) */
const UNSPLASH_IDS = [
  'photo-1441974231531-c6227db76b6e', // 森林阳光
  'photo-1506744038136-46273834b3fb', // 湖面山景
  'photo-1470071459604-3b5ec3a7fe05', // 晨雾山峦
  'photo-1447752875215-b2761acb3c5d', // 林间光柱
  'photo-1501854140801-50d01698950b', // 雪原山川
  'photo-1472214103451-9374bd1c798e', // 原野
  'photo-1475924156734-496f6cac6ec1', // 湖边栈道
  'photo-1501785888041-af3ef285b470', // 山巅云海
  'photo-1464822759023-fed622ff2c3b', // 远山
  'photo-1506905925346-21bda4d32df4', // 暮色山峰
  'photo-1507525428034-b723cf961d3e', // 海滩
  'photo-1519681393784-d120267933ba', // 星空雪山
  'photo-1476514525535-07fb3b4ae5f1', // 湖上独木舟
  'photo-1439066615861-d1af74d74000', // 湖畔码头
  'photo-1469474968028-56623f02e42e', // 林间光
  'photo-1477346611705-65d1883cee1e', // 沙漠
  'photo-1449824913935-59a10b8d2000', // 城市街道
  'photo-1477959858617-67f85cf4f1df', // 城市夜景
  'photo-1444723121867-7a241cacace9', // 城市黄昏
  'photo-1503676260728-1c00da094a0b', // 书桌/学习
];

function unsplashUrl(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const photo = UNSPLASH_IDS[h % UNSPLASH_IDS.length];
  return `https://images.unsplash.com/${photo}?auto=format&fit=crop&w=800&q=60`;
}

/** 稳定兜底真实图(id 不同 → 图不同) */
function picsumUrl(id: string): string {
  return `https://picsum.photos/seed/${encodeURIComponent(id)}/800/450`;
}

/** 组装某篇文章的图源队列(去重);wikimedia 已确认不可达则跳过 coverUrl */
function buildTiersFor(id: string, coverUrl?: string): string[] {
  const list: string[] = [];
  if (coverUrl && !(commonsBlocked && isWikimedia(coverUrl))) list.push(coverUrl);
  list.push(picsumUrl(id));
  list.push(unsplashUrl(id));
  return list.filter((u, i) => list.indexOf(u) === i);
}

/* ------------------------- 回退视觉 ------------------------- */

/** 主色与白/黑混合出浅/深底色 */
function mixWithWhite(hex: string, light: boolean): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const f = (v: number) => (light ? Math.round(v + (255 - v) * 0.86) : Math.round(v * 0.22));
  return `#${[f(r), f(g), f(b)].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden' },
  thumb: {
    height: 80,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  banner: {
    height: 88,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    height: 180,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orb: {
    position: 'absolute',
    right: -30,
    top: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  orbSmall: {
    position: 'absolute',
    left: -16,
    bottom: -24,
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  emojiWrap: { backgroundColor: 'transparent' },
  emojiThumb: { fontSize: 30, lineHeight: 40 },
  emojiBanner: { fontSize: 40, lineHeight: 52 },
  emojiHero: { fontSize: 84, lineHeight: 100 },
});
