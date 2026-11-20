# Túi phân bón B / A (PhanBon_B, PhanBon_A) — icon item Vườn mây, chép lưới túi hạt (TuiHat) rồi đổi màu + hình mầm cây nổi trên nhãn.
# Cần chạy h2.py trước. Collection "PhanBon", hàng mẫu ngoài mây (y = -32). Chạy lại thì xoá bản cũ rồi dựng lại.
import bpy, math, random
from mathutils import Vector, Matrix
ns = bpy.app.driver_namespace; H = ns["H2"]; D = bpy.data; O = D.objects
coll = H["get_coll"]("PhanBon")
for o in list(coll.objects): D.objects.remove(o, do_unlink=True)
M = H["mat"]

def attach(objs, name, r):
    o = H["join"](objs, name); o.parent = r; o.matrix_parent_inverse = Matrix.Identity(4); return o

def copy_mesh(src, name, mats, r):
    me = O[src].data.copy(); me.name = name
    for i, m in enumerate(mats):
        if m is not None: me.materials[i] = m
    o = D.objects.new(name, me); coll.objects.link(o); o.parent = r; o.matrix_parent_inverse = Matrix.Identity(4)
    o.location = O[src].location; return o

YF = -0.122  # trước mặt nhãn (toạ độ của khung gốc)
ZC = -0.06   # giữa nhãn

def leaf(name, base, ang, L, Wd, m, tilt=0.0):
    a = math.radians(ang); c = (base[0] + math.cos(a) * L * 0.5, YF - 0.012, base[1] + math.sin(a) * L * 0.5)
    o = H["sphere"](name, c, 0.5, m, coll, seg=16, scale=(L, 0.05, Wd)); o.rotation_euler = (math.radians(tilt), -a, 0); return o

def sprout(prefix, big, m_la, m_than):
    parts = []
    st = [(0, YF - 0.008, ZC - 0.16), (0.01, YF - 0.012, ZC - 0.05), (-0.005, YF - 0.014, ZC + (0.1 if big else 0.04))]
    parts.append(H["tube"](prefix + "_st", st, 0.014 if big else 0.012, m_than, coll, sides=6))
    if big:  # cây 4 lá + chồi ngọn
        parts += [leaf(prefix + "_l1", (0.0, ZC - 0.03), 25, 0.2, 0.085, m_la), leaf(prefix + "_l2", (0.0, ZC - 0.03), 155, 0.2, 0.085, m_la),
                  leaf(prefix + "_l3", (0.0, ZC + 0.07), 50, 0.15, 0.07, m_la), leaf(prefix + "_l4", (0.0, ZC + 0.07), 130, 0.15, 0.07, m_la),
                  H["sphere"](prefix + "_bud", (-0.005, YF - 0.016, ZC + 0.11), 0.028, m_la, coll, seg=12, scale=(0.8, 0.6, 1.3))]
    else:    # mầm 2 lá
        parts += [leaf(prefix + "_l1", (0.0, ZC + 0.03), 30, 0.17, 0.075, m_la), leaf(prefix + "_l2", (0.0, ZC + 0.03), 150, 0.17, 0.075, m_la)]
    # ụ đất nhỏ dưới gốc
    parts.append(H["sphere"](prefix + "_dat", (0, YF - 0.006, ZC - 0.17), 0.5, D.materials["PB_Dat"], coll, seg=14, scale=(0.17, 0.03, 0.05)))
    return parts

def pellets(prefix, n, m, seed):
    rnd = random.Random(seed); ps = []
    for i in range(n):
        a = rnd.uniform(0, 2 * math.pi); d = rnd.uniform(0, 0.07) * (1 if i < n - 3 else 0.4)
        z = -0.335 + (0.03 if i >= n - 3 else 0) + rnd.uniform(0, 0.01)
        ps.append(H["sphere"](f"{prefix}_{i}", (0.2 + math.cos(a) * d, -0.15 + math.sin(a) * d * 0.5, z), rnd.uniform(0.02, 0.028), m, coll, seg=10))
    return ps

M("PB_Dat", (0.36, 0.22, 0.12), rough=0.9)
m_nhan = M("PB_Nhan", (0.98, 0.95, 0.85), rough=0.6)
CFG = {
    "B": dict(ten="Phân bón B", x=9.0, than=(0.55, 0.85, 0.32), mieng=(0.33, 0.6, 0.18), la=(0.35, 0.82, 0.3), hat=(0.48, 0.32, 0.18), big=False),
    "A": dict(ten="Phân bón A", x=10.2, than=(0.08, 0.48, 0.28), mieng=(0.95, 0.72, 0.25), la=(0.25, 0.9, 0.45), hat=(0.95, 0.78, 0.3), big=True),
}
for k, c in CFG.items():
    p = f"PhanBon_{k}"; r = D.objects.new(p, None); coll.objects.link(r); r.location = (c["x"], -32.0, 0.8); r["ten"] = c["ten"]; r["hang"] = k
    m_than = M(f"PB{k}_Than", c["than"], rough=0.55, coat=0.2)
    m_mieng = M(f"PB{k}_Mieng", c["mieng"], rough=0.3 if k == "A" else 0.6, metal=0.25 if k == "A" else 0.0, emit=(c["mieng"], 0.25 if k == "A" else 0.0))
    m_la = M(f"PB{k}_La", c["la"], rough=0.4, emit=(c["la"], 0.2 if k == "B" else 0.3))
    m_cay = M(f"PB{k}_ThanCay", (0.3, 0.55, 0.2), rough=0.6)
    copy_mesh("TuiHat_Than", p + "_Than", [m_than, m_mieng, None], r)
    copy_mesh("TuiHat_Nhan", p + "_Nhan", [m_nhan], r)
    attach(sprout(p + "_tmp_c", c["big"], m_la, m_cay), p + "_HinhCay", r)
    m_hat = M(f"PB{k}_Hat", c["hat"], rough=0.5 if k == "B" else 0.25, metal=0.0 if k == "B" else 0.6, emit=(c["hat"], 0.0 if k == "B" else 0.8))
    attach(pellets(p + "_tmp_h", 8, m_hat, 3 if k == "B" else 8), p + "_HatPhan", r)
    if k == "A":
        src = O["Tien_LongChim_LapLanh"].data.copy(); src.materials.clear(); src.materials.append(M("PBA_LapLanh", (1, 0.97, 0.8), emit=((1.0, 0.92, 0.6), 5.0)))
        sp = D.objects.new(p + "_LapLanh", src); coll.objects.link(sp); sp.parent = r; sp.matrix_parent_inverse = Matrix.Identity(4)
        sp.location = (0, -0.14, 0.0); sp.scale = (1.0, 1.0, 1.0)

result = {k: [c.name for c in O[f"PhanBon_{k}"].children] for k in CFG}
