import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { hydrateRemoteArticles } from '@/data/articles/remote-registry';
import { ensureDailyCorpusUpdate } from '@/domain/corpus/update';
import { migrateStorageIfNeeded } from '@/storage/words';

SplashScreen.preventAutoHideAsync();

/**
 * 根布局 = 原生 Stack:
 * - "(tabs)" 组承载 5 个主 Tab(NativeTabs,见 (tabs)/_layout.tsx),隐藏系统 header;
 * - "article/[id]" 详情页与 (tabs) 同级,router.push 后全屏压入 Tab 之上(自带返回)。
 * 阅读页等全屏子页在此层添加。
 */
export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    void migrateStorageIfNeeded();
    // 启动:水化远程文章;今天未更新则自动拉取一批公版短文(失败静默,下次再试)
    void (async () => {
      await hydrateRemoteArticles();
      await ensureDailyCorpusUpdate();
    })();
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
      <AnimatedSplashOverlay />
    </ThemeProvider>
  );
}
