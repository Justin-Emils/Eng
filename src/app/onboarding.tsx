import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getAccount, saveAccount } from '@/storage/account';
import { saveDailyGoal, saveOnboarded } from '@/storage/settings';

/**
 * 首次设置(注册完成后、或选择"先不登录"后进入):
 *   1. 完善个人信息(昵称 —— 头像在「我的 → 账号」里改);
 *   2. 设每日目标(读几篇 / 复习几个词);
 *   3. 引导做词汇量评估(可跳过,之后首页也会提醒)。
 *
 * 注意:欢迎语和「登录 / 注册」在 /welcome 页面完成,这里只管"建立本机学习档案"。
 * 老用户在新手机登录时不会走到这里 —— 云端备份里已经带着目标与水平,
 * 登录后自动恢复即可(见 domain/sync.ts 的 autoSyncAfterLogin)。
 */
export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ step?: string }>();

  const [step, setStep] = useState(params.step === 'goal' ? 1 : 0);
  const [nickname, setNickname] = useState('');
  const [goalArticles, setGoalArticles] = useState(1);
  const [reviewWords, setReviewWords] = useState(10);
  const [saving, setSaving] = useState(false);

  // 注册时若已经填过昵称,这里带出来不用再输一遍
  useEffect(() => {
    let active = true;
    void (async () => {
      const account = await getAccount();
      if (active && account.nickname) setNickname(account.nickname);
    })();
    return () => {
      active = false;
    };
  }, []);

  const finish = async (goAssess: boolean) => {
    if (saving) return;
    Keyboard.dismiss();
    setSaving(true);
    try {
      // 昵称写入账号档案(「我的」页与账号页读的是这里)
      if (nickname.trim()) await saveAccount({ nickname: nickname.trim() });
      await saveDailyGoal({ articles: goalArticles, reviewWords });
      await saveOnboarded(true);
      if (goAssess) {
        router.replace('/assessment');
      } else {
        router.replace('/(tabs)');
      }
    } catch {
      // 写入失败也不能卡住引导:直接进主页,设置用默认值
      router.replace('/(tabs)');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ThemedView style={styles.flex}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.five, paddingBottom: insets.bottom + Spacing.five },
        ]}
        /* always:键盘弹出时点击按钮也立即生效(否则第一下只会收起键盘,像是"点不动") */
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="on-drag">
        {/* 进度点 */}
        <View style={styles.dots}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: i <= step ? theme.accent : theme.backgroundSelected,
                  width: i === step ? 22 : 8,
                },
              ]}
            />
          ))}
        </View>

        {step === 0 ? (
          <>
            <ThemedText type="subtitle" style={styles.title}>
              完善个人信息
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.desc}>
              怎么称呼你?这只是 App 里显示的名字,之后可以在「我的 → 账号」里随时改,
              头像也在那里换。
            </ThemedText>

            <View style={styles.field}>
              <ThemedText type="small" themeColor="textSecondary">
                昵称(可留空)
              </ThemedText>
              <TextInput
                value={nickname}
                onChangeText={setNickname}
                placeholder="例如:考研人"
                placeholderTextColor={theme.textSecondary}
                style={[
                  styles.input,
                  {
                    color: theme.text,
                    backgroundColor: theme.backgroundElement,
                    borderColor: theme.border,
                  },
                ]}
                returnKeyType="next"
                maxLength={12}
                onSubmitEditing={() => {
                  Keyboard.dismiss();
                  setStep(1);
                }}
              />
            </View>

            <PrimaryButton
              label="下一步"
              onPress={() => {
                Keyboard.dismiss();
                setStep(1);
              }}
            />
          </>
        ) : step === 1 ? (
          <>
            <ThemedText type="subtitle" style={styles.title}>
              设定每日目标
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.desc}>
              目标小一点更容易坚持,之后可以在「我的」里随时改。
            </ThemedText>

            <ThemedText type="smallBold">每天读几篇?</ThemedText>
            <View style={styles.choiceRow}>
              {[1, 2, 3].map((n) => (
                <Choice
                  key={n}
                  label={`${n} 篇`}
                  active={goalArticles === n}
                  onPress={() => setGoalArticles(n)}
                />
              ))}
            </View>

            <ThemedText type="smallBold" style={styles.fieldGap}>
              每天复习几个词?
            </ThemedText>
            <View style={styles.choiceRow}>
              {[10, 20, 30].map((n) => (
                <Choice
                  key={n}
                  label={`${n} 词`}
                  active={reviewWords === n}
                  onPress={() => setReviewWords(n)}
                />
              ))}
            </View>

            <View style={styles.actions}>
              <PrimaryButton label="下一步" onPress={() => setStep(2)} />
              <Pressable onPress={() => setStep(0)} style={({ pressed }) => pressed && styles.pressed}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.back}>
                  ‹ 返回
                </ThemedText>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <ThemedText type="subtitle" style={styles.title}>
              最后一步:测一下词汇量
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.desc}>
              约 1 分钟。评估后推荐会精确到「比你高 1 档」,生词标注也会更准。
            </ThemedText>

            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="small" themeColor="textSecondary">
                没时间也没关系,可以先跳过 —— 首页会按 B1 中级推荐,随时都能在「我的 → 学习水平」里评估。
              </ThemedText>
            </ThemedView>

            <View style={styles.actions}>
              <PrimaryButton
                label="开始评估(1 分钟)"
                loading={saving}
                onPress={() => void finish(true)}
              />
              <Pressable
                onPress={() => void finish(false)}
                disabled={saving}
                style={({ pressed }) => pressed && styles.pressed}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.back}>
                  先跳过,直接开始使用
                </ThemedText>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </ThemedView>
  );
}

function Choice({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.choiceWrap, pressed && styles.pressed]}>
      <View
        style={[
          styles.choice,
          {
            backgroundColor: active ? theme.accentSoft : theme.backgroundElement,
            borderColor: active ? theme.accent : theme.border,
          },
        ]}>
        <ThemedText type={active ? 'smallBold' : 'small'} themeColor={active ? 'accent' : 'text'}>
          {label}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  dots: { flexDirection: 'row', gap: Spacing.one + 2, marginBottom: Spacing.two },
  dot: { height: 8, borderRadius: 999 },
  title: { fontSize: 24, lineHeight: 32 },
  desc: { lineHeight: 20 },
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  featureRow: { flexDirection: 'row', gap: Spacing.three, alignItems: 'flex-start' },
  featureEmoji: { fontSize: 22, lineHeight: 26 },
  featureText: { flex: 1, gap: 2 },
  field: { gap: Spacing.one + 2 },
  fieldGap: { marginTop: Spacing.two },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: Spacing.two + 2,
    paddingHorizontal: Spacing.three,
    fontSize: 15,
  },
  choiceRow: { flexDirection: 'row', gap: Spacing.two + 2 },
  choiceWrap: { flex: 1 },
  choice: {
    minHeight: 46,
    borderRadius: Spacing.two + 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { gap: Spacing.two, marginTop: Spacing.two },
  back: { textAlign: 'center', paddingVertical: Spacing.two },
  pressed: { opacity: 0.8 },
});
