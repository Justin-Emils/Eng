/**
 * 首次启动的账号入口页。
 *
 * 位置:logo / 启动动画结束后,新用户看到的第一个页面(老用户直接进首页,不经过这里)。
 *
 * 为什么把「登录 / 注册」放在最前面:
 * - 让"账号"成为第一件明确的事,而不是先用两周再在「我的」里偶然发现同步功能;
 * - 注册成功后立刻进入「完善个人信息 + 学习计划」,资料与计划一次填完;
 * - 已注册用户登录后会自动拉一次云端数据,新手机直接接上进度。
 *
 * 为什么仍保留「先不登录」:这个 App 是离线优先的,强行登录会在没网 / 后端不可用时
 * 把用户挡在门外。所以登录是主路径,跳过是明确的次路径,并且说清代价(数据只在本机)。
 */

import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { isBackendConfigured } from '@/config/backend';
import { MaxContentWidth, Spacing } from '@/constants/theme';

const FEATURES: [string, string][] = [
  ['🎯', '按你的词汇量推荐文章'],
  ['🔵', '超出水平的生词自动标蓝'],
  ['🔁', '生词按遗忘曲线排期复习'],
  ['☁️', '登录后换手机不丢进度'],
];

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  /** 跳过登录:直接进入「完善个人信息 + 学习计划」,数据只留在本机 */
  const handleSkip = () => {
    router.replace('/onboarding');
  };

  return (
    <ThemedView style={styles.flex}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.six, paddingBottom: insets.bottom + Spacing.four },
        ]}
        keyboardShouldPersistTaps="always">
        {/* 品牌区 */}
        <View style={styles.hero}>
          <ThemedText style={styles.logo}>📚</ThemedText>
          <ThemedText type="subtitle" style={styles.appName}>
            考研英语阅读
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.tagline}>
            每天一篇短阅读,按你的词汇量标出「该学的生词」
          </ThemedText>
        </View>

        {/* 卖点 */}
        <View style={styles.features}>
          {FEATURES.map(([emoji, text]) => (
            <View key={text} style={styles.featureRow}>
              <ThemedText style={styles.featureEmoji}>{emoji}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.featureText}>
                {text}
              </ThemedText>
            </View>
          ))}
        </View>

        {/* 主路径:登录 / 注册。带上 from=welcome,让认证页知道成功后该进 App 而不是原路返回 */}
        <View style={styles.actions}>
          <PrimaryButton label="登录" onPress={() => router.push('/auth/login?from=welcome')} />
          <PrimaryButton
            label="注册新账号"
            variant="outline"
            onPress={() => router.push('/auth/register?from=welcome')}
          />
        </View>

        {/* 次路径:不登录也能用(离线优先) */}
        <View style={styles.skipBlock}>
          <ThemedText type="small" themeColor="accent" onPress={handleSkip} style={styles.skip}>
            先不登录,直接使用
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.skipNote}>
            {isBackendConfigured
              ? '不登录时数据只存在这台手机上,换手机需要手动导出 / 恢复。'
              : '在线服务未配置,当前只能本地使用(不影响任何学习功能)。'}
          </ThemedText>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    justifyContent: 'center',
    gap: Spacing.four,
  },
  hero: { alignItems: 'center', gap: Spacing.two },
  logo: { fontSize: 64, lineHeight: 76 },
  appName: { fontSize: 26, lineHeight: 34 },
  tagline: { textAlign: 'center', lineHeight: 20, paddingHorizontal: Spacing.three },
  features: { gap: Spacing.two, paddingHorizontal: Spacing.two },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  featureEmoji: { fontSize: 20, lineHeight: 24 },
  featureText: { flex: 1, lineHeight: 20 },
  actions: { gap: Spacing.two + 2 },
  skipBlock: { alignItems: 'center', gap: Spacing.one + 2 },
  skip: { paddingVertical: Spacing.two },
  skipNote: { textAlign: 'center', lineHeight: 18, paddingHorizontal: Spacing.two },
});
