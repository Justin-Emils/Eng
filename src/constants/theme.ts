/**
 * 主题令牌(全局唯一取色来源)。
 *
 * 结构:
 *   ThemePalette —— 一套配色必须提供的全部令牌(显式接口,少一个就编译不过);
 *   Themes       —— 主题注册表,每个主题各自带浅色/深色两套;
 *   getPalette() —— 按 (主题 id, 深浅) 取色,useTheme() 内部用它。
 *
 * 加一个新主题只需三步:在 Themes 里加一项、在 THEME_IDS 登记、在 THEME_META 写
 * 名字与说明 —— 设置页会自动出现这个主题,不需要改 UI。
 *
 * 两条硬规矩(scripts/audit-contrast.mjs 会逐条校验):
 *   1. gold 只做线不做字 —— 金在浅色纸面上的对比度只有 3.09,当正文/小字必然不达标;
 *   2. annotate(学习标注)与 accent(品牌强调)必须分开 —— 否则正文里的生词高亮
 *      会和按钮/导航抢同一个颜色,以后想区分"已掌握/待复习/易混词"就没位置了。
 */

import '@/global.css';

import { Platform } from 'react-native';

/** 一套完整配色。所有值都是可直接用于 RN 的颜色字符串。 */
export interface ThemePalette {
  /** 页面底色 */
  background: string;
  /** 卡片/浮起面底色 */
  backgroundElement: string;
  /** 选中态底色 */
  backgroundSelected: string;
  /** 正文色 */
  text: string;
  /** 次要文字色(说明、元信息) */
  textSecondary: string;
  /** 品牌强调色:按钮、导航选中、进度条 */
  accent: string;
  /** 实心按钮底色(单独存在是为了保证按钮文字对比度 ≥ 4.5) */
  accentStrong: string;
  /** 实心按钮上的文字色 */
  onAccentStrong: string;
  /** 品牌色的浅色衬底 */
  accentSoft: string;
  /** 学习标注色:阅读正文里的生词高亮(与 accent 解耦,见文件头规矩 2) */
  annotate: string;
  /** 今日新学词(比 annotate 更重) */
  annotateStrong: string;
  /** 标注色的浅色衬底 */
  annotateSoft: string;
  /** 金:仅 1px 描边 / 角刻线 / 菱形符号 / 印章 —— 禁止用于文字 */
  gold: string;
  /** 金的极浅衬底 */
  goldSoft: string;
  /** 分隔线 / 描边 */
  border: string;
  /** 错误色与它的衬底 */
  danger: string;
  dangerSoft: string;
  /** 成功色与它的衬底 */
  success: string;
  successSoft: string;
}

export type ThemeColor = keyof ThemePalette;

/** 字形角色 —— 具体字体由 constants/theme 的 Fonts 解析,主题只说"要衬线还是无衬线" */
export type FontRole = 'serif' | 'sans';

/**
 * 主题的**形态语言**(几何 + 字形),与颜色正交,但同样属于"一套主题"。
 *
 * 为什么不能把圆角/字体写死在组件里:那样切换主题只会换颜色,形状与字形留在原地,
 * 用户会觉得"这不像换了一整套主题"。所以这些东西必须跟主题走 ——
 * 默认主题是原来那套(16 圆角、无衬线、无描边),叙拉古是印刷品那套(方直角、衬线、金刻线)。
 *
 * 应用点(只有这几处,其余组件都从这里派生):
 *   · themed-text   —— displayFont / bodyFont / plateLabels / numericWeight
 *   · themed-view   —— radiusCard / radiusPanel / radiusChip / cardFrame
 *   · primary-button—— radiusCard / buttonInsetRule
 *   · form-field、各页输入框与芯片 —— radiusCard / radiusChip
 *   · word-text + 阅读页 —— bodyFont / bodyLineHeight
 */
