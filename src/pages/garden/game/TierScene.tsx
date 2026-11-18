import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Box3, Color, Group, Material, Mesh, Object3D, PerspectiveCamera, Ray, Vector3 } from 'three'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
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

// Cảnh 3D của game Vườn mây: camera CHỈ NHÌN 1 TẦNG MÂY mỗi lúc (xem CLAUDE.md "Cơ chế hiển thị game"):
// - Đổi tầng bằng nút ▲ ▼ (GamePage); camera bay mượt ~0,8 giây, giữ nguyên góc xoay.
// - 1 ngón kéo = xoay quanh tầng; 2 ngón chụm / mở = phóng to / thu nhỏ; 2 ngón kéo = dời khung nhìn (giới hạn trong tầng); lăn chuột = zoom.
// - Giới hạn theo từng tầng: không chui xuống dưới mây, khoảng zoom theo cỡ tầng.
// - Tầng khác vẫn hiện nhưng mờ; tầng nào che tầng đang xem thì gần trong suốt.
// Bộ điều khiển camera tự viết (không dùng OrbitControls) vì khung game có thể đang xoay 90° → toạ độ chạm phải đổi qua `toLocal`.

export interface GameModels {
  cloud: GLTF
  machines: GLTF
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
  const urls = [CLOUD_MODEL, MACHINE_MODEL]
  const prog = urls.map(() => ({ loaded: 0, total: 1 }))
  const report = () => onProgress(prog.reduce((s, p) => s + Math.min(1, p.loaded / p.total), 0) / urls.length * 0.9)
  const bufs = await Promise.all(urls.map((u, i) => fetchWithProgress(u, (l, t) => { prog[i] = { loaded: l, total: t }; report() })))
  const loader = new GLTFLoader()
  const [cloud, machines] = await Promise.all(bufs.map((b) => loader.parseAsync(b, '')))
  onProgress(1)
  cached = { cloud, machines }
  return cached
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
    // vật liệu riêng của tầng (mây + máy đứng trên tầng)
    const mats: Material[] = []
    node.traverse((o) => {
      const m = o as Mesh
      if (!m.isMesh) return
      const list = Array.isArray(m.material) ? m.material : [m.material]
      const cloned = list.map((x) => { const c = x.clone(); mats.push(c); return c })
      m.material = Array.isArray(m.material) ? cloned : cloned[0]
    })
    tiers.push({ node, center, sizeX: size.x, sizeZ: size.z, box, mats, opacity: 1 })
  }
  return { root, tiers }
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
}
const PHI_MIN = 0.35 // gần nhìn thẳng từ trên xuống
const PHI_MAX = 1.32 // gần ngang mặt mây (không chui xuống dưới)
const VFOV = 40
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

function fitRadius(t: TierInfo, aspect: number) {
  const half = (VFOV * Math.PI) / 360
  const hfov = Math.atan(Math.tan(half) * aspect)
  const halfW = (Math.max(t.sizeX, t.sizeZ) / 2) * 1.08
  return Math.max(halfW / Math.tan(hfov), (t.sizeZ / 2) / Math.tan(half)) + 1.2
}
function clampCam(c: Cam, tiers: TierInfo[]) {
  const t = tiers[c.tier]
  c.phi = Math.max(PHI_MIN, Math.min(PHI_MAX, c.phi))
  if (!c.tween) {
    c.radius = Math.max(c.r0 * 0.4, Math.min(c.r0 * 1.3, c.radius))
    const mx = t.sizeX * 0.3, mz = t.sizeZ * 0.3
    c.target.x = Math.max(t.center.x - mx, Math.min(t.center.x + mx, c.target.x))
    c.target.z = Math.max(t.center.z - mz, Math.min(t.center.z + mz, c.target.z))
    c.target.y = t.center.y
  }
}

