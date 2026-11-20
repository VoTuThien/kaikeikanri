import bpy, bmesh, math, random
from mathutils import Vector, Matrix
O = bpy.data.objects; D = bpy.data; ns = bpy.app.driver_namespace; H = ns["H2"]
coll = H["get_coll"]("TuiHatGiong")
for o in [o for o in O if o.name.startswith("TuiHat")]: D.objects.remove(o, do_unlink=True)

# ---- vật liệu: thân / miệng túi màu sáng để code tô theo màu cây; nhãn trắng (code dán icon cây) ----
M_THAN = H["mat"]("TuiHat_Than", (0.93, 0.88, 0.78), 0.82, 0.0)
M_MIENG = H["mat"]("TuiHat_Mieng", (0.80, 0.72, 0.6), 0.75, 0.0)
M_CHI = H["mat"]("TuiHat_Chi", (0.97, 0.94, 0.86), 0.7, 0.0)
M_NHAN = H["mat"]("TuiHat_Nhan", (1.0, 1.0, 1.0), 0.6, 0.0)

W = 0.27      # nửa bề ngang ở đáy
HT = 0.62     # chiều cao thân (không tính dải miệng)
T = 0.105     # nửa bề dày chỗ phồng nhất
NU, NV = 28, 30
rnd = random.Random(5)

def width(v):  # hẹp dần lên miệng
    return W * (1.0 - 0.1 * v)
def thick(u, v):
    # phồng ở giữa, mỏng dần về 2 mép và lên miệng (miệng dán kín), đáy bo tròn
    side = max(0.0, 1.0 - u * u) ** 0.55
    g = math.sin(math.pi * min(1.0, 0.1 + 0.9 * v) ) ** 0.45 if v < 0.5 else (1.0 - ((v - 0.5) / 0.5) ** 1.6 * 0.93)
    bottom = min(1.0, (v / 0.12)) ** 0.5
    return T * side * g * bottom
def wrinkle(u, v):  # nếp nhăn giấy rất nhẹ
    return 0.004 * math.sin(u * 9.0 + v * 4.0) * math.sin(v * 13.0) + 0.002 * math.sin(u * 23 + v * 17)

def P(u, v, s):
    x = u * width(v)
    z = HT * v
    y = s * (thick(u, v) + (wrinkle(u, v) if thick(u, v) > 0.01 else 0))
    # đáy bo tròn: góc dưới thu vào
    if v < 0.1:
        x *= 0.82 + 0.18 * (v / 0.1) ** 0.5
    return Vector((x, -y, z))   # -y = mặt trước (nhìn từ -Y)

bm = bmesh.new()
front = [[bm.verts.new(P(-1 + 2 * i / NU, j / NV, 1)) for i in range(NU + 1)] for j in range(NV + 1)]
back = [[bm.verts.new(P(-1 + 2 * i / NU, j / NV, -1)) for i in range(NU + 1)] for j in range(NV + 1)]
for j in range(NV):
    for i in range(NU):
        bm.faces.new((front[j][i], front[j][i + 1], front[j + 1][i + 1], front[j + 1][i]))
        bm.faces.new((back[j][i + 1], back[j][i], back[j + 1][i], back[j + 1][i + 1]))
# 2 mép bên + đáy: nối mặt trước / sau
for j in range(NV):
    for i in (0, NU):
        a, b, c, d = front[j][i], front[j + 1][i], back[j + 1][i], back[j][i]
        bm.faces.new((a, b, c, d) if i == 0 else (d, c, b, a))
for i in range(NU):
    bm.faces.new((front[0][i + 1], front[0][i], back[0][i], back[0][i + 1]))
# miệng (đỉnh thân) đóng kín
for i in range(NU):
    bm.faces.new((front[NV][i], front[NV][i + 1], back[NV][i + 1], back[NV][i]))
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0015)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
me = D.meshes.new("TuiHat_Than"); bm.to_mesh(me); bm.free()
for p in me.polygons: p.use_smooth = True
than = D.objects.new("TuiHat_Than", me); coll.objects.link(than); me.materials.append(M_THAN)

