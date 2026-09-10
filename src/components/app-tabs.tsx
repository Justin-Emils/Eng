import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

/**
 * App 底部 Tab(Native,Android/iOS)。
 *
 * 注意(重要):Android 的 Material 底部导航在 tab 数 ≥ 4 时,labelVisibilityMode
 * 默认 `auto` 只会给选中项显示文字、其它项只显示图标——这正是之前"非选中标签看不见、
 * 但能点"的原因。这里显式设 `labeled`,让所有项的文字常显。
 * 路由文件名与 Trigger.name 一一对应:index/library/words/review/profile。
 */
export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.accent}
      labelVisibilityMode="labeled"
      labelStyle={{
        default: { color: colors.textSecondary },
        selected: { color: colors.accent, fontWeight: '600' },
      }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>今日</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="library">
        <NativeTabs.Trigger.Label>文章库</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="words">
        <NativeTabs.Trigger.Label>生词本</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="review">
        <NativeTabs.Trigger.Label>复习</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>我的</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
