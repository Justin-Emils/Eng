import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useState } from 'react';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { APP_FONTS } from '@/constants/fonts';
import { hydrateRemoteArticles } from '@/data/articles/remote-registry';
import { getAuthState, hydrateAuth } from '@/domain/auth/store';
import { ensureDailyCorpusUpdate } from '@/domain/corpus/update';
import { autoSyncAfterLogin } from '@/domain/sync';
import { useResolvedScheme, useTheme } from '@/hooks/use-theme';
import { hydrateThemePrefs } from '@/hooks/use-theme-pref';
import { getSettings } from '@/storage/settings';
import { hydrateLocalOwner } from '@/storage/local-owner';
import { hydrateReviewStats } from '@/storage/review-stats';
import { migrateStorageIfNeeded } from '@/storage/words';

SplashScreen.preventAutoHideAsync();

/**
 * 根布局 = 原生 Stack:
 * - "(tabs)" 组承载 5 个主 Tab(NativeTabs,见 (tabs)/_layout.tsx),隐藏系统 header;
 * - "article/[id]" 详情页与 (tabs) 同级,router.push 后全屏压入 Tab 之上(自带返回);
 * - 首次打开(未完成引导)自动进入 /onboarding。
 *
 * 深色模式适配:
 * - 主题模式来自用户设置(跟随系统/浅色/深色),启动时水化;
 * - 窗口背景色随主题切换(expo-system-ui),状态栏图标自动反色(expo-status-bar)。
 */
export default function RootLayout() {
  const router = useRouter();
  const scheme = useResolvedScheme();
  const palette = useTheme();
  const isDark = scheme === 'dark';
  /**
   * 内嵌字体(Literata,见 constants/fonts.ts)。
   * **必须等它加载完再收启动遮罩**:否则第一帧会用系统字体渲染,
   * 字体到位后整屏文字会"跳"一下 —— 那是很明显的廉价感来源。
   */
  const [fontsLoaded] = useFonts(APP_FONTS);
  const [bootChecked, setBootChecked] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  /** 启动时是否已登录 —— 决定"还没建本机学习档案"时去 welcome 还是直接补引导 */
  const [authedAtBoot, setAuthedAtBoot] = useState(false);

  useEffect(() => {
    void migrateStorageIfNeeded();
    void (async () => {
      // 主题模式先水化,避免首帧用错配色(深浅模式与主题 id 一起读)
      await hydrateThemePrefs();
      /**
       * 复习校准数据与本机数据归属:两者都参与**同步判断**(曲线是同步算的、
       * 上传前要校验归属),所以必须在首屏之前读完。
       * 注:上一次加 hydrateReviewStats 时锚点写错(旧函数名 hydrateThemeMode),
       * 替换没生效 —— 复习校准因此一直没读到数据,已一并修正。
       */
      await hydrateReviewStats();
      await hydrateLocalOwner();
      const settings = await getSettings();
      let onboarded = settings.onboarded;

      // 恢复上次的登录态(token 过期会自动续期;失败静默退回未登录)
      await hydrateAuth();
      const auth = getAuthState();

      /**
       * 已登录但本机还没有学习档案(引导未完成):
       * 可能是"新手机登录后还没走完引导就退出了",这里补一次自动同步 ——
       * 云端备份里带着目标与水平,恢复成功后就不必再走一遍引导
       * (见 domain/sync.ts 的 autoSyncAfterLogin:只在本机为空时才导入)。
       */
      if (auth.status === 'authed' && !onboarded) {
        try {
          await autoSyncAfterLogin();
          onboarded = (await getSettings()).onboarded;
        } catch {
          // 同步失败不阻塞启动:继续按"未完成引导"处理
        }
      }

      setNeedsOnboarding(!onboarded);
      setAuthedAtBoot(auth.status === 'authed');
      setBootChecked(true);

      // 启动:水化远程文章;今天未更新则自动拉取一批公版短文(失败静默,下次再试)
      await hydrateRemoteArticles();
      await ensureDailyCorpusUpdate();
    })();
  }, []);

  /**
   * 没有本机学习档案时的去向:
   * - 未登录 → 先看「登录 / 注册」页(新用户的主要入口);
   * - 已登录 → 直接补完「完善个人信息 + 学习计划」(账号已经有了,不必再看欢迎页)。
   * 老用户(已完成过引导)不会命中这里,直接进首页。
   */
  useEffect(() => {
    if (bootChecked && needsOnboarding) {
      router.replace(authedAtBoot ? '/onboarding' : '/welcome');
    }
  }, [bootChecked, needsOnboarding, authedAtBoot, router]);

  // 窗口背景跟随主题(主题或深浅色任一变化都要重设,否则切换主题时
  // Android 窗口底会残留上一套主题的底色)
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(palette.background).catch(() => {});
  }, [palette.background]);

  return (
    <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
      {/* 两个条件都满足才淡出:启动数据就绪 + 内嵌字体已加载 */}
      <AnimatedSplashOverlay ready={bootChecked && fontsLoaded} />
    </ThemeProvider>
  );
}
