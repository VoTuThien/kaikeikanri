import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  AdditiveBlending,
  Box3,
  Camera,
  Color,
  CylinderGeometry,
  Group,
  Material,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PerspectiveCamera,
  Ray,
  Raycaster,
  RingGeometry,
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
import { plotState, type Plot } from '../data/crops'
import { POT_SETS, potKindById, slotKey, type OwnedPot, type PotKind } from '../data/pots'
import { PLANT_NODE, plantFit, SLOTS } from './slots'

// Cảnh 3D của game Vườn mây: camera CHỈ NHÌN 1 TẦNG MÂY mỗi lúc (xem CLAUDE.md "Cơ chế hiển thị game"):
// - Đổi tầng bằng nút ▲ ▼ (GamePage); camera bay mượt ~0,8 giây, giữ nguyên góc xoay.
// - 1 ngón kéo = xoay quanh tầng; 2 ngón chụm / mở = phóng to / thu nhỏ; 2 ngón kéo = dời khung nhìn (giới hạn trong tầng); lăn chuột = zoom.
// - Giới hạn theo từng tầng: không chui xuống dưới mây, khoảng zoom theo cỡ tầng.
// - Tầng khác vẫn hiện nhưng mờ; tầng nào che tầng đang xem thì gần trong suốt.
// - Chậu ở các chỗ đặt cố định (`SLOTS`) theo `garden.placed`; chỗ trống của tầng đang xem có vòng nét đứt phát sáng nhấp nháy.
//   Chạm vòng = chọn chỗ đặt chậu, nhấn giữ chậu ~0,5 giây = menu Dời chỗ / Cất vào kho (GamePage lo giao diện).
// Bộ điều khiển camera tự viết (không dùng OrbitControls) vì khung game có thể đang xoay 90° → toạ độ chạm phải đổi qua `toLocal`.

// Mô hình chậu (mỗi bộ 1 file `POT_SETS[].file`, mỗi chậu có lớp trang trí `_Lv2…Lv6`) và cây trồng (mỗi cây 4 giai đoạn `_GD0…GD3`), xuất từ Blender có nén meshopt
const POT_FILES = [...new Set(POT_SETS.map((s) => s.file))]
const PLANT_MODEL = '/models/cay-trong.glb'

export interface GameModels {
  cloud: GLTF
  machines: GLTF
  pots: GLTF[] // theo thứ tự POT_FILES
  plants: GLTF
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
  const urls = [CLOUD_MODEL, MACHINE_MODEL, PLANT_MODEL, ...POT_FILES]
  const prog = urls.map(() => ({ loaded: 0, total: 1 }))
  const report = () => onProgress(prog.reduce((s, p) => s + Math.min(1, p.loaded / p.total), 0) / urls.length * 0.9)
  const bufs = await Promise.all(urls.map((u, i) => fetchWithProgress(u, (l, t) => { prog[i] = { loaded: l, total: t }; report() })))
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
  const [cloud, machines, plants, ...pots] = await Promise.all(bufs.map((b) => loader.parseAsync(b, '')))
  onProgress(1)
  cached = { cloud, machines, pots, plants }
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
  pot: { key: string; kind: string; obj: Object3D; mats: Material[]; holder: Group } | null
  plant: { crop: string; obj: Object3D; mats: Material[] } | null
  ghost: { key: string; obj: Object3D } | null
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
      return { tier: t, index, group, hit, ring, pot: null, plant: null, ghost: null }
    }),
  )
  root.updateMatrixWorld(true)
  return { root, tiers, slots, ringMat, glowMat }
}
type World = ReturnType<typeof buildWorld>

// ---- Đồng bộ chậu / cây / vòng chỗ trống / chậu xem trước theo dữ liệu vườn + chế độ ----
export interface PlotView { crop: string; stage: number }
export type SceneMode =
  | { kind: 'view' }
  | { kind: 'place'; slot: number; preview: OwnedPot | null } // đang chọn chậu cho chỗ trống `slot` của tầng đang xem
  | { kind: 'move'; from: number } // đang dời chậu ở chỗ `from` sang chỗ trống khác cùng tầng

