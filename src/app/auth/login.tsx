/**
 * 登录页。
 *
 * 只做一件事:邮箱 + 密码换登录态。成功后返回上一页(通常是从「我的 → 账号」进来的),
 * 并把登录态写进全局 store —— 云同步、账号信息都会立刻跟着变。
 */

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { AuthShell } from '@/components/auth-shell';
import { FormField } from '@/components/form-field';
import { PrimaryButton } from '@/components/primary-button';
import { StatusNote } from '@/components/status-note';
import { ThemedText } from '@/components/themed-text';
import { isBackendConfigured } from '@/config/backend';
import { signIn } from '@/domain/auth/store';
import { validateEmail, validatePassword } from '@/domain/auth/validate';
import { mergeProfileFromCloud } from '@/domain/sync';
import { useAuth } from '@/hooks/use-auth';

export default function LoginScreen() {
  const router = useRouter();
  const auth = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/profile');
  };

  const handleSubmit = async () => {
    const next: { email?: string; password?: string } = {};
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    if (emailError) next.email = emailError;
    if (passwordError) next.password = passwordError;
    setErrors(next);
    setFailure(null);
    if (next.email || next.password) return;

    setBusy(true);
    try {
      await signIn(email, password);
      // 首次在新手机登录时,把云端的昵称/头像补到本机(失败不影响登录本身)
      void mergeProfileFromCloud().catch(() => {});
      goBack();
    } catch (e) {
      setFailure(e instanceof Error ? e.message : '登录失败,请稍后重试');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="登录"
      subtitle="登录后可以把生词、阅读进度、设置同步到云端,换手机不丢数据。"
      footer={
        <>
          <Pressable onPress={() => router.push('/auth/forgot')} hitSlop={8}>
            <ThemedText type="small" themeColor="accent">
              忘记密码?
            </ThemedText>
          </Pressable>
          <Pressable onPress={() => router.replace('/auth/register')} hitSlop={8}>
            <ThemedText type="small" themeColor="textSecondary">
              还没有账号?<ThemedText type="small" themeColor="accent">去注册</ThemedText>
            </ThemedText>
          </Pressable>
        </>
      }>
      {!isBackendConfigured ? (
        <StatusNote kind="error">在线服务未配置,登录不可用。请先在 src/config/backend.ts 填入后端地址。</StatusNote>
      ) : null}

      {auth.status === 'authed' ? (
        <StatusNote kind="info">
          当前已登录:{auth.session?.user.email || '未知邮箱'}。想换账号请先退出登录。
        </StatusNote>
      ) : null}

      <FormField
        label="邮箱"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoComplete="email"
        returnKeyType="next"
        error={errors.email}
        editable={!busy}
      />
      <FormField
        label="密码"
        value={password}
        onChangeText={setPassword}
        placeholder="输入密码"
        secure
        autoComplete="current-password"
        returnKeyType="done"
        error={errors.password}
        editable={!busy}
        onSubmitEditing={() => void handleSubmit()}
      />

      {failure ? <StatusNote kind="error">{failure}</StatusNote> : null}

      <PrimaryButton label="登录" loading={busy} onPress={() => void handleSubmit()} />

      <ThemedText type="small" themeColor="textSecondary" style={styles.tip}>
        登录只影响同步:不登录时阅读、背单词、复习全部照常使用。
      </ThemedText>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  tip: { lineHeight: 18 },
});
