"""Xuất icon item (mảnh sao, bùa, phân bón) và icon côn trùng, 128px webp vào public/game/{sao,bua,phan,contrung}/.
Trước đó render trong Blender: ns["render_lv_glow"]([root], <dir>/x_<root>, 1, res=(512, 512), pad=1.3) rồi glow_merge.py <dir>/x_<root> <dir>/x_<root>.png.
Côn trùng: tạm xoay khung gốc cho dễ nhìn, tách mạng nhện (Nhen_Luoi) ra, render như trên, rồi trả lại (xem CLAUDE.md "Icon côn trùng").
Cắt vuông theo hình vật (+10%), quầng sáng bỏ phần quá nhạt (FLOOR) và nhạt dần ra mép để không lộ khung vuông.
Dùng: python item_icons.py <dir> [item|contrung]   (chạy ở gốc repo; bỏ nhóm = xuất cả 2)"""
import sys, numpy as np
from PIL import Image
d = sys.argv[1]; FLOOR = 0.1
GROUPS = {
    "item": {"ManhSao_Sang": "sao/sao_sang", "ManhSao": "sao/sao", "Bua_B": "bua/B", "Bua_A": "bua/A", "Bua_S": "bua/S", "Bua_GiuCap": "bua/keep", "PhanBon_B": "phan/B", "PhanBon_A": "phan/A"},
    "contrung": {"Sau": "contrung/sau", "BoRua": "contrung/bo_rua", "DomDom": "contrung/dom_dom", "Nhen": "contrung/nhen", "Buom": "contrung/buom"},
}
M = {}
for g in (sys.argv[2:] or GROUPS): M.update(GROUPS[g])
for n, out in M.items():
    im = np.asarray(Image.open(f"{d}/x_{n}.png").convert("RGBA")).astype(np.float32) / 255
    t = np.asarray(Image.open(f"{d}/x_{n}_t.png").convert("RGBA"))[..., 3].astype(np.float32) / 255
    ys, xs = np.where(t > 0.04)
    cx, cy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
    half = max(xs.max() - xs.min(), ys.max() - ys.min()) / 2 * 1.1
    H, W = t.shape; yy, xx = np.mgrid[0:H, 0:W]
    dx = np.maximum(np.abs(xx - cx) - half * 0.8, 0) / (half * 0.2); dy = np.maximum(np.abs(yy - cy) - half * 0.8, 0) / (half * 0.2)
    fall = np.clip(1 - np.sqrt(dx ** 2 + dy ** 2), 0, 1); fall = fall * fall * (3 - 2 * fall)
    glow = np.clip((im[..., 3] - FLOOR) / (1 - FLOOR), 0, 1) * fall
    im[..., 3] = np.maximum(glow, t)
    img = Image.fromarray((im * 255).clip(0, 255).astype(np.uint8), "RGBA")
    pad = Image.new("RGBA", (W + 400, H + 400)); pad.paste(img, (200, 200))
    sq = pad.crop((int(cx - half) + 200, int(cy - half) + 200, int(cx + half) + 200, int(cy + half) + 200))
    sq.resize((128, 128), Image.LANCZOS).save(f"public/game/{out}.webp", "WEBP", quality=90, method=6)
