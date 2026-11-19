import bpy, bmesh, math, os, random
from mathutils import Vector, Matrix
O = bpy.data.objects; D = bpy.data; ns = bpy.app.driver_namespace; H = ns["H2"]; M = ns["BT_M"]; SPECS = ns["bt_specs"]; F = ns["BT_fn"]
coll = F["coll"]
for o in [o for o in O if o.name.startswith("ChauBT_") and "_Lv" in o.name]: D.objects.remove(o, do_unlink=True)
torus, tube, sphere, rad = H["torus"], H["tube"], H["sphere"], H["rad"]
crystal, snowflake = F["crystal"], F["snowflake"]
M["sang"] = H["mat"]("BT_Sang", (0.75, 0.92, 1.0), 0.1, 0, ((0.6, 0.85, 1.0), 4.0), coat=1.0)
M["tinhsang"] = H["mat"]("BT_TinhTheSang", (0.55, 0.85, 1.0), 0.05, 0, ((0.5, 0.8, 1.0), 2.2), alpha=0.8, coat=1.0)
M["hao"] = H["mat"]("BT_HaoQuang", (0.7, 0.9, 1.0), 0.4, 0, ((0.6, 0.85, 1.0), 2.0), alpha=0.35)
M["bangtrong"] = H["mat"]("BT_CotBang", (0.75, 0.92, 1.0), 0.03, 0, ((0.6, 0.85, 1.0), 0.5), alpha=0.65, coat=1.0)
M["sao"] = D.materials.get("SL_SaoLapLanh") or H["mat"]("SL_SaoLapLanh", (1, 1, 1), 0.2, 0, ((0.8, 0.9, 1.0), 6.0))
FRONT = -math.pi / 2
def star4(nm, pos, normal, s, m):
    bm = bmesh.new(); c = bm.verts.new((0, 0, 0)); ring = []
    for i in range(8):
        a = 2 * math.pi * i / 8; rr = s if i % 2 == 0 else s * 0.22; ring.append(bm.verts.new((rr * math.cos(a), rr * math.sin(a), 0)))
    for i in range(8): bm.faces.new((c, ring[i], ring[(i + 1) % 8]))
    me = D.meshes.new(nm); bm.to_mesh(me); bm.free(); me.materials.append(m)
    o = D.objects.new(nm, me); coll.objects.link(o); o.location = pos; o.rotation_euler = Vector(normal).normalized().to_track_quat('Z', 'Y').to_euler()
    s_ = o.modifiers.new("d", 'SOLIDIFY'); s_.thickness = 0.004; return o
def icicle(nm, x, y, z, length, r, m):
    bm = bmesh.new(); ring = [bm.verts.new((x + r * math.cos(2 * math.pi * k / 6), y + r * math.sin(2 * math.pi * k / 6), z)) for k in range(6)]
    tip = bm.verts.new((x, y, z - length)); top = bm.verts.new((x, y, z + 0.005))
    for k in range(6):
        j = (k + 1) % 6; bm.faces.new((ring[j], ring[k], tip)); bm.faces.new((ring[k], ring[j], top))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = D.meshes.new(nm); bm.to_mesh(me); bm.free(); me.materials.append(m)
    o = D.objects.new(nm, me); coll.objects.link(o); return o
