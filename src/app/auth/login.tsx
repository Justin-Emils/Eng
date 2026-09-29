/**
 * 登录页。
 *
 * 只做一件事:邮箱 + 密码换登录态。成功后返回上一页(通常是从「我的 → 账号」进来的),
 * 并把登录态写进全局 store —— 云同步、账号信息都会立刻跟着变。
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet } from 'react-native';

import { AuthShell } from '@/components/auth-shell';
import { FormField } from '@/components/form-field';
import { PrimaryButton } from '@/components/primary-button';
import { StatusNote } from '@/components/status-note';
import { ThemedText } from '@/components/themed-text';
import { isBackendConfigured } from '@/config/backend';
import { signIn } from '@/domain/auth/store';
import { validateEmail, validatePassword } from '@/domain/auth/validate';
import { adoptLocalDataToCurrentAccount, autoSyncAfterLogin, planLoginSync, restoreFromCloud } from '@/domain/sync';
import { markPulled } from '@/domain/autosync';
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
       * 登录后的同步方向(B2 + 自动同步):
       *   本机无数据 + 云端有 → 自动恢复;本机有 + 云端无 → 自动上传;
       *   两边都有 → **必须问用户以哪边为准**(唯一会丢数据的分支,不允许自动决定);
       *   归属属于另一个账号 → 同样交给用户处理。
       * 见 domain/sync.ts 的 planLoginSync 与 domain/autosync.ts 的安全边界。
       */
      const plan = await planLoginSync().catch(() => null);

      const finishNav = (restoredNow: boolean) => {
        void (async () => {
          const settings = await getSettings();
          if (!settings.onboarded) {
            // 还没建本机学习档案:恢复成功就直接开始用,否则补完引导
            setTimeout(() => router.replace(restoredNow ? '/(tabs)' : '/onboarding'), 1100);
            return;
          }
          if (fromGate) {
            setTimeout(() => router.replace('/(tabs)'), 900);
            return;
          }
          setTimeout(goBack, 800);
        })();
      };

      if (plan && plan.auto === null) {
        // 需要用户决策:两条路都会覆盖一边,所以文案必须写清"覆盖的是哪边"
        setBusy(false);
        const remoteWhen = plan.remoteUpdatedAt
          ? new Date(plan.remoteUpdatedAt).toLocaleString()
          : '时间未知';
        Alert.alert(
          '本机与云端都有数据',
          `${plan.message}\n\n本机:${plan.localWords} 个生词\n云端:${plan.remoteWords} 个生词(更新于 ${remoteWhen})\n\n选择以哪边为准 —— 另一边会被覆盖。`,
          [
            {
              text: '用云端数据覆盖本机',
              onPress: () => {
                void (async () => {
                  try {
                    const n = await restoreFromCloud({
                      raw: plan.remoteRaw,
                      updatedAt: plan.remoteUpdatedAt,
                      device: '',
                      wordCount: plan.remoteWords,
                    });
                    await markPulled();
                    setSuccess(`已用云端数据覆盖本机(${n} 项)`);
                  } catch (e) {
                    setFailure(`覆盖失败:${e instanceof Error ? e.message : '未知错误'}`);
                  }
                  finishNav(true);
                })();
              },
            },
            {
              text: '用本机数据覆盖云端',
              onPress: () => {
                void (async () => {
                  try {
                    await adoptLocalDataToCurrentAccount();
                    setSuccess('已把本机数据同步到云端');
                  } catch (e) {
                    setFailure(`上传失败:${e instanceof Error ? e.message : '未知错误'}`);
                  }
                  finishNav(false);
                })();
              },
            },
            { text: '稍后处理(去账号页)', style: 'cancel', onPress: () => finishNav(false) },
          ],
        );
        return;
      }

      // 可以自动决定:交给 autoSyncAfterLogin(内部按"本机为空才恢复"处理)
      let note = '';
      let restored = false;
      try {
        if (plan?.auto === 'upload') {
          // 本机有数据、云端为空:直接绑定并上传,顺手建立同步基线
          await adoptLocalDataToCurrentAccount();
          note = `已把本机的 ${plan.localWords} 个生词同步到云端`;
        } else {
          const result = await autoSyncAfterLogin();
          note = result.note;
          restored = result.restored;
        }
      } catch (e) {
        note = `自动同步失败:${e instanceof Error ? e.message : '未知错误'}(可在账号页手动同步)`;
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
