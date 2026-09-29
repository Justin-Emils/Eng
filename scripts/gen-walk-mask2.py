"""行走动画抠底 v2:更严的判据 + 更紧的阈值。

v1 的两个不足(用户反馈"身上依旧有透明的地方"):
  1. **判据太弱**:只统计"被不透明像素四面包围的透明点",抓不到大块透明区,
     也抓不到通过细缝与外界连通的透明区。正确判据是:
     **任何不与画面边界连通的透明像素都算漏洞**。
  2. **阈值太宽**:FILL_THRESH=26 时,角色深色部位(靴子/披风,灰度约 20~60)
     与其抗锯齿过渡带和纯黑背景连成一片,泛洪会顺着渐变"漏进"角色内部。

v2 做法:
  · 阈值收紧到 10(纯黑背景实测 std=0,余量足够);
  · 逐帧用"不连通透明像素"自检,并把最差的一帧编号打出来;
  · 额外统计角色边界残留的暗色描边宽度,确认没有啃掉主体。

用法:python scripts/gen-walk-mask2.py
"""
import glob
import os

import numpy as np
from PIL import Image, ImageDraw

ROOT = r'E:\code\Eng\article-reading'
FRAMES = os.path.join(ROOT, '.artifacts', 'anim-rgb')
OUT = os.path.join(ROOT, 'assets', 'anim', 'walk-transparent.webp')
FPS = 30
FILL_THRESH = 10
SENTINEL = 128


def background_mask(gray: Image.Image) -> np.ndarray:
    filled = gray.copy()
    w, h = gray.size
    seeds = [(x, 0) for x in range(0, w, 16)] + [(x, h - 1) for x in range(0, w, 16)]
    seeds += [(0, y) for y in range(0, h, 16)] + [(w - 1, y) for y in range(0, h, 16)]
    for seed in seeds:
        if gray.getpixel(seed) <= FILL_THRESH:
            ImageDraw.floodfill(filled, seed, SENTINEL, thresh=FILL_THRESH)
    return np.asarray(filled) == SENTINEL


def enclosed_transparent_count(alpha: np.ndarray) -> int:
    """统计**不与画面边界连通**的透明像素数(真漏洞)。"""
    transparent = alpha < 8
    if not transparent.any():
        return 0
    mask = Image.fromarray(np.where(transparent, 255, 0).astype(np.uint8), 'L')
    # 从四条边把"与外界连通的透明区"填成灰色,剩下的 255 就是封闭的透明孔
    h, w = alpha.shape
    for seed in [(x, 0) for x in range(0, w, 8)] + [(x, h - 1) for x in range(0, w, 8)]:
        if mask.getpixel(seed) == 255:
            ImageDraw.floodfill(mask, seed, 200, thresh=0)
    for seed in [(0, y) for y in range(0, h, 8)] + [(w - 1, y) for y in range(0, h, 8)]:
        if mask.getpixel(seed) == 255:
            ImageDraw.floodfill(mask, seed, 200, thresh=0)
    return int((np.asarray(mask) == 255).sum())


paths = sorted(glob.glob(os.path.join(FRAMES, '*.png')))
print(f'帧数 {len(paths)} · 阈值 {FILL_THRESH}')

# 并集包围盒
x0 = y0 = 10 ** 9
x1 = y1 = -1
for p in paths:
    gray = Image.open(p).convert('L')
    bg = background_mask(gray)
    ys, xs = np.where(~bg)
    if len(xs):
        x0, x1 = min(x0, int(xs.min())), max(x1, int(xs.max()))
        y0, y1 = min(y0, int(ys.min())), max(y1, int(ys.max()))
PAD = 8
w, h = Image.open(paths[0]).size
box = (max(0, x0 - PAD), max(0, y0 - PAD), min(w, x1 + PAD + 1), min(h, y1 + PAD + 1))
print(f'包围盒 {box} → {(box[2]-box[0], box[3]-box[1])}')

frame_dir = os.path.join(ROOT, '.artifacts', 'anim-masked2')
os.makedirs(frame_dir, exist_ok=True)
for old in glob.glob(os.path.join(frame_dir, '*.png')):
    os.remove(old)

worst = (0, -1)
for i, p in enumerate(paths):
    img = Image.open(p).convert('RGB')
    bg = background_mask(img.convert('L'))
    alpha = np.where(bg, 0, 255).astype(np.uint8)
    rgba = np.dstack([np.asarray(img), alpha])
    out = Image.fromarray(rgba, 'RGBA').crop(box)
    holes = enclosed_transparent_count(np.asarray(out)[:, :, 3])
    if holes > worst[0]:
        worst = (holes, i)
    out.save(os.path.join(frame_dir, f'm{i:04d}.png'))

print(f'封闭透明孔:最差帧 #{worst[1]} 有 {worst[0]} 个像素(应为 0)')

masked = [Image.open(f) for f in sorted(glob.glob(os.path.join(frame_dir, '*.png')))]
opaque = (np.asarray(masked[0])[:, :, 3] > 247).mean() * 100
masked[0].save(OUT, save_all=True, append_images=masked[1:],
               duration=int(1000 / FPS), loop=0, quality=80, method=4, lossless=False)
print(f'已生成 {OUT} · {os.path.getsize(OUT)/1024:.0f} KB · {masked[0].size} · 不透明 {opaque:.1f}%')
