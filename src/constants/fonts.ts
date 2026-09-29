/**
 * 内嵌字体注册表。
 *
 * 字体:**Literata**(Google 为**长时间屏幕阅读**设计的衬线体,OFL 授权,可随 App 分发)。
 * 选它的理由:本 App 的正文在 17~20px 这个区间,Literata 正是为这个尺寸段调过字面与
 * x-height 的,比通用衬线更省眼睛。
 *
 * **为什么按字重分成四个族名、而不是一个族名 + fontWeight**:
 * `@expo-google-fonts` 的每个字重是**独立的 ttf 文件**,注册后就是四个独立族名。
 * Android 不会因为 `fontWeight: '600'` 去挑 `Literata_600SemiBold` 那个文件,
 * 反而会拿 400 的文件**合成**一个假的半粗(字会发虚、字宽也不对)。
 * 所以这里按字重显式选族名,并把 `fontWeight` 置为 `normal` 避免再叠一层合成。
 * 见 `constants/typography.ts` 的 `FONT_SLOTS` 与 `components/themed-text.tsx`。
 *
 * 中文字形**不跟着换**:内嵌一套中文字体要 10MB+(常用字集),包体会从 ~30MB 涨到 40MB+。
 * 所以中文继续走系统字体(Android 的 Noto Sans CJK / iOS 的苹方),只有拉丁字形变化 ——
 * 对一个英语阅读 App 来说正是想要的效果。
 */

import {
  Literata_400Regular,
  Literata_500Medium,
  Literata_600SemiBold,
  Literata_700Bold,
} from '@expo-google-fonts/literata';
import { Platform } from 'react-native';

/**
 * 需要加载的字体资源表。键就是注册后的族名,值来自 `@expo-google-fonts` 的 require。
 * `_layout.tsx` 用它调 `useFonts`。
 */
export const APP_FONTS = {
  Literata_400Regular,
  Literata_500Medium,
  Literata_600SemiBold,
  Literata_700Bold,
} as const;

/** 衬线族名(按字重)。用在需要精确控制字重的场景。 */
export const SERIF_FAMILY = {
  regular: 'Literata_400Regular',
  medium: 'Literata_500Medium',
  semibold: 'Literata_600SemiBold',
  bold: 'Literata_700Bold',
} as const;

/**
 * 无衬线族(UI 标签、按钮)。
 * **刻意继续用系统字体**:中文字形占绝大多数,内嵌西文无衬线只会让中英混排更不统一。
 */
export const SANS_FAMILY =
  Platform.select({ ios: 'system-ui', android: 'sans-serif', default: 'normal' }) ?? 'normal';

/** 等宽族(音标、词性)。同样用系统字体。 */
export const MONO_FAMILY =
  Platform.select({ ios: 'ui-monospace', android: 'monospace', default: 'monospace' }) ??
  'monospace';
