import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { CHANGELOG } from '@/data/changelog';
import { APP_VERSION } from '@/domain/app-version';
import { useTheme } from '@/hooks/use-theme';

/**
 * 更新日志:每个版本改了什么。
 *
 * 数据来自内嵌的 `data/changelog.ts`(断网也能看,见那里的注释)。
 * 「当前版本」按 APP_VERSION 高亮 —— 不需要在数据里手动标记,
 * 否则每次发版都得记得改两处。
 */
export default function ChangelogScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const theme = useTheme();

  return (
    <ThemedView style={styles.flex}>
      <View style={[styles.topBar, { paddingTop: insets.top + Spacing.two }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
          <ThemedText type="subtitle">‹</ThemedText>
        </Pressable>
        <View style={styles.topBarText}>
          <ThemedText type="smallBold">更新日志</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            当前 v{APP_VERSION}
          </ThemedText>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + Spacing.six },
        ]}>
        {CHANGELOG.map((entry) => {
          const isCurrent = entry.version === APP_VERSION;
          return (
            <ThemedView
              key={entry.version}
              type="backgroundElement"
              frame="playbill"
              style={[styles.card, isCurrent && { borderColor: theme.accent }]}>
              <View style={styles.cardHead}>
                <ThemedText type="smallBold" themeColor={isCurrent ? 'accent' : 'text'}>
                  v{entry.version}
                </ThemedText>
                {isCurrent ? (
                  <ThemedView
                    type="backgroundSelected"
                    radius="chip"
                    style={[styles.currentChip, { borderColor: theme.accent }]}>
                    <ThemedText type="small" themeColor="accent">
                      当前版本
                    </ThemedText>
                  </ThemedView>
                ) : null}
                <ThemedText type="small" themeColor="textSecondary" style={styles.date}>
                  {entry.date}
                </ThemedText>
              </View>

              <ThemedText style={styles.title}>{entry.title}</ThemedText>

              <View style={styles.notes}>
                {entry.notes.map((note) => (
                  <View key={note} style={styles.noteRow}>
                    <View style={[styles.bullet, { backgroundColor: theme.accent }]} />
                    <ThemedText type="small" themeColor="textSecondary" style={styles.noteText}>
                      {note}
                    </ThemedText>
                  </View>
                ))}
              </View>
            </ThemedView>
          );
        })}

        <ThemedText type="small" themeColor="textSecondary" style={styles.footnote}>
          更早的版本可以在 GitHub 的 Release 页面查看。
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
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarText: { gap: 1 },
  content: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  card: {
    padding: Spacing.three,
    borderRadius: Radii.card,
    borderWidth: 1,
    borderColor: 'transparent',
    gap: Spacing.one,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  currentChip: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 1,
    borderWidth: 1,
  },
  date: { marginLeft: 'auto' },
  title: { fontWeight: '600' },
  notes: {
    marginTop: Spacing.one,
    gap: Spacing.one,
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
    marginTop: 7,
  },
  noteText: { flex: 1, lineHeight: 19 },
  footnote: {
    textAlign: 'center',
    marginTop: Spacing.two,
  },
  pressed: { opacity: 0.6 },
});
