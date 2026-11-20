# Bươm bướm (côn trùng thứ 5) — collection ConTrung. Chạy sau h2.py.
# Cùng quy ước các côn trùng khác: khung Empty `Buom` (phóng 1,4), bộ phận tỉ lệ 1 / góc 0 ở dáng nghỉ, tâm đúng điểm xoay,
# thuộc tính `anim`; mặt hướng -Y (Blender). Cánh nằm ngang (mặt XY), gốc cánh ở sát thân: vỗ cánh = xoay quanh trục Y cục bộ.
import bpy, bmesh, math
from mathutils import Vector, Matrix
O = bpy.data.objects; D = bpy.data; H = bpy.app.driver_namespace["H2"]
coll = H["get_coll"]("ConTrung")
for o in [o for o in O if o.name == "Buom" or o.name.startswith("Buom_")]: D.objects.remove(o, do_unlink=True)

M = H["mat"]
m_than = M("CT_BuomThan", (0.22, 0.14, 0.34), 0.55)
m_long = M("CT_BuomLong", (0.38, 0.27, 0.55), 0.8)            # lông tơ ngực
m_den = D.materials["CT_Den"]; m_trang = D.materials["CT_Trang"]; m_hong = D.materials["CT_Hong"]; m_vang = D.materials["CT_Vang"]
m_tren = M("CT_BuomCanhTren", (0.36, 0.62, 1.0), 0.35, emit=((0.36, 0.62, 1.0), 0.15))   # cánh trên: xanh trời
m_tren_n = M("CT_BuomCanhTrenNhat", (0.80, 0.90, 1.0), 0.35, emit=((0.8, 0.9, 1.0), 0.15))
m_duoi = M("CT_BuomCanhDuoi", (0.93, 0.52, 0.95), 0.35, emit=((0.93, 0.52, 0.95), 0.15)) # cánh dưới: hồng tím
m_duoi_n = M("CT_BuomCanhDuoiNhat", (1.0, 0.82, 0.95), 0.35, emit=((1.0, 0.82, 0.95), 0.15))
m_vien = M("CT_BuomVien", (0.20, 0.10, 0.36), 0.5)

# ---------- Thân: đầu tròn to (dễ thương), ngực lông, bụng thon có khía ----------
parts = []
parts.append(H["sphere"]("b_dau", (0, -0.13, 0.03), 0.072, m_than, coll, seg=20))
parts.append(H["sphere"]("b_nguc", (0, -0.035, 0.0), 0.05, m_long, coll, seg=16, scale=(1, 1.25, 1)))
for k in range(5):  # bụng: 5 đốt nhỏ dần
    y = 0.04 + k * 0.042; r = 0.042 * (1 - k * 0.14)
    parts.append(H["sphere"](f"b_bung{k}", (0, y, -0.004 - k * 0.004), r, m_than, coll, seg=14, scale=(1, 0.9, 0.95)))
# mắt to + đốm sáng, má hồng
for sx in (-1, 1):
    parts.append(H["sphere"](f"b_mat{sx}", (sx * 0.034, -0.188, 0.045), 0.024, m_den, coll, seg=14))
    parts.append(H["sphere"](f"b_mats{sx}", (sx * 0.028, -0.207, 0.056), 0.008, m_trang, coll, seg=8))
    parts.append(H["sphere"](f"b_ma{sx}", (sx * 0.052, -0.177, 0.006), 0.014, m_hong, coll, seg=10, scale=(1, 0.5, 0.7)))
    # râu cong, đầu tròn vàng
    pts = [(sx * (0.018 + 0.05 * t + 0.03 * t * t), -0.17 - 0.07 * t - 0.03 * math.sin(t * 2.6), 0.09 + 0.12 * t - 0.05 * t * t) for t in [i / 9 for i in range(10)]]
    parts.append(H["tube"](f"b_rau{sx}", pts, 0.006, m_den, coll, sides=6))
    parts.append(H["sphere"](f"b_raud{sx}", pts[-1], 0.016, m_vang, coll, seg=10))
# miệng cười nhỏ
smile = [(0.016 * math.cos(a), -0.199 - 0.006 * math.sin(a), 0.012 - 0.008 * math.sin(a)) for a in [math.pi * (0.15 + 0.7 * i / 6) for i in range(7)]]
parts.append(H["tube"]("b_mieng", smile, 0.0035, m_den, coll, sides=5))
than = H["join"](parts, "Buom_Than")

# ---------- Cánh: mỗi bên 1 object gồm cánh trên + cánh dưới ----------
# Cánh = quạt từ tâm cánh ra mép: vòng trong màu nhạt, giữa màu chính, viền đậm; chấm trắng gần mép (xuyên qua cánh để thấy cả 2 mặt).
def wing_shape(sx, cx, cy, rx, ry, rot, wob):
    # dựng cho cánh PHẢI (cx > 0, rot theo cánh phải), sx = -1 thì lật đối xứng qua trục thân
    def f(a):
        r = 1 + wob(a)
        x, y = rx * r * math.cos(a), ry * r * math.sin(a)
        c, s = math.cos(rot), math.sin(rot)
        return sx * (cx + x * c - y * s), cy + x * s + y * c
    return f

