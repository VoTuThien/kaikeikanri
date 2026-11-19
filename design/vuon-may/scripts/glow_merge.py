"""Ghép ảnh render nền đen (có quầng sáng bloom) + ảnh nền trong suốt (hình khối) thành ảnh nền trong suốt GIỮ quầng sáng.
Dùng: python glow_merge.py <base> <out> [nền xem thử RGB hex]"""
import sys
import numpy as np
from PIL import Image

base, out = sys.argv[1], sys.argv[2]
t = np.asarray(Image.open(base + "_t.png").convert("RGBA")).astype(np.float32) / 255
k = np.asarray(Image.open(base + "_k.png").convert("RGB")).astype(np.float32) / 255
glow = np.clip(k.max(axis=2) * 1.15, 0, 1)
alpha = np.maximum(t[..., 3], glow)
rgb = np.where(alpha[..., None] > 1e-3, np.clip(k / np.maximum(alpha[..., None], 1e-3), 0, 1), 0)
img = np.dstack([rgb, alpha])
im = Image.fromarray((img * 255).astype(np.uint8), "RGBA")
im.save(out)
if len(sys.argv) > 3:
    c = tuple(int(sys.argv[3][i:i + 2], 16) for i in (0, 2, 4))
    bg = Image.new("RGBA", im.size, c + (255,))
    bg.alpha_composite(im)
    bg.save(out.rsplit(".", 1)[0] + "-xem.png")
