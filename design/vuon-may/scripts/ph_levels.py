import bpy, bmesh, math, os, random
from mathutils import Vector, Matrix
O = bpy.data.objects; D = bpy.data; ns = bpy.app.driver_namespace; H = ns["H2"]; M = ns["PH_M"]; SPECS = ns["ph_specs"]; F = ns["PH_fn"]
coll = F["coll"]; feather, flame = F["feather"], F["flame"]
ONLY = ns.get("PH_ONLY", [1, 2, 3, 4, 5, 6])
for o in [o for o in O if o.name.startswith("ChauPH_") and "_Lv" in o.name and int(o.name.split("_")[1]) in ONLY]: D.objects.remove(o, do_unlink=True)
torus, tube, sphere, rad = H["torus"], H["tube"], H["sphere"], H["rad"]
M["longsang"] = H["mat"]("PH_LongSang", (1.0, 0.62, 0.15), 0.25, 0.2, ((1.0, 0.5, 0.08), 2.6), coat=0.6)
M["hongngoc"] = H["mat"]("PH_HongNgoc", (0.9, 0.05, 0.08), 0.08, 0, ((1.0, 0.1, 0.08), 3.0), coat=1.0)
M["hao"] = H["mat"]("PH_HaoQuang", (1.0, 0.55, 0.15), 0.4, 0, ((1.0, 0.45, 0.08), 2.4), alpha=0.45)
M["sao"] = H["mat"]("PH_Sao", (1.0, 0.9, 0.6), 0.2, 0, ((1.0, 0.75, 0.35), 6.0))
FRONT = -math.pi / 2
BANDS = {1: [0.76, 0.08], 2: [0.2, 0.42], 3: [0.1, 0.16], 4: [0.08], 5: [0.08, 0.44], 6: [0.065, 0.75]}
MED = {1: (FRONT, 0.42, 0.05), 2: (FRONT, 0.27, 0.012), 3: (FRONT, 0.44, 0.065), 6: (FRONT + math.pi / 6, 0.42, 0.012)}
def star4(nm, pos, normal, s, m):
    bm = bmesh.new(); c = bm.verts.new((0, 0, 0)); ring = []
    for i in range(8):
        a = 2 * math.pi * i / 8; rr = s if i % 2 == 0 else s * 0.22; ring.append(bm.verts.new((rr * math.cos(a), rr * math.sin(a), 0)))
    for i in range(8): bm.faces.new((c, ring[i], ring[(i + 1) % 8]))
    me = D.meshes.new(nm); bm.to_mesh(me); bm.free(); me.materials.append(m)
    o = D.objects.new(nm, me); coll.objects.link(o); o.location = pos; o.rotation_euler = Vector(normal).normalized().to_track_quat('Z', 'Y').to_euler()
    s_ = o.modifiers.new("d", 'SOLIDIFY'); s_.thickness = 0.004; return o
