import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type ReactNode, type Ref } from 'react'
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber'
import { Plane, Raycaster, Vector2, Vector3, type Camera, type PerspectiveCamera } from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { footprint } from '../data/layout'
import { BOARD_SIZE, type Cell, type Place, type PlaceType } from '../data/types'
import { GrassPatch, Tree, Tuft } from './Nature'
import { PlaceModel } from './PlaceModels'

// Bản đồ mini dạng "thành phố mini": nền cỏ, cây quanh mép, camera xoay / phóng to / dịch chuyển được.
// Bên dưới chia lưới BOARD_SIZE x BOARD_SIZE ô (mỗi ô 1 đơn vị) để đặt mô hình gọn gàng; lưới chỉ hiện mờ khi đang kéo.
// Mô hình chiếm size x size ô (xem data/layout.ts), `cell` là ô góc trên-trái của vùng đó.

const HALF = BOARD_SIZE / 2
// Mô hình hơi nhỏ hơn vùng ô để không chạm mô hình bên cạnh
const MODEL_SCALE = 0.82
// Phần cỏ rộng hơn vùng đặt mô hình để trồng cây quanh mép
const GROUND_SIZE = BOARD_SIZE + 2

// Tâm vùng size x size ô bắt đầu từ ô `c`
const areaCenter = (c: Cell, size: number): [number, number, number] => [c.x + size / 2 - HALF, 0, c.y + size / 2 - HALF]

export interface BoardHandle {
  // Đổi vị trí ngón tay / chuột ra điểm trên mặt đất theo toạ độ lưới (0..BOARD_SIZE), null nếu ngoài vùng đặt mô hình
  pick: (clientX: number, clientY: number) => { x: number; y: number } | null
}

export interface BoardPreview {
  placeId: string
  type: PlaceType
  cell: Cell | null // chỗ đang rê tới (ô góc)
  status: 'place' | 'swap' | 'blocked' // thả ở đây thì: đặt / đổi chỗ / không được
}

interface BoardSceneProps {
  ref?: Ref<BoardHandle>
  places: Place[] // các địa điểm đã đặt lên bản đồ
  preview?: BoardPreview | null // địa điểm đang được kéo
  selectedId?: string | null
  // Không truyền = chế độ chỉ xem (màn hình Trạng thái): chạm mô hình cũng xoay camera
  onModelPointerDown?: (placeId: string, clientX: number, clientY: number) => void
  onEmptyTap?: () => void // chạm vào chỗ không có mô hình
  children?: ReactNode // vẽ thêm vào cảnh, vd tag người dùng
}

// Điểm ngay trên đỉnh mô hình (để gắn tag người dùng)
export function placeTop(place: Place): [number, number, number] {
  const size = footprint(place.type)
  const [x, , z] = areaCenter(place.cell!, size)
  return [x, MODEL_TOP[place.type] * MODEL_SCALE * size + 0.25, z]
}

// Chiều cao ước lượng của từng mô hình khi chưa phóng to (đơn vị ô)
const MODEL_TOP: Record<PlaceType, number> = {
  house: 1.1,
  market: 0.8,
  company: 1.7,
  tram: 0.75,
  bus: 0.95,
  supermarket: 0.8,
  hospital: 0.85,
}

const PREVIEW_COLOR: Record<BoardPreview['status'], string> = {
  place: '#4ade80', // xanh: chỗ trống
  swap: '#fbbf24', // vàng: sẽ đổi chỗ
  blocked: '#f87171', // đỏ: không đủ chỗ
}

// Camera điều khiển bằng tay: 1 ngón xoay, 2 ngón phóng to / thu nhỏ và dịch chuyển (chuột: kéo trái xoay, lăn để zoom, kéo phải dịch)
// Gắn vào khung bọc ngoài canvas: chạm trúng mô hình thì sự kiện bị chặn lại nên camera không xoay mà mô hình được kéo.
function CameraControls({ domElement }: { domElement: HTMLElement | null }) {
  const { camera, invalidate } = useThree()
  useEffect(() => {
    if (!domElement) return
    const controls = new OrbitControls(camera, domElement)
    controls.target.set(0, 0, 0)
    controls.minDistance = 4
    controls.maxDistance = BOARD_SIZE * 2.6
    controls.minPolarAngle = 0.15 // gần như nhìn thẳng từ trên xuống
    controls.maxPolarAngle = 1.35 // không cho camera chui xuống dưới mặt đất
    controls.screenSpacePanning = false // dịch chuyển song song mặt đất
    controls.rotateSpeed = 0.7
    controls.zoomSpeed = 1
    controls.panSpeed = 1.2
    const onChange = () => {
      // Không cho kéo khung nhìn ra quá xa thành phố
      controls.target.x = Math.max(-HALF, Math.min(HALF, controls.target.x))
      controls.target.z = Math.max(-HALF, Math.min(HALF, controls.target.z))
      controls.target.y = 0
      invalidate() // chỉ vẽ lại khi camera đổi (frameloop="demand") để tiết kiệm pin
    }
    controls.addEventListener('change', onChange)
    controls.update()
    return () => {
      controls.removeEventListener('change', onChange)
      controls.dispose()
    }
  }, [camera, domElement, invalidate])
  return null
}

