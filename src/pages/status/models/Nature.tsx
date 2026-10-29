// Nền cỏ và cây trang trí dùng chung cho khung xem trước mô hình và bản đồ mini

export const GRASS = '#7cc456'
const GRASS_DARK = '#5fa83f'
const DIRT = '#8b5e34'

// Mảng cỏ vuông có lớp đất bên dưới; mặt cỏ nằm ở y = 0
export function GrassPatch({ size, thickness = 0.25 }: { size: number; thickness?: number }) {
  return (
    <group>
      <mesh position={[0, -thickness / 2 - 0.04, 0]} receiveShadow>
        <boxGeometry args={[size, thickness, size]} />
        <meshStandardMaterial color={DIRT} flatShading />
      </mesh>
      <mesh position={[0, -0.02, 0]} receiveShadow>
        <boxGeometry args={[size + 0.04, 0.04, size + 0.04]} />
        <meshStandardMaterial color={GRASS} flatShading />
      </mesh>
    </group>
  )
}

// Bụi cỏ nhỏ (vài lá nhọn)
export function Tuft({ p, s = 1 }: { p: [number, number, number]; s?: number }) {
  return (
    <group position={p} scale={s}>
      {[-0.035, 0, 0.035].map((x, i) => (
        <mesh key={x} position={[x, 0.05, 0]} rotation={[0, 0, x * 6]} castShadow>
          <coneGeometry args={[0.025, i === 1 ? 0.14 : 0.1, 4]} />
          <meshStandardMaterial color={GRASS_DARK} flatShading />
        </mesh>
      ))}
    </group>
  )
}

// Cây low-poly: thân gỗ + 2 tầng tán lá
export function Tree({ p, s = 1 }: { p: [number, number, number]; s?: number }) {
  return (
    <group position={p} scale={s}>
      <mesh position={[0, 0.15, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.07, 0.3, 6]} />
        <meshStandardMaterial color="#7a4b25" flatShading />
      </mesh>
      <mesh position={[0, 0.42, 0]} castShadow>
        <coneGeometry args={[0.28, 0.4, 7]} />
        <meshStandardMaterial color="#3f9a3a" flatShading />
      </mesh>
      <mesh position={[0, 0.62, 0]} castShadow>
        <coneGeometry args={[0.2, 0.32, 7]} />
        <meshStandardMaterial color="#4fb347" flatShading />
      </mesh>
    </group>
  )
}
