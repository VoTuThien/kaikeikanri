import bpy, bmesh, math, os, random
from mathutils import Vector, Matrix
O = bpy.data.objects; D = bpy.data; ns = bpy.app.driver_namespace; H = ns["H2"]
coll = H["get_coll"]("BoChau_BangTinh")
for o in [o for o in O if o.name.startswith("ChauBT_")]: D.objects.remove(o, do_unlink=True)
M = {
 "bang": H["mat"]("BT_Bang", (0.72, 0.88, 1.0), 0.06, 0, ((0.55, 0.8, 1.0), 0.12), coat=1.0),
 "bangd": H["mat"]("BT_BangDam", (0.3, 0.55, 0.9), 0.08, 0, coat=1.0),
 "tuyet": H["mat"]("BT_Tuyet", (0.97, 0.98, 1.0), 0.65),
 "bac": H["mat"]("BT_Bac", (0.86, 0.9, 0.96), 0.18, 1.0),
 "tinhthe": H["mat"]("BT_TinhThe", (0.62, 0.86, 1.0), 0.03, 0, ((0.5, 0.8, 1.0), 0.6), alpha=0.75, coat=1.0),
}
ns["BT_M"] = M
# vật liệu thân băng lấy màu từ màu đỉnh "Col" (xuất được sang glTF thành COLOR_0)
_nt = M["bang"].node_tree; _b = _nt.nodes["Principled BSDF"]
for _n in [x for x in _nt.nodes if x.name == "MauDinh"]: _nt.nodes.remove(_n)
_ca = _nt.nodes.new("ShaderNodeVertexColor"); _ca.name = "MauDinh"; _ca.layer_name = "Col"
_nt.links.new(_ca.outputs["Color"], _b.inputs["Base Color"])
M["tinhthe"].node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.42, 0.74, 1.0, 1)
_b.inputs["Coat Weight"].default_value = 0.35; _b.inputs["Emission Strength"].default_value = 0.0; _b.inputs["Roughness"].default_value = 0.12
lathe, torus, tube, sphere, rad = H["lathe"], H["torus"], H["tube"], H["sphere"], H["rad"]
FRONT = -math.pi / 2
SPECS = {
 1: dict(ten="Bình băng", outer=[(0.3,0),(0.33,0.03),(0.4,0.3),(0.44,0.55),(0.38,0.78),(0.36,0.86),(0.4,0.94),(0.37,0.96)], inner=[(0.35,0.93),(0.33,0.85),(0.35,0.76),(0.4,0.55),(0.37,0.3),(0.27,0.1)], soil=0.88, facets=10),
 2: dict(ten="Bát tuyết", outer=[(0.3,0),(0.34,0.03),(0.5,0.2),(0.58,0.36),(0.58,0.42),(0.54,0.44)], inner=[(0.52,0.41),(0.3,0.08)], soil=0.36),
 3: dict(ten="Chậu tinh thể", outer=[(0.36,0),(0.39,0.03),(0.44,0.4),(0.46,0.6),(0.46,0.66),(0.42,0.68)], inner=[(0.4,0.65),(0.34,0.1)], soil=0.58),
 4: dict(ten="Chậu bông tuyết", outer=[(0.34,0),(0.37,0.03),(0.48,0.3),(0.5,0.5),(0.47,0.66),(0.44,0.7),(0.4,0.71)], inner=[(0.38,0.69),(0.44,0.55),(0.44,0.3),(0.3,0.1)], soil=0.62),
 5: dict(ten="Chậu băng xoắn", outer=[(0.32,0),(0.35,0.03),(0.46,0.4),(0.5,0.68),(0.5,0.74),(0.46,0.76)], inner=[(0.44,0.73),(0.33,0.1)], soil=0.66),
 6: dict(ten="Chậu chân băng", outer=[(0.28,0.18),(0.32,0.2),(0.46,0.36),(0.5,0.55),(0.5,0.66),(0.46,0.68)], inner=[(0.44,0.65),(0.3,0.28)], soil=0.6, legs=True),
}
ns["bt_specs"] = SPECS
def crystal(nm, base, d, length, w, m, sides=6):
    # lăng trụ tinh thể nhọn đầu theo hướng d
    d = Vector(d).normalized(); a = d.orthogonal().normalized(); b = d.cross(a); bm = bmesh.new()
    r0 = [bm.verts.new(Vector(base) + (a * math.cos(2 * math.pi * k / sides) + b * math.sin(2 * math.pi * k / sides)) * w) for k in range(sides)]
    r1 = [bm.verts.new(Vector(base) + d * length * 0.72 + (a * math.cos(2 * math.pi * k / sides) + b * math.sin(2 * math.pi * k / sides)) * w * 0.92) for k in range(sides)]
    tip = bm.verts.new(Vector(base) + d * length); bot = bm.verts.new(Vector(base) - d * w * 0.4)
    for k in range(sides):
        j = (k + 1) % sides
        bm.faces.new((r0[k], r0[j], r1[j], r1[k])); bm.faces.new((r1[k], r1[j], tip)); bm.faces.new((r0[j], r0[k], bot))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = D.meshes.new(nm); bm.to_mesh(me); bm.free(); me.materials.append(m)
    o = D.objects.new(nm, me); coll.objects.link(o); return o
