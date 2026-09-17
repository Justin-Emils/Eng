import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { PrimaryButton } from '@/components/primary-button';
import { SettingRow } from '@/components/setting-row';
import { StatusNote } from '@/components/status-note';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { isBackendConfigured } from '@/config/backend';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { isImageAvatar, pickAvatarFromLibrary } from '@/domain/avatar';
import { signOut } from '@/domain/auth/store';
import { describeBackup, exportBackup, importBackup } from '@/domain/backup';
import { pullBackup, pushBackup, pushProfile, restoreFromCloud } from '@/domain/sync';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import {
  AVATAR_CHOICES,
  DEFAULT_AVATAR,
  getAccount,
  joinedDays,
  saveAccount,
  type AccountInfo,
} from '@/storage/account';
import { getWords } from '@/storage/words';

/**
 * 账号与同步页。
 *
 * 两部分刻意分开:
 * - 上半「本机身份」:昵称/头像/加入时间 —— 不登录也有,随时可改;
 * - 下半「云端账号」:邮箱注册登录、上传/恢复学习数据、改密码、退出。
 * 数据本身始终以本机为准,云端只是搬运通道,所以断网、不登录都不影响使用。
 */
export default function AccountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const auth = useAuth();

  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [nicknameDraft, setNicknameDraft] = useState('');
  const [savedTip, setSavedTip] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupInfo, setBackupInfo] = useState<string | null>(null);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncNote, setSyncNote] = useState<string | null>(null);

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
    // 已登录时顺带把 emoji 头像同步到云端(相册图片是本机文件路径,不参与同步)
    if (auth.status === 'authed') void pushProfile({ avatar: emoji }).catch(() => {});
  };

  const saveNickname = async () => {
    const next = await saveAccount({ nickname: nicknameDraft.trim() });
    setAccount(next);
    setNicknameDraft(next.nickname);
    setSavedTip(true);
    setTimeout(() => setSavedTip(false), 1500);
    if (auth.status === 'authed' && next.nickname) {
      void pushProfile({ nickname: next.nickname }).catch(() => {});
    }
  };

  /** 从相册选图作为头像(拷贝到 App 文档目录,不会被系统清理) */
  const handlePickImage = async () => {
    setAvatarBusy(true);
    try {
      const uri = await pickAvatarFromLibrary();
      if (uri) {
        const next = await saveAccount({ avatar: uri });
        setAccount(next);
      }
    } catch (e) {
      Alert.alert('选图失败', e instanceof Error ? e.message : '请稍后重试');
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleResetAvatar = async () => {
    const next = await saveAccount({ avatar: DEFAULT_AVATAR });
    setAccount(next);
  };

  const handleCopyId = async () => {
    if (!account) return;
    await Clipboard.setStringAsync(account.id);
    Alert.alert('已复制本机 ID', '这是本机的身份标识(与云端账号无关)。客服排查问题时提供它即可。');
  };

  /** 导出备份到剪贴板 */
  const handleExport = async () => {
    setBackupBusy(true);
    try {
      const raw = await exportBackup();
      await Clipboard.setStringAsync(raw);
      setBackupInfo(`✓ 已复制备份(${Math.max(1, Math.round(raw.length / 1024))} KB),粘到备忘录/微信保存`);
    } catch (e) {
      setBackupInfo(`✗ 导出失败:${e instanceof Error ? e.message : '未知错误'}`);
    } finally {
      setBackupBusy(false);
    }
  };

  /** 从剪贴板导入备份(覆盖本机数据,二次确认) */
  const handleImport = async () => {
    const raw = await Clipboard.getStringAsync();
    if (!raw || !raw.trim()) {
      setBackupInfo('✗ 剪贴板为空,请先复制备份内容');
      return;
    }
    const summary = describeBackup(raw);
    Alert.alert('用备份覆盖本机数据?', `${summary}\n\n当前的学习数据会被替换,建议先导出一次当前数据。`, [
      { text: '取消', style: 'cancel' },
      {
        text: '覆盖导入',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setBackupBusy(true);
            try {
              const n = await importBackup(raw);
              setBackupInfo(`✓ 已导入 ${n} 项数据,请重启 App 生效`);
            } catch (e) {
              setBackupInfo(`✗ 导入失败:${e instanceof Error ? e.message : '未知错误'}`);
            } finally {
              setBackupBusy(false);
            }
          })();
        },
      },
    ]);
  };

  /** 上传本机数据到云端(整份备份,覆盖云端旧备份) */
  const handleCloudUpload = async () => {
    setSyncBusy(true);
    setSyncNote(null);
    try {
      await pushBackup();
      setSyncNote(`✓ 已上传到云端(${wordCount} 个生词 + 进度、设置)`);
    } catch (e) {
      setSyncNote(`✗ 上传失败:${e instanceof Error ? e.message : '未知错误'}`);
    } finally {
      setSyncBusy(false);
    }
  };

  /** 从云端恢复(覆盖本机,二次确认) */
  const handleCloudRestore = async () => {
    setSyncBusy(true);
    setSyncNote(null);
    try {
      const remote = await pullBackup();
      if (!remote) {
        setSyncNote('云端还没有备份,先点上面的「上传本机数据到云端」');
        return;
      }
      const when = remote.updatedAt ? new Date(remote.updatedAt).toLocaleString() : '未知时间';
      Alert.alert(
        '用云端备份覆盖本机?',
        `云端备份:${remote.wordCount} 个生词 · 更新于 ${when}\n本机现有:${wordCount} 个生词\n\n覆盖后本机数据会被替换。建议先「上传」一次,把当前状态留在云端。`,
        [
          { text: '取消', style: 'cancel' },
          {
            text: '覆盖恢复',
            style: 'destructive',
            onPress: () => {
              void (async () => {
                try {
                  const n = await restoreFromCloud(remote);
                  setSyncNote(`✓ 已从云端恢复 ${n} 项数据,请重启 App 生效`);
                } catch (e) {
                  setSyncNote(`✗ 恢复失败:${e instanceof Error ? e.message : '未知错误'}`);
                }
              })();
            },
          },
        ],
      );
    } catch (e) {
      setSyncNote(`✗ 读取云端备份失败:${e instanceof Error ? e.message : '未知错误'}`);
    } finally {
      setSyncBusy(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('退出登录?', '退出只影响云端同步,本机的生词和进度都会保留。', [
      { text: '取消', style: 'cancel' },
      {
        text: '退出登录',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await signOut();
            setSyncNote('已退出登录,本机数据保留');
          })();
        },
      },
    ]);
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
            <Avatar source={account?.avatar ?? DEFAULT_AVATAR} size={64} />
            <View style={styles.identityBody}>
              <ThemedText type="smallBold" style={styles.nickname}>
                {account?.nickname || '未设置昵称'}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                本地账号 · 加入 {account ? joinedDays(account) : '–'} 天
              </ThemedText>
              <Pressable onPress={() => void handleCopyId()} hitSlop={6}>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  ID {account?.id ?? '–'} · 点按复制
                </ThemedText>
              </Pressable>
            </View>
          </View>

          {/* 自定义头像:相册选图(存到 App 目录) + emoji 备选 */}
          <View style={styles.avatarActions}>
            <PrimaryButton
              label={avatarBusy ? '处理中…' : '从相册选择头像'}
              loading={avatarBusy}
              onPress={() => void handlePickImage()}
              style={styles.avatarBtn}
            />
            {isImageAvatar(account?.avatar ?? '') ? (
              <Pressable onPress={() => void handleResetAvatar()} hitSlop={6}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.resetAvatar}>
                  改用 emoji 头像
                </ThemedText>
              </Pressable>
            ) : null}
          </View>

          <ThemedText type="smallBold" style={styles.label}>
            或选一个 emoji 头像
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

        {/* 云端账号:登录后可跨设备同步;不登录时这里明确说明,不做假入口 */}
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
          云端账号
        </ThemedText>
        <ThemedView type="backgroundElement" style={styles.list}>
          {!isBackendConfigured ? (
            <SettingRow
              label="在线服务未配置"
              sublabel="请在 src/config/backend.ts 填入 Supabase 地址与公开密钥"
              value="不可用"
              last
            />
          ) : auth.status === 'loading' ? (
            <SettingRow label="正在恢复登录状态…" last />
          ) : auth.status === 'authed' ? (
            <>
              <SettingRow
                label={account?.nickname || '已登录'}
                sublabel={auth.session?.user.email ?? ''}
                value="✓ 已登录"
              />
              <SettingRow
                label="上传本机数据到云端"
                sublabel="把生词本、进度、设置整份推到云端(覆盖云端旧备份)"
                value={syncBusy ? '处理中…' : '上传 ›'}
                onPress={() => {
                  if (!syncBusy) void handleCloudUpload();
                }}
              />
              <SettingRow
                label="从云端恢复"
                sublabel="用云端备份覆盖本机数据(会二次确认)"
                value={syncBusy ? '处理中…' : '恢复 ›'}
                onPress={() => {
                  if (!syncBusy) void handleCloudRestore();
                }}
              />
              <SettingRow
                label="修改密码"
                sublabel="已登录状态直接改,不需要邮箱验证码"
                value="修改 ›"
                onPress={() => router.push('/auth/forgot?mode=change')}
              />
              <SettingRow
                label="退出登录"
                sublabel="本机数据保留,只是停止与云端同步"
                value="退出 ›"
                onPress={handleSignOut}
                last
              />
            </>
          ) : (
            <>
              <SettingRow
                label="登录"
                sublabel="已有账号,输入邮箱和密码"
                value="去登录 ›"
                onPress={() => router.push('/auth/login')}
              />
              <SettingRow
                label="注册"
                sublabel="用邮箱创建账号,注册即登录,无需收确认邮件"
                value="去注册 ›"
                onPress={() => router.push('/auth/register')}
              />
              <SettingRow
                label="同步内容"
                sublabel={`生词本、复习进度、阅读记录、每日目标、设置、昵称头像 · 本机现有 ${wordCount} 个生词`}
                last
              />
            </>
          )}
        </ThemedView>
        {syncNote ? (
          <StatusNote kind={syncNote.startsWith('✗') ? 'error' : 'success'}>{syncNote}</StatusNote>
        ) : null}

        {/* 备份与恢复(没有云端时最实用的"数据迁移") */}
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
          备份与恢复
        </ThemedText>
        <ThemedView type="backgroundElement" style={styles.list}>
          <SettingRow
            label="导出学习数据"
            sublabel="生词本、复习进度、阅读记录、打卡、设置、头像 → 复制到剪贴板"
            value={backupBusy ? '处理中…' : '导出 ›'}
            onPress={() => {
              if (!backupBusy) void handleExport();
            }}
          />
          <SettingRow
            label="从备份恢复"
            sublabel="把之前复制的备份粘贴到剪贴板,点这里覆盖导入(会二次确认)"
            value={backupBusy ? '处理中…' : '导入 ›'}
            onPress={() => {
              if (!backupBusy) void handleImport();
            }}
            last
          />
        </ThemedView>
        {backupInfo ? (
          <ThemedText type="small" themeColor="accent" style={styles.note}>
            {backupInfo}
          </ThemedText>
        ) : null}

        <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
          说明:这个 App 是「离线优先」的 —— 所有学习数据都保存在手机本地,
          不登录也能完整使用。云端账号只负责「换手机时不丢数据」:登录后点「上传」把数据推上去,
          在新手机上登录再点「恢复」即可。不想用云端时,上面的「导出 / 从备份恢复」也能把数据搬过去。
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
  avatarActions: { marginTop: Spacing.two, gap: Spacing.one, alignItems: 'flex-start' },
  avatarBtn: { alignSelf: 'stretch' },
  resetAvatar: { paddingVertical: Spacing.one },
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
