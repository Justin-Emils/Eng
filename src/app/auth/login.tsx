/**
 * 登录页。
 *
 * 只做一件事:邮箱 + 密码换登录态。成功后返回上一页(通常是从「我的 → 账号」进来的),
 * 并把登录态写进全局 store —— 云同步、账号信息都会立刻跟着变。
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { autoSyncAfterLogin } from '@/domain/sync';
import { useAuth } from '@/hooks/use-auth';
import { getSettings } from '@/storage/settings';

export default function LoginScreen() {
  const router = useRouter();
  const auth = useAuth();
  /** 从欢迎页进来的(新用户首次路径):成功后要进 App,不能原路退回欢迎页 */
  const params = useLocalSearchParams<{ from?: string }>();
  const fromGate = params.from === 'welcome';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
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

      /**
       * 老用户登录后自动同步一次云端数据(只补不覆盖,见 domain/sync.ts):
       * 新手机上本机为空 → 直接把进度接上;本机已有数据 → 只合并昵称/头像,不覆盖。
       */
      let note = '';
      let restored = false;
      try {
        const result = await autoSyncAfterLogin();
        note = result.note;
        restored = result.restored;
      } catch (e) {
        note = `自动同步失败:${e instanceof Error ? e.message : '未知错误'}(可在账号页手动上传 / 恢复)`;
      }
      setSuccess(note);

      const settings = await getSettings();
      if (!settings.onboarded) {
        // 还没建本机学习档案:云端恢复成功就直接开始用,否则补完引导
        setTimeout(() => router.replace(restored ? '/(tabs)' : '/onboarding'), 1100);
        return;
      }
      if (fromGate) {
        // 本来就在欢迎页(没有一个"上一页"可回),直接进首页
        setTimeout(() => router.replace('/(tabs)'), 900);
        return;
      }
      setTimeout(goBack, 800);
    } catch (e) {
      setFailure(e instanceof Error ? e.message : '登录失败,请稍后重试');
      // 只有失败时才解除 loading:成功后会跳走,期间保持 loading 可以防止连点重复登录
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
          <Pressable
            onPress={() => router.replace(fromGate ? '/auth/register?from=welcome' : '/auth/register')}
            hitSlop={8}>
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
      {success ? <StatusNote kind="success">{success}</StatusNote> : null}

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
