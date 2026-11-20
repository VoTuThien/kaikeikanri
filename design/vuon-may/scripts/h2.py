import bpy, bmesh, math, re, os
from mathutils import Vector, Matrix
D = bpy.data; O = bpy.data.objects; ns = bpy.app.driver_namespace; sc = bpy.context.scene

def get_coll(name):
    c = D.collections.get(name)
    if not c:
        c = D.collections.new(name); D.collections["VuonMay"].children.link(c)
    return c
def link(o, coll):
    for c in list(o.users_collection): c.objects.unlink(o)
    coll.objects.link(o); return o
def mat(name, rgb, rough=0.4, metal=0.0, emit=None, alpha=1.0, coat=0.0):
    m = D.materials.get(name) or D.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1); b.inputs["Roughness"].default_value = rough; b.inputs["Metallic"].default_value = metal
    b.inputs["Coat Weight"].default_value = coat; b.inputs["Alpha"].default_value = alpha
    if emit: b.inputs["Emission Color"].default_value = (*emit[0], 1); b.inputs["Emission Strength"].default_value = emit[1]
    else: b.inputs["Emission Strength"].default_value = 0.0
    if alpha < 1:
        try: m.surface_render_method = 'BLENDED'
        except Exception: pass
    return m
def _obj(name, bm, m, coll, smooth=True):
    me = D.meshes.new(name); bm.to_mesh(me); bm.free()
    if smooth:
        for p in me.polygons: p.use_smooth = True
    o = D.objects.new(name, me); coll.objects.link(o); me.materials.append(m); return o
