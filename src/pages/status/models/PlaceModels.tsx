import type { ReactNode } from 'react'
import type { PlaceType } from '../data/types'

// 7 mô hình 3D low-poly dựng bằng khối cơ bản (hộp, trụ, nón).
// Quy ước: đáy mô hình nằm ở y = 0, chiếm khoảng 1 x 1 đơn vị (vừa 1 ô bàn cờ), mặt trước hướng về +z.

type Vec3 = [number, number, number]

interface PartProps {
  p: Vec3 // vị trí tâm
  c: string // màu
  r?: Vec3 // góc xoay (radian)
  opacity?: number
}

function Box({ p, s, c, r, opacity }: PartProps & { s: Vec3 }) {
  return (
    <mesh position={p} rotation={r} castShadow receiveShadow>
      <boxGeometry args={s} />
      <meshStandardMaterial color={c} flatShading transparent={opacity !== undefined} opacity={opacity ?? 1} />
    </mesh>
  )
}

function Cyl({ p, c, r, radius, h, seg = 12 }: PartProps & { radius: number; h: number; seg?: number }) {
  return (
    <mesh position={p} rotation={r} castShadow receiveShadow>
      <cylinderGeometry args={[radius, radius, h, seg]} />
      <meshStandardMaterial color={c} flatShading />
    </mesh>
  )
}

function Ball({ p, c, radius }: PartProps & { radius: number }) {
  return (
    <mesh position={p} castShadow>
      <sphereGeometry args={[radius, 10, 8]} />
      <meshStandardMaterial color={c} flatShading />
    </mesh>
  )
}

const WINDOW = '#9fd3ff'
const WOOD = '#8b5a2b'
const METAL = '#5f6b7a'
const CONCRETE = '#c9ccd1'

