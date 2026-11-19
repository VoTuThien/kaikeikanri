import bpy, bmesh, math, os, random
from mathutils import Vector, Matrix
O = bpy.data.objects; D = bpy.data; ns = bpy.app.driver_namespace; H = ns["H2"]
coll = H["get_coll"]("BoChau_PhuongHoang")
ONLY = ns.get("PH_ONLY", [1,2,3,4,5,6])
for o in [o for o in O if any(o.name == f"ChauPH_{k}" or o.name.startswith(f"ChauPH_{k}_") for k in ONLY)]: D.objects.remove(o, do_unlink=True)
M = {
 "than": H["mat"]("PH_Than", (1, 1, 1), 0.18, 0, coat=1.0),           # màu từ màu đỉnh Col
 "vang": H["mat"]("PH_Vang", (1.0, 0.72, 0.25), 0.2, 1.0),
 "vangd": H["mat"]("PH_VangDam", (0.75, 0.42, 0.1), 0.3, 1.0),
 "do": H["mat"]("PH_DoSon", (0.55, 0.03, 0.04), 0.25, 0, coat=1.0),
 "long": H["mat"]("PH_Long", (0.95, 0.35, 0.08), 0.35, 0, ((1.0, 0.4, 0.05), 0.4), coat=0.6),
 "longv": H["mat"]("PH_LongVang", (1.0, 0.75, 0.2), 0.3, 0.3, ((1.0, 0.6, 0.1), 0.4), coat=0.6),
 "ngoc": H["mat"]("PH_NgocLam", (0.05, 0.55, 0.6), 0.15, 0, coat=1.0),
 "lua": H["mat"]("PH_Lua", (1.0, 0.55, 0.1), 0.4, 0, ((1.0, 0.45, 0.05), 3.0)),
 "than_hong": H["mat"]("PH_ThanHong", (1.0, 0.5, 0.1), 0.3, 0, ((1.0, 0.35, 0.05), 4.0)),
}
_nt = M["than"].node_tree; _b = _nt.nodes["Principled BSDF"]
for _n in [x for x in _nt.nodes if x.name == "MauDinh"]: _nt.nodes.remove(_n)
_ca = _nt.nodes.new("ShaderNodeVertexColor"); _ca.name = "MauDinh"; _ca.layer_name = "Col"; _nt.links.new(_ca.outputs["Color"], _b.inputs["Base Color"])
ns["PH_M"] = M
lathe, torus, tube, sphere, rad = H["lathe"], H["torus"], H["tube"], H["sphere"], H["rad"]
FRONT = -math.pi / 2
SPECS = {
 1: dict(ten="Bình lông vũ", outer=[(0.3,0),(0.33,0.03),(0.32,0.08),(0.44,0.32),(0.48,0.5),(0.42,0.68),(0.35,0.8),(0.37,0.88),(0.42,0.95),(0.39,0.97)], inner=[(0.37,0.94),(0.33,0.86),(0.32,0.78),(0.4,0.66),(0.44,0.5),(0.4,0.32),(0.27,0.1)], soil=0.89),
 2: dict(ten="Bát cánh phượng", outer=[(0.28,0),(0.32,0.03),(0.3,0.07),(0.5,0.24),(0.58,0.4),(0.58,0.46),(0.54,0.48)], inner=[(0.52,0.45),(0.3,0.1)], soil=0.4),
 3: dict(ten="Tổ lửa", outer=[(0.36,0),(0.39,0.03),(0.46,0.35),(0.48,0.55),(0.46,0.62),(0.43,0.63)], inner=[(0.41,0.61),(0.34,0.1)], soil=0.55),
 4: dict(ten="Đuôi phượng", outer=[(0.34,0),(0.37,0.03),(0.47,0.3),(0.5,0.5),(0.47,0.66),(0.44,0.7),(0.41,0.71)], inner=[(0.39,0.69),(0.44,0.55),(0.44,0.3),(0.3,0.1)], soil=0.62),
 5: dict(ten="Mặt trời", outer=[(0.4,0),(0.42,0.03),(0.46,0.45),(0.48,0.6),(0.48,0.64),(0.44,0.66)], inner=[(0.42,0.63),(0.36,0.1)], soil=0.57),
 6: dict(ten="Tháp lửa", outer=[(0.3,0),(0.33,0.03),(0.4,0.5),(0.44,0.82),(0.46,0.9),(0.42,0.92)], inner=[(0.4,0.89),(0.42,0.8),(0.37,0.5),(0.28,0.1)], soil=0.84),
}
ns["ph_specs"] = SPECS
def feather(nm, base, d, up, length, width, m, curl=0.15, rib=None):
    # lông vũ: phiến dẹt hình giọt nước dọc trục d, cong nhẹ theo up, có gân giữa
    d = Vector(d).normalized(); up = Vector(up).normalized(); side = d.cross(up).normalized(); nrm = side.cross(d).normalized()
    bm = bmesh.new(); rows = []
    for k in range(9):
        t = k / 8; w = width * math.sin(math.pi * min(1, 0.08 + t * 0.95)) ** 0.8 * (1 - 0.25 * t)
        c = Vector(base) + d * length * t + nrm * (curl * length * t * t)
        rows.append([bm.verts.new(c - side * w), bm.verts.new(c + nrm * 0.004), bm.verts.new(c + side * w)])
    for k in range(8):
        for i in range(2): bm.faces.new((rows[k][i], rows[k][i + 1], rows[k + 1][i + 1], rows[k + 1][i]))
    me = D.meshes.new(nm); bm.to_mesh(me); bm.free(); me.materials.append(m)
    for p in me.polygons: p.use_smooth = True
    o = D.objects.new(nm, me); coll.objects.link(o); s_ = o.modifiers.new("d", 'SOLIDIFY'); s_.thickness = 0.006
    out = [o]
    if rib is not None:
        pts = [tuple(Vector(base) + d * length * t + nrm * (curl * length * t * t + 0.004)) for t in (0.0, 0.35, 0.7, 0.95)]
        out.append(tube(nm + "_g", pts, 0.004, rib, coll, 4))
    return out
