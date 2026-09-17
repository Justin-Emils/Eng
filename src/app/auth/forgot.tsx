/**
 * 忘记密码 / 修改密码。
 *
 * 两种模式共用一个页面:
 * - 默认(忘记密码):输邮箱 → 收 6 位验证码 → 验证码 + 新密码 → 直接重置并登录;
 * - `?mode=change`(已登录时改密码):跳过邮箱环节,直接设新密码。
 *
 * 为什么用验证码而不是邮件里的重置链接:链接方式要在 Supabase 配回调地址、
 * 还要在 Android 上注册深链,任何一环没配好就是"点了没反应"。
 * 验证码只需要用户手输 6 位数字,没有可失效的中间环节。
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AuthShell } from '@/components/auth-shell';
import { FormField } from '@/components/form-field';
import { PrimaryButton } from '@/components/primary-button';
import { StatusNote } from '@/components/status-note';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { changePassword, requestPasswordReset, resetPasswordWithCode } from '@/domain/auth/store';
import { validateCode, validateEmail, validatePassword, validatePasswordConfirm } from '@/domain/auth/validate';
import { useAuth } from '@/hooks/use-auth';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const auth = useAuth();
  const params = useLocalSearchParams<{ mode?: string }>();
  const isChangeMode = params.mode === 'change';

  const [step, setStep] = useState<'request' | 'verify'>('request');
  // 已登录时(改密码模式)直接用当前账号邮箱作初值 —— 用惰性初始化而不是 effect,
  // 避免"渲染 → effect 里 setState → 再渲染"的级联渲染
  const [email, setEmail] = useState(() => auth.session?.user.email ?? '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ email?: string; code?: string; password?: string; confirm?: string }>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 卸载时清掉倒计时,避免组件没了还在跳
  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
    },
    [],
  );

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/profile');
  };

  /** 发送验证码后的 60 秒冷却:后端对发信有小时级限速,提前拦住更友好 */
  const startCooldown = () => {
    setCooldown(60);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCooldown((current) => {
        if (current <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
  };

  const handleSendCode = async () => {
    const emailError = validateEmail(email);
    setErrors(emailError ? { email: emailError } : {});
    setFailure(null);
    if (emailError) return;

    setBusy(true);
    try {
      await requestPasswordReset(email);
      setStep('verify');
      setSuccess(`验证码已发送到 ${email.trim()},请查看邮件(含垃圾箱),10 分钟内有效。`);
      startCooldown();
    } catch (e) {
      setFailure(e instanceof Error ? e.message : '发送失败,请稍后重试');
    } finally {
      setBusy(false);
    }
  };

  const handleResetWithCode = async () => {
    const next: typeof errors = {};
    const codeError = validateCode(code);
    const passwordError = validatePassword(password);
    const confirmError = validatePasswordConfirm(password, confirm);
    if (codeError) next.code = codeError;
    if (passwordError) next.password = passwordError;
    if (confirmError) next.confirm = confirmError;
    setErrors(next);
    setFailure(null);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    try {
      await resetPasswordWithCode(email, code, password);
      setSuccess('密码已重置,已自动登录。正在返回…');
      setTimeout(goBack, 900);
    } catch (e) {
      setFailure(e instanceof Error ? e.message : '重置失败,请稍后重试');
    } finally {
      setBusy(false);
    }
  };

  const handleChangePassword = async () => {
    const next: typeof errors = {};
    const passwordError = validatePassword(password);
    const confirmError = validatePasswordConfirm(password, confirm);
    if (passwordError) next.password = passwordError;
    if (confirmError) next.confirm = confirmError;
    setErrors(next);
    setFailure(null);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    try {
      await changePassword(password);
      setSuccess('密码已修改,其他设备需要重新登录。正在返回…');
      setTimeout(goBack, 900);
    } catch (e) {
      setFailure(e instanceof Error ? e.message : '修改失败,请稍后重试');
    } finally {
      setBusy(false);
    }
  };

  // ---------- 已登录:直接改密码 ----------
  if (isChangeMode) {
    return (
      <AuthShell title="修改密码" subtitle={`当前账号:${email || '未知邮箱'}`}>
        <FormField
          label="新密码"
          value={password}
          onChangeText={setPassword}
          placeholder="至少 6 位"
          secure
          autoComplete="new-password"
          returnKeyType="next"
          error={errors.password}
          editable={!busy}
        />
        <FormField
          label="确认新密码"
          value={confirm}
          onChangeText={setConfirm}
          placeholder="再输入一次"
          secure
          autoComplete="new-password"
          returnKeyType="done"
          error={errors.confirm}
          editable={!busy}
          onSubmitEditing={() => void handleChangePassword()}
        />
        {failure ? <StatusNote kind="error">{failure}</StatusNote> : null}
        {success ? <StatusNote kind="success">{success}</StatusNote> : null}
        <PrimaryButton label="保存新密码" loading={busy} onPress={() => void handleChangePassword()} />
        <ThemedText type="small" themeColor="textSecondary" style={styles.tip}>
          改完密码后,其它设备上的登录会失效,需要重新登录。这台手机会保持登录。
        </ThemedText>
      </AuthShell>
    );
  }

  // ---------- 第一步:发验证码 ----------
  if (step === 'request') {
    return (
      <AuthShell
        title="忘记密码"
        subtitle="输入注册用的邮箱,我们会发一封含 6 位验证码的邮件给你,用它可以重设密码。"
        footer={
          <ThemedText type="small" themeColor="textSecondary">
            想起密码了?<ThemedText type="small" themeColor="accent" onPress={goBack}>去登录</ThemedText>
          </ThemedText>
        }>
        <FormField
          label="邮箱"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoComplete="email"
          returnKeyType="done"
          error={errors.email}
          editable={!busy}
          onSubmitEditing={() => void handleSendCode()}
        />
        {failure ? <StatusNote kind="error">{failure}</StatusNote> : null}
        <PrimaryButton label="发送验证码" loading={busy} onPress={() => void handleSendCode()} />
        <ThemedText type="small" themeColor="textSecondary" style={styles.tip}>
          免费版邮件通道有小时级限速,如果提示发送过于频繁,等几分钟再试。
        </ThemedText>
      </AuthShell>
    );
  }

  // ---------- 第二步:验证码 + 新密码 ----------
  return (
    <AuthShell title="重设密码" subtitle={`验证码已发往 ${email.trim()}`}>
      <FormField
        label="邮箱验证码"
        value={code}
        onChangeText={setCode}
        placeholder="邮件里的 6 位数字"
        keyboardType="number-pad"
        returnKeyType="next"
        maxLength={6}
        error={errors.code}
        editable={!busy}
      />
      <FormField
        label="新密码"
        value={password}
        onChangeText={setPassword}
        placeholder="至少 6 位"
        secure
        autoComplete="new-password"
        returnKeyType="next"
        error={errors.password}
        editable={!busy}
      />
      <FormField
        label="确认新密码"
        value={confirm}
        onChangeText={setConfirm}
        placeholder="再输入一次"
        secure
        autoComplete="new-password"
        returnKeyType="done"
        error={errors.confirm}
        editable={!busy}
        onSubmitEditing={() => void handleResetWithCode()}
      />

      {failure ? <StatusNote kind="error">{failure}</StatusNote> : null}
      {success ? <StatusNote kind="success">{success}</StatusNote> : null}

      <PrimaryButton label="重置密码并登录" loading={busy} onPress={() => void handleResetWithCode()} />

      <View style={styles.footerRow}>
        <PrimaryButton
          label={cooldown > 0 ? `${cooldown} 秒后可重发` : '重新发送验证码'}
          disabled={cooldown > 0}
          onPress={() => void handleSendCode()}
        />
      </View>
      <ThemedText type="small" themeColor="textSecondary" style={styles.tip}>
        没收到?确认邮箱填对、看看垃圾邮件;也可以在 Supabase 控制台
        Authentication → Users 里直接确认该用户是否存在。
      </ThemedText>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  tip: { lineHeight: 18 },
  footerRow: { marginTop: Spacing.half },
});
