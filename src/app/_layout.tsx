import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { Colors } from '@/constants/theme';
import { hydrateRemoteArticles } from '@/data/articles/remote-registry';
import { ensureDailyCorpusUpdate } from '@/domain/corpus/update';
import { migrateStorageIfNeeded } from '@/storage/words';

SplashScreen.preventAutoHideAsync();

/**
 * 根布局 = 原生 Stack:
 * - "(tabs)" 组承载 5 个主 Tab(NativeTabs,见 (tabs)/_layout.tsx),隐藏系统 header;
 * - "article/[id]" 详情页与 (tabs) 同级,router.push 后全屏压入 Tab 之上(自带返回)。
 *
 * 深色模式适配(重要):
 * - 窗口/Activity 背景色跟随主题(expo-system-ui),消除深色下的白底闪烁;
 * - 状态栏图标自动反色(expo-status-bar style="auto"),深色背景时用浅色图标,
 *   否则时间/电量这些字会看不见;
 * - 导航容器主题同步(ThemeProvider);
 * - 各页面统一用 useTheme()/ThemedText/ThemedView 取色,不再写死颜色。
 */
export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  useEffect(() => {
    void migrateStorageIfNeeded();
    // 启动:水化远程文章;今天未更新则自动拉取一批公版短文(失败静默,下次再试)
    void (async () => {
      await hydrateRemoteArticles();
      await ensureDailyCorpusUpdate();
    })();
  }, []);

  // 窗口背景跟随主题
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(
      isDark ? Colors.dark.background : Colors.light.background,
    ).catch(() => {});
  }, [isDark]);

  return (
    <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
      <AnimatedSplashOverlay />
    </ThemeProvider>
  );
}
