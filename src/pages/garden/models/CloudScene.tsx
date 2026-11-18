import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  CanvasTexture,
  Color,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  ShaderMaterial,
  Vector3,
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

// Cảnh 3D "các tầng mây lơ lửng ban đêm" của app Vườn mây: xoay bằng 1 ngón, phóng to / thu nhỏ bằng 2 ngón (chuột: kéo + lăn).
// Hình khối mây dựng trong Blender (design/vuon-may/tang-may.blend) rồi xuất ra public/models/tang-may.glb (đã giảm đỉnh);
// 3 máy chế tạo xuất ra public/models/may-che-tao.glb; màu mây, trời sao, trăng, đốm sáng, ánh sáng vẽ bằng code. Tải riêng (lazy) cùng thư viện 3D.

export const CLOUD_MODEL = '/models/tang-may.glb'
// 3 máy chế tạo hình con vật (máy nhím, máy thỏ, máy mèo), cùng file Blender, xuất kèm vật liệu (giữ màu) và vị trí trên tầng mây.
// Bộ phận / tâm xoay / điểm mốc của từng máy: xem mục Vườn mây trong CLAUDE.md (để sau làm hoạt cảnh bằng code).
export const MACHINE_MODEL = '/models/may-che-tao.glb'
// Máy nào đứng trên tầng mây nào: gắn vào tầng đó để nhấp nhô theo mây
export const MACHINE_TIER: Record<string, string> = { May_Nhim: 'TangMay_1', May_Tho: 'TangMay_2', May_Meo: 'TangMay_3' }

// Tâm các tầng mây (toạ độ three.js, trục Y hướng lên): camera xoay quanh điểm này
const TARGET = new Vector3(0, 4.8, -3)

// ---- Màu mây theo độ cao cục bộ: đáy xanh tím -> giữa tím nhạt -> đỉnh trắng hơi hồng (giống vật liệu trong Blender) ----
const BOTTOM = new Color(0.22, 0.24, 0.75)
const MIDDLE = new Color(0.72, 0.62, 0.98)
const TOP = new Color(1.0, 0.95, 0.98)
const FROM_Y = -2.6
const TO_Y = 0.9

export function paintClouds(root: Group) {
  const material = new MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.92,
    metalness: 0,
    emissive: new Color(0.16, 0.12, 0.3),
    emissiveIntensity: 0.55,
  })
  const c = new Color()
  root.traverse((obj) => {
    const mesh = obj as Mesh
    if (!mesh.isMesh) return
    const pos = mesh.geometry.getAttribute('position') as BufferAttribute
    const colors = new Float32Array(pos.count * 3)
    for (let i = 0; i < pos.count; i++) {
      const t = Math.min(1, Math.max(0, (pos.getY(i) - FROM_Y) / (TO_Y - FROM_Y)))
      if (t < 0.5) c.copy(BOTTOM).lerp(MIDDLE, t / 0.5)
      else c.copy(MIDDLE).lerp(TOP, (t - 0.5) / 0.5)
      colors.set([c.r, c.g, c.b], i * 3)
    }
    mesh.geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
    mesh.material = material
  })
}

// Kính trong suốt (bồn kính máy nhím) xuất từ Blender là vật liệu "transmission": vẽ tốn thêm 1 lượt render, nặng trên iPhone cũ
// -> đổi thành kính trong suốt thường
export function lightenMaterials(root: Object3D) {
  root.traverse((obj) => {
    const mesh = obj as Mesh
    if (!mesh.isMesh) return
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      const mat = m as MeshPhysicalMaterial
      if (mat.transmission > 0) {
        mat.transmission = 0
        mat.transparent = true
        mat.opacity = 0.32
        mat.depthWrite = false
      }
    }
  })
}

// Các tầng mây nhấp nhô lên xuống nhẹ, mỗi tầng 1 nhịp riêng; các máy chế tạo đứng trên tầng của mình nên nhấp nhô theo
function Clouds() {
  const [cloudGltf, machineGltf] = useLoader(GLTFLoader, [CLOUD_MODEL, MACHINE_MODEL])
  const root = useMemo(() => {
    const scene = cloudGltf.scene.clone(true)
    paintClouds(scene) // tô màu mây TRƯỚC khi gắn máy (máy giữ màu của nó)
    const machines = machineGltf.scene.clone(true)
    lightenMaterials(machines)
    scene.updateMatrixWorld(true)
    machines.updateMatrixWorld(true)
    for (const [machine, tier] of Object.entries(MACHINE_TIER)) {
      const m = machines.getObjectByName(machine)
      const t = scene.getObjectByName(tier)
      if (m && t) t.attach(m) // giữ nguyên vị trí trong không gian, chỉ đổi cha
    }
    return scene
  }, [cloudGltf, machineGltf])
  const bases = useMemo(() => root.children.map((o) => o.position.y), [root])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    root.children.forEach((o, i) => {
      o.position.y = bases[i] + Math.sin(t * 0.6 + i * 1.7) * 0.12
    })
  })
  return <primitive object={root} />
}