interface SyncInput {
  pots: OwnedPot[]
  placed: Record<string, string>
  views: (PlotView | null)[]
  tier: number
  tierOpen: boolean
  mode: SceneMode
}
function dropPlant(world: World, s: SlotNode) {
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
        s.pot = { key, kind: kind.id, obj, mats, holder }
      }
    }
    // Cây (tầng 1: chỗ i ↔ ô đất i)
    const v = s.pot && s.tier === 0 ? inp.views[s.index] : null
    if (s.plant && s.plant.crop !== v?.crop) dropPlant(world, s)
    const tpl = v && PLANT_NODE[v.crop] ? models.plants.scene.getObjectByName(`Cay_${PLANT_NODE[v.crop]}`) : null
    if (v && tpl && s.pot) {
      if (!s.plant) {
        const obj = tpl.clone(true)
        obj.position.set(0, 0, 0)
        obj.scale.multiplyScalar(plantFit(v.crop, s.pot.kind))
        const mats = cloneMaterials(obj)
        s.pot.holder.add(obj)
        t.mats.push(...mats)
        s.plant = { crop: v.crop, obj, mats }
      }
      for (const c of s.plant.obj.children) c.visible = c.name.endsWith(`_GD${v.stage}`)
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

export default function TierScene({ models, tier, tierOpen, toLocal, plots, pots, placed, now, mode, onSlotTap, onPotHold, onEmptyTap }: {
  models: GameModels
  tier: number
  tierOpen: boolean // tầng đang xem đã mở khoá
  toLocal: (cx: number, cy: number) => { x: number; y: number }
  plots: Plot[]
  pots: OwnedPot[]
  placed: Record<string, string>
  now: number
  mode: SceneMode
  onSlotTap: (slot: number) => void // chạm chỗ trống (tầng đang xem)
  onPotHold: (slot: number) => void // nhấn giữ chậu đã đặt
  onEmptyTap: () => void // chạm chỗ khác (không phải chỗ trống)
}) {
  const world = useMemo(() => buildWorld(models), [models])
  // Giai đoạn của từng ô (tính lại mỗi giây, chỉ dựng lại khi có thay đổi)
  const views = plots.map((p) => { const st = plotState(p, now); return st?.crop ? { crop: st.crop.id, stage: st.stage } : null })
  const pv = mode.kind === 'place' ? mode.preview : null
  const key = [
    tier, tierOpen, mode.kind, mode.kind === 'place' ? `${mode.slot}:${pv?.kind}:${pv?.level}` : mode.kind === 'move' ? mode.from : '',
    JSON.stringify(placed), pots.map((p) => `${p.id}${p.kind}${p.level}`).join(','), views.map((v) => (v ? `${v.crop}${v.stage}` : '-')).join(','),
  ].join('|')
  useEffect(() => { syncSlots(world, models, { pots, placed, views, tier, tierOpen, mode }) }, [key, world]) // eslint-disable-line react-hooks/exhaustive-deps

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
  // Đang đặt chậu: camera lại gần + giữ chỗ đặt ở vùng trống bên trái-trên; xong thì tâm nhìn tự về lại trong tầng
  const focusSlot = mode.kind === 'place' ? mode.slot : -1
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

  // ---- Chạm vào chỗ đặt / chậu (tia từ camera) ----
  const camRef = useRef<Camera | null>(null)
  const raycaster = useMemo(() => new Raycaster(), [])
  const el = useRef<HTMLDivElement>(null)
  const latest = useRef({ tier, onSlotTap, onPotHold, onEmptyTap })
  latest.current = { tier, onSlotTap, onPotHold, onEmptyTap }
  function pick(p: { x: number; y: number }): SlotNode | null {
    const camera = camRef.current; const box = el.current
    if (!camera || !box) return null
    const ndc = new Vector2((p.x / box.clientWidth) * 2 - 1, -(p.y / box.clientHeight) * 2 + 1)
    raycaster.setFromCamera(ndc, camera)
    // chỗ có chậu: chạm đúng hình chậu / cây (bỏ lớp đang ẩn); chỗ trống: khối dẹt quanh vòng
    const list = world.slots[latest.current.tier]
    const shown = (o: Object3D | null) => { for (; o; o = o.parent) if (!o.visible) return false; return true }
    const hits = raycaster.intersectObjects(list.map((s) => (s.pot ? s.pot.obj : s.hit)), true)
    for (const h of hits) {
      if (!shown(h.object)) continue
      let o: Object3D | null = h.object
      while (o && !list.some((s) => s.group === o)) o = o.parent
      const s = list.find((x) => x.group === o)
      if (s) return s
    }
    return null
  }

  // ---- Nhận chạm (toạ độ đã đổi về khung ngang) ----
  const pts = useRef(new Map<number, { x: number; y: number }>())
  const gest = useRef({ dragging: false, multi: false, held: false, timer: 0, sx: 0, sy: 0, dist: 0, mid: null as { x: number; y: number } | null })
  const two = () => { const [a, b] = [...pts.current.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y), m: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } } }
  function onDown(e: React.PointerEvent) {
    try { (e.target as Element).setPointerCapture?.(e.pointerId) } catch { /* con trỏ không giữ được (vd sự kiện giả lập): vẫn xử lý bình thường */ }
    const p = toLocal(e.clientX, e.clientY); pts.current.set(e.pointerId, p)
    const g = gest.current
    window.clearTimeout(g.timer)
    if (pts.current.size === 1) {
      g.dragging = false; g.multi = false; g.held = false; g.sx = p.x; g.sy = p.y
      // nhấn giữ chậu đã đặt
      g.timer = window.setTimeout(() => {
        if (pts.current.size !== 1 || g.dragging || g.multi) return
        const s = pick({ x: g.sx, y: g.sy })
        if (s?.pot) { g.held = true; latest.current.onPotHold(s.index) }
      }, HOLD_MS)
    }
    if (pts.current.size === 2) { const t = two(); g.dist = t.d; g.mid = t.m; g.dragging = true; g.multi = true }
  }
  function onMove(e: React.PointerEvent) {
    const prev = pts.current.get(e.pointerId); if (!prev) return
    const p = toLocal(e.clientX, e.clientY); pts.current.set(e.pointerId, p)
    const c = cam.current; const g = gest.current; const h = el.current?.clientHeight || 400
    if (g.held) return
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
      // chạm nhanh 1 ngón: chỗ trống → chọn chỗ đặt; chỗ khác → báo chạm ra ngoài
      if (had && e.type === 'pointerup' && !g.dragging && !g.multi && !g.held) {
        const s = pick({ x: g.sx, y: g.sy })
        if (s && s.ring.visible) latest.current.onSlotTap(s.index)
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
      </Canvas>
    </div>
  )
}