FLAKE_OFF = {4: math.pi / 4}
for n, sp in SPECS.items():
    nm = f"ChauBT_{n}"; root = O[nm]; outer = sp["outer"]; top = max(z for r, z in outer)
    facets = sp.get("facets")
    R = lambda z, off=0.0: rad(outer, z) + off
    rimR = max(r for r, z in outer if z > top - 0.05); rimz = top - 0.012
    z0 = outer[0][1]; mid = z0 + (top - z0) * 0.45; sh = z0 + (top - z0) * 0.8
    segs = facets or 64
    def sband(tag, z, r=0.011): return torus(f"{nm}_{tag}", z, R(z, 0.007), r, M["bac"], coll, segs, 6)
    def flakes(tag, z, k, s, m):
        out = []
        for i in range(k):
            a = FRONT + 2 * math.pi * i / k + math.pi / k + FLAKE_OFF.get(n, 0); r = R(z, 0.012)
            out += snowflake(f"{nm}_{tag}{i}_", (r * math.cos(a), r * math.sin(a), z), (math.cos(a), math.sin(a), 0), s, m, 0.007)
        return out
    def clusters(tag, k=4, glow=True):
        out = []; rnd = random.Random(n * 3 + k)
        for i in range(k):
            a = FRONT + 2 * math.pi * i / k + 0.4; r = (0.47 if sp.get("legs") else R(z0 + 0.04)) + 0.05
            for j in range(3):
                aa = a + (j - 1) * 0.16; d = (math.cos(aa) * 0.5, math.sin(aa) * 0.5, 1.0)
                out.append(crystal(f"{nm}_{tag}{i}{j}", (r * math.cos(aa), r * math.sin(aa), 0.01), d, (0.2 if j == 1 else 0.13) + rnd.uniform(0, 0.03), 0.032, M["tinhsang"] if glow else M["tinhthe"]))
        return out
    def icicles(tag, k=16):
        out = []; rnd = random.Random(n * 5)
        for i in range(k):
            a = 2 * math.pi * i / k + rnd.uniform(-0.08, 0.08); r = rimR + 0.01
            out.append(icicle(f"{nm}_{tag}{i}", r * math.cos(a), r * math.sin(a), rimz - 0.01, rnd.uniform(0.07, 0.15), 0.018, M["bangtrong"]))
        return out
    def filigree(tag, z):
        pts = []
        for i in range(129):
            a = 2 * math.pi * i / 128; zz = z + 0.022 * math.sin(12 * a); rr = R(zz, 0.012)
            pts.append((rr * math.cos(a), rr * math.sin(a), zz))
        return [tube(f"{nm}_{tag}", pts, 0.007, M["bac"], coll, 5)]
    def crown(tag, k=12):
        out = []
        for i in range(k):
            a = 2 * math.pi * i / k; r = rimR + 0.03; ln = 0.12 if i % 2 == 0 else 0.08
            out.append(crystal(f"{nm}_{tag}{i}", (r * math.cos(a), r * math.sin(a), rimz), (math.cos(a) * 0.25, math.sin(a) * 0.25, 1.0), ln, 0.022, M["tinhsang"]))
        out.append(torus(f"{nm}_{tag}v", rimz + 0.005, rimR + 0.03, 0.013, M["bac"], coll, segs, 6))
        return out
    def aura(tag):
        base_r = 0.5 if sp.get("legs") else R(z0 + 0.02) + 0.08
        return [torus(f"{nm}_{tag}", 0.012, base_r, 0.03, M["hao"], coll, 64, 8), torus(f"{nm}_{tag}2", 0.012, base_r + 0.07, 0.014, M["hao"], coll, 64, 6)]
    def snowfall(tag, k):
        rnd = random.Random(n * 9); out = []
        for i in range(k):
            a = rnd.uniform(0, 2 * math.pi); r = rimR + rnd.uniform(0.05, 0.18); z = rnd.uniform(0.1, top + 0.3)
            if i % 3 == 0: out.append(star4(f"{nm}_{tag}s{i}", (r * math.cos(a), r * math.sin(a), z), (math.cos(a), math.sin(a), 0), rnd.uniform(0.025, 0.04), M["sao"]))
            else: out.append(sphere(f"{nm}_{tag}t{i}", (r * math.cos(a), r * math.sin(a), z), rnd.uniform(0.008, 0.014), M["sang"], coll, 6))
        return out
    def big_flake(tag):
        a = FRONT + (math.pi / 4 if n == 4 else 0); z = mid; r = R(z, 0.016)
        return snowflake(f"{nm}_{tag}_", (r * math.cos(a), r * math.sin(a), z), (math.cos(a), math.sin(a), 0), 0.15, M["sang"], 0.011)
    L = {}
    L[2] = [sband("a1", sh), sband("a2", z0 + 0.06, 0.009)]
    L[3] = [sband("b1", sh), sband("b2", z0 + 0.06, 0.009)] + flakes("bf", mid, 6, 0.06, M["tuyet"])
    L[4] = [sband("c1", sh), sband("c2", z0 + 0.06, 0.009)] + flakes("cf", mid, 6, 0.06, M["tuyet"]) + clusters("ck")
    L[5] = [sband("d1", sh)] + filigree("dl", z0 + 0.08) + icicles("di") + clusters("dk") + flakes("df", mid, 6, 0.06, M["tuyet"])
    L[6] = crown("ec") + filigree("el", z0 + 0.08) + icicles("ei") + clusters("ek") + aura("eh") + snowfall("es", 14) + big_flake("eb") + flakes("ef", mid, 4, 0.06, M["tuyet"])
    for lv, parts in L.items():
        H["add_level"](root, lv, parts)
bpy.context.view_layer.update()
