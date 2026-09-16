/**
 * 头像组件(本地账号):显示 emoji 头像;size 控制大小。
 * 用主题色衬底,深浅色下都清晰。
 */

import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

export function Avatar({ emoji, size = 56 }: { emoji: string; size?: number }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.backgroundSelected,
        },
      ]}>
      <ThemedText style={{ fontSize: size * 0.5, lineHeight: size * 0.62 }}>{emoji}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
});
