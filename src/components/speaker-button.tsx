/**
 * 发音按钮（小字号图标,跟主题走）。
 *
 * 反馈原话:「发音应该在单词的下方显示小字音标,右侧是发音按钮,并且只要一个
 * 符合主体的小字体图标就行」—— 之前直接把 🔊 emoji 拼在单词后面,风格不搭。
 *
 * 现在:用 `@expo/vector-icons` 的 Feather(`volume-2`)—— 线条细、与衬线主题更协调,
 * 外面套一个 `radius="chip"` 的小描边底(和生词本状态徽章、筛选片同一套视觉),
 * 颜色取主题 `accent`,描边取 `border`,深浅色主题都自动适配。
 *
 * 为什么不用 emoji:emoji 的字体、颜色、行高都由系统决定,和主题无关,
 * 在深色主题里会跳出来;字体图标可以跟着主题改色和尺寸。
 */

import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { speak } from '@/domain/speech';
import { useTheme } from '@/hooks/use-theme';

export function SpeakerButton({
  word,
  size = 13,
  /** 无障碍标签用的更完整描述(可选) */
  label,
}: {
  word: string;
  size?: number;
  label?: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => void speak(word)}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={label ?? `朗读 ${word}`}
      style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView
        type="backgroundSelected"
        radius="chip"
        style={[styles.chip, { borderColor: theme.border }]}>
        <Feather name="volume-2" size={size} color={theme.accent} />
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  pressed: { opacity: 0.6 },
});
