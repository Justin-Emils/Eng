/**
 * 字符串哈希(djb2)。
 *
 * 用途:同步指纹(判断"本机内容有没有变")。
 * 不追求抗碰撞 —— 它不是安全校验,只是"内容指纹"。
 *
 * 放在 domain 下的原因:storage/sync-state.ts 也要用它,而验证脚本需要在 Node 里
 * 直接跑指纹逻辑(不依赖 AsyncStorage),所以这里保持**零依赖纯函数**。
 */

export function hashString(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16);
}
