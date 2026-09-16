import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { PrimaryButton } from '@/components/primary-button';
import { SettingRow } from '@/components/setting-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  AVATAR_CHOICES,
  getAccount,
  joinedDays,
  saveAccount,
  type AccountInfo,
} from '@/storage/account';
import { getWords } from '@/storage/words';

/**
 * 账号与同步页:
 * 当前是**本地账号**(数据只在本机)—— 这里可以设置头像/昵称、查看本机身份;
 * 云同步(注册/登录 + 跨设备同步)还未接入,页面明确标注"开发中",不做假登录。
 */
export default function AccountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [nicknameDraft, setNicknameDraft] = useState('');
  const [savedTip, setSavedTip] = useState(false);
  const [wordCount, setWordCount] = useState(0);

  useEffect(() => {
    let active = true;
    void (async () => {
      const [acc, words] = await Promise.all([getAccount(), getWords()]);
      if (!active) return;
      setAccount(acc);
      setNicknameDraft(acc.nickname);
      setWordCount(words.length);
    })();
    return () => {
      active = false;
    };
  }, []);

  const pickAvatar = async (emoji: string) => {
    const next = await saveAccount({ avatar: emoji });
    setAccount(next);
  };

  const saveNickname = async () => {
    const next = await saveAccount({ nickname: nicknameDraft.trim() });
    setAccount(next);
    setNicknameDraft(next.nickname);
    setSavedTip(true);
    setTimeout(() => setSavedTip(false), 1500);
  };

  return (
    <ThemedView style={styles.flex}>
      {/* 顶栏 */}
      <View style={[styles.topBar, { paddingTop: insets.top + Spacing.two }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}>
          <ThemedText style={styles.backIcon} themeColor="accent">
            ‹
          </ThemedText>
        </Pressable>
        <ThemedText type="smallBold">账号与同步</ThemedText>
        <View style={styles.topBarRight} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + Spacing.six },
        ]}>
        {/* 本机身份 */}
        <ThemedView type="backgroundElement" style={styles.card}>
          <View style={styles.identityRow}>
            <Avatar emoji={account?.avatar ?? '📚'} size={64} />
            <View style={styles.identityBody}>
              <ThemedText type="smallBold" style={styles.nickname}>
                {account?.nickname || '未设置昵称'}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                本地账号 · 加入 {account ? joinedDays(account) : '–'} 天
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                ID {account?.id ?? '–'}
              </ThemedText>
            </View>
          </View>

          <ThemedText type="smallBold" style={styles.label}>
            选择头像
          </ThemedText>
          <View style={styles.avatarGrid}>
            {AVATAR_CHOICES.map((emoji) => {
              const active = account?.avatar === emoji;
              return (
                <Pressable key={emoji} onPress={() => void pickAvatar(emoji)} hitSlop={4}>
                  <View
                    style={[
                      styles.avatarChoice,
                      {
                        borderColor: active ? theme.accent : 'transparent',
                        backgroundColor: active ? theme.accentSoft : theme.background,
                      },
                    ]}>
                    <ThemedText style={styles.avatarEmoji}>{emoji}</ThemedText>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <ThemedText type="smallBold" style={styles.label}>
            昵称
          </ThemedText>
          <View style={styles.nickRow}>
            <TextInput
              value={nicknameDraft}
              onChangeText={setNicknameDraft}
              onSubmitEditing={() => void saveNickname()}
              onBlur={() => void saveNickname()}
              placeholder="给自己起个名字"
              placeholderTextColor={theme.textSecondary}
              maxLength={12}
              returnKeyType="done"
              style={[
                styles.input,
                {
                  color: theme.text,
                  backgroundColor: theme.background,
                  borderColor: theme.border,
                },
              ]}
            />
            <PrimaryButton label={savedTip ? '✓ 已保存' : '保存'} onPress={() => void saveNickname()} />
          </View>
        </ThemedView>

        {/* 云同步(未接入,明确说明而不做假登录) */}
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
          云同步
        </ThemedText>
        <ThemedView type="backgroundElement" style={styles.list}>
          <SettingRow
            label="注册 / 登录"
            sublabel="云同步开发中:接入后可用邮箱注册,换手机也能带走生词与进度"
            value="敬请期待"
          />
          <SettingRow
            label="同步内容"
            sublabel="生词本、复习进度、阅读记录、每日目标、学习统计"
          />
          <SettingRow
            label="本机数据"
            sublabel={`当前本机已有 ${wordCount} 个生词 · 无需登录即可使用全部功能`}
            last
          />
        </ThemedView>

        <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
          说明:这个 App 是「离线优先」的 —— 所有学习数据都保存在手机本地,
          不登录也能完整使用。云同步只是为了换设备时不丢数据,接入后你可以自由选择用或不用。
        </ThemedText>
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
  content: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  card: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  identityBody: { flex: 1, gap: 2 },
  nickname: { fontSize: 16 },
  label: { marginTop: Spacing.two },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  avatarChoice: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: { fontSize: 22, lineHeight: 28 },
  nickRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  input: {
    flex: 1,
    minHeight: 46,
    borderWidth: 1,
    borderRadius: Spacing.two + 2,
    paddingHorizontal: Spacing.three,
    fontSize: 15,
  },
  sectionTitle: { marginTop: Spacing.two, marginLeft: Spacing.one },
  list: { borderRadius: Spacing.three, paddingHorizontal: Spacing.three },
  note: { lineHeight: 20, paddingHorizontal: Spacing.one },
});