export interface ThemeSkin {
  /** 展示层字体:页面标题、卡片标题、文章标题 */
  displayFont: FontRole;
  /** 阅读正文字体 */
  bodyFont: FontRole;
  /** 阅读正文的行高倍数(衬线比无衬线需要更多呼吸) */
  bodyLineHeight: number;
  /**
   * 圆角三角色。
   *
   * 这三个值是从**原 App** 的真实取值反推的,不是拍脑袋:
   *   · 卡片 / 列表 / 按钮 / 输入框 —— 原来一律是 16
   *     (form-field 的注释就写着"圆角与 PrimaryButton 一致")
   *   · 次级面板(提示条、译文块)—— 原来是 8~10
   *   · 芯片 / 徽章 / 进度条 —— 原来是 999(胶囊)
   * 拆成三个而不是一个,是因为"退回默认主题"时它们要各自回到各自的原值。
   */
  radiusCard: number;
  radiusPanel: number;
  radiusChip: number;
  /**
   * 是否使用 App 自己的**形象**(从启动屏动画抠出的透明角色姿势)。
   *
   * 又是一个独立开关,不跟 `motifs` 绑:
   * 形象是"App 层面"的资产(空状态、完成态、引导页),不是某套主题的装饰花纹。
   * 现在只有叙拉古主题开着,是为了守住"默认主题逐像素回到原样";
   * 如果决定让默认主题也用,改这一处即可。
   */
  mascot: boolean;
  /** 卡片画"节目单"式描边 + 对角金刻线 */
  cardFrame: boolean;
  /** 主按钮画内嵌细线(票券感) */
  buttonInsetRule: boolean;
  /** 小标签用"铭牌"式:全大写 + 大字距 */
  plateLabels: boolean;
  /**
   * 是否启用主题纹样:幕布轨、金色菱形符号、蜡封印章,
   * 以及用它们替换界面里的 emoji。
   *
   * 注意它**不管封面**(见 `coverArt`)。封面是"用哪张图"的问题,
   * 而随机照片封面在任何主题下都是缺陷(与文章无关、依赖网络、要处理超时),
   * 不该跟"要不要金刻线"共用一个开关。
   */
  motifs: boolean;
  /**
   * 文章封面来源。
   * - `'photo'` —— 原来的多级真实图回退(Wikimedia / picsum / Unsplash + 渐变 emoji 兜底)
   * - `'playbill'` —— 程序化"节目单"封面:零网络、零素材、按 id 稳定生成
   *
   * 单独成字段而不是复用 `motifs`,是为了能独立决定:
   * 想让两套主题都用节目单封面(把随机照片彻底淘汰),只改这一处即可。
   */
  coverArt: 'photo' | 'playbill';
  /** 统计数字的字重(衬线体用 600,无衬线粗体用 800) */
  numericWeight: '600' | '700' | '800';
}

/** 一个主题 = 一套浅色 + 一套深色 + 一份形态语言 */
export interface ThemePair {
  light: ThemePalette;
  dark: ThemePalette;
  skin: ThemeSkin;
}

/**
 * 默认主题的形态语言 = **App 原来的样子**。
 * 这一份是"退回原样"的基准:16 圆角、无衬线、无描边、胶囊芯片。
 */
const defaultSkin: ThemeSkin = {
  displayFont: 'sans',
  bodyFont: 'sans',
  bodyLineHeight: 1.7,
  radiusCard: 16,
  radiusPanel: 8,
  radiusChip: 999,
  cardFrame: false,
  buttonInsetRule: false,
  plateLabels: false,
  /** 默认主题保留原来的 emoji 与随机照片封面 —— 一律不启用纹样 */
  motifs: false,
  mascot: false,
  coverArt: 'photo',
  numericWeight: '800',
};

/** 叙拉古的形态语言:印刷品。方直角 + 细线 + 金刻线 + 衬线。 */
const siracusaSkin: ThemeSkin = {
  displayFont: 'serif',
  bodyFont: 'serif',
  bodyLineHeight: 1.8,
  radiusCard: 3,
  radiusPanel: 2,
  radiusChip: 2,
  cardFrame: true,
  buttonInsetRule: true,
  plateLabels: true,
  motifs: true,
  mascot: true,
  coverArt: 'playbill',
  numericWeight: '600',
};

/**
 * 默认主题:清爽蓝白。
 * 保持 App 原有的观感 —— 换成叙拉古主题时它就是"退回原样"的兜底,
 * 也是新主题做对比时的基准。
 */
