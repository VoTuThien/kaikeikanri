import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  AdditiveBlending,
  Box3,
  CanvasTexture,
  Camera,
  Color,
  CylinderGeometry,
  Group,
  Material,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PerspectiveCamera,
  Plane,
  Quaternion,
  Ray,
  Raycaster,
  RingGeometry,
  SphereGeometry,
  SRGBColorSpace,
  Vector2,
  Vector3,
  type BufferGeometry,
} from 'three'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import {
  CLOUD_MODEL,
  MACHINE_MODEL,
  MACHINE_TIER,
  Moon,
  Sky,
  Sparkles,
  Stars,
  lightenMaterials,
  paintClouds,
} from '../models/CloudScene'
import { TIER_COUNT } from './constants'
import { cropById, cropImage, plantState, type Plant } from '../data/crops'
import { POT_SETS, potKindById, slotKey, type OwnedPot, type PotKind } from '../data/pots'
import { PLANT_NODE, plantFit, SLOTS } from './slots'
import { Icon3D } from '../../../components/ui/Icon3D'

// Cảnh 3D của game Vườn mây: camera CHỈ NHÌN 1 TẦNG MÂY mỗi lúc (xem CLAUDE.md "Cơ chế hiển thị game"):
// - Đổi tầng bằng nút ▲ ▼ (GamePage); camera bay mượt ~0,8 giây, giữ nguyên góc xoay.
// - 1 ngón kéo = xoay quanh tầng; 2 ngón chụm / mở = phóng to / thu nhỏ; 2 ngón kéo = dời khung nhìn (giới hạn trong tầng); lăn chuột = zoom.
// - Giới hạn theo từng tầng: không chui xuống dưới mây, khoảng zoom theo cỡ tầng.
// - Tầng khác vẫn hiện nhưng mờ; tầng nào che tầng đang xem thì gần trong suốt.
// - Chậu ở các chỗ đặt cố định (`SLOTS`) theo `garden.placed`; chỗ trống của tầng đang xem có vòng nét đứt phát sáng nhấp nháy.
//   Chạm vòng = chọn chỗ đặt chậu, nhấn giữ chậu ~0,5 giây = menu Dời chỗ / Cất vào kho (GamePage lo giao diện).
// - Cây trong chậu ở MỌI tầng (`plants`, chỉ bật lớp `_GD{giai đoạn}`); huy hiệu 💧 (cần tưới) / 🧺 (chín) nổi trên cây của tầng đang xem.
//   Côn trùng (con-trung.glb) bay / bò vòng quanh cây, chạm để bắt. Chạm chậu / cây → `onPotTap` (GamePage quyết định gieo / tưới / thu hoạch).
// - Túi hạt giống (tui-hat.glb, tô màu theo cây + nhãn icon cây) lơ lửng trên chậu vừa gieo; nhấn vào túi rồi kéo:
//   lướt qua chậu trống nào thì báo `onBagOver` (gieo), thả tay báo `onBagRelease` (GamePage ghi 1 transaction).
// Bộ điều khiển camera tự viết (không dùng OrbitControls) vì khung game có thể đang xoay 90° → toạ độ chạm phải đổi qua `toLocal`.

// Mô hình chậu (mỗi bộ 1 file `POT_SETS[].file`, mỗi chậu có lớp trang trí `_Lv2…Lv6`) và cây trồng (mỗi cây 4 giai đoạn `_GD0…GD3`), xuất từ Blender có nén meshopt
const POT_FILES = [...new Set(POT_SETS.map((s) => s.file))]
const PLANT_MODEL = '/models/cay-trong.glb'
const INSECT_MODEL = '/models/con-trung.glb'
const BAG_MODEL = '/models/tui-hat.glb'
// id côn trùng → node trong con-trung.glb; bay (vòng quanh ngọn cây) hay bò (trên miệng chậu); nhịp + biên độ vỗ cánh
const INSECT_NODE: Record<string, { node: string; fly: boolean; flap?: [number, number] }> = {
  sau: { node: 'Sau', fly: false }, bo_rua: { node: 'BoRua', fly: true, flap: [38, 0.7] }, dom_dom: { node: 'DomDom', fly: true, flap: [38, 0.7] },
  nhen: { node: 'Nhen', fly: false }, buom: { node: 'Buom', fly: true, flap: [11, 0.85] }, // bướm: vỗ chậm, rộng
}
const INSECT_SIZE = 0.42 // cạnh dài nhất của côn trùng trong cảnh

export interface GameModels {
  cloud: GLTF
  machines: GLTF
  pots: GLTF[] // theo thứ tự POT_FILES
  plants: GLTF
  insects: GLTF
  bag: GLTF
}

