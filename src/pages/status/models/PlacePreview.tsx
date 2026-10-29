import { useLayoutEffect, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Box3, Vector3, type Group } from 'three'
import type { PlaceType } from '../data/types'
import { GrassPatch, Tuft } from './Nature'
import { PlaceModel } from './PlaceModels'

// Đế cỏ cho mô hình: màu xanh tách bạch với mô hình, vài bụi cỏ ở góc cho sinh động
function GrassBase() {
  return (
    <group>
      <GrassPatch size={1.45} thickness={0.18} />
      <Tuft p={[-0.58, 0, 0.55]} />
      <Tuft p={[0.6, 0, -0.5]} s={0.8} />
      <Tuft p={[0.55, 0, 0.6]} s={0.9} />
      <Tuft p={[-0.6, 0, -0.58]} s={0.7} />
    </group>
  )
}

// Chiều cao tối đa của mô hình trong khung xem trước; mô hình cao hơn (vd toà công ty) tự thu nhỏ cho vừa
const MAX_HEIGHT = 1.05

// Mô hình xoay chậm trên đế để xem được nhiều mặt
function Spinning({ type }: { type: PlaceType }) {
  const ref = useRef<Group>(null)
  const modelRef = useRef<Group>(null)

  useLayoutEffect(() => {
    const model = modelRef.current
    if (!model) return
    model.scale.setScalar(1)
    const height = new Box3().setFromObject(model).getSize(new Vector3()).y
    model.scale.setScalar(height > MAX_HEIGHT ? MAX_HEIGHT / height : 1)
  }, [type])

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.5
  })
  return (
    <group ref={ref}>
      <GrassBase />
      <group ref={modelRef}>
        <PlaceModel type={type} />
      </group>
    </group>
  )
}

// Khung xem trước mô hình 3D. Tải riêng (lazy) để thư viện 3D không làm chậm các màn hình khác.
export default function PlacePreview({ type }: { type: PlaceType }) {
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: [2.1, 1.7, 2.1], fov: 32 }} onCreated={({ camera }) => camera.lookAt(0, 0.4, 0)}>
      <ambientLight intensity={0.8} />
      <directionalLight position={[3, 5, 2]} intensity={1.6} castShadow shadow-mapSize={[512, 512]} />
      <Spinning type={type} />
    </Canvas>
  )
}
