# Mảnh vỡ sao sáng (ManhSao_Sang) + Mảnh vỡ sao (ManhSao) — icon item Vườn mây. Cần chạy h2.py trước.
# Collection "ManhSao", hàng mẫu ngoài mây (y = -28). Chạy lại thì xoá bản cũ rồi dựng lại.
import bpy, bmesh, math, random
from mathutils import Vector, Matrix
ns = bpy.app.driver_namespace; H = ns["H2"]; D = bpy.data; O = D.objects
coll = H["get_coll"]("ManhSao")
for o in list(coll.objects): D.objects.remove(o, do_unlink=True)

M = H["mat"]
m_vang = M("MS_Vang", (1.0, 0.72, 0.22), rough=0.22, metal=0.85, emit=((1.0, 0.62, 0.15), 0.35))
m_vang2 = M("MS_VangNhat", (1.0, 0.86, 0.45), rough=0.18, metal=0.75, emit=((1.0, 0.8, 0.4), 0.5))
m_loi = M("MS_LoiSang", (1, 0.97, 0.88), emit=((1.0, 0.95, 0.8), 9.0))
m_bac = M("MS_BacHong", (0.8, 0.58, 0.76), rough=0.22, metal=0.85, emit=((0.95, 0.55, 0.85), 0.18))
m_bac2 = M("MS_BacHongNhat", (0.95, 0.85, 0.95), rough=0.15, metal=0.6, emit=((1.0, 0.75, 0.95), 0.35))
m_loi2 = M("MS_LoiHong", (1, 0.9, 0.97), emit=((1.0, 0.7, 0.92), 2.0))
m_ll_v = M("MS_LapLanhVang", (1, 0.95, 0.8), emit=((1.0, 0.9, 0.65), 6.0))
m_ll_h = M("MS_LapLanhHong", (1, 0.92, 0.98), emit=((1.0, 0.82, 0.96), 5.0))

def mk(name, verts, faces, mats_of_face, mats):
    me = D.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    for m in mats: me.materials.append(m)
    for p, mi in zip(me.polygons, mats_of_face): p.material_index = mi
    o = D.objects.new(name, me); coll.objects.link(o); return o

def root(name, loc, ten):
    r = D.objects.new(name, None); coll.objects.link(r); r.location = loc; r["ten"] = ten; return r

def parent(o, r, rot_x=True):
    o.parent = r; o.matrix_parent_inverse = Matrix.Identity(4)
    if rot_x: o.rotation_euler = (math.radians(90), 0, 0)  # dựng trong mặt XY → đứng thẳng, mặt trước hướng -Y

def sparkle(name, loc, size, m, r):
    src = O["Tien_LongChim_LapLanh"].data.copy(); src.materials.clear(); src.materials.append(m)
    o = D.objects.new(name, src); coll.objects.link(o)
    o.parent = r; o.matrix_parent_inverse = Matrix.Identity(4)
    # mesh lấp lánh gốc gồm 3 ngôi sao; giữ nguyên, chỉ co giãn + dời
    o.location = loc; o.scale = (size, size, size); return o

# ---------- Mảnh vỡ sao sáng: sao 5 cánh khối mặt cắt, 1 cánh vỡ tách ra, mặt vỡ phát sáng trắng ----------
R0, R1, ZT = 0.5, 0.21, 0.14
rim = []
for i in range(10):
    a = math.radians(90 + 36 * i); rr = R0 if i % 2 == 0 else R1
    rim.append((rr * math.cos(a), rr * math.sin(a), 0.0))
top, bot = (0, 0, ZT), (0, 0, -ZT)
BROKEN = (7, 8)  # 2 nêm quanh đỉnh cánh số 8 (góc 18°, cánh phải trên)

