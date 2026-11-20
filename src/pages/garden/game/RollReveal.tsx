import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import {
  AdditiveBlending,
  AmbientLight,
  DirectionalLight,
  PointLight,
  BackSide,
  Box3,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  Group,
  LineBasicMaterial,
  LineSegments,
  MeshBasicMaterial,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  PMREMGenerator,
  ShaderMaterial,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { LineIcon } from '../../../components/ui/Fab'
import { GLASS_ROUND } from './glass'

// Hiệu ứng LÚC VỪA BẤM QUAY (xem "Hiệu ứng lúc vừa bấm quay" trong CLAUDE.md):
// 1. Màn hình tối, mặt trăng hiện dần, từ ngoài khung trôi vào.
// 2. Loé sáng → cục roll đã nằm giữa màn hình, sao bắt đầu sáng.
// 3. Thẳng hàng: trăng trôi ra sau cục roll, hành tinh đen trôi ra trước quả cầu sáng; tia dài dần, rung, kính nứt; màu gợi ý (xanh → có thể nâng tím).
// 4. Thẳng hàng xong thì kính TỰ VỠ (không cần chạm), ánh sáng theo màu món hiếm nhất (xanh / tím + vòng sóng / vàng = nhật thực).
// Chiều sâu 3D: camera bay vòng nhẹ quanh cục roll (trăng / sao / bụi sáng trượt lệch nhau), cục roll nghiêng 3/4, kính + hành tinh phản chiếu
// môi trường (RoomEnvironment), viền kính sáng theo góc nhìn (fresnel), mảnh kính có độ dày.
// 5. 1 hoặc 10 điểm sáng bay ra theo màu từng món → gọi onDone.
// Mọi chuyển động tính theo thời gian trong 1 useFrame; lớp HTML (loé sáng, tối, chữ) đổi style trực tiếp, không render lại React mỗi khung hình.

export type Rarity = 'blue' | 'purple' | 'gold'
export type RollKind = 'sao_duyen' | 'vong_tinh'

const ROLL_MODEL = '/models/cuc-roll.glb'
const RARITY_RGB: Record<Rarity, [number, number, number]> = {
  blue: [0.35, 0.68, 1.0],
  purple: [0.74, 0.42, 1.0],
  gold: [1.0, 0.74, 0.24],
}
const RARITY_CSS: Record<Rarity, string> = { blue: '89,173,255', purple: '189,107,255', gold: '255,189,61' }
const RANK: Record<Rarity, number> = { blue: 0, purple: 1, gold: 2 }
const WHITE = new Color(1, 1, 1)
const GLOW_PARTS = ['Loi', 'Quang', 'Quang2', 'Quang3', 'Tia', 'Dom']

// Mốc thời gian (giây)
const T_MOON0 = 0.3 // trăng bắt đầu trôi vào
const T_ALIGN0 = 2.9 // hành tinh bắt đầu trôi ra trước quả cầu
const T_ALIGN1 = 5.4 // trăng + hành tinh thẳng hàng xong (trăng trôi 1 mạch từ T_MOON0 tới đây, không dừng)
const T_UPGRADE = 4.3 // lúc nâng màu xanh → tím (nếu có)
const T_BREAK = T_ALIGN1 + 0.55 // kính tự vỡ

const ROLL_SCALE = 3.2
// Camera bay vòng: góc quanh trục đứng + độ cao + khoảng cách theo thời gian
function camAt(t: number, out: Vector3) {
  const k = smooth(0, T_BREAK, t)
  const after = Math.max(0, t - T_BREAK)
  const a = -0.62 + 0.86 * k + after * 0.05
  const h = 1.5 - 1.15 * k
  const r = 7.6 - 1.2 * k + after * 0.12
  return out.set(Math.sin(a) * r, h, Math.cos(a) * r)
}
const MOON_R = 3
const HALO_R = 6.5 // bán kính phần quầng sáng thấy rõ quanh trăng
const MOON_DIST = 47 // trăng ở rất xa: vị trí tính theo khung nhìn (không bị lệch khi camera bay vòng)
const UP = new Vector3(0, 1, 0)

const smooth = (a: number, b: number, t: number) => {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)))
  return x * x * (3 - 2 * x)
}
function seeded(seed: number) {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
}
function dotTexture(ring = false) {
  const size = 128
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  if (ring) {
    g.addColorStop(0, 'rgba(255,255,255,0)')
    g.addColorStop(0.42, 'rgba(255,255,255,0)')
    g.addColorStop(0.5, 'rgba(255,255,255,1)')
    g.addColorStop(0.62, 'rgba(255,255,255,0.35)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
  } else {
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.15, 'rgba(255,255,255,0.8)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
  }
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  return new CanvasTexture(c)
}

// Kịch bản của 1 lượt quay: màu gợi ý lúc thẳng hàng, có nâng màu không
function plan(items: Rarity[], seed: number) {
  const top = items.reduce<Rarity>((a, b) => (RANK[b] > RANK[a] ? b : a), 'blue')
  const rnd = seeded(seed)
  // tím: 50% bắt đầu xanh rồi nâng tím; vàng: gợi ý xanh hoặc tím (nâng tím giữa chừng 50%), tới lúc vỡ mới thành vàng
  let hint0: Rarity = 'blue'
  let hint1: Rarity = 'blue'
  if (top === 'purple') {
    hint0 = rnd() < 0.5 ? 'blue' : 'purple'
    hint1 = 'purple'
  } else if (top === 'gold') {
    hint0 = 'blue'
    hint1 = rnd() < 0.5 ? 'purple' : 'blue'
  }
  return { top, hint0, hint1 }
}

interface Shared {
  t0: number // lúc bắt đầu (clock)
  breakAt: number | null // lúc kính vỡ (giây tính từ t0)
  flash: HTMLDivElement | null
  dark: HTMLDivElement | null
  done: boolean
  sky: number // độ sáng bầu trời hiện tại (0–1), theo phần trăng đã lọt vào màn hình
}

// ---------- Nền trời: gradient + sao, độ sáng điều khiển được ----------
function makeSky() {
  return new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    uniforms: { uBright: { value: 0 } },
    vertexShader: `varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying vec3 vDir; uniform float uBright;
      void main() {
        float t = clamp((vDir.y + 0.45) / 0.8, 0.0, 1.0);
        vec3 horizon = vec3(0.16, 0.06, 0.28);
        vec3 mid = vec3(0.06, 0.05, 0.22);
        vec3 zenith = vec3(0.006, 0.01, 0.06);
        vec3 col = t < 0.3 ? mix(horizon, mid, t / 0.3) : mix(mid, zenith, (t - 0.3) / 0.7);
        gl_FragColor = vec4(pow(col, vec3(0.75)) * uBright, 1.0);
      }`,
  })
}
function makeStars(count: number) {
  const rnd = seeded(42)
  const pos = new Float32Array(count * 3)
  const ph = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    const a = rnd() * Math.PI * 2
    const y = rnd() * 2 - 1
    const r = Math.sqrt(1 - y * y)
    pos.set([Math.cos(a) * r * 80, y * 80, Math.sin(a) * r * 80 - 20], i * 3)
    ph[i] = rnd() * Math.PI * 2
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(pos, 3))
  geo.setAttribute('aPhase', new BufferAttribute(ph, 1))
  const mat = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uMap: { value: dotTexture() }, uOn: { value: 0 }, uPx: { value: 1 } },
    vertexShader: `attribute float aPhase; uniform float uTime; uniform float uOn; uniform float uPx; varying float vAlpha;
      void main() {
        // mỗi sao bật sáng ở 1 thời điểm riêng khi uOn tăng dần
        float on = clamp((uOn - fract(aPhase * 1.7)) * 4.0, 0.0, 1.0);
        vAlpha = on * (0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * 1.3 + aPhase * 7.0)));
        gl_PointSize = (1.8 + fract(aPhase * 3.7) * 2.8) * uPx;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `uniform sampler2D uMap; varying float vAlpha;
      void main() { gl_FragColor = vec4(vec3(1.0, 0.97, 0.9), texture2D(uMap, gl_PointCoord).a * vAlpha); }`,
  })
  return { geo, mat }
}

// ---------- Vết nứt trên mặt trước khối kính (toạ độ cục bộ của khối) ----------
function makeCracks(center: Vector3, half: Vector3, seed: number) {
  const rnd = seeded(seed)
  const segs: number[] = []
  const z = center.z + half.z + 0.003
  const o = { x: center.x + (rnd() - 0.5) * half.x * 0.5, y: center.y + (rnd() - 0.5) * half.y * 0.5 }
  const inside = (x: number, y: number) => Math.abs(x - center.x) < half.x * 0.97 && Math.abs(y - center.y) < half.y * 0.97
  const branch = (x: number, y: number, a: number, len: number, depth: number) => {
    let px = x
    let py = y
    const steps = 5
    for (let i = 0; i < steps; i++) {
      a += (rnd() - 0.5) * 0.7
      const nx = px + Math.cos(a) * (len / steps)
      const ny = py + Math.sin(a) * (len / steps)
      if (!inside(nx, ny)) break
      segs.push(px, py, z, nx, ny, z)
      if (depth < 2 && rnd() < 0.3) branch(nx, ny, a + (rnd() < 0.5 ? 1 : -1) * (0.6 + rnd() * 0.5), len * 0.45, depth + 1)
      px = nx
      py = ny
    }
  }
  const n = 8
  for (let i = 0; i < n; i++) branch(o.x, o.y, (i / n) * Math.PI * 2 + rnd() * 0.5, half.x * (1.1 + rnd() * 0.8), 0)
  // vòng nứt quanh tâm
  for (let i = 0; i < 10; i++) {
    const a0 = (i / 10) * Math.PI * 2
    const a1 = a0 + Math.PI / 5
    const r = half.x * (0.18 + rnd() * 0.06)
    segs.push(o.x + Math.cos(a0) * r, o.y + Math.sin(a0) * r, z, o.x + Math.cos(a1) * r, o.y + Math.sin(a1) * r, z)
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(new Float32Array(segs), 3))
  geo.setDrawRange(0, 0)
  const mat = new LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false })
  return { lines: new LineSegments(geo, mat), count: segs.length / 3 }
}

// ---------- Mảnh kính vỡ ----------
interface Shard {
  mesh: Mesh
  vel: Vector3
  spin: Vector3
}
function makeShards(center: Vector3, half: Vector3, seed: number, tint: Color, camLocal: Vector3) {
  const rnd = seeded(seed)
  const mat = new MeshStandardMaterial({
    color: 0xffffff,
    emissive: tint.clone().multiplyScalar(0.3),
    roughness: 0.04,
    metalness: 0.25,
    envMapIntensity: 2.2,
    transparent: true,
    opacity: 0.75,
    side: DoubleSide,
    depthWrite: false,
  })
  const shards: Shard[] = []
  for (let i = 0; i < 42; i++) {
    const s = 0.05 + rnd() * 0.09
    // mảnh kính là lăng trụ tam giác có độ dày (bắt sáng ở cạnh)
    const tri = [[0, 0], [s * (0.6 + rnd()), s * (rnd() - 0.5)], [s * (rnd() - 0.3), s * (0.6 + rnd())]]
    const th = 0.008 + rnd() * 0.008
    const V = (i: number, z: number) => [tri[i][0], tri[i][1], z]
    const faces = [
      [V(0, th), V(1, th), V(2, th)], [V(0, -th), V(2, -th), V(1, -th)],
      [V(0, th), V(0, -th), V(1, -th)], [V(0, th), V(1, -th), V(1, th)],
      [V(1, th), V(1, -th), V(2, -th)], [V(1, th), V(2, -th), V(2, th)],
      [V(2, th), V(2, -th), V(0, -th)], [V(2, th), V(0, -th), V(0, th)],
    ]
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(new Float32Array(faces.flat(2)), 3))
    geo.computeVertexNormals()
    const m = new Mesh(geo, mat)
    // điểm ngẫu nhiên trên bề mặt khối
    const axis = Math.floor(rnd() * 3)
    const v = new Vector3((rnd() * 2 - 1) * half.x, (rnd() * 2 - 1) * half.y, (rnd() * 2 - 1) * half.z)
    v.setComponent(axis, (rnd() < 0.5 ? -1 : 1) * half.getComponent(axis))
    if (rnd() < 0.55) v.z = half.z // dồn nhiều mảnh ra mặt trước cho thấy rõ
    m.position.copy(center).add(v)
    m.rotation.set(rnd() * 6, rnd() * 6, rnd() * 6)
    const vel = v.clone().normalize().multiplyScalar(0.9 + rnd() * 1.6)
    vel.z += 0.6 + rnd() * 0.8
    // vài mảnh bay sượt qua sát camera
    if (i % 6 === 0) vel.add(camLocal.clone().sub(m.position).normalize().multiplyScalar(1.6 + rnd()).add(new Vector3((rnd() - 0.5) * 0.8, (rnd() - 0.5) * 0.6, 0)))
    shards.push({ mesh: m, vel, spin: new Vector3(rnd() * 8 - 4, rnd() * 8 - 4, rnd() * 8 - 4) })
  }
  return { shards, mat }
}

// ---------- Bụi sáng lơ lửng nhiều lớp xa gần (thấy rõ chiều sâu khi camera bay vòng) ----------
function makeDust(count: number) {
  const rnd = seeded(77)
  const pos = new Float32Array(count * 3)
  const ph = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    const a = rnd() * Math.PI * 2
    const y = rnd() * 2 - 1
    const r = 1.6 + rnd() ** 1.5 * 9
    const q = Math.sqrt(1 - y * y)
    pos.set([Math.cos(a) * q * r, y * r * 0.6, Math.sin(a) * q * r - 1.5], i * 3)
    ph[i] = rnd() * Math.PI * 2
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(pos, 3))
  geo.setAttribute('aPhase', new BufferAttribute(ph, 1))
  const mat = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uMap: { value: dotTexture() }, uOn: { value: 0 }, uPx: { value: 1 }, uTint: { value: new Color(1, 0.92, 0.75) } },
    vertexShader: `attribute float aPhase; uniform float uTime; uniform float uPx; uniform float uOn; varying float vA;
      void main() {
        vec3 p = position + vec3(sin(uTime * 0.3 + aPhase) * 0.25, sin(uTime * 0.45 + aPhase * 2.0) * 0.3 + uTime * 0.04, cos(uTime * 0.35 + aPhase) * 0.25);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vA = uOn * (0.25 + 0.75 * (0.5 + 0.5 * sin(uTime * 1.7 + aPhase * 5.0)));
        gl_PointSize = uPx * (0.6 + fract(aPhase * 2.3) * 1.4) * 24.0 / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform sampler2D uMap; uniform vec3 uTint; varying float vA;
      void main() { gl_FragColor = vec4(uTint, texture2D(uMap, gl_PointCoord).a * vA); }`,
  })
  return { geo, mat }
}

function RollStage({ kind, items, shared, seed }: { kind: RollKind; items: Rarity[]; shared: Shared; seed: number }) {
  const gltf = useLoader(GLTFLoader, ROLL_MODEL, (l) => l.setMeshoptDecoder(MeshoptDecoder))
  const { camera, gl, scene } = useThree()
  const sc = useMemo(() => plan(items, seed), [items, seed])

  const built = useMemo(() => {
    const prefix = kind === 'vong_tinh' ? 'Roll_VongTinh' : 'Roll_SaoDuyen'
    const src = gltf.scene.getObjectByName(prefix)!
    const roll = src.clone(true)
    roll.position.set(0, 0, 0)
    // vật liệu riêng (không đụng bản gốc của bộ nhớ đệm)
    const mats: Record<string, MeshStandardMaterial> = {}
    // phần phát sáng (lõi, quầng, tia, đốm): vật liệu tự sáng, không chịu đèn / phản chiếu → giữ đúng màu gợi ý
    const glows: Record<string, MeshBasicMaterial> = {}
    roll.traverse((o) => {
      const m = o as Mesh
      if (!m.isMesh) return
      const key = o.name.replace(prefix + '_', '')
      const src = m.material as MeshStandardMaterial
      if (GLOW_PARTS.includes(key)) {
        const gm = new MeshBasicMaterial({ color: src.emissive.clone(), transparent: src.transparent, opacity: src.opacity, depthWrite: !src.transparent, toneMapped: false, side: src.side })
        if (key !== 'Loi') gm.blending = AdditiveBlending
        m.material = gm
        glows[key] = gm
      } else {
        m.material = src.clone()
        mats[key] = m.material as MeshStandardMaterial
      }
    })
    const part = (n: string) => roll.getObjectByName(`${prefix}_${n}`) as Object3D
    const vo = part('Vo')
    const box = new Box3().setFromObject(vo)
    const center = box.getCenter(new Vector3())
    const half = box.getSize(new Vector3()).multiplyScalar(0.5)
    const pivot = new Group() // tâm khối ở gốc toạ độ, phóng to
    roll.position.copy(center).multiplyScalar(-1)
    pivot.add(roll)
    pivot.scale.setScalar(ROLL_SCALE)
    pivot.visible = false
    const planet = part('HanhTinh')
    const ring = part('VanhHT')
    const loi = part('Loi')
    const planetR = new Box3().setFromObject(planet).getSize(new Vector3()).x / 2 / planet.scale.x
    const loiR = new Box3().setFromObject(loi).getSize(new Vector3()).x / 2
    const cr = makeCracks(center, half, seed + 3)
    roll.add(cr.lines)
    const baseColor = (glows.Loi?.color ?? new Color(1, 1, 1)).clone()
    // kính: phản chiếu môi trường + viền sáng theo góc nhìn (fresnel): giữa trong, cạnh / mép đục sáng → thấy rõ khối lập phương
    const glass = mats.Vo
    if (glass) {
      glass.roughness = 0.07
      glass.metalness = 0
      glass.envMapIntensity = 1.3
      glass.transparent = true
      glass.opacity = 1
      glass.depthWrite = false
      glass.side = DoubleSide
      glass.onBeforeCompile = (sh) => {
        sh.fragmentShader = sh.fragmentShader.replace(
          '#include <opaque_fragment>',
          `#include <opaque_fragment>
          float fres = pow(1.0 - abs(dot(normalize(vViewPosition), normal)), 2.2);
          gl_FragColor.a = mix(0.04, 0.5, fres);`,
        )
      }
    }
    const dark = mats.HanhTinh
    if (dark) {
      dark.roughness = 0.12
      dark.metalness = 0.45
      dark.envMapIntensity = 1.8
    }
    return {
      pivot,
      roll,
      mats,
      glows,
      vo,
      planet,
      ring,
      loi,
      center,
      half,
      planetR,
      loiR,
      cracks: cr,
      baseColor,
      planet0: planet.position.clone(),
      ring0: ring.position.clone(),
      planetS0: planet.scale.x,
      ringS0: ring.scale.x,
      tia: part('Tia'),
      quang: [part('Quang'), part('Quang2'), part('Quang3')],
      quangS: [part('Quang'), part('Quang2'), part('Quang3')].map((q) => q.scale.clone()),
      tiaS: part('Tia').scale.clone(),
    }
  }, [gltf, kind, seed])

  const sky = useMemo(makeSky, [])
  const stars = useMemo(() => makeStars(600), [])
  const dust = useMemo(() => makeDust(260), [])
  const glow = useMemo(() => dotTexture(), [])
  const ringTex = useMemo(() => dotTexture(true), [])
  const moon = useRef<Group>(null)
  const moonGlow = useRef<SpriteMaterial | null>(null)
  const moonMat = useRef<MeshBasicMaterial | null>(null)
  const moonLight = useRef<DirectionalLight>(null)
  const keyLight = useRef<DirectionalLight>(null)
  const ambient = useRef<AmbientLight>(null)
  const fillLight = useRef<PointLight>(null)
  const fx = useMemo(() => {
    const wave = new Sprite(new SpriteMaterial({ map: ringTex, transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending }))
    const corona = new Sprite(new SpriteMaterial({ map: ringTex, color: new Color(1, 0.8, 0.35), transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending }))
    const burst = new Sprite(new SpriteMaterial({ map: glow, transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending }))
    // điểm sáng bay ra: 1 / 10
    const rnd = seeded(seed + 9)
    const dots = items.map((r, i) => {
      const s = new Sprite(new SpriteMaterial({ map: glow, color: new Color(...RARITY_RGB[r]), transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending, toneMapped: false }))
      const a = items.length === 1 ? Math.PI / 2 : (i / items.length) * Math.PI * 2 + rnd() * 0.3
      const d = new Vector3(Math.cos(a) * 2.6, Math.sin(a) * 1.5, 0.5 + rnd())
      return { s, d, r }
    })
    return { wave, corona, burst, dots }
  }, [ringTex, glow, items, seed])
  const shardSet = useRef<ReturnType<typeof makeShards> | null>(null)

  // môi trường phản chiếu cho kính / hành tinh / mảnh vỡ (không hiện làm nền)
  useEffect(() => {
    const pm = new PMREMGenerator(gl)
    const env = pm.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = env
    return () => {
      scene.environment = null
      env.dispose()
      pm.dispose()
    }
  }, [gl, scene])

  useEffect(() => {
    camAt(0, camera.position)
    camera.lookAt(0, 0, 0)
    scene.add(built.pivot, fx.wave, fx.corona, fx.burst, ...fx.dots.map((d) => d.s))
    return () => {
      scene.remove(built.pivot, fx.wave, fx.corona, fx.burst, ...fx.dots.map((d) => d.s))
      if (shardSet.current) shardSet.current.shards.forEach((s) => scene.remove(s.mesh))
    }
  }, [built, fx, camera, scene])

  const tmp = useMemo(() => ({ v: new Vector3(), w: new Vector3(), cam: new Vector3(), f: new Vector3(), r: new Vector3(), u: new Vector3(), d: new Vector3(), c: new Color(), c2: new Color() }), [])

  useFrame(({ clock }, delta) => {
    if (shared.t0 < 0) shared.t0 = clock.elapsedTime
    const t = clock.elapsedTime - shared.t0
    const b = built
    stars.mat.uniforms.uTime.value = clock.elapsedTime
    stars.mat.uniforms.uPx.value = gl.getPixelRatio()
    dust.mat.uniforms.uTime.value = clock.elapsedTime
    dust.mat.uniforms.uPx.value = gl.getPixelRatio()
    // camera bay vòng nhẹ
    const CAM_POS = camAt(t, tmp.cam)
    camera.position.copy(CAM_POS)
    camera.lookAt(0, 0, 0)
    // kính tự vỡ khi thẳng hàng xong
    if (shared.breakAt === null && t >= T_BREAK) shared.breakAt = T_BREAK

    // 1. Trăng trôi 1 MẠCH từ ngoài mép phải vào tới đúng sau quả cầu (không dừng giữa chừng).
    //    Bầu trời / sao / bụi sáng dần theo PHẦN DIỆN TÍCH trăng đã lọt vào màn hình; cục roll có sẵn từ đầu.
    const align = smooth(T_ALIGN0, T_ALIGN1, t)
    // Trăng đi theo KHUNG NHÌN: (sx, sy) = độ lệch so với tâm màn hình (đơn vị tan góc nhìn).
    const pc = camera as PerspectiveCamera
    const fwd = tmp.f.copy(CAM_POS).multiplyScalar(-1).normalize()
    const right = tmp.r.crossVectors(fwd, UP).normalize()
    const up = tmp.u.crossVectors(right, fwd)
    const tanV = Math.tan((pc.fov * Math.PI) / 360)
    const tanH = tanV * pc.aspect
    b.loi.getWorldPosition(tmp.v)
    const dl = tmp.w.copy(tmp.v).sub(CAM_POS)
    const df = dl.dot(fwd)
    const bx = dl.dot(right) / df
    const by = dl.dot(up) / df
    const moonR = MOON_R / MOON_DIST // bán kính trăng (đơn vị tan góc nhìn)
    // đường cong Bezier bậc 2: điểm đầu ngay ngoài mép phải → điểm uốn ở góc trên bên phải → đúng sau quả cầu
    const x = Math.min(1, Math.max(0, (t - T_MOON0) / (T_ALIGN1 - T_MOON0)))
    // Tốc độ: đoạn đầu (trăng lọt dần vào màn hình, ~2,3 giây) đi CHẬM và ĐỀU để trời sáng từ từ;
    // sau đó tăng tốc mượt rồi chậm dần tới đúng chỗ thẳng hàng (vận tốc liền mạch, không khựng).
    const X_IN = 0.5 // phần thời gian dành cho đoạn trăng lọt vào
    const P_IN = 0.28 // phần đường đi của đoạn đó (quầng ló vào trước, rồi cả đĩa trăng vào trong màn hình)
    let p: number
    if (x <= X_IN) p = (P_IN * x) / X_IN
    else {
      // Hermite: từ (X_IN, P_IN, dốc P_IN / X_IN) tới (1, 1, dốc 0)
      const u = (x - X_IN) / (1 - X_IN)
      const m0 = (P_IN / X_IN) * (1 - X_IN)
      p = (2 * u ** 3 - 3 * u ** 2 + 1) * P_IN + (u ** 3 - 2 * u ** 2 + u) * m0 + (-2 * u ** 3 + 3 * u ** 2) * 1
    }
    const s0x = tanH + moonR * 1.15 + 0.06 // lúc đầu chỉ phần quầng sáng chạm mép phải màn hình
    const s0y = tanV * 0.5
    const cx = tanH * 0.62
    const cy = tanV * 0.62
    const q = 1 - p
    const sx = q * q * s0x + 2 * q * p * cx + p * p * bx
    const sy = q * q * s0y + 2 * q * p * cy + p * p * by
    if (moon.current) moon.current.position.copy(CAM_POS).addScaledVector(tmp.d.copy(fwd).addScaledVector(right, sx).addScaledVector(up, sy).normalize(), MOON_DIST)
    // phần diện tích trăng nằm trong màn hình (lấy mẫu 7×7 điểm trên đĩa trăng)
    // phần diện tích nằm trong màn hình của 1 đĩa tròn tâm (sx, sy) bán kính r (lấy mẫu 7×7 điểm)
    const onScreen = (r: number) => {
      let inside = 0
      let total = 0
      for (let i = -3; i <= 3; i++)
        for (let j = -3; j <= 3; j++) {
          if (i * i + j * j > 9.5) continue
          total++
          if (Math.abs(sx + (i / 3) * r) <= tanH && Math.abs(sy + (j / 3) * r) <= tanV) inside++
        }
      return inside / total
    }
    // Quầng sáng của trăng to hơn đĩa trăng nên ló vào mép màn hình TRƯỚC: khu vực trăng sắp xuất hiện sáng hơn chỗ khác,
    // trăng vào tới đâu thì đã có sẵn viền sáng quanh nó. Bầu trời sáng theo cả quầng (40%) lẫn đĩa trăng (60%).
    const target = 0.4 * onScreen(HALO_R / MOON_DIST) + 0.6 * onScreen(moonR)
    shared.sky += (target - shared.sky) * Math.min(1, delta * 6)
    const lit = shared.sky
    const lit2 = lit * lit // cục roll chỉ rõ dần khi trăng đã vào nhiều (lúc trăng mới ló thì gần như chìm trong tối)
    if (moonMat.current) moonMat.current.opacity = 1
    // quầng có mặt từ đầu (hiện dần trong 0,6 giây cho khỏi giật), dịu lại khi trăng nằm sau cục roll
    if (moonGlow.current) moonGlow.current.opacity = 0.6 * smooth(0, 0.6, t) * (1 - 0.6 * align)
    sky.uniforms.uBright.value = 0.06 + 0.94 * lit
    stars.mat.uniforms.uOn.value = lit * 1.3
    dust.mat.uniforms.uOn.value = lit
    // ánh trăng chiếu lên cục roll: đèn đặt theo hướng trăng, mạnh dần theo độ sáng trời → vệt sáng trượt trên mặt kính khi trăng di chuyển
    if (moonLight.current) {
      moonLight.current.position.copy(moon.current ? moon.current.position : CAM_POS)
      moonLight.current.intensity = 3.2 * lit2
    }
    if (ambient.current) ambient.current.intensity = 0.5 * lit2
    if (keyLight.current) keyLight.current.intensity = 1.4 * lit2
    if (fillLight.current) fillLight.current.intensity = 6 * lit2
    // trời còn tối thì cục roll chìm trong bóng tối: kính chỉ hiện khi có ánh trăng chiếu vào
    scene.environmentIntensity = lit2 // phản chiếu môi trường của MỌI vật (kính, hành tinh, vành, mảnh vỡ) theo ánh trăng
    if (b.mats.Vo) {
      b.mats.Vo.envMapIntensity = 1.4 * lit2
      b.mats.Vo.emissiveIntensity = lit2
    }
    b.cracks.lines.material.opacity = 0.85 * lit2
    if (b.mats.HanhTinh) b.mats.HanhTinh.envMapIntensity = 1.8 * lit2
    b.pivot.visible = true
    const bt = shared.breakAt === null ? null : t - shared.breakAt

    // 3. Thẳng hàng: hành tinh trôi ra trước quả cầu; xoay nhẹ tắt dần để giữ thẳng hàng
    // nghiêng 3/4 (thấy 3 mặt kính), lật chậm, dịu dần khi thẳng hàng
    const sway = 1 - align * 0.7
    if (bt === null) {
      b.pivot.rotation.y = 0.55 + Math.sin(t * 0.55) * 0.35 * sway
      b.pivot.rotation.x = 0.32 + Math.sin(t * 0.43) * 0.12 * sway
      b.pivot.rotation.z = Math.sin(t * 0.37) * 0.06 * sway
      b.pivot.position.y = Math.sin(t * 1.2) * 0.06
    }
    // điểm trước quả cầu (toạ độ cục bộ của khối)
    const loiLocal = b.loi.position.clone()
    const camLocal = b.roll.worldToLocal(CAM_POS.clone())
    const front = loiLocal.clone().add(camLocal.sub(loiLocal).normalize().multiplyScalar(Math.min(b.half.z * 0.85, 0.22)))
    b.planet.position.lerpVectors(b.planet0, front, align)
    b.ring.position.lerpVectors(b.ring0, front, align)
    // rung + nứt dần
    const shakeA = bt === null ? align * 0.02 + smooth(T_ALIGN1, T_BREAK, t) * 0.03 : Math.max(0, 0.06 - bt * 0.3)
    b.pivot.position.x = (Math.sin(t * 43) + Math.sin(t * 61)) * shakeA * 0.5
    const crackP = bt === null ? 0.65 * smooth(T_ALIGN0 + 0.6, T_ALIGN1, t) + 0.3 * smooth(T_ALIGN1, T_BREAK, t) : Math.min(1, 0.95 + bt / 0.12)
    b.cracks.lines.geometry.setDrawRange(0, Math.floor((crackP * b.cracks.count) / 2) * 2)

    // màu gợi ý: banner → hint0 → (nâng) hint1; lúc vỡ → màu thật
    const hintCol = tmp.c.setRGB(...RARITY_RGB[sc.hint0])
    if (sc.hint1 !== sc.hint0) hintCol.lerp(tmp.c2.setRGB(...RARITY_RGB[sc.hint1]), smooth(T_UPGRADE, T_UPGRADE + 0.35, t))
    const light = tmp.c2.copy(b.baseColor).lerp(hintCol, smooth(T_ALIGN0, T_ALIGN0 + 1, t))
    if (bt !== null && bt > 0.12) light.setRGB(...RARITY_RGB[sc.top])
    for (const k of GLOW_PARTS) {
      const m = b.glows[k]
      if (!m) continue
      // lõi pha trắng nhẹ, các lớp còn lại đúng màu (không loá thành trắng)
      const glowK = lit2 * lit // lõi sáng lên SAU viền kính (chậm hơn 1 nhịp)
      if (k === 'Loi') m.color.copy(light).lerp(WHITE, 0.4).multiplyScalar(glowK)
      else m.color.copy(light).multiplyScalar((k === 'Tia' ? 1 : 0.85) * glowK)
    }
    if (b.mats.VanhHT) {
      b.mats.VanhHT.emissive.copy(light).multiplyScalar(lit2)
      b.mats.VanhHT.toneMapped = false
    }
    // tia dài dần + nhịp đập (tăng nhanh lúc nâng màu)
    const pulse = 1 + 0.06 * Math.sin(t * (6 + align * 6))
    const upKick = sc.hint1 !== sc.hint0 ? smooth(T_UPGRADE, T_UPGRADE + 0.15, t) * (1 - smooth(T_UPGRADE + 0.15, T_UPGRADE + 0.7, t)) * 0.5 : 0
    const rayK = (1 + align * 0.7 + upKick) * pulse
    b.tia.scale.copy(b.tiaS).multiplyScalar(rayK)
    b.tia.rotation.y = t * 0.4
    b.quang.forEach((q, i) => q.scale.copy(b.quangS[i]).multiplyScalar(1 + align * 0.35 * (i + 1) * 0.6 + upKick))

    // 4. Vỡ kính
    if (bt !== null) {
      const S = 0.12
      if (bt >= S && b.vo.visible) {
        b.vo.visible = false
        b.cracks.lines.visible = false
        const ss = makeShards(b.center, b.half, seed + 5, new Color(...RARITY_RGB[sc.top]), b.roll.worldToLocal(CAM_POS.clone()))
        ss.shards.forEach((s) => b.roll.add(s.mesh))
        shardSet.current = ss
      }
      const ss = shardSet.current
      if (ss) {
        const dt = Math.min(0.05, delta)
        ss.shards.forEach((s) => {
          s.mesh.position.addScaledVector(s.vel, dt)
          s.vel.y -= 1.6 * dt
          s.mesh.rotation.x += s.spin.x * dt
          s.mesh.rotation.y += s.spin.y * dt
          s.mesh.rotation.z += s.spin.z * dt
        })
        ss.mat.opacity = 0.75 * (1 - smooth(S + 0.6, S + 1.8, bt))
      }
      b.loi.getWorldPosition(tmp.v)
      const top = sc.top
      const col = new Color(...RARITY_RGB[top])
      // quầng bùng
      fx.burst.position.copy(tmp.v)
      fx.burst.material.color.copy(col)
      const bk = smooth(S, S + 0.25, bt) * (1 - smooth(S + 0.4, S + 1.6, bt))
      fx.burst.material.opacity = top === 'gold' ? 0 : bk * 0.9
      fx.burst.scale.setScalar(2 + smooth(S, S + 1.2, bt) * 9)
      // tím: vòng sóng sáng lan ra
      if (top === 'purple') {
        fx.wave.position.copy(tmp.v)
        fx.wave.material.color.copy(col)
        const wk = smooth(S, S + 0.9, bt)
        fx.wave.scale.setScalar(1 + wk * 16)
        fx.wave.material.opacity = (1 - wk) * 0.9
      }
      // vàng: nhật thực — hành tinh phình ra che kín quả cầu, tối, rồi vành vàng bừng
      if (top === 'gold') {
        b.planet.getWorldPosition(tmp.w)
        const dPlanet = tmp.w.distanceTo(CAM_POS)
        const dLoi = tmp.v.distanceTo(CAM_POS)
        const need = ((b.loiR * 1.35) / b.planetR) * (dPlanet / dLoi)
        const ek = smooth(S, S + 0.33, bt)
        const sc_ = b.planetS0 + (Math.max(need, b.planetS0) - b.planetS0) * ek
        b.planet.scale.setScalar(sc_)
        b.ring.scale.setScalar(b.ringS0 * (sc_ / b.planetS0))
        const ck = smooth(0.85, 1.25, bt)
        fx.corona.position.copy(tmp.w).addScaledVector(tmp.w.clone().sub(CAM_POS).normalize(), 0.05)
        fx.corona.scale.setScalar(0.9 + ck * 1.2 + smooth(1.1, 2.4, bt) * 14)
        fx.corona.material.opacity = ck * (1 - smooth(1.6, 2.6, bt))
        fx.burst.position.copy(tmp.v)
        fx.burst.material.opacity = smooth(0.9, 1.15, bt) * (1 - smooth(1.4, 2.6, bt))
        fx.burst.scale.setScalar(3 + smooth(0.9, 2.2, bt) * 14)
      }
      // 5. Điểm sáng bay ra
      const p0 = top === 'gold' ? 1.9 : 1.0
      const pk = smooth(p0, p0 + 1.1, bt)
      fx.dots.forEach((d, i) => {
        const k = smooth(p0 + i * 0.05, p0 + 0.9 + i * 0.05, bt)
        d.s.position.copy(tmp.v).addScaledVector(d.d, k)
        d.s.material.opacity = Math.min(1, k * 3) * (1 - smooth(p0 + 1.4, p0 + 2.0, bt))
        d.s.scale.setScalar(d.r === 'gold' ? 1.1 : d.r === 'purple' ? 0.9 : 0.7)
      })
      if (pk >= 1 && bt > p0 + 2.0 && !shared.done) shared.done = true
      // khối roll mờ dần sau khi vỡ
      b.pivot.visible = bt < p0 + 0.6
    }

    // ---- lớp HTML: loé sáng / tối / chữ ----
    if (shared.flash) {
      let a = 0
      let rgb = '255,255,255'
      if (bt !== null) {
        const top = sc.top
        if (top === 'gold') {
          const g = smooth(0.95, 1.2, bt) * (1 - smooth(1.3, 2.4, bt))
          a = Math.max(a, g)
          rgb = '255,236,190'
        } else {
          a = Math.max(a, smooth(0.1, 0.22, bt) * (1 - smooth(0.3, 1.1, bt)) * (top === 'purple' ? 0.75 : 0.55))
          rgb = RARITY_CSS[top]
        }
      }
      shared.flash.style.opacity = String(a)
      shared.flash.style.background = `radial-gradient(circle at 50% 50%, rgba(${rgb},1) 0%, rgba(${rgb},0.85) 35%, rgba(${rgb},0.5) 100%)`
    }
    if (shared.dark) {
      // trước loé sáng: phủ tối nhẹ; vàng: tối hẳn lúc nhật thực
      let d = 0
      if (bt !== null && sc.top === 'gold') d = Math.max(d, 0.9 * smooth(0.15, 0.45, bt) * (1 - smooth(0.85, 1.0, bt)))
      shared.dark.style.opacity = String(d)
    }
  })

  return (
    <>
      <mesh material={sky} renderOrder={-2}>
        <sphereGeometry args={[90, 32, 16]} />
      </mesh>
      <points geometry={stars.geo} material={stars.mat} renderOrder={-1} />
      <points geometry={dust.geo} material={dust.mat} />
      <group ref={moon} position={[60, 15, -40]}>
        <mesh>
          <sphereGeometry args={[MOON_R, 32, 16]} />
          <meshBasicMaterial ref={moonMat} color={new Color(1.0, 0.96, 0.84)} transparent opacity={0} toneMapped={false} />
        </mesh>
        <sprite scale={[HALO_R * 2.8, HALO_R * 2.8, 1]}>
          <spriteMaterial ref={moonGlow} map={glow} color={new Color(0.85, 0.82, 1.0)} transparent opacity={0} depthWrite={false} blending={AdditiveBlending} />
        </sprite>
      </group>
      <ambientLight ref={ambient} intensity={0.06} />
      <directionalLight ref={keyLight} position={[3, 4, 6]} intensity={0} />
      <directionalLight ref={moonLight} position={[60, 15, -40]} intensity={0} color={new Color(0.82, 0.88, 1.0)} />
      <pointLight ref={fillLight} position={[0, 0.2, 1.5]} intensity={1.5} distance={8} color={new Color(1, 0.95, 0.85)} />
    </>
  )
}

// Màn hiệu ứng mở cục roll. Đặt bên trong LandscapeFrame (phủ kín khung game).
// items = độ hiếm của từng món (1 hoặc 10), onDone gọi khi hiệu ứng xong hoặc bấm Bỏ qua.
export function RollReveal({ kind, items, onDone }: { kind: RollKind; items: Rarity[]; onDone: () => void }) {
  const seed = useMemo(() => Math.floor(Math.random() * 1e9), [])
  const shared = useRef<Shared>({ t0: -1, breakAt: null, flash: null, dark: null, done: false, sky: 0 }).current
  const [finished, setFinished] = useState(false)
  useEffect(() => {
    const id = window.setInterval(() => {
      if (shared.done && !finished) {
        setFinished(true)
        onDone()
      }
    }, 100)
    return () => window.clearInterval(id)
  }, [shared, finished, onDone])

  return (
    <div className="absolute inset-0 z-50 bg-black">
      <Canvas camera={{ fov: 40, near: 0.1, far: 200 }} dpr={[1, 2]} resize={{ offsetSize: true }} gl={{ antialias: true }}>
        <Suspense fallback={null}>
          <RollStage kind={kind} items={items} shared={shared} seed={seed} />
        </Suspense>
      </Canvas>
      <div ref={(el) => void (shared.dark = el)} className="pointer-events-none absolute inset-0 bg-black" style={{ opacity: 0 }} />
      <div ref={(el) => void (shared.flash = el)} className="pointer-events-none absolute inset-0" style={{ opacity: 0 }} />
      <button
        type="button"
        onPointerUp={(e) => {
          e.stopPropagation()
          if (!finished) {
            setFinished(true)
            onDone()
          }
        }}
        data-round
        aria-label="Bỏ qua"
        className={`${GLASS_ROUND} absolute top-3 h-10 w-10`}
        style={{ right: 'calc(var(--safe-r, 0px) + 12px)' }}
      >
        <LineIcon icon="skip" className="h-5 w-5" />
      </button>
    </div>
  )
}