def flame(nm, base, up, h, w, m, twist=0.6, seed=0):
    # lưỡi lửa: ống thuôn uốn chữ S, đáy phình đầu nhọn
    rnd = random.Random(seed); up = Vector(up).normalized(); side = up.orthogonal().normalized(); pts = []
    for k in range(9):
        t = k / 8; off = side * math.sin(t * math.pi * 1.4 + twist) * w * 0.6 * t
        pts.append(tuple(Vector(base) + up * h * t + off))
    return tube(nm, pts, w, m, coll, 7, taper=lambda t: (math.sin(math.pi * min(1, 0.15 + t * 0.9)) ** 0.7) * (1 - t) * 1.6 + 0.02)
ns["PH_fn"] = dict(feather=feather, flame=flame, coll=coll)
def paint(obj, z0, z1):
    me = obj.data; ca = me.color_attributes.new("Col", 'FLOAT_COLOR', 'POINT')
    stops = [(0.0, (0.16, 0.004, 0.025)), (0.55, (0.5, 0.025, 0.03)), (1.0, (0.95, 0.3, 0.05))]
    for v in me.vertices:
        t = max(0.0, min(1.0, (v.co.z - z0) / (z1 - z0)))
        for (a, ca_), (b, cb) in zip(stops, stops[1:]):
            if a <= t <= b:
                f = (t - a) / (b - a); col = [ca_[k] + (cb[k] - ca_[k]) * f for k in range(3)]; break
        ca.data[v.index].color = (*col, 1.0)
