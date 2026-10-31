/**
 * 错误边界（P2-12）。
 *
 * 报告指出的问题:任一页面渲染抛错 → 生产环境**白屏**,用户只能重装(本机数据随之丢失),
 * 而且没有任何崩溃记录。
 *
 * 这里做两件事:
 *  1. 兜住渲染异常,给一个可操作的界面(重试 / 复制错误信息),而不是白屏;
 *  2. 把错误写进本地 `readingapp.crashlog.v1`(最多 20 条),方便事后排查
 *     —— 没有 Sentry 的情况下,这是最少成本的"可观测性"。
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

const CRASH_KEY = 'readingapp.crashlog.v1';
const MAX_ENTRIES = 20;

interface CrashEntry {
  at: string;
  message: string;
  stack: string;
  component: string;
}

async function recordCrash(entry: CrashEntry): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(CRASH_KEY);
    const list = raw ? (JSON.parse(raw) as CrashEntry[]) : [];
    const next = [entry, ...list].slice(0, MAX_ENTRIES);
    await AsyncStorage.setItem(CRASH_KEY, JSON.stringify(next));
  } catch {
    // 记录失败也不能影响兜底界面
  }
}

export class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null; info: string }
> {
  state = { error: null as Error | null, info: '' };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const entry: CrashEntry = {
      at: new Date().toISOString(),
      message: error.message,
      stack: error.stack ?? '',
      component: info.componentStack ?? '',
    };
    void recordCrash(entry);
    this.setState({ info: entry.component });
    // 控制台也留一份(开发/调试时便于直接看)
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  private retry = () => {
    this.setState({ error: null, info: '' });
  };

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="title" themeColor="danger">
            这个页面出错了
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
            你的学习数据还在本机,没有丢失。可以先点「重试」;如果反复出错,
            把下面的错误信息复制给我,我按它定位。
          </ThemedText>

          <View style={styles.box}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.mono}>
              {error.message}
            </ThemedText>
            {info ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.mono}>
                {info.slice(0, 600)}
              </ThemedText>
            ) : null}
          </View>

          <Pressable
            onPress={this.retry}
            style={({ pressed }) => [styles.btn, pressed && styles.pressed]}>
            <ThemedText type="smallBold">重试</ThemedText>
          </Pressable>
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
    paddingTop: Spacing.six,
  },
  hint: { lineHeight: 20 },
  box: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    backgroundColor: 'rgba(128,128,128,0.12)',
    gap: Spacing.two,
  },
  mono: { fontFamily: 'monospace' },
  btn: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    borderWidth: 1,
  },
  pressed: { opacity: 0.7 },
});