for n, sp in SPECS.items():
    if n not in ONLY: continue
    nm = f"ChauPH_{n}"; root = O[nm]; outer = sp["outer"]; top = max(z for r, z in outer)
    R = lambda z, off=0.0: rad(outer, z) + off
    rimR = max(r for r, z in outer if z > top - 0.05); rimz = top - 0.012
    r0 = R(0.02)
    def bands(tag, gems=False):
        out = []
        for j, z in enumerate(BANDS[n]):
            out.append(torus(f"{nm}_{tag}{j}", z, R(z, 0.008), 0.011, M["vang"], coll, 72, 6))
            if gems:
                for i in range(8):
                    a = 2 * math.pi * i / 8 + FRONT; r = R(z, 0.02)
                    out.append(sphere(f"{nm}_{tag}{j}g{i}", (r * math.cos(a), r * math.sin(a), z), 0.014, M["do"], coll, 8))
        return out
    def collar(tag, k=18, ln=0.1):
        out = []
        for i in range(k):
            a = 2 * math.pi * i / k; ca, sa = math.cos(a), math.sin(a)
            base = ((rimR + 0.012) * ca, (rimR + 0.012) * sa, top - 0.035)
            out += feather(f"{nm}_{tag}{i}", base, (ca * 0.85, sa * 0.85, -0.5), (0, 0, 1), ln, 0.038, M["longv"] if i % 2 else M["vang"], -0.08)
        return out
    def flames(tag, k=8, h=0.2):
        out = []
        for i in range(k):
            a = 2 * math.pi * i / k + FRONT + math.pi / k; ca, sa = math.cos(a), math.sin(a); rr = r0 + 0.04
            out.append(flame(f"{nm}_{tag}{i}", (rr * ca, rr * sa, 0.0), (ca * 0.25, sa * 0.25, 1.0), h * (1.0 if i % 2 else 0.75), 0.03, M["lua"], 0.6 + i, n * 10 + i))
        return out
    def filigree(tag, z):
        pts = []
        for i in range(145):
            a = 2 * math.pi * i / 144; zz = z + 0.024 * math.sin(10 * a); rr = R(zz, 0.012)
            pts.append((rr * math.cos(a), rr * math.sin(a), zz))
        return [tube(f"{nm}_{tag}", pts, 0.007, M["vang"], coll, 5)]
    def embers(tag, k):
        rnd = random.Random(n * 7); out = []
        for i in range(k):
            a = rnd.uniform(0, 2 * math.pi); r = R(0.3) + rnd.uniform(0.06, 0.2); z = rnd.uniform(0.05, top + 0.25)
            out.append(sphere(f"{nm}_{tag}{i}", (r * math.cos(a), r * math.sin(a), z), rnd.uniform(0.008, 0.015), M["than_hong"], coll, 6))
        return out
    def medallion(tag):
        if n not in MED:
            # chậu 4: mắt lông đuôi phát sáng; chậu 5: lõi mặt trời phát sáng
            out = []
            if n == 4:
                for i in range(3):
                    e = O.get(f"{nm}_Than")
                    a0 = FRONT - 1.5 + i * 0.75 + 1.5; z = 0.54 + 0.03 * math.sin(6); r = R(z, 0.014)
                    pe = Vector((r * math.cos(a0), r * math.sin(a0), z)); ne = Vector((pe.x, pe.y, 0)).normalized()
                    out.append(sphere(f"{nm}_{tag}{i}", tuple(pe + ne * 0.03), 0.042, M["hongngoc"], coll, 14, scale=(1, 1, 1.35), normal=tuple(ne)))
            else:
                ca, sa = math.cos(FRONT), math.sin(FRONT); nrm = Vector((ca, sa, 0)); c = Vector((R(0.3, 0.02) * ca, R(0.3, 0.02) * sa, 0.3))
                out.append(sphere(f"{nm}_{tag}", tuple(c + nrm * 0.035), 0.068, M["hongngoc"], coll, 16, scale=(1, 1, 0.38), normal=tuple(nrm)))
            return out
        a, z, off = MED[n]; ca, sa = math.cos(a), math.sin(a); nrm = Vector((ca, sa, 0)); c = Vector((R(z, off) * ca, R(z, off) * sa, z))
        tng = Vector((-sa, ca, 0)); up = Vector((0, 0, 1)); out = []
        out.append(sphere(f"{nm}_{tag}d", tuple(c + nrm * 0.012), 0.075, M["vang"], coll, 18, scale=(1, 1, 0.3), normal=tuple(nrm)))
        out.append(sphere(f"{nm}_{tag}n", tuple(c + nrm * 0.03), 0.036, M["hongngoc"], coll, 14, scale=(1, 1, 0.55), normal=tuple(nrm)))
        out.append(torus(f"{nm}_{tag}v", 0, 0.05, 0.007, M["vang"], coll, 36, 6, loc=tuple(c + nrm * 0.028), normal=tuple(nrm)))
        for j in range(9):  # tia lông phượng toả lên trên như đuôi xoè
            b = math.radians(20 + j * 17.5); dv = tng * math.cos(b) + up * math.sin(b)
            out += feather(f"{nm}_{tag}f{j}", tuple(c + nrm * 0.016 + dv * 0.07), tuple(dv), tuple(nrm), 0.09 if j % 2 == 0 else 0.07, 0.024, M["longv"], 0.0)
        return out
    def crown(tag, k=10):
        out = []
        for i in range(k):
            a = 2 * math.pi * i / k; ca, sa = math.cos(a), math.sin(a)
            base = ((rimR + 0.02) * ca, (rimR + 0.02) * sa, rimz)
            out += feather(f"{nm}_{tag}{i}", base, (ca * 0.35, sa * 0.35, 1.0), (ca, sa, 0), 0.2 if i % 2 == 0 else 0.15, 0.065, M["longsang"] if i % 2 == 0 else M["longv"], 0.14, M["vang"])
            tip = Vector(base) + Vector((ca * 0.35, sa * 0.35, 1.0)).normalized() * (0.2 if i % 2 == 0 else 0.15) + Vector((ca, sa, 0)) * 0.025
            out.append(sphere(f"{nm}_{tag}s{i}", tuple(tip), 0.011, M["sao"], coll, 8))
        out.append(torus(f"{nm}_{tag}v", rimz + 0.004, rimR + 0.022, 0.014, M["vang"], coll, 72, 6))
        return out
    def back_wings(tag):
        out = []; bz = top * 0.82; back = FRONT + math.pi
        for s_ in (-1, 1):
            a = back + s_ * 0.75; ca, sa = math.cos(a), math.sin(a); base = Vector((R(bz, 0.01) * ca, R(bz, 0.01) * sa, bz))
            side = Vector((s_, 0, 0))
            for j in range(9):
                t = j / 8; ang = math.radians(28 + t * 70)
                d = side * math.cos(ang) + Vector((0, 0.25, 0)) + Vector((0, 0, 1)) * math.sin(ang)
                ln = 0.56 * (0.6 + 0.4 * math.sin(math.pi * (0.2 + 0.8 * t)))
                out += feather(f"{nm}_{tag}{s_}{j}", tuple(base), tuple(d), (0, 1, 0), ln, 0.06, M["longsang"] if j % 2 == 0 else M["longv"], 0.08)
        return out
    def halo(tag):
        rr = r0 + 0.11; out = [torus(f"{nm}_{tag}", 0.015, rr, 0.026, M["hao"], coll, 72, 8), torus(f"{nm}_{tag}2", 0.015, rr + 0.07, 0.012, M["hao"], coll, 72, 6)]
        for i in range(12):
            a = 2 * math.pi * i / 12; ca, sa = math.cos(a), math.sin(a)
            out.append(flame(f"{nm}_{tag}f{i}", ((rr + 0.035) * ca, (rr + 0.035) * sa, 0.0), (ca * 0.15, sa * 0.15, 1), 0.13 if i % 2 else 0.09, 0.022, M["lua"], i, 100 + n * 12 + i))
        return out
    def sparks(tag, k):
        rnd = random.Random(n * 11); out = []
        for i in range(k):
            a = rnd.uniform(0, 2 * math.pi); r = rimR + rnd.uniform(0.08, 0.22); z = rnd.uniform(0.15, top + 0.35)
            if i % 2 == 0: out.append(star4(f"{nm}_{tag}s{i}", (r * math.cos(a), r * math.sin(a), z), (math.cos(a), math.sin(a), 0), rnd.uniform(0.028, 0.045), M["sao"]))
            else: out.append(sphere(f"{nm}_{tag}t{i}", (r * math.cos(a), r * math.sin(a), z), rnd.uniform(0.008, 0.014), M["than_hong"], coll, 6))
        return out
    L = {}
    L[2] = bands("a")
    L[3] = bands("b", True) + collar("bc")
    L[4] = bands("c", True) + collar("cc") + flames("cf")
    L[5] = bands("d", True) + filigree("dl", {1: 0.84, 2: 0.12, 3: 0.2, 4: 0.2, 5: 0.16, 6: 0.86}[n]) + collar("dc", 22, 0.12) + flames("df", 10, 0.24) + embers("de", 12) + medallion("dm")
    L[6] = bands("e", True) + crown("ec") + back_wings("ew") + flames("ef", 10, 0.26) + halo("eh") + sparks("es", 16) + medallion("em")
    for lv, parts in L.items():
        H["add_level"](root, lv, parts)
bpy.context.view_layer.update()
