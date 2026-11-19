import bpy, bmesh, math, os, random
from mathutils import Vector, Matrix
O = bpy.data.objects; D = bpy.data; ns = bpy.app.driver_namespace; H = ns["H2"]; M = ns["SL_M"]; SPECS = ns["sl_specs"]
coll = H["get_coll"]("BoChau_SuLam")
for o in [o for o in O if o.name.startswith("ChauSL_") and "_Lv" in o.name]: D.objects.remove(o, do_unlink=True)
lathe, torus, tube, sphere, rad = H["lathe"], H["torus"], H["tube"], H["sphere"], H["rad"]
M["ngocsang"] = H["mat"]("SL_NgocSang", (0.75, 0.88, 1.0), 0.15, 0, ((0.55, 0.78, 1.0), 4.0), coat=1.0)
M["ngoc"] = H["mat"]("SL_NgocBich", (0.25, 0.68, 0.45), 0.12, 0, coat=1.0)
M["daydo"] = H["mat"]("SL_DayDo", (0.75, 0.08, 0.08), 0.6)
M["hao"] = H["mat"]("SL_HaoQuang", (0.6, 0.8, 1.0), 0.4, 0, ((0.55, 0.78, 1.0), 2.0), alpha=0.35)
M["sao"] = H["mat"]("SL_SaoLapLanh", (1, 1, 1), 0.2, 0, ((0.8, 0.9, 1.0), 6.0))
OCT = 1 / math.cos(math.pi / 8); FRONT = -math.pi / 2
# huy chương: góc lệch + độ cao riêng từng chậu để không đè hoa văn sẵn có
MEDAL = {1: (0.0, None, 0.065), 2: (0.0, None, 0.06), 3: (0.0, None, 0.065), 4: (math.pi / 4, None, 0.06), 5: (0.0, 0.52, 0.045), 6: (0.0, None, 0.06)}
def star4(nm, pos, normal, s, m):
    bm = bmesh.new(); c = bm.verts.new((0, 0, 0)); ring = []
    for i in range(8):
        a = 2 * math.pi * i / 8; rr = s if i % 2 == 0 else s * 0.22; ring.append(bm.verts.new((rr * math.cos(a), rr * math.sin(a), 0)))
    for i in range(8): bm.faces.new((c, ring[i], ring[(i + 1) % 8]))
    me = D.meshes.new(nm); bm.to_mesh(me); bm.free(); me.materials.append(m)
    o = D.objects.new(nm, me); coll.objects.link(o); o.location = pos; o.rotation_euler = Vector(normal).normalized().to_track_quat('Z', 'Y').to_euler()
    s_ = o.modifiers.new("d", 'SOLIDIFY'); s_.thickness = 0.004; return o