// Góc nhìn ban đầu: lùi camera ra vừa đủ để thấy trọn thành phố theo bề ngang khung (màn hình dọc thì hẹp ngang)
const START_ELEVATION = 0.9 // khoảng 52° từ trên xuống
function FitInitialView() {
  const { camera, size, invalidate } = useThree()
  const done = useRef(false)
  useLayoutEffect(() => {
    if (done.current || !size.width || !size.height) return
    done.current = true
    const cam = camera as PerspectiveCamera
    const halfV = (cam.fov * Math.PI) / 360
    const halfH = Math.atan(Math.tan(halfV) * (size.width / size.height))
    const distance = Math.min(BOARD_SIZE * 2.5, Math.max(8, (GROUND_SIZE / 2 + 0.3) / Math.tan(Math.min(halfH, halfV))))
    cam.position.set(0, Math.sin(START_ELEVATION) * distance, Math.cos(START_ELEVATION) * distance)
    cam.lookAt(0, 0, 0)
    invalidate()
  }, [camera, size, invalidate])
  return null
}

// Lấy camera và thẻ canvas ra ngoài để tính ô khi kéo thả (sự kiện kéo được nghe ở cấp trang)
function Bridge({ target }: { target: { current: { camera: Camera; dom: HTMLElement } | null } }) {
  const { camera, gl } = useThree()
  useLayoutEffect(() => {
    target.current = { camera, dom: gl.domElement }
  }, [camera, gl, target])
  return null
}

// Hàng cây quanh mép (vị trí cố định theo công thức để mỗi lần mở trông giống nhau)
const EDGE = HALF + 0.5
const TREES: [number, number][] = Array.from({ length: BOARD_SIZE / 2 }, (_, i) => {
  const t = -HALF + 1 + i * 2 + (i % 3) * 0.4
  return [
    [t, -EDGE],
    [t + 0.6, EDGE],
    [-EDGE, t + 0.3],
    [EDGE, t - 0.2],
  ] as [number, number][]
}).flat()
// Bụi cỏ rải rác trong thành phố
const TUFTS: [number, number][] = Array.from({ length: BOARD_SIZE * 2 }, (_, i) => [
  ((i * 7.31) % BOARD_SIZE) - HALF + 0.3,
  ((i * 4.17 + 2.6) % BOARD_SIZE) - HALF + 0.4,
])

function City() {
  return (
    <group>
      <GrassPatch size={GROUND_SIZE} thickness={0.6} />
      {TREES.map(([x, z], i) => (
        <Tree key={i} p={[x, 0, z]} s={0.9 + (i % 3) * 0.15} />
      ))}
      {TUFTS.map(([x, z], i) => (
        <Tuft key={i} p={[x, 0, z]} s={1.2} />
      ))}
    </group>
  )
}

// Lưới ô mờ, chỉ hiện khi đang kéo để biết mô hình sẽ đặt vào đâu
function GuideGrid() {
  return (
    <gridHelper
      args={[BOARD_SIZE, BOARD_SIZE, '#ffffff', '#ffffff']}
      position={[0, 0.005, 0]}
      material-transparent
      material-opacity={0.3}
    />
  )
}