const defaultTheme: ThemePair = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
    accent: '#208AEF',
    /**
     * 填充按钮的底色(与 accent 分开的原因:白字压在 accent #208AEF 上
     * 对比度只有 3.53;深色主题 accent 变成亮蓝后更是只剩 2.63 → 字看不清)
     */
    accentStrong: '#0F5CC0',
    /** 填充按钮上的文字色(与 accentStrong 对比度 ≥ 4.5) */
    onAccentStrong: '#ffffff',
    /** 品牌色的浅色衬底(足够浅,保证 accent 文字压在它上面也有 ≥3 对比度) */
    accentSoft: '#E3F2FD',
    /** 这个主题里生词高亮沿用品牌蓝系,但比 accent 压深一档 ——
     *  原来的 #208AEF 压在白底上只有 3.53,当正文标注不达标(见 audit-contrast)。
     *  #1068CC 是同一族蓝里既明显更深、又有 5.42 余量的选择。 */
    annotate: '#1068CC',
    annotateStrong: '#0B4E9B',
    annotateSoft: '#E3F2FD',
    /** 默认主题没有金属色:装饰线用中性灰,角刻线才看得出但不抢戏 */
    gold: '#B9C0CA',
    goldSoft: '#EDEFF3',
    border: '#D5D9DF',
    danger: '#C62828',
    dangerSoft: '#FDECEA',
    success: '#1B5E20',
    successSoft: '#E8F5E9',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
    accent: '#4DA3FF',
    /** 深色下按钮:亮蓝底 + 深墨蓝字(对比度 6.47,不用白字) */
    accentStrong: '#4DA3FF',
    onAccentStrong: '#0A1D33',
    accentSoft: '#17324D',
    annotate: '#4DA3FF',
    annotateStrong: '#8FC6FF',
    annotateSoft: '#17324D',
    gold: '#565C66',
    goldSoft: '#2A2E34',
    border: '#3A3D42',
    danger: '#FF8A80',
    dangerSoft: '#33191A',
    success: '#81C784',
    successSoft: '#132A18',
  },
  skin: defaultSkin,
};

/**
 * 叙拉古 · 揭幕者们。
 *
 * ⚠️ 这里的色值**不是推出来的,是从活动截图里量出来的**。
 * 早期版本凭"意大利狂欢节 + 剧院 + 印刷品"的叙事自己编了一套
 * (羊皮纸 + 酒红 + 金),方向是错的 —— 那套语言与活动的实际画面天差地别。
 * 现在每个 token 都对应 `scripts/analyze-reference.ps1` 的实测结果,
 * 完整数据见 `docs/theme-siracusa.md` 第 14 节。
 *
 * 实测结论(7 张活动图,饱和像素占抽样 42%):
 *   · 底色 = **近黑带紫**：#09080b / #0d0b12 / #050506,不是暖棕黑;
 *   · 浮起面 = 紫灰 #17141b / #1c1725 / #201a36 / #221a28;
 *   · 最大色族 = **蓝紫 240-255°**(#332c6c,占饱和 25.5%)与**紫 255-285°**
 *     (#4d3071 / #583776,合计 24.9%) —— 紫罗兰才是主色;
 *   · 次大色族 = **绯红 345-360°**(#802132,占饱和 16.5%),另有酒红 330-345°;
 *   · **暖金只是配角**:30-45° #e0b987 占饱和 13%,亮部是奶油 #f7d8b4;
 *   · 7 张图暗部占比 48%–78% —— **参考里没有浅色界面**。
 *
 * 所以:
 *   · 深色 = 主模式(对齐参考):紫罗兰底 + 亮蓝紫强调 + 绯红标注 + 金/奶油点缀;
 *   · 浅色 = **衍生**的日间变体 —— 参考里没有浅色界面可依据,这里只把同一套
 *     色族反转(淡紫纸 + 靛紫强调 + 绯红标注),不当成"还原"。
 *
 * 只借配色关系与图形语法,不使用任何官方立绘 / Logo / 字体。
 */
const siracusa: ThemePair = {
  light: {
    /** 淡紫纸(衍生,非实测) */
    background: '#F4F1F8',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#E6E1F2',
    text: '#0D0B16',
    /** 实测的紫灰 #564957 往冷里调,保证在三种底色上都 ≥4.5 */
    textSecondary: '#5B5270',
    /** 实测蓝紫 #37299b / #3a3370 的浅色变体 */
    accent: '#3A329B',
    accentStrong: '#332C8C',
    onAccentStrong: '#F7F4FB',
    accentSoft: '#E6E2F7',
    /**
     * 标注 = **品红**。这是看了活动宣传页之后补的第三个强调色 ——
     * 参考页里数字与关键词用的是橙、个别字用品红高亮,而金色专门用来"手绘圈划"。
     * 早先只取到绯红,漏了品红这一族。
     */
    annotate: '#A8297A',
    annotateStrong: '#7E1A5B',
    annotateSoft: '#F6DEEF',
    /** 金是配角:实测 #d8a05d 压到浅底上要够深才看得见 */
    gold: '#A8722E',
    goldSoft: '#EDDFC6',
    border: '#D5CFE4',
    /** 危险用橙(实测 #e39434 一族),和"绯红=标注"区分开 */
    danger: '#9C4A12',
    dangerSoft: '#F7E3D2',
    success: '#2F6B45',
    successSoft: '#E0EFE3',
  },
  dark: {
    /** 实测最深的底:#09080b / #0d0b12 / #050506 —— 近黑带紫,不是暖棕 */
    background: '#0B0912',
    /** 实测卡片:#17141b / #1c1725 */
    backgroundElement: '#1A1725',
    /** 实测紫色面:#201a36 / #221a28 */
    backgroundSelected: '#272041',
    text: '#F5F2FA',
    textSecondary: '#A99CC0',
    /** 实测最大色族:亮蓝紫 240-255°(#4a47d6 / #5c56d7) */
    accent: '#8F88F2',
    accentStrong: '#8F88F2',
    onAccentStrong: '#12101F',
    accentSoft: '#252047',
    /**
     * 标注 = **品红**。这是看了活动宣传页后补的第三个强调色 ——
     * 参考页里数字与关键词用橙色高亮、个别字用品红,而金色专门承担"手绘圈划"。
     * 早先只量到绯红一族,漏了品红。
     * 提亮到 #EC6BB6 是因为它要压在近黑底上当**正文标注**,对比度必须够。
     */
    annotate: '#EC6BB6',
    annotateStrong: '#F59ACD',
    annotateSoft: '#3A1030',
    /** 实测暖金 #d8a05d —— 只做线,不做字 */
    gold: '#D8A05D',
    goldSoft: '#3A2A18',
    border: '#2E2842',
    danger: '#E8913F',
    dangerSoft: '#3A2413',
    success: '#8FCB9B',
    successSoft: '#16301E',
  },
  skin: siracusaSkin,
};

