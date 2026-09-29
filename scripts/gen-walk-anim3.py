"""从裁切好的帧里挑出体积与画质的平衡点。

上一版裁到 235×333(原像素的 15%)后体积仍有 2855 KB —— 因为 alpha 来自亮度渐变,
软边多、压缩率低。这里同时试质量与分辨率两档,目标压到 1.2 MB 以内。

用法:python scripts/gen-walk-anim3.py
"""
import glob
import os

from PIL import Image

ROOT = r'E:\code\Eng\article-reading'
CROPS = os.path.join(ROOT, '.artifacts', 'anim-crops')
OUT = os.path.join(ROOT, 'assets', 'anim', 'walk-transparent.webp')
FPS = 30

paths = sorted(glob.glob(os.path.join(CROPS, 'c*.png')))
if not paths:
    raise SystemExit('没有裁切帧,先跑 gen-walk-anim2.py')
base = Image.open(paths[0])
print(f'裁切帧 {len(paths)} 张 · {base.size}')

tmp = os.path.join(ROOT, 'assets', 'anim', '_sweep.webp')
best = None
for scale, quality in [(1.0, 78), (1.0, 60), (1.0, 50), (0.8, 60), (0.72, 65), (0.72, 55)]:
    if scale == 1.0:
        frames = [Image.open(p).convert('RGBA') for p in paths]
    else:
        size = (max(1, int(base.size[0] * scale)), max(1, int(base.size[1] * scale)))
        frames = [Image.open(p).convert('RGBA').resize(size, Image.LANCZOS) for p in paths]
    frames[0].save(tmp, save_all=True, append_images=frames[1:],
                   duration=int(1000 / FPS), loop=0, quality=quality, method=4)
    kb = os.path.getsize(tmp) / 1024
    print(f'  scale={scale} quality={quality} 尺寸={frames[0].size} → {kb:.0f} KB')
    if best is None or (kb <= 1200 and kb > best[0]):
        best = (kb, scale, quality, frames[0].size)
    for im in frames:
        im.close()

kb, scale, quality, size = best
print(f'选中:scale={scale} quality={quality} 尺寸={size} ({kb:.0f} KB)')
if scale == 1.0:
    frames = [Image.open(p).convert('RGBA') for p in paths]
else:
    dst = (max(1, int(base.size[0] * scale)), max(1, int(base.size[1] * scale)))
    frames = [Image.open(p).convert('RGBA').resize(dst, Image.LANCZOS) for p in paths]
frames[0].save(OUT, save_all=True, append_images=frames[1:],
               duration=int(1000 / FPS), loop=0, quality=quality, method=4)
for im in frames:
    im.close()
if os.path.exists(tmp):
    os.remove(tmp)
print(f'已生成 {OUT} · {os.path.getsize(OUT)/1024:.0f} KB')