def make_wing(name, shape, m_in, m_mid, segs=48, spots=(), dz=0.0, eye=None):
    bm = bmesh.new()
    cx, cy = shape.center
    rings_t = [0.0, 0.45, 0.87, 1.0]
    mats = [m_in, m_mid, m_vien]
    me_mats = [m_in, m_mid, m_vien]
    center = bm.verts.new((cx, cy, 0))
    rings = []
    for t in rings_t[1:]:
        ring = []
        for i in range(segs):
            a = 2 * math.pi * i / segs; x, y = shape(a)
            ring.append(bm.verts.new((cx + (x - cx) * t, cy + (y - cy) * t, 0)))
        rings.append(ring)
    for i in range(segs):
        j = (i + 1) % segs
        f = bm.faces.new((center, rings[0][i], rings[0][j])); f.material_index = 0
        for k in range(len(rings) - 1):
            f = bm.faces.new((rings[k][i], rings[k + 1][i], rings[k + 1][j], rings[k][j])); f.material_index = min(k + 1, 2)
    for f in bm.faces: f.normal_update()
    # nâng nhẹ mép ngoài (cánh hơi cong lên = dáng nghỉ chữ V nhẹ)
    for v in bm.verts:
        v.co.z += 0.18 * abs(v.co.x) ** 1.3 + dz
    me = D.meshes.new(name); bm.to_mesh(me); bm.free()
    for m in me_mats: me.materials.append(m)
    o = D.objects.new(name, me); coll.objects.link(o)
    sol = o.modifiers.new("Day", 'SOLIDIFY'); sol.thickness = 0.008; sol.offset = 0
    objs = [o]
    for (sx_, sy_, sr) in spots:
        z = 0.18 * abs(sx_) ** 1.3 + dz
        s = H["sphere"](name + f"_c{len(objs)}", (sx_, sy_, z), sr, m_trang, coll, seg=10, scale=(1, 1, 0.45))
        objs.append(s)
    if eye:  # đốm hoa văn tròn: vòng viền đậm + lõi vàng
        ex, ey, er = eye; z = 0.18 * abs(ex) ** 1.3 + dz
        objs.append(H["sphere"](name + "_mv", (ex, ey, z), er, m_vien, coll, seg=16, scale=(1, 1, 0.3)))
        objs.append(H["sphere"](name + "_ml", (ex, ey, z), er * 0.55, m_vang, coll, seg=14, scale=(1, 1, 0.75)))
    return objs

def side(sx, nm):
    # cánh trên: to, chóp nhọn chếch về phía trước-ngoài; cánh dưới: nhỏ, tròn, có đuôi ngắn về phía sau. Cánh trên cao hơn cánh dưới 6mm (không đè cùng mặt phẳng)
    wob_t = lambda a: 0.2 * max(0.0, math.cos(a)) ** 4 + 0.04 * math.cos(3 * a)
    up = wing_shape(sx, 0.19, -0.095, 0.19, 0.11, -0.5, wob_t); up.center = (sx * 0.16, -0.075)
    wob_d = lambda a: 0.07 * math.cos(2 * a) + 0.16 * max(0.0, math.sin(a)) ** 10  # đuôi ngắn
    lo = wing_shape(sx, 0.12, 0.085, 0.12, 0.105, 0.55, wob_d); lo.center = (sx * 0.1, 0.07)
    objs = make_wing(nm + "_tren", up, m_tren_n, m_tren, dz=0.006, spots=[(sx * 0.36, -0.2, 0.013), (sx * 0.39, -0.15, 0.01), (sx * 0.31, -0.235, 0.009)],
                     eye=(sx * 0.2, -0.11, 0.038))
    objs += make_wing(nm + "_duoi", lo, m_duoi_n, m_duoi, dz=-0.006, spots=[(sx * 0.2, 0.16, 0.011), (sx * 0.14, 0.19, 0.008)],
                      eye=(sx * 0.13, 0.1, 0.026))
    w = H["join"](objs, nm)
    # dời gốc cánh (điểm xoay) về sát mép thân: (±0,028; -0,02; 0,012)
    piv = Vector((sx * 0.028, -0.02, 0.012))
    w.data.transform(Matrix.Translation(-piv)); w.location = piv
    for p in w.data.polygons: p.use_smooth = True
    return w

canh_p = side(1, "Buom_CanhPhai")
canh_t = side(-1, "Buom_CanhTrai")

# ---------- Khung + cây đối tượng ----------
root = D.objects.new("Buom", None); coll.objects.link(root)
root.empty_display_size = 0.25; root["anim"] = "khung: bay chap chon quanh cay"
than["anim"] = "nhap nho khi bay"
for w in (canh_t, canh_p): w["anim"] = "vo canh: xoay quanh truc Y cuc bo (bien do lon, cham hon dom dom)"
than.parent = root
for w in (canh_t, canh_p):
    loc = w.location.copy(); w.parent = than; w.matrix_parent_inverse = Matrix.Identity(4); w.location = loc
root.scale = (1.4, 1.4, 1.4)
root.location = (0.2, -1.9, 2.3)
result = {"than_v": len(than.data.vertices), "canh_v": len(canh_p.data.vertices), "mats": [m.name for m in canh_p.data.materials]}