export const Themes = {
  default: defaultTheme,
  siracusa,
} as const satisfies Record<string, ThemePair>;

/**
 * 主题 id 直接从 Themes 推导 —— 单一事实来源。
 * 刻意**不**手写一份 id 列表:那样加主题时忘了登记,设置页会静默少一个主题,
 * 而且不会有任何编译错误。
 *
 * 加新主题:在 Themes 里加一项 → 在 THEME_META 里补名字(这个漏写会编译报错)。
 */
export type ThemeId = keyof typeof Themes;

/** 全部主题 id,顺序即设置页里的展示顺序(对象键的插入顺序) */
export const THEME_IDS = Object.keys(Themes) as ThemeId[];

/** 首次安装时的主题:保持原有观感 */
export const DEFAULT_THEME_ID: ThemeId = 'default';

export interface ThemeMeta {
  id: ThemeId;
  /** 设置页里显示的名字 */
  name: string;
  /** 一句话说明来历,让用户知道自己在选什么 */
  tagline: string;
}

/** 每个主题都必须在这里登记,少一个会编译报错(Record 的穷尽性检查) */
export const THEME_META: Record<ThemeId, ThemeMeta> = {
  default: {
    id: 'default',
    name: '默认',
    tagline: '清爽蓝白,专注阅读本身',
  },
  siracusa: {
    id: 'siracusa',
    name: '叙拉古 · 揭幕者们',
    tagline: '浅色是节目单,深色是剧院夜场',
  },
};

/** 主题 id 是否合法(存储里可能留着已删除主题的旧值) */
export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && (THEME_IDS as readonly string[]).includes(value);
}

/** 按主题与深浅取一套配色 */
export function getPalette(themeId: ThemeId, scheme: 'light' | 'dark'): ThemePalette {
  const pair = Themes[themeId] ?? Themes[DEFAULT_THEME_ID];
  return pair[scheme];
}

/** 取某个主题的形态语言(几何 + 字形) */
export function getSkin(themeId: ThemeId): ThemeSkin {
  return (Themes[themeId] ?? Themes[DEFAULT_THEME_ID]).skin;
}

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/**
 * 结构圆角(静态兜底)。
 *
 * ⚠️ **真正的圆角由主题的 `ThemeSkin` 决定,不是这里。**
 * 这个常量只是"某一个表面没走 ThemedView、又非要写死在 StyleSheet 里"时的兜底值 ——
 * 取值对应叙拉古那套几何。
 *
 * 规则:
 *   · 是 `ThemedView` → 用 `radius` 属性(`'card' | 'panel' | 'control' | 'none'`),
 *     主题圆角会被应用在样式数组最后一位,局部写死会被覆盖;
 *   · 是普通 View / Pressable / TextInput → 读 `useThemeSkin()` 的值内联合并。
 *
 * 留着它会让"同一个值有两处来源",所以新代码不要再引用 —— 直接走 skin。
 */
export const Radii = {
  /** 极小控件:芯片、按钮、标签 */
  sharp: 2,
  /** 卡片、列表、面板 */
  card: 3,
  /** 需要正圆的地方(头像、徽章) */
  round: 999,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
