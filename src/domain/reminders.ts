/**
 * 复习提醒（通知）。
 *
 * 报告指出:SRS 的价值一半在"按时提醒",而之前完全靠用户主动打开 App。
 *
 * 设计上的四个决定:
 *  1. **本地通知、不算服务端** —— 不需要推送服务、不产生费用,隐私上也更干净;
 *  2. **只提醒"今天有到期词"** —— 每次调度前先数一遍到期词,0 个就不排,避免
 *     "每天准时骚扰但没东西可复习";
 *  3. **一天一次,固定在用户选的时间** —— 单条 daily trigger,随时可以重排;
 *  4. **权限被拒绝时如实返回**,由界面告诉用户去系统设置开,而不是静默失效。
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { getDueWords } from '@/storage/words';
import { getSettings, saveReminder as persistReminderSetting } from '@/storage/settings';

const CHANNEL_ID = 'review-reminder';
/** 通知里最多显示的数字,避免"9999 个"这种夸张文案 */
const MAX_SHOWN = 99;

/** 允许的提醒时间(整点),设置页用这三档,不做自由时间选择器 */
export const REMINDER_HOURS = [8, 12, 20] as const;
export type ReminderHour = (typeof REMINDER_HOURS)[number];

export interface ReminderState {
  /** 系统通知权限是否已授予 */
  granted: boolean;
  /** 已排的提醒数量(0 = 没有提醒) */
  scheduled: number;
  /** 到期词数(0 时不会排提醒) */
  due: number;
}

let configured = false;

/** 前台也显示横幅(否则 App 打开时收不到提醒) */
async function configureOnce(): Promise<void> {
  if (configured) return;
  configured = true;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: '复习提醒',
        importance: Notifications.AndroidImportance.DEFAULT,
        // 不震动、不出声:学习提醒不需要抢注意
        vibrationPattern: undefined,
        sound: undefined,
      });
    }
  } catch {
    // 忽略:配置失败不影响其他功能
  }
}

/** 当前通知权限是否已授予 */
export async function hasPermission(): Promise<boolean> {
  try {
    const settings = await Notifications.getPermissionsAsync();
    return settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  } catch {
    return false;
  }
}

/** 申请权限(只在用户打开开关时调用,避免一进 App 就弹) */
export async function requestPermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    const asked = await Notifications.requestPermissionsAsync();
    return asked.granted;
  } catch {
    return false;
  }
}

/** 清掉所有已排的提醒 */
export async function cancelReminders(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // 忽略
  }
}

/**
 * 按当前设置与到期词数重排提醒。
 * 幂等:每次调用都先清空再排,不会堆叠。
 */
export async function syncReminder(): Promise<ReminderState> {
  await configureOnce();
  const settings = await getSettings();
  const enabled = settings.reminderEnabled === true;
  const hour = REMINDER_HOURS.includes(settings.reminderHour as ReminderHour)
    ? (settings.reminderHour as ReminderHour)
    : 20;

  let due = 0;
  try {
    due = (await getDueWords()).length;
  } catch {
    due = 0;
  }

  await cancelReminders();

  if (!enabled) {
    return { granted: await hasPermission(), scheduled: 0, due };
  }
  const granted = await requestPermission();
  if (!granted || due === 0) {
    return { granted, scheduled: 0, due };
  }

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '该复习了',
        body: `有 ${Math.min(due, MAX_SHOWN)} 个词到期待复习,几分钟就能过一遍。`,
        data: { kind: 'review-reminder' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute: 0,
        channelId: CHANNEL_ID,
      },
    });
    return { granted: true, scheduled: 1, due };
  } catch {
    return { granted, scheduled: 0, due };
  }
}

/** 设置页保存后调用:更新设置并重排 */
export async function updateReminderSetting(patch: {
  enabled?: boolean;
  hour?: ReminderHour;
}): Promise<ReminderState> {
  const settings = await getSettings();
  const nextEnabled = patch.enabled ?? settings.reminderEnabled === true;
  const nextHour = patch.hour ?? (settings.reminderHour as ReminderHour) ?? 20;

  await persistReminderSetting(nextEnabled, nextHour);

  if (!nextEnabled) {
    await cancelReminders();
    return { granted: await hasPermission(), scheduled: 0, due: 0 };
  }
  return syncReminder();
}

/** 给界面用的一句话 */
export function describeReminder(state: ReminderState): string {
  if (!state.granted) return '系统未授权通知,去系统设置里允许「考研英语阅读」的通知';
  if (state.scheduled > 0) return `已排好:每天到点提醒,当前 ${state.due} 个词到期`;
  if (state.due === 0) return '当前没有到期词,复习提醒会在有到期词时自动排上';
  return '未排上提醒';
}