# ---- dải dán miệng túi: tấm phẳng, mép trên răng cưa ----
top_w = width(1.0)
z0 = HT - 0.015; z1 = HT + 0.085
bm = bmesh.new(); th = 0.012
teeth = 14
cols = []
for k in range(teeth * 2 + 1):
    x = -top_w * 1.02 + 2 * top_w * 1.02 * k / (teeth * 2)
    ztop = z1 if k % 2 == 0 else z1 - 0.022
    cols.append((x, ztop))
fv = [(bm.verts.new((x, -th, z0)), bm.verts.new((x, -th, zt))) for x, zt in cols]
bv = [(bm.verts.new((x, th, z0)), bm.verts.new((x, th, zt))) for x, zt in cols]
for k in range(len(cols) - 1):
    bm.faces.new((fv[k][0], fv[k + 1][0], fv[k + 1][1], fv[k][1]))
    bm.faces.new((bv[k + 1][0], bv[k][0], bv[k][1], bv[k + 1][1]))
    bm.faces.new((fv[k][1], fv[k + 1][1], bv[k + 1][1], bv[k][1]))
    bm.faces.new((fv[k + 1][0], fv[k][0], bv[k][0], bv[k + 1][0]))
for k in (0, len(cols) - 1):
    q = (fv[k][0], fv[k][1], bv[k][1], bv[k][0])
    bm.faces.new(q if k == 0 else tuple(reversed(q)))
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
me = D.meshes.new("TuiHat_Mieng_m"); bm.to_mesh(me); bm.free(); me.materials.append(M_MIENG)
mieng = D.objects.new("TuiHat_Mieng_m", me); coll.objects.link(mieng)

# ---- đường chỉ khâu (nét đứt) 2 mặt dưới dải miệng ----
parts = [than, mieng]
zs = HT + 0.02
for side in (-1, 1):
    n = 13
    for k in range(n):
        x0 = -top_w * 0.9 + 1.8 * top_w * k / n
        x1 = x0 + 1.8 * top_w / n * 0.55
        y = side * (th + 0.004)
        parts.append(H["tube"](f"TuiHat_c{side}{k}", [(x0, y, zs), (x1, y, zs)], 0.0045, M_CHI, coll, 5))

# ---- nhãn mặt trước: lưới uốn theo mặt túi, UV 0..1 (code dán icon cây) ----
u0, u1, v0, v1 = -0.88, 0.88, 0.08, 0.9
NLU, NLV = 16, 16
bm = bmesh.new(); uv = bm.loops.layers.uv.new("UVMap"); vs = []
for j in range(NLV + 1):
    row = []
    for i in range(NLU + 1):
        u = u0 + (u1 - u0) * i / NLU; v = v0 + (v1 - v0) * j / NLV
        p = P(u, v, 1); p.y -= 0.004
        row.append(bm.verts.new(p))
    vs.append(row)
for j in range(NLV):
    for i in range(NLU):
        f = bm.faces.new((vs[j][i], vs[j][i + 1], vs[j + 1][i + 1], vs[j + 1][i]))
        for loop, (ii, jj) in zip(f.loops, ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))):
            loop[uv].uv = (ii / NLU, jj / NLV)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
me = D.meshes.new("TuiHat_Nhan"); bm.to_mesh(me); bm.free()
for p in me.polygons: p.use_smooth = True
nhan = D.objects.new("TuiHat_Nhan", me); coll.objects.link(nhan); me.materials.append(M_NHAN)
# mặt nhãn phải hướng ra phía trước (-Y): kiểm tra pháp tuyến
me.calc_normals_split() if hasattr(me, "calc_normals_split") else None
avg = sum((p.normal for p in me.polygons), Vector()) / len(me.polygons)
if avg.y > 0:
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.reverse_faces(bm, faces=bm.faces); bm.to_mesh(me); bm.free()

body = H["join"](parts, "TuiHat_Than")
root = D.objects.new("TuiHat", None); coll.objects.link(root); root["ten"] = "Túi hạt giống"
cz = (HT + 0.085) / 2
for o in (body, nhan):
    o.parent = root; o.matrix_parent_inverse = Matrix.Identity(4)
    o.location = (0, 0, -cz)   # gốc khung ở giữa túi (lơ lửng / kéo thả)
root.location = (9.0, -26.0, 0.8)
result = {"than_v": len(body.data.vertices), "nhan_v": len(nhan.data.vertices), "mats": [m.name for m in body.data.materials]}