// ---- Bầu trời: quả cầu lớn tô gradient (chân trời tím -> đỉnh xanh đậm) ----
export function Sky() {
  const material = useMemo(
    () =>
      new ShaderMaterial({
        side: BackSide,
        depthWrite: false,
        uniforms: {},
        vertexShader: `varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `varying vec3 vDir;
          void main() {
            float t = clamp((vDir.y + 0.45) / 0.8, 0.0, 1.0);
            vec3 horizon = vec3(0.16, 0.06, 0.28);
            vec3 mid = vec3(0.06, 0.05, 0.22);
            vec3 zenith = vec3(0.006, 0.01, 0.06);
            vec3 col = t < 0.3 ? mix(horizon, mid, t / 0.3) : mix(mid, zenith, (t - 0.3) / 0.7);
            gl_FragColor = vec4(pow(col, vec3(0.75)), 1.0);
          }`,
      }),
    [],
  )
  return (
    <mesh material={material} renderOrder={-1}>
      <sphereGeometry args={[90, 32, 16]} />
    </mesh>
  )
}

// Chấm tròn mềm (vẽ bằng canvas) cho sao, đốm sáng và quầng sáng của trăng
function softDot(inner = 0.0) {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(Math.max(0.05, inner), 'rgba(255,255,255,0.85)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  return new CanvasTexture(canvas)
}

// Số ngẫu nhiên có hạt giống: mỗi lần mở bầu trời trông giống nhau
function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

// ---- Sao: các điểm trên mặt cầu xa, nhấp nháy bằng shader ----
export function Stars({ count = 700 }: { count?: number }) {
  const data = useMemo(() => {
    const rnd = seeded(42)
    const positions = new Float32Array(count * 3)
    const phases = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      // Chỉ nửa trên bầu trời và quanh chân trời
      const y = rnd() * 1.1 - 0.15
      const a = rnd() * Math.PI * 2
      const r = Math.sqrt(1 - Math.min(1, y * y))
      positions.set([Math.cos(a) * r * 80, y * 80, Math.sin(a) * r * 80], i * 3)
      phases[i] = rnd() * Math.PI * 2
    }
    return { positions, phases }
  }, [count])
  const mat = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uMap: { value: softDot(0.15) } },
        vertexShader: `attribute float aPhase; uniform float uTime; varying float vAlpha;
          void main() {
            vAlpha = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * 1.3 + aPhase * 7.0));
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = (1.6 + fract(aPhase * 3.7) * 2.6);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `uniform sampler2D uMap; varying float vAlpha;
          void main() { gl_FragColor = vec4(vec3(1.0, 0.97, 0.9), texture2D(uMap, gl_PointCoord).a * vAlpha); }`,
      }),
    [],
  )
  useFrame(({ clock }) => {
    mat.uniforms.uTime.value = clock.elapsedTime
  })
  return (
    <points material={mat} renderOrder={0}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[data.positions, 3]} />
        <bufferAttribute attach="attributes-aPhase" args={[data.phases, 1]} />
      </bufferGeometry>
    </points>
  )
}

