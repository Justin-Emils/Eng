/**
 * 表单输入框(认证页共用):标签 + 输入 + 提示 + 错误。
 *
 * 几个刻意的细节:
 * - 密码框带「显示/隐藏」,自用 App 里输错密码看不到最恼人;
 * - 错误文字用主题的 danger 令牌,每套主题的深浅色都各自保证 ≥4.5 对比度;
 * - 输入框高度 48、圆角与 PrimaryButton 一致,视觉上成对。
 */

import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme, useThemeSkin } from '@/hooks/use-theme';

export function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  secure = false,
  hint,
  error,
  editable = true,
  keyboardType,
  autoCapitalize,
  autoComplete,
  returnKeyType,
  maxLength,
  onSubmitEditing,
}: {
  label: string;
  value: string;
  onChangeText: (next: string) => void;
  placeholder?: string;
  /** 密码类输入:自动隐藏内容并显示「显示/隐藏」切换 */
  secure?: boolean;
  hint?: string;
  error?: string | null;
  editable?: boolean;
  keyboardType?: TextInputProps['keyboardType'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoComplete?: TextInputProps['autoComplete'];
  returnKeyType?: TextInputProps['returnKeyType'];
  maxLength?: number;
  onSubmitEditing?: () => void;
}) {
  const theme = useTheme();
  const skin = useThemeSkin();
  const [revealed, setRevealed] = useState(false);

  const danger = theme.danger;

  return (
    <View style={styles.wrap}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
        {label}
      </ThemedText>

      <View style={styles.inputRow}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.textSecondary}
          secureTextEntry={secure && !revealed}
          editable={editable}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize ?? 'none'}
          autoComplete={autoComplete}
          autoCorrect={false}
          returnKeyType={returnKeyType}
          maxLength={maxLength}
          onSubmitEditing={onSubmitEditing}
          style={[
            styles.input,
            {
              // 与 PrimaryButton 用同一个控件圆角,视觉上成对(由主题决定胶囊还是方直角)
              borderRadius: skin.radiusCard,
              color: theme.text,
              backgroundColor: theme.background,
              borderColor: error ? danger : theme.border,
            },
          ]}
        />
        {secure ? (
          <Pressable
            onPress={() => setRevealed((v) => !v)}
            hitSlop={10}
            style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}>
            <ThemedText type="small" themeColor="accent">
              {revealed ? '隐藏' : '显示'}
            </ThemedText>
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <ThemedText type="small" style={[styles.help, { color: danger }]}>
          {error}
        </ThemedText>
      ) : hint ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.help}>
          {hint}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.one },
  label: { lineHeight: 18 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  input: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    fontSize: 15,
  },
  toggle: { paddingHorizontal: Spacing.two, paddingVertical: Spacing.two },
  pressed: { opacity: 0.6 },
  help: { lineHeight: 18, paddingHorizontal: Spacing.one },
});
