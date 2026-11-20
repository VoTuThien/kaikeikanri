# Bùa may mắn B / A / S (Bua_B, Bua_A, Bua_S) + Bùa giữ cấp (Bua_GiuCap) — icon item Vườn mây. Cần chạy h2.py trước.
# Collection "Bua", hàng mẫu ngoài mây (y = -30). Dựng trong mặt XZ, mặt trước hướng -Y. Chạy lại thì xoá bản cũ rồi dựng lại.
# Đặt bpy.app.driver_namespace["BUA_ONLY"] = ["B", "A"] để chỉ dựng lại vài lá.
import bpy, bmesh, math
from mathutils import Vector, Matrix
ns = bpy.app.driver_namespace; H = ns["H2"]; D = bpy.data; O = D.objects
coll = H["get_coll"]("Bua")
ONLY = ns.get("BUA_ONLY") or ["B", "A", "S", "GiuCap"]
for o in list(coll.objects):
    if any(o.name == f"Bua_{k}" or o.name.startswith(f"Bua_{k}_") for k in ONLY): D.objects.remove(o, do_unlink=True)
M = H["mat"]; TH = 0.09  # bề dày thẻ bùa

def slab(name, pts, th, m, bev=0.022):
    bm = bmesh.new(); vs = [bm.verts.new((x, -th / 2, z)) for x, z in pts]; f = bm.faces.new(vs)
    ext = bmesh.ops.extrude_face_region(bm, geom=[f]); nv = [g for g in ext["geom"] if isinstance(g, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, verts=nv, vec=(0, th, 0)); bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = D.meshes.new(name); bm.to_mesh(me); bm.free(); me.materials.append(m)
    o = D.objects.new(name, me); coll.objects.link(o)
    b = o.modifiers.new("Bev", 'BEVEL'); b.width = bev; b.segments = 3; b.limit_method = 'ANGLE'
    return o

def arch_outline(w, h, n=24, rc=0.06):
    # thẻ bùa: đáy bo 2 góc, 2 cạnh thẳng, đầu vòm bán nguyệt
    r = w / 2; zb, zt = -h / 2, h / 2 - r; pts = []
    for k in range(6):  # góc phải dưới
        a = -math.pi / 2 + (math.pi / 2) * k / 5; pts.append((r - rc + rc * math.cos(a), zb + rc + rc * math.sin(a)))
    for k in range(n + 1):
        a = math.pi * k / n; pts.append((r * math.cos(a), zt + r * math.sin(a)))
    for k in range(6):  # góc trái dưới
        a = math.pi + (math.pi / 2) * k / 5; pts.append((-r + rc + rc * math.cos(a), zb + rc + rc * math.sin(a)))
    return pts

def shield_outline(w, h, n=14):
    r = w / 2; zt = h * 0.42; pts = [(r, zt)]
    for k in range(1, n + 1):  # cạnh phải cong xuống mũi nhọn
        t = k / n; pts.append((r * (1 - t ** 1.8) * (1 + 0.08 * math.sin(math.pi * t)), zt - (h * 0.42 + h * 0.58) * t))
    pts = pts[:-1] + [(0, -h * 0.58)]
    left = [(-x, z) for x, z in reversed(pts[:-1])]
    top = [(r * 0.55, zt + 0.035), (0, zt + 0.05), (-r * 0.55, zt + 0.035)]  # mép trên vồng lên nhẹ
    return pts + left + list(reversed(top))[::-1][::-1]

def rim(name, pts, s, r, m, y):
    P = [Vector((x * s, y, z * s)) for x, z in pts]; P.append(P[0])
    return H["tube"](name, P, r, m, coll, sides=6)

def leaf_clover(prefix, cx, cz, size, y, m, m_c=None):
    parts = []
    for k in range(4):
        a = math.radians(45 + 90 * k)
        for side in (-1, 1):  # mỗi lá là 2 thuỳ → hình tim
            b = a + side * 0.42
            p = (cx + math.cos(b) * size * 0.62, y, cz + math.sin(b) * size * 0.62)
            o = H["sphere"](f"{prefix}_l{k}{side}", p, size * 0.42, m, coll, seg=14, scale=(1, 0.32, 1)); parts.append(o)
    st = H["tube"](f"{prefix}_st", [(cx, y + 0.005, cz), (cx + size * 0.25, y + 0.005, cz - size * 0.7), (cx + size * 0.5, y + 0.005, cz - size * 1.1)], size * 0.09, m, coll, sides=5)
    parts.append(st)
    if m_c: parts.append(H["sphere"](f"{prefix}_c", (cx, y - 0.012, cz), size * 0.22, m_c, coll, seg=14, scale=(1, 0.6, 1)))
    return parts

def star_pts(R, r, n=5, rot=90):
    return [((R if i % 2 == 0 else r) * math.cos(math.radians(rot + 180 / n * i)), (R if i % 2 == 0 else r) * math.sin(math.radians(rot + 180 / n * i))) for i in range(2 * n)]

def cord_tassel(prefix, ztop, zbot, m_cord, m_tas, m_knot, long=1.0):
    parts = [H["torus"](f"{prefix}_vong", 0, 0.07, 0.014, m_cord, coll, segs=24, minor=6, loc=(0, 0, ztop + 0.06), normal=(0, 1, 0))]
    parts.append(H["sphere"](f"{prefix}_nut", (0, 0, zbot - 0.035), 0.04, m_knot, coll, seg=12))
    L = 0.2 * long
    parts.append(H["tube"](f"{prefix}_co", [(0, 0, zbot - 0.06), (0, 0, zbot - 0.1)], 0.028, m_knot, coll, sides=8))
    for k in range(9):  # tua rua: các sợi toả nhẹ
        a = 2 * math.pi * k / 9; dx, dy = math.cos(a) * 0.022, math.sin(a) * 0.022
        parts.append(H["tube"](f"{prefix}_t{k}", [(dx, dy, zbot - 0.09), (dx * 1.6, dy * 1.6, zbot - 0.09 - L * 0.5), (dx * 2.2, dy * 2.2, zbot - 0.09 - L)], 0.011, m_tas, coll, sides=5))
    return parts

def sparkle(name, loc, size, m, r):
    src = O["Tien_LongChim_LapLanh"].data.copy(); src.materials.clear(); src.materials.append(m)
    o = D.objects.new(name, src); coll.objects.link(o); o.parent = r; o.matrix_parent_inverse = Matrix.Identity(4)
    o.location = loc; o.scale = (size, size, size); return o

def attach(objs, name, r):
    o = H["join"](objs, name); o.parent = r; o.matrix_parent_inverse = Matrix.Identity(4); return o

def root(name, loc, ten):
    r = D.objects.new(name, None); coll.objects.link(r); r.location = loc; r["ten"] = ten; return r

W, Hh = 0.5, 0.68; YF = -TH / 2 - 0.004
# ---------------- bảng màu theo hạng ----------------
RANKS = {
    "B": dict(ten="Bùa may mắn B", x=9.0, than=(0.2, 0.5, 0.95), vien=(0.9, 0.95, 1.0), vmetal=0.6, la=(0.45, 0.95, 0.5), tua=(0.35, 0.65, 1.0)),
    "A": dict(ten="Bùa may mắn A", x=10.2, than=(0.52, 0.27, 0.92), vien=(1.0, 0.82, 0.45), vmetal=0.85, la=(0.4, 0.95, 0.55), tua=(0.75, 0.45, 1.0)),
    "S": dict(ten="Bùa may mắn S", x=11.4, than=(1.0, 0.55, 0.12), vien=(1.0, 0.86, 0.4), vmetal=0.9, la=(0.3, 1.0, 0.55), tua=(0.95, 0.2, 0.18)),
}
for k, c in RANKS.items():
    if k not in ONLY: continue
    p = f"Bua_{k}"; r = root(p, (c["x"], -30.0, 0.8), c["ten"]); r["hang"] = k
    m_than = M(f"Bua{k}_Than", c["than"], rough=0.3, metal=0.15 if k != "S" else 0.3, coat=0.6)
    m_vien = M(f"Bua{k}_Vien", c["vien"], rough=0.2, metal=c["vmetal"])
    m_la = M(f"Bua{k}_La", c["la"], rough=0.35, emit=(c["la"], 0.35 if k == "B" else 0.45 if k == "A" else 0.7))
    m_tua = M(f"Bua{k}_Tua", c["tua"], rough=0.6)
    m_gem = M(f"Bua{k}_Ngoc", (1.0, 0.25, 0.6) if k == "A" else (0.15, 0.85, 1.0), rough=0.08, metal=0.2, coat=1.0, emit=((1.0, 0.3, 0.65) if k == "A" else (0.2, 0.9, 1.0), 0.6))
    out = arch_outline(W, Hh)
    attach([slab(p + "_tmp_s", out, TH, m_than)], p + "_Than", r)
    vien = [rim(p + "_tmp_r1", out, 1.0, 0.022, m_vien, 0)]
    if k != "B": vien.append(rim(p + "_tmp_r2", out, 0.8, 0.012, m_vien, YF))
    vien += cord_tassel(p + "_tmp_d", Hh / 2, -Hh / 2, m_vien, m_tua, m_vien, long=1.0 if k == "B" else 1.25 if k == "A" else 1.45)
    attach(vien, p + "_Vien", r)
    attach(leaf_clover(p + "_tmp_c", 0, 0.02, 0.17 if k == "B" else 0.16, YF, m_la, m_gem if k != "B" else None), p + "_HoaVan", r)
    if k == "A":  # 2 hạt ngọc 2 bên + 1 hạt trên vòm
        g = [H["sphere"](p + f"_tmp_g{i}", pos, 0.032, m_gem, coll, seg=12, scale=(1, 0.6, 1)) for i, pos in enumerate([(-0.17, YF, -0.22), (0.17, YF, -0.22), (0, YF, 0.24)])]
        attach(g, p + "_Ngoc", r)
    if k == "S":
        m_sao = M("BuaS_Sao", (1.0, 0.9, 0.55), rough=0.15, metal=0.8, emit=((1.0, 0.85, 0.4), 2.0))
        m_canh = M("BuaS_Canh", (1.0, 0.97, 0.9), rough=0.3, emit=((1.0, 0.92, 0.7), 0.6))
        crown = slab(p + "_tmp_sao", [(x, z + Hh / 2 + 0.11) for x, z in star_pts(0.1, 0.045)], 0.05, m_sao, bev=0.01)
        g = [H["sphere"](p + f"_tmp_g{i}", pos, 0.03, m_gem, coll, seg=12, scale=(1, 0.6, 1)) for i, pos in enumerate([(-0.17, YF, -0.22), (0.17, YF, -0.22)])]
        attach([crown] + g, p + "_Ngoc", r)
        wings = []
        for side in (-1, 1):  # đôi cánh 4 lông vũ mỗi bên, sau thẻ
            for j in range(4):
                a = math.radians(25 - 22 * j); L = 0.26 - 0.035 * j
                cx = side * (W / 2 - 0.02 + math.cos(a) * L * 0.5); cz = 0.12 + math.sin(a) * L * 0.5
                o = H["sphere"](p + f"_tmp_w{side}{j}", (cx, 0.03, cz), 0.5, m_canh, coll, seg=14, scale=(L, 0.025, 0.055 - 0.006 * j))
                o.rotation_euler = (0, -side * a, 0); wings.append(o)
        attach(wings, p + "_Canh", r)
        m_ll = M("BuaS_LapLanh", (1, 0.95, 0.8), emit=((1.0, 0.9, 0.6), 6.0))
        sparkle(p + "_LapLanh", (0, -0.08, 0.04), 1.25, m_ll, r)

# ---------------- Bùa giữ cấp: khiên bạc, ổ khoá vàng, lỗ khoá sáng xanh ngọc ----------------
if "GiuCap" in ONLY:
    p = "Bua_GiuCap"; r = root(p, (12.6, -30.0, 0.8), "Bùa giữ cấp")
    m_than = M("BuaGC_Than", (0.8, 0.85, 0.92), rough=0.3, metal=0.6, coat=0.5)
    m_vien = M("BuaGC_Vien", (0.2, 0.75, 0.75), rough=0.25, metal=0.6, emit=((0.2, 0.8, 0.8), 0.4))
    m_khoa = M("BuaGC_Khoa", (1.0, 0.75, 0.25), rough=0.3, metal=0.45, emit=((1.0, 0.7, 0.25), 0.15))
    m_lo = M("BuaGC_LoKhoa", (0.6, 1.0, 0.95), emit=((0.35, 1.0, 0.9), 6.0))
    m_xich = M("BuaGC_Xich", (0.8, 0.84, 0.9), rough=0.25, metal=0.9)
    out = shield_outline(0.56, 0.72)
    attach([slab(p + "_tmp_s", out, TH, m_than)], p + "_Than", r)
    vien = [rim(p + "_tmp_r1", out, 1.0, 0.024, m_vien, 0), rim(p + "_tmp_r2", out, 0.82, 0.012, m_vien, YF)]
    for i in range(3):  # xích 3 mắt treo trên đỉnh
        o = H["torus"](p + f"_tmp_x{i}", 0, 0.035, 0.011, m_xich, coll, segs=18, minor=6, loc=(0, 0, 0.33 + 0.055 * i), normal=(0, 1, 0) if i % 2 == 0 else (1, 0, 0))
        o.scale = (1, 1, 1.35) if i % 2 == 0 else (1.35, 1, 1); vien.append(o)
    attach(vien, p + "_Vien", r)
    # ổ khoá: thân hộp bo góc + quai chữ U phía trên
    body = slab(p + "_tmp_k", [(x * 0.16, z * 0.13 - 0.05) for x, z in [(-1, -1), (1, -1), (1, 1), (-1, 1)]], 0.07, m_khoa, bev=0.025)
    body.location = (0, YF - 0.035, 0)
    sh = H["torus"](p + "_tmp_q", 0, 0.085, 0.022, m_khoa, coll, segs=28, minor=8, loc=(0, YF - 0.035, 0.08), normal=(0, 1, 0))
    attach([body, sh], p + "_Khoa", r)
    hole = [H["sphere"](p + "_tmp_h", (0, YF - 0.072, -0.02), 0.03, m_lo, coll, seg=14, scale=(1, 0.4, 1)),
            H["tube"](p + "_tmp_h2", [(0, YF - 0.072, -0.03), (0, YF - 0.072, -0.11)], 0.016, m_lo, coll, sides=6, taper=lambda t: 1 + 0.6 * t)]
    attach(hole, p + "_LoKhoa", r)
    m_ll = M("BuaGC_LapLanh", (0.9, 1, 1), emit=((0.6, 1.0, 0.95), 5.0))
    sparkle(p + "_LapLanh", (0, -0.08, 0.0), 1.15, m_ll, r)

result = {k: [c.name for c in O[f"Bua_{k}"].children] for k in ONLY}
