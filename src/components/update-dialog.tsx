/**
 * 检查更新弹窗（C3）。
 *
 * 触发时机:App 启动后自动查一次(6 小时节流,见 domain/update),
 * 有新版本且没被跳过时弹出来。三条交互:
 *   · 「稍后」—— 关掉,下次启动还会再问;
 *   · 「本次更新前不再提示」—— 记住这个版本号,只有出现更高版本才再问;
 *   · 「去下载」—— 用系统浏览器打开 APK 直链(GitHub Release 资源)。
 *
 * 为什么不自己做下载/安装:App 里下载 APK 再触发安装需要额外权限与原生模块,
 * 而且自己升级自己容易踩坑。交给浏览器 + 系统安装器最稳,用户也看得见来源。
 *
 * 拆成两个导出是有意的:
 *   · `UpdatePrompt` 是纯展示(接收一份版本信息),开发页可以拿它预览样式;
 *   · `UpdateDialog` 负责"启动时自动检查"和记住跳过的版本。
 * 本地构建的版本号经常比线上 release 新,不拆出来的话这个弹窗根本没法在真机上看到。
 */

import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { checkForUpdate, skipVersion, type LatestRelease } from '@/domain/update';
import { useTheme } from '@/hooks/use-theme';

export function UpdatePrompt({
  release,
  current,
  onClose,
  onSkipVersion,
}: {
  release: LatestRelease;
  /** 当前版本(展示用) */
  current: string;
  onClose: () => void;
  /** 勾了"本次更新前不再提示"时回调(预览时不传) */
  onSkipVersion?: (version: string) => void;
}) {
  const theme = useTheme();
  const [dontRemind, setDontRemind] = useState(false);
  const [busy, setBusy] = useState(false);

  const openDownload = useCallback(async () => {
    setBusy(true);
    try {
      await Linking.openURL(release.downloadUrl);
    } catch {
      // 打不开:把链接复制到剪贴板,用户自己粘到浏览器(国内网络下 github.com 常常打不开)
      await Clipboard.setStringAsync(release.downloadUrl).catch(() => {});
      Alert.alert(
        '打不开下载链接',
        `地址已复制到剪贴板:\n${release.downloadUrl}\n\n如果浏览器也打不开 github.com,请先连上代理再粘贴访问。`,
      );
    } finally {
      setBusy(false);
      onClose();
    }
  }, [onClose, release.downloadUrl]);

  /** 只复制链接,不尝试打开 */
  const copyLink = useCallback(async () => {
    await Clipboard.setStringAsync(release.downloadUrl).catch(() => {});
    Alert.alert('下载地址已复制', release.downloadUrl);
  }, [release.downloadUrl]);

  const handleDownload = useCallback(() => {
    if (dontRemind) onSkipVersion?.(release.version);
    void openDownload();
  }, [dontRemind, onSkipVersion, openDownload, release.version]);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <ThemedView type="backgroundElement" frame="playbill" style={styles.card}>
          <ThemedText type="smallBold" themeColor="accent">
            发现新版本
          </ThemedText>
          <ThemedText type="subtitle" style={styles.version}>
            v{release.version}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            当前 v{current}
            {release.title ? ` · ${release.title}` : ''}
          </ThemedText>

          {release.notes.length > 0 ? (
            <View style={styles.notes}>
              {release.notes.slice(0, 6).map((note) => (
                <View key={note} style={styles.noteRow}>
                  <View style={[styles.bullet, { backgroundColor: theme.accent }]} />
                  <ThemedText type="small" style={styles.noteText}>
                    {note}
                  </ThemedText>
                </View>
              ))}
              {release.notes.length > 6 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  …共 {release.notes.length} 条,完整列表见「更新日志」
                </ThemedText>
              ) : null}
            </View>
          ) : null}

          {/* 「本次更新前不再提示」:勾上就记住这个版本号 */}
          <Pressable
            onPress={() => setDontRemind((v) => !v)}
            style={({ pressed }) => [styles.remindRow, pressed && styles.pressed]}>
            <View
              style={[
                styles.checkbox,
                { borderColor: dontRemind ? theme.accent : theme.textSecondary },
                dontRemind && { backgroundColor: theme.accent },
              ]}>
              {dontRemind ? (
                <ThemedText type="smallBold" style={{ color: theme.onAccentStrong, fontSize: 11 }}>
                  ✓
                </ThemedText>
              ) : null}
            </View>
            <ThemedText type="small" themeColor="textSecondary" style={styles.remindText}>
              本次更新前不再提示(出现更高版本时会再问)
            </ThemedText>
          </Pressable>

          <View style={styles.actions}>
            <Pressable onPress={() => void copyLink()} style={({ pressed }) => pressed && styles.pressed}>
              <ThemedView type="backgroundSelected" radius="chip" style={styles.btnGhost}>
                <ThemedText type="small" themeColor="textSecondary">
                  复制链接
                </ThemedText>
              </ThemedView>
            </Pressable>
            <Pressable onPress={onClose} style={({ pressed }) => pressed && styles.pressed}>
              <ThemedView type="backgroundSelected" radius="chip" style={styles.btnGhost}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  稍后
                </ThemedText>
              </ThemedView>
            </Pressable>
            <Pressable
              disabled={busy}
              onPress={handleDownload}
              style={({ pressed }) => pressed && styles.pressed}>
              <ThemedView type="backgroundSelected" radius="chip" style={styles.btnPrimary}>
                <ThemedText type="smallBold" themeColor="accent">
                  {busy ? '打开中…' : '去下载'}
                </ThemedText>
              </ThemedView>
            </Pressable>
          </View>
        </ThemedView>
      </View>
    </Modal>
  );
}

/** 启动时自动检查一次;没有新版本就什么都不渲染 */
export function UpdateDialog() {
  const [found, setFound] = useState<{ release: LatestRelease; current: string } | null>(null);

  useEffect(() => {
    void (async () => {
      await Promise.resolve();
      const result = await checkForUpdate();
      if (result.status !== 'available' || !result.latest) return;
      setFound({ release: result.latest, current: result.current });
    })();
  }, []);

  const close = useCallback(() => setFound(null), []);

  if (!found) return null;
  return (
    <UpdatePrompt
      release={found.release}
      current={found.current}
      onClose={close}
      onSkipVersion={(version) => {
        void skipVersion(version);
      }}
    />
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  backdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  card: {
    width: '100%',
    maxWidth: 460,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.four,
    gap: Spacing.one,
  },
  version: { fontSize: 26, lineHeight: 34 },
  notes: {
    marginTop: Spacing.two,
    gap: Spacing.two,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  bullet: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 8,
  },
  noteText: {
    flex: 1,
    lineHeight: 20,
  },
  remindRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  remindText: { flex: 1, lineHeight: 18 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  btnGhost: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  btnPrimary: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderWidth: 1,
  },
  pressed: { opacity: 0.7 },
});
