"""行走动画抠底 v4:对**背景掩码**做形态学开运算,消除细通道与噪点。

思路修正:前面几版都在"修角色"(闭运算/回填),而问题其实出在**背景**——
背景掩码里有若干细小的触须(由浅色衣服上的压缩噪点连成),它们把泛洪引进了角色内部。

所以直接把背景掩码做**开运算**(先腐蚀再膨胀):
  · 腐蚀:细触须(1~2px 宽)整条消失;
  · 膨胀:主体背景恢复原尺寸。
被消掉的触须不再连通,角色内部就不会被抠穿。最后再回填"与边界不连通的透明区"兜底。

用法:python scripts/gen-walk-mask4.py
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
OPEN_SIZE = 5  # 开运算核:5 可消掉 2px 以内的细通道;发丝等细主体宽度远大于此


def flood_background(gray: Image.Image) -> np.ndarray:
    """从四边泛洪,返回 True = 与边界连通的背景"""
    filled = gray.copy()
    w, h = gray.size
    seeds = [(x, 0) for x in range(0, w, 8)] + [(x, h - 1) for x in range(0, w, 8)]
    seeds += [(0, y) for y in range(0, h, 8)] + [(w - 1, y) for y in range(0, h, 8)]
    for seed in seeds:
        if gray.getpixel(seed) <= FILL_THRESH:
            ImageDraw.floodfill(filled, seed, SENTINEL, thresh=FILL_THRESH)
    return np.asarray(filled) == SENTINEL


def alpha_for(img_rgb: Image.Image) -> np.ndarray:
    bg = flood_background(img_rgb.convert('L'))
    m = Image.fromarray(np.where(bg, 255, 0).astype(np.uint8), 'L')
    # 开运算:MinFilter 收缩(细触须消失)→ MaxFilter 恢复主体尺寸
    m = m.filter(ImageFilter.MinFilter(OPEN_SIZE)).filter(ImageFilter.MaxFilter(OPEN_SIZE))
    bg2 = np.asarray(m) > 128

    alpha = np.where(bg2, 0, 255).astype(np.uint8)
    # 兜底:与边界不连通的透明区一定不是背景,填实
    inv = Image.fromarray(np.where(alpha == 0, 255, 0).astype(np.uint8), 'L')
    w, h = inv.size
    for seed in [(x, 0) for x in range(0, w, 8)] + [(x, h - 1) for x in range(0, w, 8)]:
        if inv.getpixel(seed) == 255:
            ImageDraw.floodfill(inv, seed, 100, thresh=0)
    for seed in [(0, y) for y in range(0, h, 8)] + [(w - 1, y) for y in range(0, h, 8)]:
        if inv.getpixel(seed) == 255:
            ImageDraw.floodfill(inv, seed, 100, thresh=0)
    enclosed = np.asarray(inv) == 255
    alpha[enclosed] = 255
    return alpha, int(bg.sum()), int(bg2.sum()), int(enclosed.sum())


paths = sorted(glob.glob(os.path.join(FRAMES, '*.png')))
probe = Image.open(paths[16]).convert('RGB')
a, n1, n2, n3 = alpha_for(probe)
print(f'帧16 自检: 泛洪背景 {n1} px → 开运算后 {n2} px · 回填封闭透明 {n3} px · 最终透明 {100*(a<8).mean():.1f}%')

x0 = y0 = 10 ** 9
x1 = y1 = -1
for p in paths:
    alpha, _, _, _ = alpha_for(Image.open(p).convert('RGB'))
    ys, xs = np.where(alpha > 40)
    if len(xs):
        x0, x1 = min(x0, int(xs.min())), max(x1, int(xs.max()))
        y0, y1 = min(y0, int(ys.min())), max(y1, int(ys.max()))
PAD = 8
w, h = Image.open(paths[0]).size
box = (max(0, x0 - PAD), max(0, y0 - PAD), min(w, x1 + PAD + 1), min(h, y1 + PAD + 1))
print(f'包围盒 {box} → {(box[2]-box[0], box[3]-box[1])}')

out_dir = os.path.join(ROOT, '.artifacts', 'anim-masked4')
os.makedirs(out_dir, exist_ok=True)
for old in glob.glob(os.path.join(out_dir, '*.png')):
    os.remove(old)
for i, p in enumerate(paths):
    img = Image.open(p).convert('RGB')
    alpha, _, _, _ = alpha_for(img)
    rgba = np.dstack([np.asarray(img), alpha])
    Image.fromarray(rgba, 'RGBA').crop(box).save(os.path.join(out_dir, f'm{i:04d}.png'))

frames = [Image.open(f) for f in sorted(glob.glob(os.path.join(out_dir, '*.png')))]
frames[0].save(OUT, save_all=True, append_images=frames[1:],
               duration=int(1000 / FPS), loop=0, quality=80, method=4, lossless=False)
ratio = (np.asarray(frames[0])[:, :, 3] > 247).mean() * 100
print(f'已生成 {OUT} · {os.path.getsize(OUT)/1024:.0f} KB · {frames[0].size} · 不透明 {ratio:.1f}%')
