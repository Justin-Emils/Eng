/**
 * 头像组件(本地账号):支持 emoji 头像与**自定义图片**头像。
 * - source 是图片 URI(file/content/http/data)→ 渲染图片;
 * - 否则按 emoji 渲染。
 * 用主题色衬底 + 细描边,深浅色下都清晰。
 */

import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { isImageAvatar } from '@/domain/avatar';
import { useTheme } from '@/hooks/use-theme';

export function Avatar({ source, size = 56 }: { source: string; size?: number }) {
  const theme = useTheme();
  const isImage = isImageAvatar(source);

  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.backgroundSelected,
          borderColor: theme.border,
        },
      ]}>
      {isImage ? (
        <Image
          source={{ uri: source }}
          style={{ width: size, height: size }}
          contentFit="cover"
          transition={120}
        />
      ) : (
        <ThemedText style={{ fontSize: size * 0.5, lineHeight: size * 0.62 }}>{source}</ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
});