// ---- Đốm sáng vàng lấp lánh bay quanh các tầng mây ----
export function Sparkles({ count = 80 }: { count?: number }) {
  const ref = useRef<Group>(null)
  const data = useMemo(() => {
    const rnd = seeded(7)
    const positions = new Float32Array(count * 3)
    const phases = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      positions.set([rnd() * 15 - 7.5, rnd() * 15 - 2.5, -(rnd() * 10 - 3)], i * 3)
      phases[i] = rnd() * Math.PI * 2
    }
    return { positions, phases }
  }, [count])
  const mat = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uMap: { value: softDot() }, uScale: { value: 1 } },
        vertexShader: `attribute float aPhase; uniform float uTime; uniform float uScale; varying float vAlpha;
          void main() {
            vec3 p = position + vec3(sin(uTime * 0.4 + aPhase) * 0.25, sin(uTime * 0.7 + aPhase * 2.0) * 0.3, cos(uTime * 0.5 + aPhase) * 0.25);
            vAlpha = 0.3 + 0.7 * (0.5 + 0.5 * sin(uTime * 2.2 + aPhase * 5.0));
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_PointSize = uScale * 26.0 / -mv.z;
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `uniform sampler2D uMap; varying float vAlpha;
          void main() { gl_FragColor = vec4(vec3(1.0, 0.86, 0.5), texture2D(uMap, gl_PointCoord).a * vAlpha); }`,
      }),
    [],
  )
  const { gl } = useThree()
  useFrame(({ clock }) => {
    mat.uniforms.uTime.value = clock.elapsedTime
    mat.uniforms.uScale.value = gl.getPixelRatio() * 4
  })
  return (
    <group ref={ref}>
      <points material={mat}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[data.positions, 3]} />
          <bufferAttribute attach="attributes-aPhase" args={[data.phases, 1]} />
        </bufferGeometry>
      </points>
    </group>
  )
}

// ---- Trăng tròn + quầng sáng (góc phải phía sau) ----
const MOON_POS: [number, number, number] = [8, 13, -34]
export function Moon() {
  const glow = useMemo(() => softDot(0.12), [])
  return (
    <group position={MOON_POS}>
      <mesh>
        <sphereGeometry args={[2.4, 32, 16]} />
        <meshBasicMaterial color={new Color(1.0, 0.96, 0.84)} toneMapped={false} />
      </mesh>
      <sprite scale={[14, 14, 1]}>
        <spriteMaterial map={glow} color={new Color(0.85, 0.82, 1.0)} transparent opacity={0.55} depthWrite={false} blending={AdditiveBlending} />
      </sprite>
    </group>
  )
}

// ---- Điều khiển camera: 1 ngón xoay, 2 ngón zoom; tự xoay chậm cho tới khi người dùng chạm ----
function CameraControls() {
  const { camera, gl, size } = useThree()
  const controls = useRef<OrbitControls | null>(null)

  // Góc nhìn ban đầu: lùi camera vừa đủ thấy trọn bề ngang tầng mây lớn nhất (màn hình dọc thì hẹp ngang)
  useLayoutEffect(() => {
    if (!size.width || !size.height || controls.current) return
    const cam = camera as PerspectiveCamera
    const halfV = (cam.fov * Math.PI) / 360
    const halfH = Math.atan(Math.tan(halfV) * (size.width / size.height))
    const distance = Math.min(42, Math.max(20, 8.6 / Math.tan(Math.min(halfH, halfV))))
    const dir = new Vector3(0, 0.36, 1).normalize()
    cam.position.copy(TARGET).addScaledVector(dir, distance)
    cam.lookAt(TARGET)
  }, [camera, size])

  useEffect(() => {
    const c = new OrbitControls(camera, gl.domElement)
    c.target.copy(TARGET)
    c.enablePan = false
    c.enableDamping = true
    c.dampingFactor = 0.08
    c.rotateSpeed = 0.6
    c.minDistance = 7
    c.maxDistance = 45
    c.minPolarAngle = 0.25 // gần nhìn thẳng từ trên xuống
    c.maxPolarAngle = 2.0 // nhìn hơi từ dưới lên thấy đáy mây
    c.autoRotate = true
    c.autoRotateSpeed = 0.35
    const stop = () => (c.autoRotate = false)
    c.addEventListener('start', stop)
    c.update()
    controls.current = c
    return () => {
      c.removeEventListener('start', stop)
      c.dispose()
      controls.current = null
    }
  }, [camera, gl])

  useFrame(() => controls.current?.update())
  return null
}

export default function CloudScene() {
  return (
    <Canvas dpr={[1, 1.75]} camera={{ fov: 46, near: 0.1, far: 300, position: [0, 13, 24] }} gl={{ antialias: true }}>
      <Sky />
      <Stars />
      <Moon />
      {/* Ánh sáng: nền tím dịu, ánh trăng từ phải sau, ánh viền hồng tím phía sau, hắt hồng từ dưới lên */}
      <hemisphereLight args={[new Color(0.75, 0.78, 1.0), new Color(0.55, 0.3, 0.6), 1.1]} />
      <directionalLight position={[8, 20, -20]} intensity={1.6} color={new Color(0.8, 0.86, 1.0)} />
      <directionalLight position={[-12, 10, 14]} intensity={1.1} color={new Color(0.78, 0.66, 1.0)} />
      <directionalLight position={[-4, 9, -18]} intensity={0.8} color={new Color(0.95, 0.7, 1.0)} />
      <pointLight position={[0, -6, 6]} intensity={60} distance={30} color={new Color(1.0, 0.55, 0.85)} />
      <Clouds />
      <Sparkles />
      <CameraControls />
    </Canvas>
  )
}
