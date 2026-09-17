/**
 * 开发者面板(隐藏页面:不在任何导航里出现,只能从「我的 → 关于 → 连点『版本』5 次」进入)。
 *
 * 为什么需要它:正式打包的 APK 里没有开发者菜单(摇一摇只在 Expo Go 有效),
 * 而"重测首次启动流程"必须把本机学习档案清掉 —— 这是 Release 版里唯一的入口。
 * 页面上每一项都写清"会发生什么",危险操作一律二次确认。
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SettingRow } from '@/components/setting-row';
import { StatusNote } from '@/components/status-note';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { isBackendConfigured } from '@/config/backend';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { signOut } from '@/domain/auth/store';
import { pullBackup } from '@/domain/sync';
import { useAuth } from '@/hooks/use-auth';
import { getAccount } from '@/storage/account';
import { getSettings, saveOnboarded } from '@/storage/settings';
import { getWords } from '@/storage/words';

interface Snapshot {
  onboarded: boolean;
  wordCount: number;
  nickname: string;
  backendReady: boolean;
  cloudNote: string;
}

export default function DevScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const auth = useAuth();

  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const loadSnapshot = useCallback(async () => {
    const [settings, words, account] = await Promise.all([getSettings(), getWords(), getAccount()]);
    let cloudNote = '未登录';
    if (auth.status === 'authed') {
      try {
        const remote = await pullBackup();
        cloudNote = remote ? `${remote.wordCount} 个生词` : '云端还没有备份';
      } catch (e) {
        cloudNote = `读取失败:${e instanceof Error ? e.message : '未知错误'}`;
      }
    }
    setSnapshot({
      onboarded: settings.onboarded,
      wordCount: words.length,
      nickname: account.nickname || '(未设昵称)',
      backendReady: isBackendConfigured,
      cloudNote,
    });
  }, [auth.status]);

  // 进入页面时读一次状态;包一层 async IIFE 并先 await,避免 effect 里同步 setState
  useEffect(() => {
    void (async () => {
      await Promise.resolve();
      await loadSnapshot();
    })();
  }, [loadSnapshot]);

  const goFirstRun = () => {
    router.replace(auth.status === 'authed' ? '/onboarding' : '/welcome');
  };

  /** 只重置"是否完成引导",学习数据(生词、进度、打卡)全部保留 */
  const handleResetOnboarding = () => {
    Alert.alert(
      '重走首次启动流程?',
      '只把「已完成引导」标记清掉:生词本、阅读进度、打卡记录都会保留。\n\n下一步会看到「登录 / 注册」页 —— 想模拟全新用户,再执行下面的「退出登录」。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '重置并重走',
          onPress: () => {
            void (async () => {
              setBusy(true);
              try {
                await saveOnboarded(false);
                goFirstRun();
              } finally {
                setBusy(false);
              }
            })();
          },
        },
      ],
    );
  };

  const handleSignOut = () => {
    void (async () => {
      setBusy(true);
      try {
        await signOut();
        setNote('已退出登录');
        await loadSnapshot();
      } finally {
        setBusy(false);
      }
    })();
  };

  /** 彻底清空:等效于卸载重装(AsyncStorage 里所有 key 全没) */
  const handleWipe = () => {
    Alert.alert(
      '清空全部本机数据?',
      '生词本、阅读进度、打卡、设置、昵称头像、登录态 —— 全部删除,无法恢复(云端备份不受影响,重新登录后可以恢复)。\n\n等效于卸载重装。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '全部清空',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBusy(true);
              try {
                // 先走 signOut 让内存里的登录态也归零,再清空存储
                await signOut();
                await AsyncStorage.clear();
                setNote('本机数据已清空');
                router.replace('/welcome');
              } finally {
                setBusy(false);
              }
            })();
          },
        },
      ],
    );
  };

  return (
    <ThemedView style={styles.flex}>
      <View style={[styles.topBar, { paddingTop: insets.top + Spacing.two }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
          <ThemedText style={styles.backIcon} themeColor="accent">
            ‹
          </ThemedText>
        </Pressable>
        <ThemedText type="smallBold">开发者选项</ThemedText>
        <View style={styles.topBarRight} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.six }]}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.intro}>
          隐藏页面,用于重测首次启动流程和查看本机状态。正式版里没有开发者菜单,
          所以入口放在这里。
        </ThemedText>

        {/* 当前状态 */}
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
          当前状态
        </ThemedText>
        <ThemedView type="backgroundElement" style={styles.list}>
          <SettingRow label="版本" value={String(Constants.expoConfig?.version ?? '未知')} />
          <SettingRow
            label="登录状态"
            value={auth.status === 'authed' ? `已登录 ${auth.session?.user.email ?? ''}` : auth.status === 'loading' ? '读取中…' : '未登录'}
          />
          <SettingRow
            label="本机学习档案"
            sublabel="决定启动时进首页还是走首次流程"
            value={snapshot ? (snapshot.onboarded ? '已完成引导' : '未完成') : '读取中…'}
          />
          <SettingRow label="本机生词" value={snapshot ? `${snapshot.wordCount} 个` : '读取中…'} />
          <SettingRow label="昵称" value={snapshot?.nickname ?? '读取中…'} />
          <SettingRow
            label="云端备份"
            sublabel="需要登录后才能读取"
            value={snapshot?.cloudNote ?? '读取中…'}
          />
          <SettingRow
            label="在线服务配置"
            value={snapshot ? (snapshot.backendReady ? '已配置' : '未配置') : '读取中…'}
            last
          />
        </ThemedView>

        {note ? <StatusNote kind="success">{note}</StatusNote> : null}

        {/* 操作 */}
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
          重测首次启动
        </ThemedText>
        <ThemedView type="backgroundElement" style={styles.list}>
          <SettingRow
            label="重新走首次引导"
            sublabel="保留生词与进度,只把「已完成引导」标记清掉"
            value={busy ? '处理中…' : '执行 ›'}
            onPress={() => {
              if (!busy) handleResetOnboarding();
            }}
          />
          <SettingRow
            label="退出登录"
            sublabel={auth.status === 'authed' ? auth.session?.user.email ?? '' : '当前未登录'}
            value={busy ? '处理中…' : '退出 ›'}
            onPress={() => {
              if (!busy && auth.status === 'authed') handleSignOut();
            }}
          />
          <SettingRow
            label="清空全部本机数据"
            sublabel="等效于卸载重装(云端备份不受影响)"
            value={busy ? '处理中…' : '危险 ›'}
            onPress={() => {
              if (!busy) handleWipe();
            }}
            last
          />
        </ThemedView>

        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.cardText}>
            想模拟「全新用户」:先「退出登录」,再「清空全部本机数据」——
            之后启动就会停在「登录 / 注册」页,和刚下载安装完全一致。
            {'\n\n'}
            想模拟「老用户换新手机」:清空数据后登录同一个账号,若云端有备份,
            会自动恢复并直接进首页。
          </ThemedText>
        </ThemedView>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
    gap: Spacing.two,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 34, lineHeight: 36, marginTop: -4 },
  topBarRight: { width: 36 },
  pressed: { opacity: 0.6 },
  content: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  intro: { lineHeight: 20 },
  sectionTitle: { marginTop: Spacing.two, marginLeft: Spacing.one },
  list: { borderRadius: Spacing.three, paddingHorizontal: Spacing.three },
  card: { borderRadius: Spacing.three, padding: Spacing.three },
  cardText: { lineHeight: 20 },
});
