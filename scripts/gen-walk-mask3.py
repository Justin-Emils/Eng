"""行走动画抠底 v3:在 v2(边界泛洪)之上再补两步形态学清理。

v2 的残留问题(诊断图可见):浅色裤子区域有若干**洋红斑点** = 被误抠成透明的小洞。
根因:素材是 AV1 有损压缩,浅色衣服上残留近黑噪点;这些噪点与背景的纯黑
连成"细通道",泛洪就顺着通道漏进角色内部。

v3 的两步:
  1. **闭运算**(先腐蚀 MinFilter 再膨胀 MaxFilter):封掉细通道与小块孔洞,
     同时保持外形尺寸不变;
  2. **封闭透明区回填**:闭运算后仍与外界不连通的透明像素,直接设为不透明
     (它们不可能是背景 —— 背景一定与画面四边连通)。

用法:python scripts/gen-walk-mask3.py
"""
import glob
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = r'E:\code\Eng\article-reading'
FRAMES = os.path.join(ROOT, '.artifacts', 'anim-rgb')
OUT = os.path.join(ROOT, 'assets', 'anim', 'walk-transparent.webp')
FPS = 30
FILL_THRESH = 10
SENTINEL = 128
# 闭运算核大小:3 足以封掉 1~2px 的细通道;再大会啃掉发丝等细节
CLOSE_SIZE = 3


def background_mask(gray: Image.Image) -> np.ndarray:
    filled = gray.copy()
    w, h = gray.size
    seeds = [(x, 0) for x in range(0, w, 16)] + [(x, h - 1) for x in range(0, w, 16)]
    seeds += [(0, y) for y in range(0, h, 16)] + [(w - 1, y) for y in range(0, h, 16)]
    for seed in seeds:
        if gray.getpixel(seed) <= FILL_THRESH:
            ImageDraw.floodfill(filled, seed, SENTINEL, thresh=FILL_THRESH)
    return np.asarray(filled) == SENTINEL


def clean_alpha(alpha: np.ndarray) -> np.ndarray:
    """封闭细通道与小孔,并回填"与外界不连通"的透明区。"""
    opaque = Image.fromarray(np.where(alpha > 40, 255, 0).astype(np.uint8), 'L')
    # 1) 闭运算:腐蚀 → 膨胀
    closed = opaque.filter(ImageFilter.MinFilter(CLOSE_SIZE)).filter(ImageFilter.MaxFilter(CLOSE_SIZE))
    # 2) 回填封闭透明区:从四边泛洪标记"与外界连通的透明",剩下的透明一律变不透明
    inv = Image.fromarray(np.where(np.asarray(closed) > 40, 0, 255).astype(np.uint8), 'L')
    w, h = inv.size
    for seed in [(x, 0) for x in range(0, w, 8)] + [(x, h - 1) for x in range(0, w, 8)]:
        if inv.getpixel(seed) == 255:
            ImageDraw.floodfill(inv, seed, 100, thresh=0)
    for seed in [(0, y) for y in range(0, h, 8)] + [(w - 1, y) for y in range(0, h, 8)]:
        if inv.getpixel(seed) == 255:
            ImageDraw.floodfill(inv, seed, 100, thresh=0)
    enclosed = np.asarray(inv) == 255  # 封闭的透明区 → 回填
    result = np.asarray(closed).copy()
    result[enclosed] = 255
    return np.where(result > 40, 255, 0).astype(np.uint8)


paths = sorted(glob.glob(os.path.join(FRAMES, '*.png')))
print(f'帧数 {len(paths)}')

# 并集包围盒(用清理后的 alpha 计算,避免把噪点当成角色)
x0 = y0 = 10 ** 9
x1 = y1 = -1
for p in paths:
    img = Image.open(p).convert('L')
    alpha = np.where(background_mask(img), 0, 255).astype(np.uint8)
    alpha = clean_alpha(alpha)
    ys, xs = np.where(alpha > 40)
    if len(xs):
        x0, x1 = min(x0, int(xs.min())), max(x1, int(xs.max()))
        y0, y1 = min(y0, int(ys.min())), max(y1, int(ys.max()))
PAD = 8
w, h = Image.open(paths[0]).size
box = (max(0, x0 - PAD), max(0, y0 - PAD), min(w, x1 + PAD + 1), min(h, y1 + PAD + 1))
print(f'包围盒 {box} → {(box[2]-box[0], box[3]-box[1])}')

frame_dir = os.path.join(ROOT, '.artifacts', 'anim-masked3')
os.makedirs(frame_dir, exist_ok=True)
for old in glob.glob(os.path.join(frame_dir, '*.png')):
    os.remove(old)

for i, p in enumerate(paths):
    img = Image.open(p).convert('RGB')
    alpha = clean_alpha(np.where(background_mask(img.convert('L')), 0, 255).astype(np.uint8))
    rgba = np.dstack([np.asarray(img), alpha])
    Image.fromarray(rgba, 'RGBA').crop(box).save(os.path.join(frame_dir, f'm{i:04d}.png'))

frames = [Image.open(f) for f in sorted(glob.glob(os.path.join(frame_dir, '*.png')))]
opaque_ratio = (np.asarray(frames[0])[:, :, 3] > 247).mean() * 100
frames[0].save(OUT, save_all=True, append_images=frames[1:],
               duration=int(1000 / FPS), loop=0, quality=80, method=4, lossless=False)
print(f'已生成 {OUT} · {os.path.getsize(OUT)/1024:.0f} KB · {frames[0].size} · 不透明 {opaque_ratio:.1f}%')
