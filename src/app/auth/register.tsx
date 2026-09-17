/**
 * 注册页。
 *
 * 后端已关闭"邮箱确认"(mailer_autoconfirm),所以注册成功即处于登录状态,
 * 不需要去邮箱点链接 —— 这也是国内网络下最省事的方式。
 */

import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { AuthShell } from '@/components/auth-shell';
import { FormField } from '@/components/form-field';
import { PrimaryButton } from '@/components/primary-button';
import { StatusNote } from '@/components/status-note';
import { ThemedText } from '@/components/themed-text';
import { isBackendConfigured } from '@/config/backend';
import { register } from '@/domain/auth/store';
import { validateEmail, validateNickname, validatePassword, validatePasswordConfirm } from '@/domain/auth/validate';
import { pushProfile } from '@/domain/sync';
import { getAccount, saveAccount } from '@/storage/account';

interface FieldErrors {
  nickname?: string;
  email?: string;
  password?: string;
  confirm?: string;
}

export default function RegisterScreen() {
  const router = useRouter();

  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 昵称默认沿用本机已经设过的昵称,少填一次
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

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/profile');
  };

  const handleSubmit = async () => {
    const next: FieldErrors = {};
    const nicknameError = validateNickname(nickname);
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    const confirmError = validatePasswordConfirm(password, confirm);
    if (nicknameError) next.nickname = nicknameError;
    if (emailError) next.email = emailError;
    if (passwordError) next.password = passwordError;
    if (confirmError) next.confirm = confirmError;
    setErrors(next);
    setFailure(null);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    try {
      const session = await register(email, password, nickname);

      // 昵称/头像同时写进本机与云端,换手机登回来时资料一致
      const trimmed = nickname.trim();
      if (trimmed) await saveAccount({ nickname: trimmed });
      const account = await getAccount();
      void pushProfile({ nickname: account.nickname, avatar: account.avatar }).catch(() => {});

      if (!session) {
        setFailure('注册成功,但后端要求先在邮箱确认。请去邮箱点确认链接后再登录。');
        return;
      }

      setSuccess('注册成功,已自动登录。正在返回…');
      setTimeout(goBack, 900);
    } catch (e) {
      setFailure(e instanceof Error ? e.message : '注册失败,请稍后重试');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="注册"
      subtitle="用一个邮箱创建账号,注册成功即登录,不需要去邮箱确认。"
      footer={
        <Pressable onPress={() => router.replace('/auth/login')} hitSlop={8}>
          <ThemedText type="small" themeColor="textSecondary">
            已经有账号了?<ThemedText type="small" themeColor="accent">去登录</ThemedText>
          </ThemedText>
        </Pressable>
      }>
      {!isBackendConfigured ? (
        <StatusNote kind="error">在线服务未配置,注册不可用。请先在 src/config/backend.ts 填入后端地址。</StatusNote>
      ) : null}

      <FormField
        label="昵称(可留空)"
        value={nickname}
        onChangeText={setNickname}
        placeholder="给自己起个名字"
        autoCapitalize="none"
        returnKeyType="next"
        maxLength={12}
        error={errors.nickname}
        editable={!busy}
      />
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
        placeholder="至少 6 位"
        secure
        autoComplete="new-password"
        returnKeyType="next"
        hint="建议 8 位以上,混合字母和数字。忘记密码可用邮箱验证码重置。"
        error={errors.password}
        editable={!busy}
      />
      <FormField
        label="确认密码"
        value={confirm}
        onChangeText={setConfirm}
        placeholder="再输入一次"
        secure
        autoComplete="new-password"
        returnKeyType="done"
        error={errors.confirm}
        editable={!busy}
        onSubmitEditing={() => void handleSubmit()}
      />

      {failure ? <StatusNote kind="error">{failure}</StatusNote> : null}
      {success ? <StatusNote kind="success">{success}</StatusNote> : null}

      <PrimaryButton label="注册并登录" loading={busy} onPress={() => void handleSubmit()} />

      <ThemedText type="small" themeColor="textSecondary" style={styles.tip}>
        邮箱只用于登录和找回密码,不会收到任何推广邮件。
      </ThemedText>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  tip: { lineHeight: 18 },
});