def snowflake(nm, pos, normal, s, m, r=0.006):
    n = Vector(normal).normalized(); a = n.orthogonal().normalized(); b = n.cross(a); c = Vector(pos); out = []
    for k in range(6):
        ang = math.pi * k / 3; d = a * math.cos(ang) + b * math.sin(ang)
        out.append(tube(f"{nm}{k}", [tuple(c), tuple(c + d * s)], r, m, coll, 4))
        for f in (0.45, 0.72):
            p = c + d * s * f; e = d * math.cos(0.6) * s * 0.28
            for sg in (-1, 1):
                q = (a * math.cos(ang + sg * 0.75) + b * math.sin(ang + sg * 0.75)) * s * 0.26 * (1.1 - f)
                out.append(tube(f"{nm}{k}{f}{sg}", [tuple(p), tuple(p + q)], r * 0.8, m, coll, 4))
    out.append(sphere(nm + "c", tuple(c), r * 2.2, m, coll, 8))
    return out
ns["BT_fn"] = dict(crystal=crystal, snowflake=snowflake, coll=coll)
for n, sp in SPECS.items():
    nm = f"ChauBT_{n}"; outer, inner = sp["outer"], sp["inner"]; top = max(z for r, z in outer)
    R = lambda z, off=0.0: rad(outer, z) + off
    if sp.get("facets"):
        parts = [lathe(nm + "_v", [(0.0001, outer[0][1])] + outer + inner, M["bang"], coll, sp["facets"])]
        parts[0].data.polygons.foreach_set("use_smooth", [False] * len(parts[0].data.polygons))
    elif n == 5:
        f = lambda a, r, z: 0.045 * abs(math.sin(5 * (a + z * 2.2))) if 0.03 < z < 0.7 else 0
        parts = [lathe(nm + "_v", [(0.0001, 0)] + outer + inner, M["bang"], coll, 120, f)]
    else:
        parts = [lathe(nm + "_v", [(0.0001, outer[0][1])] + outer + inner, M["bang"], coll, 72)]
    rimR = max(r for r, z in outer if z > top - 0.05)
    parts.append(torus(nm + "_mieng", top - 0.012, rimR - 0.02, 0.016, M["bac"], coll, sp.get("facets", 64), 6))
    parts.append(torus(nm + "_de", outer[0][1] + 0.04, R(outer[0][1] + 0.04, 0.004), 0.014, M["bangd"], coll, sp.get("facets", 64), 6))
    if n == 1:
        for i in range(10):  # gân băng dọc theo cạnh
            a = 2 * math.pi * i / 10; pts = [((R(z) + 0.004) * math.cos(a), (R(z) + 0.004) * math.sin(a), z) for z in (0.06, 0.3, 0.55, 0.76)]
            parts.append(tube(f"{nm}_g{i}", pts, 0.006, M["bangd"], coll, 4))
        parts.append(torus(nm + "_b", 0.82, R(0.82, 0.004), 0.012, M["bangd"], coll, 10, 6))
    elif n == 2:  # vành tuyết phủ miệng bát
        rnd = random.Random(2)
        for i in range(44):
            a = 2 * math.pi * i / 44 + rnd.uniform(-0.04, 0.04); r = rimR - 0.005 + rnd.uniform(-0.012, 0.02)
            parts.append(sphere(f"{nm}_t{i}", (r * math.cos(a), r * math.sin(a), top + 0.004 + rnd.uniform(0, 0.012)), rnd.uniform(0.05, 0.075), M["tuyet"], coll, 12, scale=(1.3, 1, 0.55), normal=(0, 0, 1)))
        for i in range(10):  # tuyết chảy xuống thân
            a = 2 * math.pi * i / 10 + 0.2; r = R(top - 0.07, 0.01)
            parts.append(sphere(f"{nm}_c{i}", (r * math.cos(a), r * math.sin(a), top - 0.06), 0.045, M["tuyet"], coll, 10, scale=(0.8, 0.8, 1.4)))
        parts.append(torus(nm + "_b", 0.22, R(0.22, 0.004), 0.012, M["bangd"], coll, 64, 6))
    elif n == 3:  # chùm tinh thể ở chân
        rnd = random.Random(3)
        for i in range(9):
            a = 2 * math.pi * i / 9 + rnd.uniform(-0.15, 0.15); r = R(0.05) + 0.02
            d = (math.cos(a) * 0.55, math.sin(a) * 0.55, 1.0)
            parts.append(crystal(f"{nm}_k{i}", (r * math.cos(a), r * math.sin(a), 0.02), d, rnd.uniform(0.16, 0.28), rnd.uniform(0.035, 0.05), M["tinhthe"]))
        parts.append(torus(nm + "_b", 0.48, R(0.48, 0.004), 0.012, M["bangd"], coll, 64, 6))
    elif n == 4:  # 4 bông tuyết bạc lớn
        for i in range(4):
            a = FRONT + math.pi / 2 * i; z = 0.4; r = R(z, 0.01)
            parts += snowflake(f"{nm}_s{i}_", (r * math.cos(a), r * math.sin(a), z), (math.cos(a), math.sin(a), 0), 0.17, M["tuyet"], 0.012)
        parts.append(torus(nm + "_b", 0.62, R(0.62, 0.004), 0.012, M["bangd"], coll, 64, 6))
    elif n == 5:
        parts.append(torus(nm + "_b", 0.7, R(0.7, 0.006), 0.012, M["bangd"], coll, 64, 6))
    elif n == 6:  # 3 chân tinh thể băng
        for i in range(3):
            a = FRONT + 2 * math.pi * i / 3; ca, sa = math.cos(a), math.sin(a)
            parts.append(crystal(f"{nm}_ch{i}", (0.34 * ca, 0.34 * sa, 0.26), (ca * 0.45, sa * 0.45, -1.0), 0.29, 0.045, M["tinhthe"]))
        parts.append(torus(nm + "_vd", 0.19, 0.3, 0.016, M["bac"], coll, 48, 6))
        parts.append(torus(nm + "_b", 0.5, R(0.5, 0.004), 0.012, M["bangd"], coll, 64, 6))
    body = parts[0]; me = body.data
    ca = me.color_attributes.new("Col", 'FLOAT_COLOR', 'POINT')
    z0, z1 = outer[0][1], top
    for v in me.vertices:
        t = max(0.0, min(1.0, (v.co.z - z0) / (z1 - z0))) ** 1.3
        c0, c1 = (0.05, 0.16, 0.55), (0.55, 0.8, 1.0)
        ca.data[v.index].color = (*(c0[k] + (c1[k] - c0[k]) * t for k in range(3)), 1.0)
    H["make_pot"]("ChauBT", n, sp, parts, coll, sp["ten"], "bang_tinh", (9.0 + 1.5 * (n - 1), -22.0, 0.4))
    # phần không phải thân băng: màu đỉnh trắng (three.js nhân màu đỉnh với màu vật liệu)
    for d in O[f"ChauBT_{n}_Than"].data.color_attributes["Col"].data:
        if d.color[0] == 0 and d.color[1] == 0 and d.color[2] == 0: d.color = (1, 1, 1, 1)
bpy.context.view_layer.update()