for n, sp in SPECS.items():
    nm = f"ChauSL_{n}"; root = O[nm]; outer = sp["outer"]; top = max(z for r, z in outer); octa = sp.get("octa", False)
    def R(z, off=0.0, a=None):
        if octa and a is not None:
            # khoảng cách tới mặt bát giác theo hướng a
            ap = (a - math.pi / 8) % (math.pi / 4) - math.pi / 8
            return rad(outer, z) * OCT * math.cos(math.pi / 8) / math.cos(ap) + off
        return rad(outer, z) + off
    rimR = max(r for r, z in outer if z > top - 0.05) * (OCT if octa else 1); rimz = top - 0.012
    z0 = outer[0][1]; mid = z0 + (top - z0) * 0.45; sh = z0 + (top - z0) * 0.78
    segs = 8 if octa else 64
    def gband(tag, z, r=0.011): return torus(f"{nm}_{tag}", z, (rad(outer, z) * (OCT if octa else 1)) + 0.006, r, M["vang"], coll, segs, 6)
    def flowers(tag, z, k, s=0.05, off=0.0):
        out = []
        for i in range(k):
            a = FRONT + 2 * math.pi * i / k + math.pi / k + off; ca, sa = math.cos(a), math.sin(a); c = Vector((R(z, 0.008, a) * ca, R(z, 0.008, a) * sa, z))
            t = Vector((-sa, ca, 0)); up = Vector((0, 0, 1))
            for j in range(5):
                b = 2 * math.pi * j / 5 + math.pi / 2
                out.append(sphere(f"{nm}_{tag}{i}{j}", tuple(c + (t * math.cos(b) + up * math.sin(b)) * s * 0.55), s * 0.42, M["vang"], coll, 8, scale=(1, 1, 0.35), normal=(ca, sa, 0)))
            out.append(sphere(f"{nm}_{tag}{i}c", tuple(c + Vector((ca, sa, 0)) * 0.008), s * 0.3, M["ngocsang"], coll, 8))
        return out
    def medals(tag, k=4, glow=True, scale=1.0):
        off, zz, rr = MEDAL[n]; zz = zz if zz is not None else mid; rr *= scale; out = []
        for i in range(k):
            a = FRONT + 2 * math.pi * i / k + off; ca, sa = math.cos(a), math.sin(a); p = (R(zz, 0.012, a) * ca, R(zz, 0.012, a) * sa, zz)
            out.append(torus(f"{nm}_{tag}{i}", 0, rr, 0.012, M["vang"], coll, 28, 6, loc=p, normal=(ca, sa, 0)))
            out.append(torus(f"{nm}_{tag}i{i}", 0, rr * 0.62, 0.006, M["vang"], coll, 24, 5, loc=p, normal=(ca, sa, 0)))
            out.append(sphere(f"{nm}_{tag}p{i}", (p[0] + ca * 0.012, p[1] + sa * 0.012, zz), rr * 0.42, M["ngocsang"] if glow else M["lam"], coll, 14))
        return out
    def tassels(tag, z):
        out = []
        for s_ in (-1, 1):
            a = FRONT + s_ * 1.25; ca, sa = math.cos(a), math.sin(a); r = R(z, 0.03, a); p0 = Vector((r * ca, r * sa, z))
            p1 = p0 + Vector((ca * 0.02, sa * 0.02, -0.12)); p2 = p1 + Vector((0, 0, -0.07))
            out.append(tube(f"{nm}_{tag}d{s_}", [tuple(p0), tuple(p0 + Vector((ca * 0.03, sa * 0.03, -0.05))), tuple(p1)], 0.007, M["daydo"], coll, 5))
            out.append(sphere(f"{nm}_{tag}n{s_}", tuple(p1 + Vector((0, 0, -0.035))), 0.038, M["ngoc"], coll, 12, scale=(1, 1, 1.25)))
            out.append(sphere(f"{nm}_{tag}c{s_}", tuple(p1 + Vector((0, 0, 0.005))), 0.022, M["vang"], coll, 8))
            for j in range(7):
                b = 2 * math.pi * j / 7; q = p2 + Vector((math.cos(b) * 0.01, math.sin(b) * 0.01, 0))
                out.append(tube(f"{nm}_{tag}t{s_}{j}", [tuple(q), tuple(q + Vector((math.cos(b) * 0.012, math.sin(b) * 0.012, -0.1)))], 0.005, M["daydo"], coll, 4))
        return out
    def filigree(tag, z):
        pts = []
        for i in range(129):
            a = 2 * math.pi * i / 128; zz = z + 0.025 * math.sin(10 * a); rr = R(zz, 0.01, a)
            pts.append((rr * math.cos(a), rr * math.sin(a), zz))
        return [tube(f"{nm}_{tag}", pts, 0.008, M["vang"], coll, 5)]
    def crown(tag, k=10):
        out = []
        for i in range(k):
            a0 = 2 * math.pi * i / k; a1 = 2 * math.pi * (i + 1) / k; pts = []
            for j in range(9):
                t = j / 8; a = a0 + (a1 - a0) * t; zz = rimz + 0.02 + 0.06 * math.sin(math.pi * t); rr = rimR + 0.02
                pts.append((rr * math.cos(a), rr * math.sin(a), zz))
            out.append(tube(f"{nm}_{tag}{i}", pts, 0.008, M["vang"], coll, 5))
            am = (a0 + a1) / 2; rr = rimR + 0.02
            out.append(sphere(f"{nm}_{tag}p{i}", (rr * math.cos(am), rr * math.sin(am), rimz + 0.09), 0.018, M["ngocsang"], coll, 8))
        out.append(torus(f"{nm}_{tag}v", rimz + 0.02, rimR + 0.02, 0.012, M["vang"], coll, segs, 6))
        return out
    def aura(tag):
        base_r = 0.47 if sp.get("legs") else rad(outer, outer[0][1] + 0.02) * (OCT if octa else 1) + 0.06
        return [torus(f"{nm}_{tag}", 0.012, base_r, 0.03, M["hao"], coll, 64, 8), torus(f"{nm}_{tag}2", 0.012, base_r + 0.06, 0.015, M["hao"], coll, 64, 6)]
    def sparkles(tag, k):
        rnd = random.Random(n * 7); out = []
        for i in range(k):
            a = rnd.uniform(0, 2 * math.pi); r = rimR + rnd.uniform(0.05, 0.16); z = rnd.uniform(0.15, top + 0.25)
            out.append(star4(f"{nm}_{tag}{i}", (r * math.cos(a), r * math.sin(a), z), (math.cos(a), math.sin(a), 0), rnd.uniform(0.025, 0.045), M["sao"]))
        return out
    fz = sh - 0.07 if top > 0.55 else sh - 0.04
    L = {}
    L[2] = [gband("a1", sh), gband("a2", z0 + 0.03, 0.009)]
    L[3] = [gband("b1", sh), gband("b2", z0 + 0.03, 0.009)] + flowers("bf", fz, 6)
    L[4] = [gband("c1", sh), gband("c2", z0 + 0.03, 0.009)] + medals("cm") + flowers("cf", fz, 6, 0.045, math.pi / 6)
    L[5] = [gband("d1", sh)] + filigree("dl", z0 + 0.06) + medals("dm") + tassels("dt", sh) + flowers("df", fz, 6, 0.045, math.pi / 6)
    L[6] = crown("ec") + filigree("el", z0 + 0.06) + medals("em", 4, True, 1.15) + tassels("et", sh) + aura("eh") + sparkles("es", 9) + [gband("e1", sh, 0.013)] + flowers("ef", fz, 6, 0.045, math.pi / 6)
    for lv, parts in L.items():
        H["add_level"](root, lv, parts)
bpy.context.view_layer.update()
