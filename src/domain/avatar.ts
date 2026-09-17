/**
 * 自定义头像工具:从相册选图 → 拷贝到 App 文档目录 → 返回可长期使用的 file:// URI。
 *
 * 为什么要拷贝:picker 返回的是**缓存目录**里的文件,系统清缓存后会失效;
 * 文档目录(Paths.document)不受清理影响。
 * 头像统一裁剪成 1:1、压缩到 0.6 质量,单张通常几百 KB。
 */

import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

/** 头像目录(惰性创建) */
function avatarDir(): Directory {
  const dir = new Directory(Paths.document, 'avatars');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/** avatar 字段是图片(而不是 emoji)—— 用于渲染时判断 */
export function isImageAvatar(avatar: string): boolean {
  return /^(file|content|https?|data|ph):/i.test(avatar);
}

/**
 * 打开相册选一张图并保存为头像。
 * @returns 成功返回新的头像 URI;用户取消返回 null;失败抛错(调用方提示);
 */
export async function pickAvatarFromLibrary(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.6,
  });
  if (result.canceled || result.assets.length === 0) return null;

  const picked = result.assets[0];
  const source = new File(picked.uri);
  // 扩展名随picker结果(可能是 png/webp)
  const ext = (source.extension || '.jpg').replace(/^\./, '');
  const target = new File(avatarDir(), `avatar-${Date.now()}.${ext}`);
  // 用 bytes()+write() 而不是 copy():不依赖 copy 的平台差异
  target.write(await source.bytes());

  // 清理旧头像,避免文件堆积
  try {
    for (const entry of avatarDir().list()) {
      if (entry instanceof File && entry.uri !== target.uri && entry.name.startsWith('avatar-')) {
        entry.delete();
      }
    }
  } catch {
    // 清理失败不影响使用
  }

  return target.uri;
}
