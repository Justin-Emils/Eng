import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * 隐私政策 / 用户协议 / 数据出境说明（P2-1）。
 *
 * 说明:这是**草稿**,把"收集什么、存在哪、怎么删"如实写清楚,用于商店上架前的占位。
 * 正式上架前需要法务过一遍 —— 我不会假装这就是合规文本。
 *
 * 为什么必须写:App 收集邮箱/昵称/学习记录,而且 Supabase 项目在**新加坡**
 * (ap-southeast-1),属于个人信息出境,PIPL 要求告知并取得单独同意。
 */

type Doc = 'privacy' | 'terms';

const DOCS: { key: Doc; label: string }[] = [
  { key: 'privacy', label: '隐私政策' },
  { key: 'terms', label: '用户协议' },
];

export default function LegalScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const theme = useTheme();
  const params = useLocalSearchParams<{ doc?: string }>();
  const [doc, setDoc] = useState<Doc>(params.doc === 'terms' ? 'terms' : 'privacy');

  return (
    <ThemedView style={styles.flex}>
      <View style={[styles.topBar, { paddingTop: insets.top + Spacing.two }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
          <ThemedText type="subtitle">‹</ThemedText>
        </Pressable>
        <ThemedText type="smallBold">关于数据与使用</ThemedText>
      </View>

      <View style={styles.tabs}>
        {DOCS.map((d) => {
          const active = d.key === doc;
          return (
            <Pressable key={d.key} onPress={() => setDoc(d.key)} style={styles.tabWrap}>
              <ThemedView
                type={active ? 'backgroundSelected' : 'backgroundElement'}
                radius="chip"
                style={[styles.tab, active && { borderColor: theme.accent }]}>
                <ThemedText type="smallBold" themeColor={active ? 'accent' : 'textSecondary'}>
                  {d.label}
                </ThemedText>
              </ThemedView>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.six }]}>
        <ThemedView type="backgroundElement" style={styles.draftNote}>
          <ThemedText type="small" themeColor="textSecondary">
            这是**草稿**:内容如实描述了 App 现在实际怎么做,但正式上架前仍需法务审阅。
          </ThemedText>
        </ThemedView>

        {doc === 'privacy' ? <PrivacyDoc /> : <TermsDoc />}
      </ScrollView>
    </ThemedView>
  );
}

function H({ children }: { children: ReactNode }) {
  return (
    <ThemedText type="smallBold" style={styles.h}>
      {children}
    </ThemedText>
  );
}

function P({ children }: { children: ReactNode }) {
  return (
    <ThemedText type="small" themeColor="textSecondary" style={styles.p}>
      {children}
    </ThemedText>
  );
}

function PrivacyDoc() {
  return (
    <>
      <H>一、收集哪些信息</H>
      <P>
        · 账号信息:邮箱地址、密码(仅以哈希形式保存在服务端,App 不保存明文)、昵称、头像(可选)。
        {'\n'}· 学习数据:生词、复习记录、阅读进度、打卡记录、难度评估结果、设置项。
        {'\n'}· 我们不收集通讯录、短信、位置、相册原图;头像只保存你选定的 emoji 或短标识。
      </P>

      <H>二、存在哪里</H>
      <P>
        · 本机:以上数据全部在本机保存一份(App 离线可用)。
        {'\n'}· 云端(仅在登录后):学习数据与昵称/头像会保存到你自己的云端备份中。
        {'\n'}· **数据出境**:云端服务使用 Supabase,项目部署在**新加坡(ap-southeast-1)**。
        因此登录后你的邮箱与学习数据会传输并存储在新加坡。不登录时数据只在本机,不会出境。
      </P>

      <H>三、用来做什么</H>
      <P>
        · 提供阅读、查词、复习安排、难度评估与跨设备同步;
        {'\n'}· 不做广告投放,不向第三方出售或共享你的数据;
        {'\n'}· 不做用户画像以外的用途;没有接入任何第三方埋点/广告 SDK。
      </P>

      <H>四、你的权利</H>
      <P>
        · 查看/导出:设置里可导出备份(JSON)与生词本(CSV);
        {'\n'}· 删除本机数据:设置 → 清空生词本/清空全部本机数据;
        {'\n'}· 删除云端数据:在「账号与同步」里发现的问题请按下方联系方式联系,**我会手动删除**
        (当前版本尚未提供自助注销入口,这点如实说明);
        {'\n'}· 撤回同意:退出登录后数据不再上传云端。
      </P>

      <H>五、保留期限</H>
      <P>
        · 本机数据:直到你删除或卸载 App;
        {'\n'}· 云端数据:直到你要求删除;长期不使用导致云端项目被暂停时,数据仍保留,
        可按下方方式联系恢复或删除。
      </P>

      <H>六、联系方式</H>
      <P>数据相关请求请通过应用仓库的 Issue 或邮件联系开发者(见「关于」页)。</P>

      <H>七、变更</H>
      <P>本政策更新时会写入 App 内的更新日志,并在本页标注日期。</P>
    </>
  );
}

function TermsDoc() {
  return (
    <>
      <H>一、服务内容</H>
      <P>
        本 App 提供考研英语阅读练习、生词管理与复习安排。内容包含公版英文短文与内置词表,
        仅供个人学习使用。
      </P>

      <H>二、账号</H>
      <P>
        · 你可以不注册,离线使用全部功能;注册后可跨设备同步;
        {'\n'}· 请妥善保管密码;因共享账号导致的损失由使用者承担。
      </P>

      <H>三、内容与知识产权</H>
      <P>
        · 公版文章来自 Project Gutenberg(公有领域);封面图片来自 Wikimedia Commons 等来源,
        其许可见来源页;
        {'\n'}· 内置词典与词表遵循其原始许可(见仓库 README 的第三方数据说明);
        {'\n'}· 请勿将本 App 内容用于商业转载。
      </P>

      <H>四、免责</H>
      <P>
        学习效果因人而异,本 App 不承诺任何考试结果;数据同步依赖第三方云服务,
        极端情况下可能出现延迟或不可用,已在「离线优先」的设计下尽量减少影响。
      </P>

      <H>五、变更与终止</H>
      <P>功能调整会记录在更新日志;你可以随时停止使用并删除本机数据。</P>
    </>
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
  tabs: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
  },
  tabWrap: { flexGrow: 0 },
  tab: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  content: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
  },
  draftNote: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    marginBottom: Spacing.one,
  },
  h: { marginTop: Spacing.three },
  p: { lineHeight: 21 },
  pressed: { opacity: 0.6 },
});