def lathe(name, pts, m, coll, segs=64, f=None, caps=True):
    bm = bmesh.new(); rings = []
    for (r, z) in pts:
        ring = []
        for i in range(segs):
            a = 2 * math.pi * i / segs; rr = r + (f(a, r, z) if f and r > 0.01 else 0)
            ring.append(bm.verts.new((rr * math.cos(a), rr * math.sin(a), z)))
        rings.append(ring)
    for k in range(len(rings) - 1):
        for i in range(segs):
            j = (i + 1) % segs; bm.faces.new((rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i]))
    if caps:
        for idx in (0, -1):
            c = bm.verts.new((0, 0, pts[idx][1]))
            for i in range(segs):
                j = (i + 1) % segs
                bm.faces.new((rings[idx][i], rings[idx][j], c) if idx == -1 else (rings[idx][j], rings[idx][i], c))
    else:
        for i in range(segs):
            j = (i + 1) % segs; bm.faces.new((rings[-1][i], rings[-1][j], rings[0][j], rings[0][i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _obj(name, bm, m, coll)
def torus(name, z, R, r, m, coll, segs=56, minor=8, loc=None, normal=None):
    bm = bmesh.new(); rings = []
    for i in range(segs):
        a = 2 * math.pi * i / segs
        rings.append([bm.verts.new(((R + r * math.cos(2 * math.pi * k / minor)) * math.cos(a), (R + r * math.cos(2 * math.pi * k / minor)) * math.sin(a), z + r * math.sin(2 * math.pi * k / minor))) for k in range(minor)])
    for i in range(segs):
        for k in range(minor):
            bm.faces.new((rings[i][k], rings[(i + 1) % segs][k], rings[(i + 1) % segs][(k + 1) % minor], rings[i][(k + 1) % minor]))
    o = _obj(name, bm, m, coll)
    if loc is not None: o.location = loc
    if normal is not None: o.rotation_euler = Vector(normal).normalized().to_track_quat('Z', 'Y').to_euler()
    return o
def tube(name, pts, r, m, coll, sides=6, taper=None):
    bm = bmesh.new(); pts = [Vector(p) for p in pts]; rings = []
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        a = t.orthogonal().normalized(); b = t.cross(a); rr = r * (taper(i / (len(pts) - 1)) if taper else 1)
        rings.append([bm.verts.new(p + (a * math.cos(2 * math.pi * k / sides) + b * math.sin(2 * math.pi * k / sides)) * rr) for k in range(sides)])
    for i in range(len(rings) - 1):
        for k in range(sides):
            bm.faces.new((rings[i][k], rings[i][(k + 1) % sides], rings[i + 1][(k + 1) % sides], rings[i + 1][k]))
    for idx in (0, -1):
        c = bm.verts.new(pts[idx])
        for k in range(sides):
            f = (rings[idx][k], rings[idx][(k + 1) % sides], c)
            bm.faces.new(f if idx == -1 else tuple(reversed(f)))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _obj(name, bm, m, coll)
def sphere(name, loc, r, m, coll, seg=12, scale=None, normal=None):
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=max(4, seg // 2 + 1), radius=r)
    o = _obj(name, bm, m, coll); o.location = loc
    if scale: o.scale = scale
    if normal is not None: o.rotation_euler = Vector(normal).normalized().to_track_quat('Z', 'Y').to_euler()
    return o
def join(objs, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        for md in list(o.modifiers):
            bpy.context.view_layer.objects.active = o; o.select_set(True); bpy.ops.object.modifier_apply(modifier=md.name); o.select_set(False)
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active; o.name = name; o.data.name = name
    return o
def rad(outer, z):
    pts = []
    for p in outer:
        if pts and p[1] < pts[-1][1]: break
        pts.append(p)
    for (r0, z0), (r1, z1) in zip(pts, pts[1:]):
        if z0 <= z <= z1 and z1 > z0: return r0 + (r1 - r0) * (z - z0) / (z1 - z0)
    return pts[-1][0] if z > pts[-1][1] else pts[0][0]
def rin(inner, z):
    pts = sorted(inner, key=lambda p: p[1])
    for (r0, z0), (r1, z1) in zip(pts, pts[1:]):
        if z0 <= z <= z1: return r0 + (r1 - r0) * (z - z0) / (z1 - z0)
    return pts[-1][0] if z > pts[-1][1] else pts[0][0]
def make_pot(prefix, n, sp, than_parts, coll, ten, bo, loc):
    nm = f"{prefix}_{n}"
    than = join(than_parts, nm + "_Than")
    rs = rin(sp["inner"], sp["soil"]) - 0.005
    dat = lathe(nm + "_Dat", [(rs, sp["soil"] - 0.03), (rs, sp["soil"]), (rs * 0.6, sp["soil"] + 0.015)], D.materials["Chau_Dat"], coll, 32)
    root = D.objects.new(nm, None); coll.objects.link(root); root["ten"] = ten; root["bo"] = bo; root["cap"] = 1
    diem = D.objects.new(nm + "_DiemCay", None); diem.empty_display_size = 0.1; coll.objects.link(diem); diem.location = (0, 0, sp["soil"] + 0.015)
    for o in (than, dat, diem): o.parent = root; o.matrix_parent_inverse = Matrix.Identity(4)
    root.location = loc
    return root
def add_level(root, lv, parts):
    o = join(parts, f"{root.name}_Lv{lv}")
    o.parent = root; o.matrix_parent_inverse = Matrix.Identity(4); o.hide_set(True); o.hide_render = True
    return o
def wall_hits(plant_root, pot_root, sp, stages=(1, 2, 3)):
    inv = pot_root.matrix_world.inverted(); top = max(z for r, z in sp["outer"]); hits = 0
    outer, inner = sp["outer"], sp["inner"]
    dg = bpy.context.evaluated_depsgraph_get()
    for st in stages:
        ob = O.get(f"{plant_root.name}_GD{st}")
        if not ob: continue
        e = ob.evaluated_get(dg); me = e.to_mesh(); mw = ob.matrix_world
        for v in me.vertices:
            p = inv @ (mw @ v.co); r = (p.x ** 2 + p.y ** 2) ** 0.5
            if p.z < 0 or p.z > top + 0.01: continue
            ro = rad(outer, p.z) + 0.004
            ri = rin(inner, p.z) - 0.004 if p.z <= max(z for _, z in inner) else ro - 0.08
            if ri < r < ro: hits += 1
        e.to_mesh_clear()
    return hits
def fit_plants(prefix, specs, kind_prefix):
    plants = ("Cai", "CaRot", "Dau", "Ngo", "CaChua", "HuongDuong", "BiNgo", "DuaHau")
    out = {}
    for p in plants:
        rig = O[f"Cay_{p}"]; par, mpi, loc, scl = rig.parent, rig.matrix_parent_inverse.copy(), rig.location.copy(), rig.scale.copy()
        for n, sp in specs.items():
            pot = O[f"{prefix}_{n}"]
            rig.parent = O[f"{prefix}_{n}_DiemCay"]; rig.matrix_parent_inverse = Matrix.Identity(4); rig.location = (0, 0, 0)
            fit = None
            for f in [1.0] + [x / 100 for x in range(95, 49, -5)]:
                rig.scale = scl * f; bpy.context.view_layer.update()
                if wall_hits(rig, pot, sp) == 0: fit = f; break
            if fit != 1.0: out.setdefault(p, {})[f"{kind_prefix}_{n}"] = fit
        rig.parent = par; rig.matrix_parent_inverse = mpi; rig.location = loc; rig.scale = scl
    bpy.context.view_layer.update()
    return out
ns["H2"] = dict(get_coll=get_coll, link=link, mat=mat, lathe=lathe, torus=torus, tube=tube, sphere=sphere, join=join, rad=rad, rin=rin,
                make_pot=make_pot, add_level=add_level, wall_hits=wall_hits, fit_plants=fit_plants)

# ---- render theo cấp (nền trong suốt / nền đen để ghép giữ quầng sáng) ----
def render_lv(names, path, level=1, res=(1500, 340), pad=1.08, transparent=True, world_off=False):
    r = sc.render
    sv = dict(eng=r.engine, ft=r.film_transparent, rx=r.resolution_x, ry=r.resolution_y, pct=r.resolution_percentage, fp=r.filepath, fmt=r.image_settings.file_format, cm=r.image_settings.color_mode, cam=sc.camera, vt=sc.view_settings.view_transform)
    hid = {o.name: o.hide_render for o in O}
    bgn = [n for n in sc.world.node_tree.nodes if n.type == 'BACKGROUND']; bgs = [n.inputs["Strength"].default_value for n in bgn]
    cam_d = D.cameras.new("TmpCam"); cam_d.type = 'ORTHO'; cam = O.new("TmpCam", cam_d); sc.collection.objects.link(cam)
    lights = []
    for nm, rot, en in (("TmpKey", (math.radians(50), 0, math.radians(35)), 3.5), ("TmpFill", (math.radians(60), 0, math.radians(-120)), 1.4)):
        ld = D.lights.new(nm, 'SUN'); ld.energy = en; lo = O.new(nm, ld); lo.rotation_euler = rot; sc.collection.objects.link(lo); lights.append(lo)
    try:
        show = set(); pts = []
        for n in names:
            root = O[n]; show.add(n)
            for c in root.children_recursive:
                m = re.search(r"_Lv(\d)$", c.name)
                if m and int(m.group(1)) != level: continue
                show.add(c.name)
                if c.type == 'MESH': pts += [c.matrix_world @ Vector(b) for b in c.bound_box]
        for o in O: o.hide_render = not (o.name in show or o.name in ("TmpCam", "TmpKey", "TmpFill"))
        mn = Vector([min(v[i] for v in pts) for i in range(3)]); mx = Vector([max(v[i] for v in pts) for i in range(3)])
        c = (mn + mx) / 2; d = Vector((0, -math.cos(math.radians(22)), math.sin(math.radians(22))))
        cam.location = c + d * 20; cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
        cam_d.ortho_scale = max(mx.x - mn.x, (mx.z - mn.z + 0.2) * res[0] / res[1]) * pad
        if world_off:
            for n_ in bgn: n_.inputs["Strength"].default_value = 0
        r.engine = 'BLENDER_EEVEE'; r.film_transparent = transparent; r.resolution_x, r.resolution_y = res; r.resolution_percentage = 100
        r.image_settings.file_format = 'PNG'; r.image_settings.color_mode = 'RGBA'; r.filepath = path; sc.camera = cam; sc.view_settings.view_transform = 'Standard'
        bpy.ops.render.render(write_still=True)
    finally:
        for o in O:
            if o.name in hid: o.hide_render = hid[o.name]
        for n_, s in zip(bgn, bgs): n_.inputs["Strength"].default_value = s
        for l in lights: D.objects.remove(l, do_unlink=True)
        D.objects.remove(cam, do_unlink=True)
        r.engine, r.film_transparent, r.resolution_x, r.resolution_y, r.resolution_percentage, r.filepath = sv['eng'], sv['ft'], sv['rx'], sv['ry'], sv['pct'], sv['fp']
        r.image_settings.file_format = sv['fmt']; r.image_settings.color_mode = sv['cm']; sc.camera = sv['cam']; sc.view_settings.view_transform = sv['vt']
def render_lv_glow(names, base, level=1, **kw):
    render_lv(names, base + "_t.png", level, transparent=True, **kw)
    render_lv(names, base + "_k.png", level, transparent=False, world_off=True, **kw)
ns["render_lv"] = render_lv; ns["render_lv_glow"] = render_lv_glow

# ---- icon cây: chỉ bật lớp _GD3 (chín), camera trực giao nghiêng 18°, khung vuông vừa sát hình (tính theo đỉnh) ----
def render_crop(root_name, path, res=384, pad=1.06, elev=18):
    r = sc.render
    sv = dict(eng=r.engine, ft=r.film_transparent, rx=r.resolution_x, ry=r.resolution_y, pct=r.resolution_percentage, fp=r.filepath, fmt=r.image_settings.file_format, cm=r.image_settings.color_mode, cam=sc.camera, vt=sc.view_settings.view_transform)
    hid = {o.name: o.hide_render for o in O}
    cam_d = D.cameras.new("TmpCam"); cam_d.type = 'ORTHO'; cam = O.new("TmpCam", cam_d); sc.collection.objects.link(cam)
    lights = []
    for nm, rot, en in (("TmpKey", (math.radians(50), 0, math.radians(35)), 3.5), ("TmpFill", (math.radians(60), 0, math.radians(-120)), 1.4)):
        ld = D.lights.new(nm, 'SUN'); ld.energy = en; lo = O.new(nm, ld); lo.rotation_euler = rot; sc.collection.objects.link(lo); lights.append(lo)
    try:
        gd = O[root_name + "_GD3"]; show = {root_name, gd.name} | {c.name for c in gd.children_recursive}; pts = []
        dg = bpy.context.evaluated_depsgraph_get()
        for nm in show:
            c = O[nm]
            if c.type == 'MESH': pts += [c.matrix_world @ v.co for v in c.evaluated_get(dg).data.vertices]
        for o in O: o.hide_render = not (o.name in show or o.name in ("TmpCam", "TmpKey", "TmpFill"))
        d = Vector((0, -math.cos(math.radians(elev)), math.sin(math.radians(elev))))
        q = (-d).to_track_quat('-Z', 'Y'); right = q @ Vector((1, 0, 0)); up = q @ Vector((0, 1, 0))
        xs = [p.dot(right) for p in pts]; ys = [p.dot(up) for p in pts]
        c3 = sum(pts, Vector()) / len(pts)
        c3 = c3 + right * ((min(xs) + max(xs)) / 2 - c3.dot(right)) + up * ((min(ys) + max(ys)) / 2 - c3.dot(up))
        cam.location = c3 + d * 30; cam.rotation_euler = q.to_euler()
        cam_d.ortho_scale = max(max(xs) - min(xs), max(ys) - min(ys)) * pad
        r.engine = 'BLENDER_EEVEE'; r.film_transparent = True; r.resolution_x = r.resolution_y = res; r.resolution_percentage = 100
        r.image_settings.file_format = 'PNG'; r.image_settings.color_mode = 'RGBA'; r.filepath = path; sc.camera = cam; sc.view_settings.view_transform = 'Standard'
        bpy.ops.render.render(write_still=True)
    finally:
        for o in O:
            if o.name in hid: o.hide_render = hid[o.name]
        for l in lights: D.objects.remove(l, do_unlink=True)
        D.objects.remove(cam, do_unlink=True)
        r.engine, r.film_transparent, r.resolution_x, r.resolution_y, r.resolution_percentage, r.filepath = sv['eng'], sv['ft'], sv['rx'], sv['ry'], sv['pct'], sv['fp']
        r.image_settings.file_format = sv['fmt']; r.image_settings.color_mode = sv['cm']; sc.camera = sv['cam']; sc.view_settings.view_transform = sv['vt']
ns["render_crop"] = render_crop
