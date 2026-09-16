import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useTheme } from '@/hooks/use-theme';

/**
 * App 底部 Tab(Native,Android/iOS)。
 *
 * 图标:Android 用 `md`(Material Symbols 字形,字体随 expo-symbols 包提供,离线可用);
 * 选中态用强调色,未选中用次要文字色。图标含义:
 *   今日=today · 文章库=menu_book · 生词本=bookmark · 复习=refresh · 我的=person
 *
 * 注意(重要):Android 的 Material 底部导航在 tab 数 ≥ 4 时,labelVisibilityMode
 * 默认 `auto` 只会给选中项显示文字、其它项只显示图标——这正是之前"非选中标签看不见、
 * 但能点"的原因。这里显式设 `labeled`,让所有项的文字常显。
 * 路由文件名与 Trigger.name 一一对应:index/library/words/review/profile。
 */
export default function AppTabs() {
  const theme = useTheme();

  return (
    <NativeTabs
      backgroundColor={theme.background}
      iconColor={{ default: theme.textSecondary, selected: theme.accent }}
      indicatorColor={theme.accent}
      labelVisibilityMode="labeled"
      labelStyle={{
        default: { color: theme.textSecondary },
        selected: { color: theme.accent, fontWeight: '600' },
      }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon md={{ default: 'today', selected: 'today' }} />
        <NativeTabs.Trigger.Label>今日</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="library">
        <NativeTabs.Trigger.Icon md={{ default: 'menu_book', selected: 'menu_book' }} />
        <NativeTabs.Trigger.Label>文章库</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="words">
        <NativeTabs.Trigger.Icon md={{ default: 'bookmark', selected: 'bookmark' }} />
        <NativeTabs.Trigger.Label>生词本</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="review">
        <NativeTabs.Trigger.Icon md={{ default: 'refresh', selected: 'refresh' }} />
        <NativeTabs.Trigger.Label>复习</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Icon md={{ default: 'person', selected: 'person' }} />
        <NativeTabs.Trigger.Label>我的</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
