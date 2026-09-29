"""把行走动画抠成透明背景 —— 用**边界泛洪**而不是"亮度当 alpha"。

问题(用户反馈):「加载界面的小人身上部分深色的地方变成透明了」。

原因:上一版用亮度当 alpha(alpha = 亮度 × 1.6),于是**角色自身的深色部分**
亮度低 → alpha≈0 → 被抠成透明。角色是浅色主体 + 深色描边/阴影,所以那些深色全漏了。

正确做法:背景是**纯黑且与画面边界连通**的一大片区域;角色内部的深色被角色自己的
浅色像素包围,**不与边界连通**。于是用「从四条边向内泛洪」把背景标出来,
只把泛洪到的像素设为透明,其余(含角色深色)一律不透明。

用法:python scripts/gen-walk-mask.py [帧目录] [输出文件]
"""
import glob
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

ROOT = r'E:\code\Eng\article-reading'
FRAMES = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, '.artifacts', 'anim-rgb')
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, 'assets', 'anim', 'walk-transparent.webp')
FPS = 30
# 背景判定:与种子像素灰度差 ≤ 该阈值,视为同一片背景(纯黑底实测 std=0,给点余量)
FILL_THRESH = 26
# 泛洪填充用的哨兵值:必须不等于角色上可能出现的灰度(角色是浅色 + 深色描边,故取中灰)
SENTINEL = 128

paths = sorted(glob.glob(os.path.join(FRAMES, '*.png')))
if not paths:
    raise SystemExit(f'没有帧:{FRAMES}')
print(f'帧数 {len(paths)} · 单帧 {Image.open(paths[0]).size}')


def background_mask(img: Image.Image) -> np.ndarray:
    """返回 True = 背景(应透明)。从四条边的每个像素向内泛洪。"""
    gray = img.convert('L')
    filled = gray.copy()
    w, h = gray.size
    seeds = [(x, 0) for x in range(0, w, 24)] + [(x, h - 1) for x in range(0, w, 24)]
    seeds += [(0, y) for y in range(0, h, 24)] + [(w - 1, y) for y in range(0, h, 24)]
    for seed in seeds:
        # 只从"接近黑"的边界像素起泛洪,避免从角色身上起填充
        if gray.getpixel(seed) <= FILL_THRESH:
            ImageDraw.floodfill(filled, seed, SENTINEL, thresh=FILL_THRESH)
    return np.asarray(filled) == SENTINEL


# 第一遍:算并集包围盒(角色走动会左右摆,必须取并集)
x0 = y0 = 10 ** 9
x1 = y1 = -1
for p in paths:
    img = Image.open(p).convert('RGB')
    bg = background_mask(img)
    ys, xs = np.where(~bg)
    if len(xs):
        x0, x1 = min(x0, int(xs.min())), max(x1, int(xs.max()))
        y0, y1 = min(y0, int(ys.min())), max(y1, int(ys.max()))
PAD = 10
w, h = Image.open(paths[0]).size
box = (max(0, x0 - PAD), max(0, y0 - PAD), min(w, x1 + PAD + 1), min(h, y1 + PAD + 1))
print(f'并集包围盒 {box} → {(box[2]-box[0], box[3]-box[1])}(原 {(w, h)})')

# 第二遍:生成带 alpha 的帧并落盘
frame_dir = os.path.join(ROOT, '.artifacts', 'anim-masked')
os.makedirs(frame_dir, exist_ok=True)
for old in glob.glob(os.path.join(frame_dir, '*.png')):
    os.remove(old)

holes_total = 0
for i, p in enumerate(paths):
    img = Image.open(p).convert('RGB')
    bg = background_mask(img)
    rgba = np.dstack([np.asarray(img), np.where(bg, 0, 255).astype(np.uint8)])
    out = Image.fromarray(rgba, 'RGBA').crop(box)
    # 统计"被不透明像素四面包围的透明点"= 真漏洞(应为 0)
    a = np.asarray(out)[:, :, 3]
    solid = a > 40
    inner = solid[1:-1, 1:-1]
    surrounded = inner & solid[:-2, 1:-1] & solid[2:, 1:-1] & solid[1:-1, :-2] & solid[1:-1, 2:]
    holes = int((~inner & surrounded).sum())
    holes_total += holes
    out.save(os.path.join(frame_dir, f'm{i:04d}.png'))

print(f'逐帧漏洞统计合计:{holes_total}(应为 0)')

masked = [Image.open(f) for f in sorted(glob.glob(os.path.join(frame_dir, '*.png')))]
masked[0].save(OUT, save_all=True, append_images=masked[1:],
               duration=int(1000 / FPS), loop=0, quality=80, method=4, lossless=False)
print(f'已生成 {OUT} · {os.path.getsize(OUT)/1024:.0f} KB · {masked[0].size}')