def wedge_piece(name, idxs, offset, rot_deg, glow_sides):
    vs, fs, fm = [], [], []
    for k, i in enumerate(idxs):
        a, b = rim[i], rim[(i + 1) % 10]
        base = len(vs); vs += [top, bot, a, b]
        fs += [(base, base + 2, base + 3), (base + 1, base + 3, base + 2)]; fm += [0, 0]
        # mặt cắt bên (top, bot, rim) chỉ ở 2 đầu của mảnh
        if k == 0 and glow_sides: fs.append((base, base + 1, base + 2)); fm.append(1)
        if k == len(idxs) - 1 and glow_sides: fs.append((base, base + 3, base + 1)); fm.append(1)
    o = mk(name, vs, fs, fm, [m_vang, m_loi])
    bm = bmesh.new(); bm.from_mesh(o.data); bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(o.data); bm.free()
    for p in o.data.polygons: p.use_smooth = False
    # dời / xoay mảnh (trong mặt XY)
    c = Vector(rim[idxs[len(idxs) // 2] if len(idxs) % 2 else idxs[len(idxs) // 2]])
    Mx = Matrix.Translation(Vector(offset)) @ Matrix.Translation(c) @ Matrix.Rotation(math.radians(rot_deg), 4, 'Z') @ Matrix.Rotation(math.radians(rot_deg * 0.6), 4, 'X') @ Matrix.Translation(-c)
    o.data.transform(Mx)
    return o

r1 = root("ManhSao_Sang", (9.0, -28.0, 0.8), "Mảnh vỡ sao sáng")
main_idx = [i for i in range(10) if i not in BROKEN]
main_idx = main_idx[main_idx.index(9):] + main_idx[:main_idx.index(9)]  # liền mạch: 9,0,1,...,6
body = wedge_piece("ManhSao_Sang_Than", main_idx, (0, 0, 0), 0, True); parent(body, r1)
d = Vector(rim[8]).normalized()
chip = wedge_piece("ManhSao_Sang_Manh", list(BROKEN), tuple(d * 0.14 + Vector((0.0, 0.02, 0))), -7, True); parent(chip, r1)
# viền vàng nhạt dọc 5 cạnh sống trên mặt trước (gờ sáng)
ridges = []
for i in range(0, 10, 2):
    if i == 8: continue
    p = Vector(rim[i]) * 0.94 + Vector((0, 0, 0.012)); q = Vector(top) * 0.92
    ridges.append(H["tube"](f"MS_tmp_r{i}", [p, p.lerp(q, 0.5) + Vector((0, 0, 0.012)), q], 0.012, m_vang2, coll, sides=5, taper=lambda t: 0.5 + 0.5 * t))
rid = H["join"](ridges, "ManhSao_Sang_Go"); parent(rid, r1)
# lõi sáng lộ ra ở chỗ vỡ + quầng
core = H["sphere"]("ManhSao_Sang_Loi", (d.x * 0.1, 0.0, d.y * 0.1), 0.07, m_loi, coll, seg=16); parent(core, r1, False)
# vết nứt sáng zíc zắc trên mặt trước: từ chỗ vỡ chạy qua tâm xuống khe giữa 2 cánh dưới
def crack(name, a, b, n, amp, seed):
    rnd = random.Random(seed); A, B = Vector(a), Vector(b); perp = Vector((-(B - A).y, (B - A).x, 0)).normalized(); pts = []
    for k in range(n + 1):
        t = k / n; p = A.lerp(B, t) + perp * (0 if k in (0, n) else amp * (1 if k % 2 else -1) * rnd.uniform(0.5, 1.0))
        rr = (p.x ** 2 + p.y ** 2) ** 0.5; p.z = ZT * max(0.0, 1 - rr / 0.36) + 0.012; pts.append(p)
    return H["tube"](name, pts, 0.011, m_loi, coll, sides=5, taper=lambda t: 1 - 0.7 * t)
cr = H["join"]([crack("MS_tmp_c1", Vector(rim[8]) * 0.42, Vector(rim[5]) * 0.95, 7, 0.035, 5),
                crack("MS_tmp_c2", Vector(rim[8]) * 0.42 + Vector(rim[5]) * 0.3, Vector(rim[2]) * 0.55, 4, 0.03, 9)], "ManhSao_Sang_VetNut")
parent(cr, r1)
sparkle("ManhSao_Sang_LapLanh", (0.0, -0.05, 0.0), 1.45, m_ll_v, r1)

# ---------- Mảnh vỡ sao: 3 mảnh vỡ nhọn bạc ánh hồng, xoè như chùm ----------
def shard(name, length, width, n_sides, seed, m_main, m_edge):
    rnd = random.Random(seed); vs = []; fs = []; fm = []
    ring = []
    for k in range(n_sides):
        a = 2 * math.pi * k / n_sides + rnd.uniform(-0.25, 0.25); w = width * rnd.uniform(0.7, 1.15)
        ring.append((w * math.cos(a), w * math.sin(a) * 0.55, length * rnd.uniform(0.18, 0.32)))
    vs = ring + [(rnd.uniform(-0.02, 0.02), 0, length), (rnd.uniform(-0.02, 0.02), 0, -length * 0.08)]
    t, b = n_sides, n_sides + 1
    for k in range(n_sides):
        j = (k + 1) % n_sides
        fs += [(k, j, t), (j, k, b)]; fm += [0 if k % 2 == 0 else 1, 0]
    o = mk(name, vs, fs, fm, [m_main, m_edge])
    bm = bmesh.new(); bm.from_mesh(o.data); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(o.data); bm.free()
    for p in o.data.polygons: p.use_smooth = False
    return o

r2 = root("ManhSao", (10.5, -28.0, 0.8), "Mảnh vỡ sao")
parts = []
for nm, L, W, ang, off, sd in (("A", 0.6, 0.13, 0, (0, 0, -0.3), 3), ("B", 0.42, 0.11, 40, (0.13, -0.02, -0.27), 7), ("C", 0.34, 0.1, -44, (-0.13, -0.03, -0.26), 11)):
    s = shard(f"MS_tmp_{nm}", L, W, 5, sd, m_bac, m_bac2)
    s.rotation_euler = (math.radians(-8), math.radians(ang), math.radians(10 if ang else 0))
    s.location = off; parts.append(s)
ms = H["join"](parts, "ManhSao_Manh"); ms.parent = r2; ms.matrix_parent_inverse = Matrix.Identity(4)
sparkle("ManhSao_LapLanh", (0.0, -0.05, 0.02), 1.0, m_ll_h, r2)
result = {"sang": [c.name for c in r1.children], "sao": [c.name for c in r2.children]}