function CameraRig({ cam, tiers }: { cam: React.MutableRefObject<Cam>; tiers: TierInfo[] }) {
  const { camera, size } = useThree()
  const ray = useMemo(() => new Ray(), [])
  const hit = useMemo(() => new Vector3(), [])
  useEffect(() => {
    const c = cam.current; const pc = camera as PerspectiveCamera
    pc.fov = VFOV; pc.updateProjectionMatrix()
    c.aspect = size.width / size.height
    c.r0 = fitRadius(tiers[c.tier], c.aspect)
    if (c.fresh) { c.radius = c.r0; c.cur.radius = c.r0; c.fresh = false }
  }, [camera, size, tiers, cam])
  useFrame((_, dt) => {
    const c = cam.current
    if (c.tween) {
      c.tween.t = Math.min(1, c.tween.t + dt / 0.8)
      const k = ease(c.tween.t)
      c.target.copy(c.tween.from).lerp(c.tween.to, k)
      c.radius = c.tween.fromR + (c.tween.toR - c.tween.fromR) * k
      if (c.tween.t >= 1) c.tween = null
    }
    clampCam(c, tiers)
    const s = 1 - Math.exp(-dt * 12)
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

function World({ root }: { root: Group }) {
  const bases = useMemo(() => root.children.map((o) => o.position.y), [root])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    root.children.forEach((o, i) => { o.position.y = bases[i] + Math.sin(t * 0.6 + i * 1.7) * 0.1 })
  })
  return <primitive object={root} />
}

export default function TierScene({ models, tier, toLocal }: {
  models: GameModels
  tier: number
  toLocal: (cx: number, cy: number) => { x: number; y: number }
}) {
  const world = useMemo(() => buildWorld(models), [models])
  const cam = useRef<Cam>(null as unknown as Cam)
  if (!cam.current) {
    const t = world.tiers[tier]
    cam.current = {
      theta: 0, phi: 1.0, radius: 12, target: t.center.clone(),
      cur: { theta: 0, phi: 1.0, radius: 12, target: t.center.clone() },
      tween: null, tier, r0: 12, aspect: 2, fresh: true,
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

  // ---- Nhận chạm (toạ độ đã đổi về khung ngang) ----
  const pts = useRef(new Map<number, { x: number; y: number }>())
  const gest = useRef<{ dragging: boolean; sx: number; sy: number; dist: number; mid: { x: number; y: number } | null }>({ dragging: false, sx: 0, sy: 0, dist: 0, mid: null })
  const el = useRef<HTMLDivElement>(null)
  const two = () => { const [a, b] = [...pts.current.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y), m: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } } }
  function onDown(e: React.PointerEvent) {
    try { (e.target as Element).setPointerCapture?.(e.pointerId) } catch { /* con trỏ không giữ được (vd sự kiện giả lập): vẫn xử lý bình thường */ }
    const p = toLocal(e.clientX, e.clientY); pts.current.set(e.pointerId, p)
    const g = gest.current
    if (pts.current.size === 1) { g.dragging = false; g.sx = p.x; g.sy = p.y }
    if (pts.current.size === 2) { const t = two(); g.dist = t.d; g.mid = t.m; g.dragging = true }
  }
  function onMove(e: React.PointerEvent) {
    const prev = pts.current.get(e.pointerId); if (!prev) return
    const p = toLocal(e.clientX, e.clientY); pts.current.set(e.pointerId, p)
    const c = cam.current; const g = gest.current; const h = el.current?.clientHeight || 400
    if (pts.current.size === 1) {
      if (!g.dragging && Math.hypot(p.x - g.sx, p.y - g.sy) > 8) g.dragging = true   // chạm nhanh không tính là xoay
      if (!g.dragging) return
      c.theta -= ((p.x - prev.x) / h) * Math.PI * 1.1
      c.phi -= ((p.y - prev.y) / h) * Math.PI * 0.9
    } else if (pts.current.size === 2 && g.mid) {
      const t = two()
      if (t.d > 0 && g.dist > 0) c.radius *= g.dist / t.d
      const k = (2 * c.radius * Math.tan((VFOV * Math.PI) / 360)) / h
      const dx = t.m.x - g.mid.x, dy = t.m.y - g.mid.y
      c.target.x -= (Math.cos(c.theta) * dx - Math.sin(c.theta) * dy) * k
      c.target.z -= (-Math.sin(c.theta) * dx - Math.cos(c.theta) * dy) * k
      g.dist = t.d; g.mid = t.m
    }
  }
  function onUp(e: React.PointerEvent) {
    pts.current.delete(e.pointerId)
    const g = gest.current
    if (pts.current.size === 1) { const [p] = [...pts.current.values()]; g.sx = p.x; g.sy = p.y; g.mid = null }
    if (pts.current.size === 0) g.dragging = false
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
        <World root={world.root} />
        <Sparkles />
        <CameraRig cam={cam} tiers={world.tiers} />
      </Canvas>
    </div>
  )
}