for n, sp in SPECS.items():
    if n not in ONLY: continue
    nm = f"ChauPH_{n}"; outer, inner = sp["outer"], sp["inner"]; top = max(z for r, z in outer)
    R = lambda z, off=0.0: rad(outer, z) + off
    body = lathe(nm + "_v", [(0.0001, 0)] + outer + inner, M["than"], coll, 80)
    paint(body, 0.0, top); parts = [body]
    rimR = max(r for r, z in outer if z > top - 0.05)
    parts.append(torus(nm + "_mieng", top - 0.012, rimR - 0.02, 0.018, M["vang"], coll, 72, 8))
    parts.append(torus(nm + "_de", 0.035, R(0.035, 0.004), 0.018, M["vang"], coll, 72, 8))
    def P(z, a, off=0.006):
        r = R(z, off); return Vector((r * math.cos(a), r * math.sin(a), z))
    if n == 1:  # vảy lông vũ ôm sát thân, xếp lớp như bộ lông
        rows = [(0.66, 16), (0.56, 18), (0.46, 20), (0.36, 20), (0.26, 18)]
        for ri, (z, k) in enumerate(rows):
            for i in range(k):
                a = 2 * math.pi * (i + 0.5 * (ri % 2)) / k; ca, sa = math.cos(a), math.sin(a)
                b0 = P(z, a, 0.008 + 0.004 * ri); e0 = P(z - 0.15, a, 0.008 + 0.004 * ri)
                parts += feather(f"{nm}_v{ri}{i}", tuple(b0), tuple(e0 - b0), (ca, sa, 0), 0.16, 0.068, M["longv"] if ri % 2 else M["long"], 0.05, M["vang"] if ri == 0 else None)
        parts.append(torus(nm + "_co", 0.69, R(0.69, 0.012), 0.016, M["vang"], coll, 72, 6))
    elif n == 2:  # 2 cánh phượng lớn xoè hai bên, 2 lớp lông
        for s_ in (-1, 1):
            ca = float(s_)
            for layer, (cnt, L0, w, mm) in enumerate(((11, 0.34, 0.07, None), (8, 0.2, 0.065, M["longv"]))):
                for j in range(cnt):
                    t = j / (cnt - 1); ang = math.radians(4 + t * 82)
                    d = Vector((ca * math.cos(ang), -0.08 * layer, math.sin(ang)))
                    base = (0.55 * ca, -0.02 * layer, 0.3)
                    ln = L0 * (0.62 + 0.38 * math.sin(math.pi * (0.25 + 0.75 * t)))
                    m = mm or (M["long"] if j % 2 else M["longv"])
                    parts += feather(f"{nm}_c{s_}{layer}{j}", base, tuple(d), (0, -1, 0), ln, w, m, 0.0, M["vang"])
            parts.append(sphere(f"{nm}_g{s_}", (0.56 * ca, 0, 0.3), 0.05, M["vang"], coll, 12))
            parts.append(sphere(f"{nm}_gn{s_}", (0.56 * ca, -0.045, 0.3), 0.026, M["ngoc"], coll, 10))
        parts.append(torus(nm + "_b", 0.36, R(0.36, 0.005), 0.012, M["vang"], coll, 72, 6))
    elif n == 3:  # tổ cành vàng đan dày + than hồng
        rnd = random.Random(3)
        for i in range(64):
            a0 = rnd.uniform(0, 2 * math.pi); z0 = rnd.uniform(0.3, 0.6); pts = []; span = rnd.uniform(0.7, 1.3) * rnd.choice((-1, 1)); dz = rnd.uniform(-0.12, 0.12)
            for k in range(8):
                t = k / 7; a = a0 + t * span; z = min(0.61, max(0.25, z0 + (t - 0.5) * dz)); r = R(z, 0.016 + 0.014 * math.sin(t * math.pi))
                pts.append((r * math.cos(a), r * math.sin(a), z))
            parts.append(tube(f"{nm}_t{i}", pts, rnd.uniform(0.009, 0.014), M["vangd"] if i % 3 else M["vang"], coll, 5))
        for i in range(22):
            a = rnd.uniform(0, 2 * math.pi); z = rnd.uniform(0.34, 0.58); r = R(z, 0.03)
            parts.append(sphere(f"{nm}_h{i}", (r * math.cos(a), r * math.sin(a), z), rnd.uniform(0.014, 0.022), M["than_hong"], coll, 8))
        parts.append(torus(nm + "_b", 0.2, R(0.2, 0.005), 0.012, M["vang"], coll, 72, 6))
    elif n == 4:  # 3 lông đuôi dài cuộn quanh mặt trước, đầu có "mắt" ngọc
        for i in range(3):
            a0 = FRONT - 1.5 + i * 0.75; pts = []
            for k in range(25):
                t = k / 24; a = a0 + t * 1.5; z = 0.1 + t * 0.44 + 0.03 * math.sin(t * 6); r = R(z, 0.014)
                pts.append((r * math.cos(a), r * math.sin(a), z))
            parts.append(tube(f"{nm}_d{i}", pts, 0.012, M["vang"], coll, 6, taper=lambda t: 1.0 - 0.4 * t))
            for k in range(1, 24):  # tơ lông dày hai bên
                t = k / 24; p = Vector(pts[k]); tang = (Vector(pts[k + 1]) - Vector(pts[k - 1])).normalized(); rn = Vector((p.x, p.y, 0)).normalized()
                for sg in (-1, 1):
                    q = p + Vector((0, 0, sg)) * 0.05 * (0.5 + t) + tang * 0.03 + rn * 0.004
                    mid_ = (p + q) / 2 + rn * 0.006
                    parts.append(tube(f"{nm}_t{i}{k}{sg}", [tuple(p), tuple(mid_), tuple(q)], 0.0055, M["longv"] if k % 2 else M["long"], coll, 3, taper=lambda t: 1 - 0.7 * t))
            pe = Vector(pts[-1]); ne = Vector((pe.x, pe.y, 0)).normalized()
            parts.append(sphere(f"{nm}_m{i}", tuple(pe + ne * 0.01), 0.062, M["vang"], coll, 16, scale=(1, 1.0, 1.35), normal=tuple(ne)))
            parts.append(sphere(f"{nm}_mn{i}", tuple(pe + ne * 0.028), 0.04, M["ngoc"], coll, 14, scale=(1, 1, 1.35), normal=tuple(ne)))
            parts.append(sphere(f"{nm}_mc{i}", tuple(pe + ne * 0.045), 0.018, M["do"], coll, 10, scale=(1, 1, 1.3), normal=tuple(ne)))
        parts.append(torus(nm + "_b", 0.64, R(0.64, 0.006), 0.012, M["vang"], coll, 72, 6))
    elif n == 5:  # mặt trời vàng lớn phía trước + đai tia nắng
        a = FRONT; ca, sa = math.cos(a), math.sin(a); z = 0.3; c = Vector((R(z, 0.02) * ca, R(z, 0.02) * sa, z)); nrm = Vector((ca, sa, 0))
        parts.append(sphere(f"{nm}_mt", tuple(c), 0.11, M["vang"], coll, 20, scale=(1, 1, 0.3), normal=tuple(nrm)))
        parts.append(sphere(f"{nm}_mtn", tuple(c + nrm * 0.03), 0.06, M["lua"], coll, 16, scale=(1, 1, 0.35), normal=tuple(nrm)))
        parts.append(torus(f"{nm}_mtv", 0, 0.125, 0.009, M["vang"], coll, 48, 6, loc=tuple(c + nrm * 0.005), normal=tuple(nrm)))
        tng = Vector((-sa, ca, 0)); upv = Vector((0, 0, 1))
        for j in range(16):
            b = 2 * math.pi * j / 16; dirv = tng * math.cos(b) + upv * math.sin(b); ln = 0.11 if j % 2 == 0 else 0.07
            parts.append(tube(f"{nm}_tia{j}", [tuple(c + dirv * 0.14), tuple(c + dirv * (0.14 + ln) + nrm * 0.01)], 0.016, M["vang"], coll, 4, taper=lambda t: 1 - 0.9 * t))
        for j in range(28):  # đai tam giác tia nắng quanh thân
            a = 2 * math.pi * j / 28; r = R(0.56, 0.006)
            parts.append(tube(f"{nm}_dt{j}", [(r * math.cos(a), r * math.sin(a), 0.49), ((r + 0.004) * math.cos(a), (r + 0.004) * math.sin(a), 0.6)], 0.02, M["vang"], coll, 4, taper=lambda t: 1 - 0.9 * t))
        parts.append(torus(nm + "_b", 0.48, R(0.48, 0.006), 0.012, M["vang"], coll, 72, 6))
    elif n == 6:  # 6 ô ngọn lửa đổ đầy màu cam vàng, viền vàng
        for i in range(6):
            a = 2 * math.pi * i / 6 + FRONT; left = []; right = []
            for k in range(17):
                t = k / 16; z = 0.1 + t * 0.62; w = 0.17 * math.sin(math.pi * min(1, t * 1.1)) ** 0.7 * (1 - 0.65 * t)
                da = (w + 0.035 * math.sin(t * 9) * t) / max(0.25, R(z)); db = (w * 0.75 - 0.03 * math.sin(t * 9) * t) / max(0.25, R(z))
                left.append((z, a - da)); right.append((z, a + db))
            bm = bmesh.new(); vs = []
            for (zl, al), (zr, ar) in zip(left, right):
                row = []
                for q in range(5):
                    f = q / 4; aa = al + (ar - al) * f; rr = R(zl, 0.008 + 0.006 * math.sin(math.pi * f))
                    row.append(bm.verts.new((rr * math.cos(aa), rr * math.sin(aa), zl)))
                vs.append(row)
            for k in range(16):
                for q in range(4): bm.faces.new((vs[k][q], vs[k][q + 1], vs[k + 1][q + 1], vs[k + 1][q]))
            me = D.meshes.new(f"{nm}_f{i}"); bm.to_mesh(me); bm.free(); me.materials.append(M["longv"])
            for pp in me.polygons: pp.use_smooth = True
            fo = D.objects.new(f"{nm}_f{i}", me); coll.objects.link(fo); sm = fo.modifiers.new("d", 'SOLIDIFY'); sm.thickness = 0.006; parts.append(fo)
            outline = [(R(z, 0.012) * math.cos(aa), R(z, 0.012) * math.sin(aa), z) for z, aa in left] + [(R(z, 0.012) * math.cos(aa), R(z, 0.012) * math.sin(aa), z) for z, aa in reversed(right)]
            parts.append(tube(f"{nm}_l{i}", outline, 0.009, M["vang"], coll, 4))
        parts.append(torus(nm + "_b", 0.8, R(0.8, 0.006), 0.014, M["vang"], coll, 72, 6))
    H["make_pot"]("ChauPH", n, sp, parts, coll, sp["ten"], "phuong_hoang", (9.0 + 1.8 * (n - 1), -24.0, 0.4))
    for d_ in O[f"ChauPH_{n}_Than"].data.color_attributes["Col"].data:
        if d_.color[0] == 0 and d_.color[1] == 0 and d_.color[2] == 0: d_.color = (1, 1, 1, 1)
bpy.context.view_layer.update()
