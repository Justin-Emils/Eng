"""诊断:把透明区染成洋红,直接看出"哪些地方被抠掉了"。

用途:判断透明区到底是"真漏洞"(角色身上被误抠)还是"合理背景"(腿间空隙之类)。
同时打印角色深色部位的灰度分布 —— 如果深色部位本身就是纯黑(0),
那它与纯黑背景在信息上无法区分,任何抠底算法都救不了,必须换方案。

用法:python scripts/anim-alpha-check.py
"""
import glob
import os

import numpy as np
from PIL import Image

ROOT = r'E:\code\Eng\article-reading'
MAGENTA = (255, 0, 255)


def composite(frame_path: str) -> Image.Image:
    img = Image.open(frame_path).convert('RGBA')
    arr = np.asarray(img).astype(np.uint8)
    alpha = arr[:, :, 3]
    rgb = arr[:, :, :3]
    out = np.where(alpha[:, :, None] > 40, rgb, np.array(MAGENTA, dtype=np.uint8))
    return Image.fromarray(out.astype(np.uint8), 'RGB')


for tag, d in [('v1(阈值26)', '.artifacts/anim-masked'), ('v2(阈值10)', '.artifacts/anim-masked2')]:
    files = sorted(glob.glob(os.path.join(ROOT, d, '*.png')))
    if not files:
        print(f'{tag}: 无帧')
        continue
    idx = min(16, len(files) - 1)
    img = Image.open(files[idx]).convert('RGBA')
    arr = np.asarray(img)
    alpha = arr[:, :, 3]
    gray = arr[:, :, :3].mean(axis=2)
    transparent = alpha < 8
    print(f'{tag} 帧#{idx} 尺寸{img.size}: 透明 {100*transparent.mean():.1f}%')
    # 透明区里,原图接近纯黑的比例(说明是背景) vs 明显非黑(说明是角色被误抠)
    if transparent.any():
        vals = gray[transparent]
        print(f'   透明区原图灰度:均值 {vals.mean():.1f} · 近黑(≤10)占 {100*(vals<=10).mean():.1f}%')
    # 角色身上(不透明)的暗部统计
    solid_dark = (alpha > 247) & (gray <= 30)
    print(f'   不透明但很暗的像素(角色暗部保留情况):{int(solid_dark.sum())} 个')
    out = composite(files[idx]).resize((img.size[0] * 2, img.size[1] * 2), Image.NEAREST)
    out.save(os.path.join(ROOT, '.artifacts', f'alpha-check-{tag.split("(")[0]}.png'))
    print(f'   已生成诊断图 .artifacts/alpha-check-{tag.split("(")[0]}.png')

# 深色部位的原始灰度:判断"能不能抠"
first = sorted(glob.glob(os.path.join(ROOT, '.artifacts/anim-rgb', '*.png')))[0]
raw = np.asarray(Image.open(first).convert('L'))
import collections
hist = collections.Counter(raw.flatten().tolist())
print('\n原始帧灰度分布(前 12 个最常见值):')
for v, n in hist.most_common(12):
    print(f'   灰度 {v:3d} → {n:6d} 像素')