// ---- Tải mô hình có tiến độ (đọc dần từng phần của file để biết đã tải bao nhiêu) ----
let cached: GameModels | null = null
async function fetchWithProgress(url: string, onBytes: (loaded: number, total: number) => void): Promise<ArrayBuffer> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Không tải được ${url}`)
  const total = Number(res.headers.get('content-length')) || 0
  if (!res.body || !total) {
    const buf = await res.arrayBuffer()
    onBytes(buf.byteLength, buf.byteLength)
    return buf
  }
  const reader = res.body.getReader(); const chunks: Uint8Array[] = []; let loaded = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value); loaded += value.length; onBytes(loaded, total)
  }
  const out = new Uint8Array(loaded); let off = 0
  for (const c of chunks) { out.set(c, off); off += c.length }
  return out.buffer
}
export async function loadGameModels(onProgress: (p: number) => void): Promise<GameModels> {
  if (cached) { onProgress(1); return cached }
  const urls = [CLOUD_MODEL, MACHINE_MODEL, PLANT_MODEL, INSECT_MODEL, BAG_MODEL, ...POT_FILES]
  const prog = urls.map(() => ({ loaded: 0, total: 1 }))
  const report = () => onProgress(prog.reduce((s, p) => s + Math.min(1, p.loaded / p.total), 0) / urls.length * 0.9)
  const bufs = await Promise.all(urls.map((u, i) => fetchWithProgress(u, (l, t) => { prog[i] = { loaded: l, total: t }; report() })))
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
  const [cloud, machines, plants, insects, bag, ...pots] = await Promise.all(bufs.map((b) => loader.parseAsync(b, '')))
  onProgress(1)
  cached = { cloud, machines, pots, plants, insects, bag }
  return cached
}

// Sao chép vật liệu của 1 cây đối tượng (để làm mờ độc lập), trả về danh sách vật liệu mới
function cloneMaterials(obj: Object3D, edit?: (m: Material) => void) {
  const mats: Material[] = []
  obj.traverse((o) => {
    const m = o as Mesh
    if (!m.isMesh) return
    const list = Array.isArray(m.material) ? m.material : [m.material]
    const cl = list.map((x) => { const c = x.clone(); edit?.(c); mats.push(c); return c })
    m.material = Array.isArray(m.material) ? cl : cl[0]
  })
  return mats
}

const potNode = (models: GameModels, name: string) => {
  for (const g of models.pots) { const o = g.scene.getObjectByName(name); if (o) return o }
  return null
}
// Chậu loại `kind`, chỉ bật lớp trang trí đúng cấp (`_Lv{cấp}`, cấp 1 = tắt hết)
function makePot(models: GameModels, kind: PotKind, level: number) {
  const pot = potNode(models, kind.model)!.clone(true)
  pot.traverse((o) => { const m = /_Lv(\d)$/.exec(o.name); if (m) o.visible = Number(m[1]) === level })
  pot.position.set(0, 0, 0); pot.rotation.set(0, 0, 0)
  return pot
}

// ---- Dựng cảnh: mây tô màu + máy gắn vào tầng; mỗi tầng có vật liệu riêng để làm mờ độc lập ----
interface TierInfo {
  node: Object3D
  center: Vector3 // tâm mặt trên của tầng
  sizeX: number
  sizeZ: number
  box: Box3
  mats: Material[]
  opacity: number
}
// 1 chỗ đặt chậu cố định: nhóm gắn vào tầng (đi theo mây nhấp nhô), khối chạm vô hình, vòng nét đứt khi trống
interface SlotNode {
  tier: number
  index: number
  group: Group
  hit: Mesh
  ring: Mesh
  pot: { key: string; kind: string; obj: Object3D; mats: Material[]; holder: Group; rim: number; radius: number } | null
  plant: { crop: string; obj: Object3D; mats: Material[]; stage: number } | null
  insect: { id: string; holder: Group; obj: Object3D; hit: Mesh; mats: Material[]; flaps: { o: Object3D; q: Quaternion; sign: number }[]; phase: number } | null
  top: number // độ cao (cục bộ) của đỉnh chậu + cây đang hiện: chỗ đặt huy hiệu / túi hạt
  ghost: { key: string; obj: Object3D } | null
}

// Đỉnh / bán kính của các phần đang hiện (bỏ lớp ẩn), tính trong toạ độ của `group`
const _b = new Box3(); const _m = new Box3()
function visibleBox(obj: Object3D, group: Group) {
  _b.makeEmpty(); group.updateMatrixWorld(true)
  const inv = group.matrixWorld.clone().invert()
  obj.traverseVisible((o) => {
    const m = o as Mesh
    if (!m.isMesh || !m.geometry) return
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox()
    _m.copy(m.geometry.boundingBox!).applyMatrix4(m.matrixWorld).applyMatrix4(inv)
    _b.union(_m)
  })
  return _b
}

// Vòng nét đứt (24 đoạn) nằm phẳng trên mặt mây
function dashedRing(r: number) {
  const parts: BufferGeometry[] = []
  const n = 24
  for (let i = 0; i < n; i++) parts.push(new RingGeometry(r * 0.82, r, 3, 1, (i / n) * Math.PI * 2, (Math.PI * 2 / n) * 0.55))
  const g = mergeGeometries(parts)!
  g.rotateX(-Math.PI / 2)
  return g
}

function buildWorld(models: GameModels) {
  const root = models.cloud.scene.clone(true)
  paintClouds(root)
  const machines = models.machines.scene.clone(true)
  lightenMaterials(machines)
  root.updateMatrixWorld(true); machines.updateMatrixWorld(true)
  for (const [m, t] of Object.entries(MACHINE_TIER)) {
    const mo = machines.getObjectByName(m); const to = root.getObjectByName(t)
    if (mo && to) to.attach(mo)
  }
  root.updateMatrixWorld(true)
  const tiers: TierInfo[] = []
  for (let i = 1; i <= TIER_COUNT; i++) {
    const node = root.getObjectByName(`TangMay_${i}`)!
    const mesh = node as Mesh
    mesh.geometry.computeBoundingBox()
    const box = mesh.geometry.boundingBox!.clone().applyMatrix4(node.matrixWorld)
    const size = box.getSize(new Vector3())
    const center = box.getCenter(new Vector3()); center.y = box.max.y - 0.35
    tiers.push({ node, center, sizeX: size.x, sizeZ: size.z, box, mats: cloneMaterials(node), opacity: 1 })
  }

  // Bán kính vòng chỗ trống = chậu to nhất (tính cả đĩa lót)
  const pb = new Box3()
  for (let s = 1; s <= 6; s++) { const o = potNode(models, `ChauDat_${s}_Than`); if (o) pb.expandByObject(o) }
  const sz = pb.getSize(new Vector3())
  const R = Math.max(0.3, Math.max(sz.x, sz.z) / 2) * 1.1
  const ringGeo = dashedRing(R)
  const ringMat = new MeshBasicMaterial({ color: new Color(1, 0.62, 0.12), transparent: true, opacity: 0.9, depthWrite: false })
  // quầng sáng mờ bên trong vòng (cộng sáng nhẹ)
  const glowGeo = new RingGeometry(R * 0.15, R * 0.88, 32, 1); glowGeo.rotateX(-Math.PI / 2)
  const glowMat = new MeshBasicMaterial({ color: new Color(1, 0.75, 0.35), transparent: true, opacity: 0.2, blending: AdditiveBlending, depthWrite: false })
  const hitGeo = new CylinderGeometry(R, R, 0.3, 12); hitGeo.translate(0, 0.12, 0) // khối dẹt để chạm chỗ trống dễ hơn
  const hitMat = new MeshBasicMaterial({ visible: false })

  const slots: SlotNode[][] = SLOTS.map((list, t) =>
    list.map((s, index) => {
      const group = new Group()
      group.position.set(...s.pos)
      root.add(group); group.updateMatrixWorld(true); tiers[t].node.attach(group)
      const ring = new Mesh(ringGeo, ringMat); ring.position.y = 0.07; ring.visible = false; ring.renderOrder = 5
      ring.add(new Mesh(glowGeo, glowMat))
      const hit = new Mesh(hitGeo, hitMat)
      group.add(ring, hit)
      return { tier: t, index, group, hit, ring, pot: null, plant: null, insect: null, top: 0.5, ghost: null }
    }),
  )
  root.updateMatrixWorld(true)
  // khối cầu vô hình quanh côn trùng (chạm dễ hơn)
  const insectHit = new SphereGeometry(0.34, 8, 6)
  return { root, tiers, slots, ringMat, glowMat, hitMat, insectHit }
}
type World = ReturnType<typeof buildWorld>

// ---- Đồng bộ chậu / cây / vòng chỗ trống / chậu xem trước theo dữ liệu vườn + chế độ ----
export interface PlantView { crop: string; stage: number; insect: string | null; ripe: boolean; thirsty: boolean }
export type SceneMode =
  | { kind: 'view' }
  | { kind: 'place'; slot: number; preview: OwnedPot | null } // đang chọn chậu cho chỗ trống `slot` của tầng đang xem
  | { kind: 'move'; from: number } // đang dời chậu ở chỗ `from` sang chỗ trống khác cùng tầng
  | { kind: 'seed'; slot: number } // đang chọn hạt cho chậu trống `slot` (camera giữ chậu ở vùng trống)

interface SyncInput {
  pots: OwnedPot[]
  placed: Record<string, string>
  views: Record<string, PlantView>
  tier: number
  tierOpen: boolean
  mode: SceneMode
}
function dropInsect(world: World, s: SlotNode) {
  if (!s.insect) return
  s.insect.holder.removeFromParent()
  const t = world.tiers[s.tier]
  t.mats = t.mats.filter((m) => !s.insect!.mats.includes(m))
  s.insect.mats.forEach((m) => m.dispose())
  s.insect = null
}
function makeInsect(world: World, models: GameModels, id: string, s: SlotNode) {
  const info = INSECT_NODE[id]
  const tpl = info && models.insects.scene.getObjectByName(info.node)
  if (!tpl) return null
  // wrapper (phóng to / nhỏ) > pivot (dời tâm phần đang hiện về gốc, quay) > obj (mô hình gốc, tỉ lệ 1)
  const obj = tpl.clone(true)
  obj.position.set(0, 0, 0); obj.rotation.set(0, 0, 0); obj.scale.setScalar(1)
  const web = obj.getObjectByName('Nhen_Luoi'); if (web) web.visible = false // nhện bỏ mạng, chỉ bò quanh chậu
  const pivot = new Group(); pivot.add(obj)
  if (id === 'nhen') { obj.rotation.x = -Math.PI / 2; pivot.rotation.y = Math.PI } // nhện dựng đứng trên mạng → nằm bò, đầu hướng +Z
  const wrapper = new Group(); wrapper.add(pivot)
  const box = visibleBox(pivot, wrapper)
  const size = box.getSize(new Vector3())
  pivot.position.copy(box.getCenter(new Vector3())).multiplyScalar(-1)
  pivot.position.y += size.y / 2 // đáy con côn trùng ở gốc (bò trên miệng chậu)
  wrapper.scale.setScalar(INSECT_SIZE / Math.max(size.x, size.y, size.z, 1e-3))
  const flaps: { o: Object3D; q: Quaternion; sign: number }[] = []
  obj.traverse((o) => { if (/_Canh(Trai|Phai)$/.test(o.name)) flaps.push({ o, q: o.quaternion.clone(), sign: o.name.endsWith('Trai') ? 1 : -1 }) })
  const vo = ['BoRua_VoTrai', 'BoRua_VoPhai'].map((n) => obj.getObjectByName(n))
  vo.forEach((o, i) => { if (o) o.rotateX(-0.45).rotateZ(i ? -0.35 : 0.35) }) // bọ rùa bay: mai hé mở
  const mats = cloneMaterials(obj)
  const holder = new Group()
  const hit = new Mesh(world.insectHit, world.hitMat)
  holder.add(wrapper, hit)
  s.group.add(holder)
  world.tiers[s.tier].mats.push(...mats)
  return { id, holder, obj: wrapper as Object3D, hit, mats, flaps, phase: s.index * 1.7 }
}
function dropPlant(world: World, s: SlotNode) {
  dropInsect(world, s)
  if (!s.plant) return
  s.plant.obj.removeFromParent()
  const t = world.tiers[s.tier]
  t.mats = t.mats.filter((m) => !s.plant!.mats.includes(m))
  s.plant.mats.forEach((m) => m.dispose())
  s.plant = null
}
function syncSlots(world: World, models: GameModels, inp: SyncInput) {
  const potById = new Map(inp.pots.map((p) => [p.id, p]))
  for (const list of world.slots) for (const s of list) {
    const t = world.tiers[s.tier]
    const owned = potById.get(inp.placed[slotKey(s.tier, s.index)] ?? '')
    const kind = owned && potKindById.get(owned.kind)
    const key = kind ? `${kind.id}:${owned!.level}` : ''
    // Chậu
    if ((s.pot?.key ?? '') !== key) {
      dropPlant(world, s)
      if (s.pot) {
        s.pot.obj.removeFromParent()
        t.mats = t.mats.filter((m) => !s.pot!.mats.includes(m))
        s.pot.mats.forEach((m) => m.dispose())
        s.pot = null
      }
      if (kind) {
        const obj = makePot(models, kind, owned!.level)
        const mats = cloneMaterials(obj)
        const holder = new Group()
        ;(obj.getObjectByName(`${kind.model}_DiemCay`) ?? obj).add(holder)
        s.group.add(obj)
        t.mats.push(...mats)
        const pb = visibleBox(obj, s.group)
        s.pot = { key, kind: kind.id, obj, mats, holder, rim: pb.max.y, radius: Math.max(0.3, (pb.max.x - pb.min.x) / 2 * 0.85) }
      }
      s.top = s.pot ? s.pot.rim : 0.5
    }
    // Cây trong chậu (mọi tầng)
    const v = s.pot ? inp.views[slotKey(s.tier, s.index)] : undefined
    if (s.plant && s.plant.crop !== v?.crop) { dropPlant(world, s); s.top = s.pot ? s.pot.rim : 0.5 }
    const tpl = v && PLANT_NODE[v.crop] ? models.plants.scene.getObjectByName(`Cay_${PLANT_NODE[v.crop]}`) : null
    if (v && tpl && s.pot) {
      if (!s.plant) {
        const obj = tpl.clone(true)
        obj.position.set(0, 0, 0)
        obj.scale.multiplyScalar(plantFit(v.crop, s.pot.kind))
        const mats = cloneMaterials(obj)
        s.pot.holder.add(obj)
        t.mats.push(...mats)
        s.plant = { crop: v.crop, obj, mats, stage: -1 }
      }
      if (s.plant.stage !== v.stage) {
        for (const c of s.plant.obj.children) c.visible = c.name.endsWith(`_GD${v.stage}`)
        s.plant.stage = v.stage
        s.top = Math.max(s.pot.rim, visibleBox(s.group, s.group).max.y)
      }
      // Côn trùng
      if (s.insect && s.insect.id !== v.insect) dropInsect(world, s)
      if (v.insect && !s.insect) s.insect = makeInsect(world, models, v.insect, s)
    }
    // Chậu xem trước (mờ) ở chỗ đang chọn
    const m = inp.mode
    const pv = m.kind === 'place' && s.tier === inp.tier && m.slot === s.index && !s.pot ? m.preview : null
    const pk = pv && potKindById.get(pv.kind)
    const gkey = pk ? `${pk.id}:${pv!.level}` : ''
    if ((s.ghost?.key ?? '') !== gkey) {
      if (s.ghost) { s.ghost.obj.removeFromParent(); s.ghost = null }
      if (pk) {
        const obj = makePot(models, pk, pv!.level)
        cloneMaterials(obj, (c) => { c.transparent = true; c.opacity = 0.55; c.depthWrite = false })
        s.group.add(obj)
        s.ghost = { key: gkey, obj }
      }
    }
    // Vòng chỗ trống: tầng đang xem (đã mở khoá), chỗ chưa có chậu; chỗ đang xem trước chậu thì ẩn vòng
    s.ring.visible = !s.pot && !s.ghost && s.tier === inp.tier && inp.tierOpen
  }
}

// ---- Trạng thái camera dùng chung giữa phần nhận chạm (HTML) và phần vẽ (trong Canvas) ----
interface Cam {
  theta: number; phi: number; radius: number; target: Vector3 // giá trị mong muốn
  cur: { theta: number; phi: number; radius: number; target: Vector3 } // giá trị đang hiển thị (làm mượt)
  tween: { from: Vector3; to: Vector3; fromR: number; toR: number; t: number } | null
  tier: number
  r0: number // khoảng cách mặc định của tầng đang xem (vừa khung)
  aspect: number
  fresh: boolean // chưa đặt khoảng cách ban đầu
  focus: Object3D | null // đang đặt chậu: giữ chỗ này ở vùng trống bên trái-trên (không bị danh sách / bảng che)
}
const PHI_MIN = 0.35 // gần nhìn thẳng từ trên xuống
const PHI_MAX = 1.32 // gần ngang mặt mây (không chui xuống dưới)
const VFOV = 40
const HALF = (VFOV * Math.PI) / 360
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

function fitRadius(t: TierInfo, aspect: number) {
  const hfov = Math.atan(Math.tan(HALF) * aspect)
  const halfW = (Math.max(t.sizeX, t.sizeZ) / 2) * 1.08
  return Math.max(halfW / Math.tan(hfov), (t.sizeZ / 2) / Math.tan(HALF)) + 1.2
}
function clampCam(c: Cam, tiers: TierInfo[]) {
  const t = tiers[c.tier]
  c.phi = Math.max(PHI_MIN, Math.min(PHI_MAX, c.phi))
  if (!c.tween) {
    c.radius = Math.max(c.r0 * 0.4, Math.min(c.r0 * 1.3, c.radius))
    if (c.focus) return
    const mx = t.sizeX * 0.3, mz = t.sizeZ * 0.3
    c.target.x = Math.max(t.center.x - mx, Math.min(t.center.x + mx, c.target.x))
    c.target.z = Math.max(t.center.z - mz, Math.min(t.center.z + mz, c.target.z))
    c.target.y = t.center.y
  }
}

function CameraRig({ cam, world, grab }: { cam: React.MutableRefObject<Cam>; world: World; grab: React.MutableRefObject<Camera | null> }) {
  const { camera, size } = useThree()
  const tiers = world.tiers
  const ray = useMemo(() => new Ray(), [])
  const hit = useMemo(() => new Vector3(), [])
  const fp = useMemo(() => new Vector3(), [])
  useEffect(() => {
    grab.current = camera
    const c = cam.current; const pc = camera as PerspectiveCamera
    pc.fov = VFOV; pc.updateProjectionMatrix()
    c.aspect = size.width / size.height
    c.r0 = fitRadius(tiers[c.tier], c.aspect)
    if (c.fresh) { c.radius = c.r0; c.cur.radius = c.r0; c.fresh = false }
  }, [camera, size, tiers, cam, grab])
  useFrame(({ clock }, dt) => {
    const c = cam.current
    const pulse = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 2.6) // vòng chỗ trống nhấp nháy chậm
    world.ringMat.opacity = 0.45 + 0.5 * pulse
    world.glowMat.opacity = 0.03 + 0.09 * pulse
    world.slots[c.tier].forEach((s) => { s.ring.rotation.y = clock.elapsedTime * 0.25 })
    if (c.tween) {
      c.tween.t = Math.min(1, c.tween.t + dt / 0.8)
      const k = ease(c.tween.t)
      c.target.copy(c.tween.from).lerp(c.tween.to, k)
      c.radius = c.tween.fromR + (c.tween.toR - c.tween.fromR) * k
      if (c.tween.t >= 1) c.tween = null
    } else if (c.focus) {
      // chỗ đang đặt nằm ở khoảng 1/3 trái, hơi cao: dời tâm nhìn sang phải + về phía camera
      c.focus.getWorldPosition(fp)
      const halfH = c.radius * Math.tan(HALF), halfW = halfH * c.aspect
      c.target.set(
        fp.x + Math.cos(c.theta) * halfW * 0.4 + Math.sin(c.theta) * halfH * 0.3,
        fp.y,
        fp.z - Math.sin(c.theta) * halfW * 0.4 + Math.cos(c.theta) * halfH * 0.3,
      )
    }
    clampCam(c, tiers)
    const s = 1 - Math.exp(-dt * (c.focus ? 6 : 12))
    c.cur.theta += (c.theta - c.cur.theta) * s
    c.cur.phi += (c.phi - c.cur.phi) * s
    c.cur.radius += (c.radius - c.cur.radius) * (c.tween ? 1 : s)
    c.cur.target.lerp(c.target, c.tween ? 1 : s)
    const { theta, phi, radius, target } = c.cur
    camera.position.set(
      target.x + radius * Math.sin(phi) * Math.sin(theta),
      target.y + radius * Math.cos(phi),
      target.z + radius * Math.sin(phi) * Math.cos(theta),
    )
    camera.lookAt(target)
    // Làm mờ: tầng đang xem rõ; tầng khác mờ; tầng nào nằm giữa camera và tầng đang xem thì gần trong suốt
    ray.origin.copy(camera.position); ray.direction.copy(target).sub(camera.position).normalize()
    const dist = camera.position.distanceTo(target)
    tiers.forEach((t, i) => {
      let want = 1
      if (i !== c.tier) {
        const p = ray.intersectBox(t.box, hit)
        want = p && camera.position.distanceTo(p) < dist ? 0.1 : 0.38
      }
      t.opacity += (want - t.opacity) * (1 - Math.exp(-dt * 8))
      const transparent = t.opacity < 0.995
      for (const m of t.mats) {
        if (m.transparent !== transparent) { m.transparent = transparent; m.needsUpdate = true }
        m.opacity = t.opacity
        m.depthWrite = !transparent
      }
    })
  })
  return null
}

function WorldView({ root }: { root: Group }) {
  const bases = useMemo(() => root.children.map((o) => o.position.y), [root])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    root.children.forEach((o, i) => { o.position.y = bases[i] + Math.sin(t * 0.6 + i * 1.7) * 0.1 })
  })
  return <primitive object={root} />
}

const HOLD_MS = 500
const BAG_SCALE = 0.85
const BAG_LIFT = 70 // px: túi nổi phía trên ngón tay khi kéo (không bị ngón tay che)
const BAG_REACH = 60 // px: ngón tay cách chậu trống bao nhiêu thì tính là lướt qua chậu đó

// ---- Túi hạt giống: 1 mô hình, tô màu thân theo cây, nhãn = icon cây vẽ to bằng canvas ----
function labelTexture(crop: string) {
  const c = document.createElement('canvas'); c.width = c.height = 256
  const g = c.getContext('2d')!
  const tex = new CanvasTexture(c)
  tex.flipY = false; tex.colorSpace = SRGBColorSpace
  const paint = (img?: HTMLImageElement) => {
    g.fillStyle = '#f6ecd6'; g.fillRect(0, 0, 256, 256)
    if (img) { const S = 256 * 1.18; g.drawImage(img, (256 - S) / 2, (256 - S) / 2, S, S) } // cây vẽ TO, tràn mép
    g.strokeStyle = '#966e46'; g.lineWidth = 8; g.strokeRect(4, 4, 248, 248)
    tex.needsUpdate = true
  }
  paint()
  const img = new Image(); img.onload = () => paint(img); img.src = cropImage(crop)
  return tex
}
function makeBag(models: GameModels, crop: string) {
  const obj = models.bag.scene.getObjectByName('TuiHat')!.clone(true)
  obj.position.set(0, 0, 0); obj.scale.setScalar(BAG_SCALE)
  const color = new Color(cropById.get(crop)?.bag ?? '#e5e7eb')
  const tex = labelTexture(crop)
  const mats = cloneMaterials(obj, (m) => {
    const mm = m as Material & { color?: Color; map?: unknown }
    if (m.name === 'TuiHat_Than') mm.color?.copy(color)
    else if (m.name === 'TuiHat_Mieng') mm.color?.copy(color).multiplyScalar(0.62)
    else if (m.name === 'TuiHat_Nhan') { (mm as unknown as { map: CanvasTexture }).map = tex; mm.color?.set(0xffffff); m.needsUpdate = true }
  })
  return { crop, obj, mats, tex }
}
type Bag = ReturnType<typeof makeBag>

export interface BagState { crop: string; slot: number } // túi đang lơ lửng trên chậu `slot` của tầng đang xem
interface Badge { index: number; icon: string }

// Hoạt cảnh mỗi khung hình: côn trùng bay / bò, huy hiệu đi theo cây, túi hạt bay theo ngón tay / về chậu
function Live({ world, tier, badgeEls, bagRef, bagDrag, camRef }: {
  world: World
  tier: number
  badgeEls: React.MutableRefObject<Map<number, HTMLDivElement>>
  bagRef: React.MutableRefObject<{ bag: Bag | null; slot: number }>
  bagDrag: React.MutableRefObject<{ on: boolean; point: Vector3 }>
  camRef: React.MutableRefObject<Camera | null>
}) {
  const { camera, size } = useThree()
  const v = useMemo(() => new Vector3(), [])
  const q = useMemo(() => new Quaternion(), [])
  const zAxis = useMemo(() => new Vector3(0, 0, 1), [])
  const bagGroup = useMemo(() => new Group(), [])
  useEffect(() => { camRef.current = camera }, [camera, camRef])
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime
    for (const list of world.slots) for (const s of list) {
      const ins = s.insect
      if (!ins || !s.pot) continue
      const fly = INSECT_NODE[ins.id]?.fly
      const a = t * (fly ? 1.1 : 0.45) + ins.phase
      const r = fly ? s.pot.radius + 0.25 : s.pot.radius * 0.92
      const y = fly ? Math.max(s.pot.rim + 0.3, s.top * 0.75) + Math.sin(t * 2.3 + ins.phase) * 0.12 : s.pot.rim + 0.02
      ins.holder.position.set(Math.cos(a) * r, y, Math.sin(a) * r)
      ins.holder.rotation.y = -a // mặt côn trùng (+Z) hướng theo chiều bay
      const [fs, fa] = INSECT_NODE[ins.id]?.flap ?? [38, 0.7]
      for (const f of ins.flaps) f.o.quaternion.copy(f.q).multiply(q.setFromAxisAngle(zAxis, Math.sin(t * fs + ins.phase) * fa * f.sign))
    }
    // Huy hiệu: chiếu đỉnh cây của tầng đang xem ra màn hình
    for (const [index, el] of badgeEls.current) {
      const s = world.slots[tier]?.[index]
      if (!s) continue
      s.group.localToWorld(v.set(0, s.top + 0.12, 0)).project(camera)
      const behind = v.z > 1
      el.style.transform = `translate(${((v.x + 1) / 2) * size.width}px, ${((1 - v.y) / 2) * size.height}px) translate(-50%, -100%)`
      el.style.opacity = behind ? '0' : '1'
    }
    // Túi hạt
    const b = bagRef.current
    if (b.bag) {
      if (b.bag.obj.parent !== bagGroup) bagGroup.add(b.bag.obj)
      const s = world.slots[tier]?.[b.slot]
      if (bagDrag.current.on) v.copy(bagDrag.current.point)
      else if (s) s.group.localToWorld(v.set(0, s.top + 0.5, 0))
      const k = 1 - Math.exp(-dt * (bagDrag.current.on ? 18 : 6))
      if (b.bag.obj.position.lengthSq() === 0) b.bag.obj.position.copy(v)
      b.bag.obj.position.lerp(v, k)
      b.bag.obj.position.y += Math.sin(t * 2.2) * 0.004
      b.bag.obj.rotation.set(Math.sin(t * 1.3) * 0.08, Math.atan2(camera.position.x - b.bag.obj.position.x, camera.position.z - b.bag.obj.position.z) + Math.sin(t * 0.9) * 0.25, Math.sin(t * 1.7) * 0.06)
    }
  })
  return <primitive object={bagGroup} />
}

export default function TierScene({ models, tier, tierOpen, toLocal, plants, pots, placed, now, mode, bag, onSlotTap, onPotTap, onPotHold, onEmptyTap, onBagOver, onBagRelease }: {
  models: GameModels
  tier: number
  tierOpen: boolean // tầng đang xem đã mở khoá
  toLocal: (cx: number, cy: number) => { x: number; y: number }
  plants: Record<string, Plant> // cây trong chậu (đã gộp các chậu vừa gieo, chưa ghi xong)
  pots: OwnedPot[]
  placed: Record<string, string>
  now: number
  mode: SceneMode
  bag: BagState | null
  onSlotTap: (slot: number) => void // chạm chỗ trống (vòng nét đứt, tầng đang xem)
  onPotTap: (slot: number, insect: boolean) => void // chạm chậu đã đặt / cây (insect = chạm trúng côn trùng)
  onPotHold: (slot: number) => void // nhấn giữ chậu đã đặt
  onEmptyTap: () => void // chạm chỗ khác
  onBagOver: (slot: number) => void // đang kéo túi hạt lướt qua chậu trống
  onBagRelease: () => void // thả túi hạt
}) {
  const world = useMemo(() => buildWorld(models), [models])
  // Trạng thái từng cây (tính lại mỗi giây, chỉ dựng lại khi có thay đổi)
  const views: Record<string, PlantView> = {}
  for (const [k, p] of Object.entries(plants)) {
    const st = plantState(p, now)
    if (st?.crop) views[k] = { crop: st.crop.id, stage: st.stage, insect: st.insect, ripe: st.ripe, thirsty: st.thirsty }
  }
  const pv = mode.kind === 'place' ? mode.preview : null
  const key = [
    tier, tierOpen, mode.kind, mode.kind === 'place' ? `${mode.slot}:${pv?.kind}:${pv?.level}` : mode.kind === 'move' ? mode.from : '',
    JSON.stringify(placed), pots.map((p) => `${p.id}${p.kind}${p.level}`).join(','),
    Object.entries(views).map(([k, v]) => `${k}${v.crop}${v.stage}${v.insect}`).join(','),
  ].join('|')
  useEffect(() => { syncSlots(world, models, { pots, placed, views, tier, tierOpen, mode }) }, [key, world]) // eslint-disable-line react-hooks/exhaustive-deps
  const viewsRef = useRef(views); viewsRef.current = views

  // Huy hiệu trên cây của tầng đang xem: 🧺 chín, 💧 cần tưới
  const badges: Badge[] = []
  if (tierOpen) for (let i = 0; i < SLOTS[tier].length; i++) {
    const v = placed[slotKey(tier, i)] ? views[slotKey(tier, i)] : undefined
    if (v?.ripe) badges.push({ index: i, icon: '🧺' })
    else if (v?.thirsty && v.stage > 0) badges.push({ index: i, icon: '💧' })
  }
  const badgeEls = useRef(new Map<number, HTMLDivElement>())

  // Túi hạt: dựng lại khi đổi loại cây
  const bagRef = useRef<{ bag: Bag | null; slot: number }>({ bag: null, slot: 0 })
  const bagDrag = useRef({ on: false, point: new Vector3(), over: new Set<number>() })
  const bagCrop = bag?.crop ?? null
  useEffect(() => {
    if (!bagCrop) return
    const b = makeBag(models, bagCrop)
    bagRef.current.bag = b
    return () => {
      b.obj.removeFromParent(); b.mats.forEach((m) => m.dispose()); b.tex.dispose()
      if (bagRef.current.bag === b) bagRef.current.bag = null
      bagDrag.current.on = false
    }
  }, [bagCrop, models])
  if (bag) bagRef.current.slot = bag.slot

  const cam = useRef<Cam>(null as unknown as Cam)
  if (!cam.current) {
    const t = world.tiers[tier]
    cam.current = {
      theta: 0, phi: 1.0, radius: 12, target: t.center.clone(),
      cur: { theta: 0, phi: 1.0, radius: 12, target: t.center.clone() },
      tween: null, tier, r0: 12, aspect: 2, fresh: true, focus: null,
    }
  }
  // Đổi tầng: bay tới tầng mới, giữ góc xoay, khoảng cách về mức vừa khung của tầng mới
  useEffect(() => {
    const c = cam.current
    if (c.tier === tier) return
    const ratio = c.radius / c.r0   // giữ mức phóng to tương đối khi sang tầng khác
    c.tier = tier
    const t = world.tiers[tier]
    const newR0 = fitRadius(t, c.aspect)
    c.tween = { from: c.target.clone(), to: t.center.clone(), fromR: c.radius, toR: newR0 * Math.max(0.6, Math.min(1.2, ratio)), t: 0 }
    c.r0 = newR0
  }, [tier, world])
  // Đang đặt chậu / chọn hạt: camera lại gần + giữ chỗ đó ở vùng trống bên trái-trên; xong thì tâm nhìn tự về lại trong tầng
  const focusSlot = mode.kind === 'place' || mode.kind === 'seed' ? mode.slot : -1
  const prevRadius = useRef(0)
  useEffect(() => {
    const c = cam.current
    if (focusSlot < 0) {
      if (c.focus) { c.focus = null; c.radius = prevRadius.current } // đặt xong / huỷ: trả lại khoảng cách cũ
      return
    }
    if (!c.focus) prevRadius.current = c.radius
    c.focus = world.slots[tier][focusSlot]?.group ?? null
    c.radius = Math.min(c.radius, c.r0 * 0.62)
  }, [focusSlot, tier, world])

  // ---- Chạm vào chỗ đặt / chậu / côn trùng / túi hạt (tia từ camera) ----
  const camRef = useRef<Camera | null>(null)
  const raycaster = useMemo(() => new Raycaster(), [])
  const el = useRef<HTMLDivElement>(null)
  const latest = useRef({ tier, onSlotTap, onPotTap, onPotHold, onEmptyTap, onBagOver, onBagRelease, bagOn: !!bag })
  latest.current = { tier, onSlotTap, onPotTap, onPotHold, onEmptyTap, onBagOver, onBagRelease, bagOn: !!bag }
  const ndc = (p: { x: number; y: number }) => {
    const box = el.current!
    return new Vector2((p.x / box.clientWidth) * 2 - 1, -(p.y / box.clientHeight) * 2 + 1)
  }
  const shown = (o: Object3D | null) => { for (; o; o = o.parent) if (!o.visible) return false; return true }
  function pick(p: { x: number; y: number }): { s: SlotNode; insect: boolean } | null {
    const camera = camRef.current
    if (!camera || !el.current) return null
    raycaster.setFromCamera(ndc(p), camera)
    const list = world.slots[latest.current.tier]
    // côn trùng trước (khối cầu vô hình quanh con)
    for (const h of raycaster.intersectObjects(list.flatMap((s) => (s.insect ? [s.insect.hit] : [])), false)) {
      const s = list.find((x) => x.insect?.hit === h.object)
      if (s) return { s, insect: true }
    }
    // chỗ có chậu: chạm đúng hình chậu / cây (bỏ lớp đang ẩn); chỗ trống: khối dẹt quanh vòng
    const hits = raycaster.intersectObjects(list.map((s) => (s.pot ? s.pot.obj : s.hit)), true)
    for (const h of hits) {
      if (!shown(h.object)) continue
      let o: Object3D | null = h.object
      while (o && !list.some((s) => s.group === o)) o = o.parent
      const s = list.find((x) => x.group === o)
      if (s) return { s, insect: false }
    }
    return null
  }
  function hitBag(p: { x: number; y: number }) {
    const b = bagRef.current.bag; const camera = camRef.current
    if (!b || !camera || !el.current) return false
    raycaster.setFromCamera(ndc(p), camera)
    if (raycaster.intersectObject(b.obj, true).length) return true
    // chạm gần túi (trong 40px) cũng tính
    const v = b.obj.getWorldPosition(new Vector3()).project(camera)
    const sx = ((v.x + 1) / 2) * el.current.clientWidth, sy = ((1 - v.y) / 2) * el.current.clientHeight
    return Math.hypot(sx - p.x, sy - p.y) < 40
  }
  const plane = useMemo(() => new Plane(new Vector3(0, 1, 0), 0), [])
  // Đang kéo túi: túi đi theo ngón tay (cao hơn ngón tay BAG_LIFT px), lướt qua chậu trống nào thì gieo chậu đó
  function dragBag(p: { x: number; y: number }) {
    const camera = camRef.current; const box = el.current
    if (!camera || !box) return
    const t = world.tiers[latest.current.tier]
    plane.constant = -(t.center.y + 1.0)
    raycaster.setFromCamera(ndc({ x: p.x, y: p.y - BAG_LIFT }), camera)
    raycaster.ray.intersectPlane(plane, bagDrag.current.point)
    const v = new Vector3()
    let best: SlotNode | null = null; let bestD = BAG_REACH
    for (const s of world.slots[latest.current.tier]) {
      if (!s.pot || viewsRef.current[slotKey(s.tier, s.index)] || bagDrag.current.over.has(s.index)) continue
      s.group.localToWorld(v.set(0, s.pot.rim, 0)).project(camera)
      const d = Math.hypot(((v.x + 1) / 2) * box.clientWidth - p.x, ((1 - v.y) / 2) * box.clientHeight - p.y)
      if (d < bestD) { bestD = d; best = s }
    }
    if (best) { bagDrag.current.over.add(best.index); latest.current.onBagOver(best.index) }
  }

  // ---- Nhận chạm (toạ độ đã đổi về khung ngang) ----
  const pts = useRef(new Map<number, { x: number; y: number }>())
  const gest = useRef({ dragging: false, multi: false, held: false, bag: false, timer: 0, sx: 0, sy: 0, dist: 0, mid: null as { x: number; y: number } | null })
  const two = () => { const [a, b] = [...pts.current.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y), m: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } } }
  function onDown(e: React.PointerEvent) {
    try { (e.target as Element).setPointerCapture?.(e.pointerId) } catch { /* con trỏ không giữ được (vd sự kiện giả lập): vẫn xử lý bình thường */ }
    const p = toLocal(e.clientX, e.clientY); pts.current.set(e.pointerId, p)
    const g = gest.current
    window.clearTimeout(g.timer)
    if (pts.current.size === 1) {
      g.dragging = false; g.multi = false; g.held = false; g.sx = p.x; g.sy = p.y
      // bắt đầu trên túi hạt = kéo túi (không xoay camera)
      g.bag = latest.current.bagOn && hitBag(p)
      if (g.bag) { bagDrag.current.on = true; bagDrag.current.over = new Set(); dragBag(p); return }
      // nhấn giữ chậu đã đặt
      g.timer = window.setTimeout(() => {
        if (pts.current.size !== 1 || g.dragging || g.multi) return
        const h = pick({ x: g.sx, y: g.sy })
        if (h?.s.pot && !h.insect) { g.held = true; latest.current.onPotHold(h.s.index) }
      }, HOLD_MS)
    }
    if (pts.current.size === 2) {
      if (g.bag) { g.bag = false; bagDrag.current.on = false; latest.current.onBagRelease() }
      const t = two(); g.dist = t.d; g.mid = t.m; g.dragging = true; g.multi = true
    }
  }
  function onMove(e: React.PointerEvent) {
    const prev = pts.current.get(e.pointerId); if (!prev) return
    const p = toLocal(e.clientX, e.clientY); pts.current.set(e.pointerId, p)
    const c = cam.current; const g = gest.current; const h = el.current?.clientHeight || 400
    if (g.held) return
    if (g.bag) { dragBag(p); return }
    if (pts.current.size === 1) {
      if (!g.dragging && Math.hypot(p.x - g.sx, p.y - g.sy) > 8) { g.dragging = true; window.clearTimeout(g.timer) } // chạm nhanh không tính là xoay
      if (!g.dragging) return
      c.theta -= ((p.x - prev.x) / h) * Math.PI * 1.1
      c.phi -= ((p.y - prev.y) / h) * Math.PI * 0.9
    } else if (pts.current.size === 2 && g.mid) {
      const t = two()
      if (t.d > 0 && g.dist > 0) c.radius *= g.dist / t.d
      if (!c.focus) {
        const k = (2 * c.radius * Math.tan(HALF)) / h
        const dx = t.m.x - g.mid.x, dy = t.m.y - g.mid.y
        c.target.x -= (Math.cos(c.theta) * dx - Math.sin(c.theta) * dy) * k
        c.target.z -= (-Math.sin(c.theta) * dx - Math.cos(c.theta) * dy) * k
      }
      g.dist = t.d; g.mid = t.m
    }
  }
  function onUp(e: React.PointerEvent) {
    const had = pts.current.has(e.pointerId)
    pts.current.delete(e.pointerId)
    const g = gest.current
    if (pts.current.size === 1) { const [p] = [...pts.current.values()]; g.sx = p.x; g.sy = p.y; g.mid = null }
    if (pts.current.size === 0) {
      window.clearTimeout(g.timer)
      if (g.bag) { g.bag = false; bagDrag.current.on = false; latest.current.onBagRelease(); return }
      // chạm nhanh 1 ngón: côn trùng / chậu / chỗ trống / chỗ khác
      if (had && e.type === 'pointerup' && !g.dragging && !g.multi && !g.held) {
        const h = pick({ x: g.sx, y: g.sy })
        if (h?.s.pot) latest.current.onPotTap(h.s.index, h.insect)
        else if (h && h.s.ring.visible) latest.current.onSlotTap(h.s.index)
        else latest.current.onEmptyTap()
      }
      g.dragging = false
    }
  }
  function onWheel(e: React.WheelEvent) { cam.current.radius *= Math.exp(e.deltaY * 0.0015) }

  return (
    <div ref={el} className="absolute inset-0 touch-none" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onWheel={onWheel}>
      <Canvas dpr={[1, 1.75]} resize={{ offsetSize: true }} camera={{ fov: VFOV, near: 0.1, far: 300, position: [0, 8, 14] }} gl={{ antialias: true }}>
        <Sky />
        <Stars />
        <Moon />
        <hemisphereLight args={[new Color(0.75, 0.78, 1.0), new Color(0.55, 0.3, 0.6), 1.1]} />
        <directionalLight position={[8, 20, -20]} intensity={1.6} color={new Color(0.8, 0.86, 1.0)} />
        <directionalLight position={[-12, 10, 14]} intensity={1.1} color={new Color(0.78, 0.66, 1.0)} />
        <directionalLight position={[-4, 9, -18]} intensity={0.8} color={new Color(0.95, 0.7, 1.0)} />
        <pointLight position={[0, -6, 6]} intensity={60} distance={30} color={new Color(1.0, 0.55, 0.85)} />
        <WorldView root={world.root} />
        <Sparkles />
        <CameraRig cam={cam} world={world} grab={camRef} />
        <Live world={world} tier={tier} badgeEls={badgeEls} bagRef={bagRef} bagDrag={bagDrag} camRef={camRef} />
      </Canvas>
      {/* Huy hiệu trên cây (vị trí cập nhật mỗi khung hình trong Live) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {badges.map((b) => (
          <div
            key={`${tier}-${b.index}`}
            ref={(d) => { if (d) badgeEls.current.set(b.index, d); else badgeEls.current.delete(b.index) }}
            className="absolute top-0 left-0"
            style={{ opacity: 0 }}
          >
            {/* lớp trong mới nhảy (animation transform không đè lên vị trí của lớp ngoài) */}
            <div
              data-round
              className={`flex h-8 w-8 items-center justify-center rounded-full border border-white/50 shadow-lg shadow-black/40 ${
                b.icon === '🧺' ? 'animate-bounce bg-gradient-to-br from-amber-300/90 to-orange-500/90' : 'bg-gradient-to-br from-sky-400/90 to-blue-600/90'
              }`}
            >
              <Icon3D emoji={b.icon} className="h-5 w-5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