// Vùng đang rê tới khi kéo (theo kích thước mô hình): tô kín màu xanh / vàng / đỏ
function Highlight({ cell, size, color }: { cell: Cell; size: number; color: string }) {
  const [x, , z] = areaCenter(cell, size)
  return (
    <mesh position={[x, 0.02, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[size - 0.04, size - 0.04]} />
      <meshBasicMaterial color={color} transparent opacity={0.55} depthWrite={false} />
    </mesh>
  )
}

// Mô hình đang chọn: chỉ vẽ khung viền quanh vùng của nó, không tô kín để cỏ bên trong vẫn giữ màu xanh
const OUTLINE_WIDTH = 0.1
function SelectionOutline({ cell, size }: { cell: Cell; size: number }) {
  const [x, , z] = areaCenter(cell, size)
  const half = size / 2 - OUTLINE_WIDTH / 2
  // 4 cạnh: trên, dưới, trái, phải
  const edges: [number, number, number, number][] = [
    [0, -half, size, OUTLINE_WIDTH],
    [0, half, size, OUTLINE_WIDTH],
    [-half, 0, OUTLINE_WIDTH, size],
    [half, 0, OUTLINE_WIDTH, size],
  ]
  return (
    <group position={[x, 0.02, z]}>
      {edges.map(([dx, dz, w, d], i) => (
        <mesh key={i} position={[dx, 0, dz]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[w, d]} />
          <meshBasicMaterial color="#f0abfc" depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

// Mô hình đặt trên bản đồ: phóng to theo số ô chiếm (2x2 thì to gấp đôi, cao gấp đôi)
function PlacedModel({ type, cell, onPointerDown }: { type: PlaceType; cell: Cell; onPointerDown?: (e: ThreeEvent<PointerEvent>) => void }) {
  const size = footprint(type)
  return (
    <group position={areaCenter(cell, size)} scale={MODEL_SCALE * size} onPointerDown={onPointerDown}>
      <PlaceModel type={type} />
    </group>
  )
}

export default function BoardScene({ ref, places, preview = null, selectedId = null, onModelPointerDown, onEmptyTap, children }: BoardSceneProps) {
  const three = useRef<{ camera: Camera; dom: HTMLElement } | null>(null)
  const [wrapper, setWrapper] = useState<HTMLDivElement | null>(null)

  useImperativeHandle(ref, () => {
    const raycaster = new Raycaster()
    const ground = new Plane(new Vector3(0, 1, 0), 0)
    const ndc = new Vector2()
    const hit = new Vector3()
    return {
      pick(clientX, clientY) {
        if (!three.current) return null
        const rect = three.current.dom.getBoundingClientRect()
        if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null
        ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
        raycaster.setFromCamera(ndc, three.current.camera)
        if (!raycaster.ray.intersectPlane(ground, hit)) return null
        const x = hit.x + HALF
        const y = hit.z + HALF
        return x >= 0 && x <= BOARD_SIZE && y >= 0 && y <= BOARD_SIZE ? { x, y } : null
      },
    }
  }, [])

  const selected = places.find((p) => p.id === selectedId)

  return (
    <div ref={setWrapper} className="h-full w-full" style={{ touchAction: 'none' }}>
      <Canvas
        shadows
        frameloop="demand"
        dpr={[1, 2]}
        camera={{ position: [0, 14, 14], fov: 45, near: 0.1, far: 200 }}
        onPointerMissed={onEmptyTap}
      >
        {/* Đặt góc nhìn ban đầu trước, rồi mới gắn điều khiển camera */}
        <FitInitialView />
        <CameraControls domElement={wrapper} />
        <Bridge target={three} />
        <ambientLight intensity={0.85} />
        <directionalLight
          position={[HALF, BOARD_SIZE * 1.2, HALF * 0.8]}
          intensity={1.5}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-GROUND_SIZE / 2 - 1}
          shadow-camera-right={GROUND_SIZE / 2 + 1}
          shadow-camera-top={GROUND_SIZE / 2 + 1}
          shadow-camera-bottom={-GROUND_SIZE / 2 - 1}
          shadow-camera-far={BOARD_SIZE * 4}
        />
        <City />
        {preview && <GuideGrid />}
        {selected?.cell && <SelectionOutline cell={selected.cell} size={footprint(selected.type)} />}
        {preview?.cell && <Highlight cell={preview.cell} size={footprint(preview.type)} color={PREVIEW_COLOR[preview.status]} />}

        {places.map((p) => {
          // Mô hình đang được kéo thì vẽ ở chỗ đang rê tới thay vì chỗ cũ
          const dragging = preview?.placeId === p.id && preview.cell
          return (
            p.cell && (
              <PlacedModel
                key={p.id}
                type={p.type}
                cell={dragging ? preview.cell! : p.cell}
                onPointerDown={
                  onModelPointerDown &&
                  ((e) => {
                    e.stopPropagation()
                    // Chặn sự kiện lên khung bọc để camera không xoay khi đang kéo mô hình
                    e.nativeEvent.stopPropagation()
                    onModelPointerDown(p.id, e.nativeEvent.clientX, e.nativeEvent.clientY)
                  })
                }
              />
            )
          )
        })}

        {/* Kéo từ khay lên: hiện mô hình ở chỗ đang rê tới */}
        {preview?.cell && !places.some((p) => p.id === preview.placeId) && <PlacedModel type={preview.type} cell={preview.cell} />}
        {children}
      </Canvas>
    </div>
  )
}
