import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useTheme } from '@/hooks/use-theme';

declare const require: (path: string) => number;

/**
 * 底部 Tab 图标(24dp PNG,由 scripts/gen-tab-icons.py 从 Material Symbols 字体生成):
 *   今日=today · 文章库=menu_book(打开的书) · 生词本=bookmark · 复习=refresh · 我的=person
 *
 * 为什么用 PNG 资源而不是 `md` 图标名:
 * expo-router 的 `md` 路径要在运行时用 expo-font 把字形渲染成图片
 * (unstable_getMaterialSymbolSourceAsync),实测在 Expo Go 里不显示。
 * 直接把字形渲染成 PNG 并用 `src` 引用,Expo Go 与独立安装版都稳定,且完全离线。
 * 每套图标提供 default(未选中灰)/selected(选中蓝)两张,由系统或我们自带的颜色保证可读。
 */
const ICONS = {
  index: {
    default: require('../../assets/tab-icons/today.png'),
    selected: require('../../assets/tab-icons/today-active.png'),
  },
  library: {
    default: require('../../assets/tab-icons/library.png'),
    selected: require('../../assets/tab-icons/library-active.png'),
  },
  words: {
    default: require('../../assets/tab-icons/words.png'),
    selected: require('../../assets/tab-icons/words-active.png'),
  },
  review: {
    default: require('../../assets/tab-icons/review.png'),
    selected: require('../../assets/tab-icons/review-active.png'),
  },
  profile: {
    default: require('../../assets/tab-icons/profile.png'),
    selected: require('../../assets/tab-icons/profile-active.png'),
  },
} as const;

/**
 * App 底部 Tab(Native,Android/iOS)。
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
      /* 不要指示胶囊:原来 indicatorColor 用强调色,而选中图标/文字也是强调色,
         结果是"蓝底压蓝图标"→ 选中图标看不见。选中态靠颜色 + 加粗标签表达即可。 */
      disableIndicator
      labelVisibilityMode="labeled"
      labelStyle={{
        default: { color: theme.textSecondary },
        selected: { color: theme.accent, fontWeight: '600' },
      }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon src={ICONS.index} />
        <NativeTabs.Trigger.Label>今日</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="library">
        <NativeTabs.Trigger.Icon src={ICONS.library} />
        <NativeTabs.Trigger.Label>文章库</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="words">
        <NativeTabs.Trigger.Icon src={ICONS.words} />
        <NativeTabs.Trigger.Label>生词本</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="review">
        <NativeTabs.Trigger.Icon src={ICONS.review} />
        <NativeTabs.Trigger.Label>复习</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Icon src={ICONS.profile} />
        <NativeTabs.Trigger.Label>我的</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