function House() {
  return (
    <>
      <Box p={[0, 0.3, 0]} s={[0.8, 0.6, 0.7]} c="#f6dfb4" />
      {/* Mái nhà: nón 4 cạnh xoay 45° thành mái chóp */}
      <mesh position={[0, 0.82, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[0.66, 0.45, 4]} />
        <meshStandardMaterial color="#e05a47" flatShading />
      </mesh>
      <Box p={[0.22, 0.95, -0.12]} s={[0.1, 0.25, 0.1]} c="#a0522d" />
      <Box p={[-0.12, 0.16, 0.351]} s={[0.18, 0.32, 0.02]} c={WOOD} />
      <Box p={[0.2, 0.36, 0.351]} s={[0.16, 0.16, 0.02]} c={WINDOW} />
    </>
  )
}

function Market() {
  const stripes = [-0.38, -0.19, 0, 0.19, 0.38]
  const produce = ['#f39c12', '#27ae60', '#e74c3c', '#f1c40f', '#8e44ad']
  return (
    <>
      <Box p={[0, 0.04, 0]} s={[0.95, 0.08, 0.8]} c="#c8a26b" />
      {[-0.42, 0.42].flatMap((x) =>
        [-0.34, 0.34].map((z) => <Cyl key={`${x}${z}`} p={[x, 0.38, z]} radius={0.03} h={0.6} c={WOOD} />),
      )}
      {/* Mái bạt sọc đỏ trắng, hơi dốc về phía trước */}
      {stripes.map((x, i) => (
        <Box key={x} p={[x, 0.7, 0]} s={[0.19, 0.04, 0.86]} r={[0.15, 0, 0]} c={i % 2 ? '#ffffff' : '#e74c3c'} />
      ))}
      <Box p={[0, 0.3, 0.05]} s={[0.72, 0.07, 0.32]} c="#a0522d" />
      {produce.map((c, i) => (
        <Ball key={c} p={[-0.28 + i * 0.14, 0.39, 0.05]} radius={0.06} c={c} />
      ))}
    </>
  )
}

function Company() {
  return (
    <>
      <Box p={[0, 0.06, 0]} s={[0.78, 0.12, 0.78]} c="#3d4f6e" />
      <Box p={[0, 0.72, 0]} s={[0.6, 1.25, 0.6]} c="#5b7db1" />
      {/* Các dải cửa kính quanh toà nhà */}
      {[0, 1, 2, 3, 4].map((i) => (
        <Box key={i} p={[0, 0.3 + i * 0.22, 0]} s={[0.62, 0.08, 0.62]} c="#cfe8ff" />
      ))}
      <Box p={[0, 1.37, 0]} s={[0.4, 0.06, 0.4]} c="#3d4f6e" />
      <Cyl p={[0.12, 1.55, 0.1]} radius={0.015} h={0.32} c={METAL} />
    </>
  )
}

function TramStation() {
  return (
    <>
      {/* Sân ga + mái che */}
      <Box p={[0, 0.06, -0.27]} s={[1, 0.12, 0.4]} c={CONCRETE} />
      {[-0.4, 0.4].map((x) => (
        <Cyl key={x} p={[x, 0.38, -0.4]} radius={0.025} h={0.55} c={METAL} />
      ))}
      <Box p={[0, 0.67, -0.27]} s={[1.02, 0.05, 0.48]} c="#2e8b57" />
      {/* Đường ray */}
      {[0.12, 0.36].map((z) => (
        <Box key={z} p={[0, 0.02, z]} s={[1.1, 0.04, 0.04]} c="#777777" />
      ))}
      {/* Toa xe điện */}
      <Box p={[0, 0.26, 0.24]} s={[0.72, 0.36, 0.3]} c="#27ae60" />
      <Box p={[0, 0.33, 0.24]} s={[0.74, 0.11, 0.31]} c={WINDOW} />
      <Box p={[0, 0.47, 0.24]} s={[0.6, 0.05, 0.22]} c="#1e7a46" />
      <Box p={[0, 0.58, 0.24]} s={[0.02, 0.2, 0.2]} r={[0, 0, 0.5]} c={METAL} />
    </>
  )
}

function BusStop() {
  return (
    <>
      <Box p={[0, 0.03, 0]} s={[0.95, 0.06, 0.55]} c={CONCRETE} />
      {[-0.36, 0.36].map((x) => (
        <Cyl key={x} p={[x, 0.33, -0.2]} radius={0.025} h={0.55} c={METAL} />
      ))}
      <Box p={[0, 0.33, -0.21]} s={[0.7, 0.48, 0.03]} c={WINDOW} opacity={0.6} />
      <Box p={[0, 0.62, -0.08]} s={[0.84, 0.05, 0.42]} c="#f39c12" />
      <Box p={[0, 0.2, -0.1]} s={[0.52, 0.05, 0.16]} c={WOOD} />
      {/* Biển báo trạm xe buýt */}
      <Cyl p={[0.42, 0.45, 0.2]} radius={0.02} h={0.85} c={METAL} />
      <Cyl p={[0.42, 0.82, 0.2]} radius={0.13} h={0.03} r={[Math.PI / 2, 0, 0]} c="#2980b9" seg={20} />
    </>
  )
}

function Supermarket() {
  return (
    <>
      <Box p={[0, 0.27, 0]} s={[1, 0.54, 0.75]} c="#ecf0f1" />
      <Box p={[0, 0.56, 0]} s={[1.03, 0.16, 0.78]} c="#e67e22" />
      <Box p={[0, 0.2, 0.376]} s={[0.66, 0.34, 0.02]} c={WINDOW} />
      <Box p={[0, 0.2, 0.378]} s={[0.02, 0.34, 0.02]} c={METAL} />
      <Box p={[0.3, 0.7, -0.15]} s={[0.22, 0.12, 0.22]} c="#bdc3c7" />
      {/* Xe đẩy hàng nhỏ trước cửa */}
      <Box p={[-0.38, 0.1, 0.48]} s={[0.14, 0.1, 0.1]} c="#e74c3c" />
    </>
  )
}

function Hospital() {
  return (
    <>
      <Box p={[0, 0.4, 0]} s={[0.66, 0.8, 0.6]} c="#ffffff" />
      {[-0.46, 0.46].map((x) => (
        <Box key={x} p={[x, 0.24, 0]} s={[0.26, 0.48, 0.52]} c="#e8eef3" />
      ))}
      {/* Chữ thập đỏ ở mặt trước và trên mái */}
      <Box p={[0, 0.58, 0.302]} s={[0.26, 0.08, 0.02]} c="#e74c3c" />
      <Box p={[0, 0.58, 0.302]} s={[0.08, 0.26, 0.02]} c="#e74c3c" />
      <Box p={[0, 0.81, 0]} s={[0.3, 0.02, 0.09]} c="#e74c3c" />
      <Box p={[0, 0.81, 0]} s={[0.09, 0.02, 0.3]} c="#e74c3c" />
      <Box p={[0, 0.15, 0.302]} s={[0.2, 0.3, 0.02]} c={WINDOW} />
      {[-0.46, 0.46].map((x) => (
        <Box key={`w${x}`} p={[x, 0.3, 0.262]} s={[0.14, 0.12, 0.02]} c={WINDOW} />
      ))}
    </>
  )
}

const MODELS: Record<PlaceType, () => ReactNode> = {
  house: House,
  market: Market,
  company: Company,
  tram: TramStation,
  bus: BusStop,
  supermarket: Supermarket,
  hospital: Hospital,
}

export function PlaceModel({ type }: { type: PlaceType }) {
  const Model = MODELS[type]
  return <Model />
}
