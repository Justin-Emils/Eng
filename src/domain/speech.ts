/**
 * 发音(TTS)—— P2「功能缺口」里排第一的一项。
 *
 * 为什么用 expo-speech 而不是音频包:学习者需要的是**任意词都能读**,
 * 用系统 TTS 零素材成本、零包体;单词发音用 en-US、略慢的语速,便于跟读。
 *
 * 两个刻意的行为:
 *  · **先 stop 再 speak**:连点多个词时不会叠着念;
 *  · **任何失败都不抛到 UI**:设备没装 TTS 引擎是常见情况,静默失败 + 返回 false,
 *    由调用方决定要不要提示。
 */

import * as Speech from 'expo-speech';

/** 语速:0.85 比默认略慢,适合跟读;复习卡里也用它 */
const WORD_RATE = 0.85;

let speaking = false;

export interface SpeakOptions {
  /** 词还是整句(整句用正常语速) */
  kind?: 'word' | 'sentence';
  onDone?: () => void;
}

/** 读一个词/一句话。返回是否真的开始朗读(设备没有 TTS 时为 false) */
export async function speak(text: string, options: SpeakOptions = {}): Promise<boolean> {
  const value = text.trim();
  if (!value) return false;
  try {
    // 先停掉上一次,避免叠音
    if (speaking) {
      await Speech.stop();
      speaking = false;
    }
    const available = await Speech.isSpeakingAsync().catch(() => false);
    void available;
    speaking = true;
    Speech.speak(value, {
      language: 'en-US',
      rate: options.kind === 'sentence' ? 1.0 : WORD_RATE,
      onDone: () => {
        speaking = false;
        options.onDone?.();
      },
      onStopped: () => {
        speaking = false;
      },
      onError: () => {
        speaking = false;
      },
    });
    return true;
  } catch {
    speaking = false;
    return false;
  }
}

export async function stopSpeaking(): Promise<void> {
  try {
    await Speech.stop();
  } catch {
    // 忽略
  }
  speaking = false;
}

/** 设备是否支持 TTS(用于决定要不要显示喇叭按钮) */
export async function isSpeechAvailable(): Promise<boolean> {
  try {
    return await Speech.isSpeakingAsync !== undefined;
  } catch {
    return false;
  }
}
