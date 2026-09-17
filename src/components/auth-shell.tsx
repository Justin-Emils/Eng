/**
 * 认证类页面(登录 / 注册 / 忘记密码)的共用外壳。
 * 抽出来的原因:这三个页面结构完全一致(返回栏 + 标题 + 表单 + 底部链接),
 * 各写一份必然出现间距/字号不一致;统一在这里改。
 */

import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** 底部链接区(如"还没有账号?去注册") */
  footer?: ReactNode;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  return (
    <ThemedView style={styles.flex}>
      <View
        style={[
          styles.topBar,
          {
            paddingTop: insets.top + Spacing.two,
            borderBottomColor: theme.border,
            borderBottomWidth: StyleSheet.hairlineWidth,
          },
        ]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
          <ThemedText style={styles.backIcon} themeColor="accent">
            ‹
          </ThemedText>
        </Pressable>
        <ThemedText type="smallBold">{title}</ThemedText>
        <View style={styles.topBarRight} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.six }]}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="on-drag">
          {subtitle ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
              {subtitle}
            </ThemedText>
          ) : null}

          <ThemedView type="backgroundElement" style={styles.card}>
            {children}
          </ThemedView>

          {footer ? <View style={styles.footer}>{footer}</View> : null}

          <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
            说明:账号只用于把学习数据同步到云端。不登录也能完整使用全部功能,
            数据一直存在这台手机上。
          </ThemedText>
        </ScrollView>
      </KeyboardAvoidingView>
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
  subtitle: { lineHeight: 20 },
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
  footer: { gap: Spacing.two, alignItems: 'center', marginTop: Spacing.two },
  note: { lineHeight: 20, paddingHorizontal: Spacing.one, marginTop: Spacing.two },
});
