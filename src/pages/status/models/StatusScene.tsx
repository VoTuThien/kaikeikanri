import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import { Avatar } from '../components'
import type { Place, Presence } from '../data/types'
import BoardScene, { placeTop } from './BoardScene'

// Cảnh "thành phố mini" ở chế độ chỉ xem, trên mỗi mô hình nổi tag những người đang ở đó.
// Tag là HTML thường đặt chồng lên canvas; mỗi khung hình tính vị trí đỉnh mô hình trên màn hình rồi dời tag tới đó.
// Tải riêng (lazy) cùng thư viện 3D.

const MAX_AVATARS = 4 // nhiều người hơn thì hiện "+N"

interface Anchor {
  id: string
  position: [number, number, number]
}

// Chạy trong Canvas: chiếu điểm 3D ra toạ độ màn hình và cập nhật thẳng style của tag (không render lại React mỗi khung hình)
function Projector({ anchors, elements }: { anchors: Anchor[]; elements: RefObject<Record<string, HTMLDivElement | null>> }) {
  const { camera, size, invalidate } = useThree()
  const v = useMemo(() => new Vector3(), [])

  // Danh sách tag đổi thì vẽ lại 1 khung để tag mới có vị trí ngay
  useEffect(() => invalidate(), [anchors, invalidate])

  useFrame(() => {
    // Ma trận camera chỉ được cập nhật lúc vẽ (sau useFrame): cập nhật trước để tag khớp đúng khung hình này, không trễ 1 nhịp
    camera.updateMatrixWorld()
    for (const a of anchors) {
      const el = elements.current?.[a.id]
      if (!el) continue
      v.set(...a.position).project(camera)
      const visible = v.z < 1 && Math.abs(v.x) <= 1.1 && Math.abs(v.y) <= 1.1
      el.style.display = visible ? 'block' : 'none'
      el.style.transform = `translate(${((v.x + 1) / 2) * size.width}px, ${((1 - v.y) / 2) * size.height}px)`
      // Tag ở gần camera nằm đè lên tag ở xa
      el.style.zIndex = String(Math.round((1 - v.z) * 10000))
    }
  })
  return null
}

function PeopleTag({ people, myUid }: { people: Presence[]; myUid: string }) {
  // Đưa mình lên đầu cho dễ thấy
  const sorted = [...people].sort((a, b) => Number(b.uid === myUid) - Number(a.uid === myUid))
  const shown = sorted.slice(0, MAX_AVATARS)
  const more = sorted.length - shown.length
  return (
    <div className="flex flex-col items-center select-none">
      <div className="flex items-center rounded-full border border-white/40 bg-slate-900/60 p-1 shadow-lg backdrop-blur">
        {shown.map((p, i) => (
          <span key={p.uid} className={i ? '-ml-2' : ''}>
            <Avatar uid={p.uid} name={p.name} me={p.uid === myUid} size="h-8 w-8 text-[11px]" />
          </span>
        ))}
        {more > 0 && <span className="px-1.5 text-xs font-bold text-white">+{more}</span>}
      </div>
      {/* Mũi nhọn chỉ xuống mô hình */}
      <span className="-mt-px h-0 w-0 border-x-[6px] border-t-[7px] border-x-transparent border-t-slate-900/60" />
    </div>
  )
}

export default function StatusScene({ places, presences, myUid }: { places: Place[]; presences: Presence[]; myUid: string }) {
  const elements = useRef<Record<string, HTMLDivElement | null>>({})
  const onBoard = places.filter((p) => p.cell)

  const byPlace = new Map<string, Presence[]>()
  for (const person of presences) {
    if (!person.placeId) continue
    byPlace.set(person.placeId, [...(byPlace.get(person.placeId) ?? []), person])
  }
  const tagged = onBoard.filter((p) => byPlace.get(p.id)?.length)

  // Giữ cùng 1 mảng khi vị trí không đổi để Projector không vẽ lại thừa
  const anchorKey = tagged.map((p) => `${p.id}:${p.type}:${p.cell!.x},${p.cell!.y}`).join('|')
  const anchors = useMemo<Anchor[]>(() => tagged.map((p) => ({ id: p.id, position: placeTop(p) })), [anchorKey])

  return (
    <div className="relative h-full w-full">
      <BoardScene places={onBoard}>
        <Projector anchors={anchors} elements={elements} />
      </BoardScene>
      {/* Lớp tag chồng lên bản đồ, không chặn thao tác xoay / phóng to */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {tagged.map((place) => (
          <div
            key={place.id}
            ref={(el) => {
              elements.current[place.id] = el
            }}
            className="absolute top-0 left-0"
            style={{ display: 'none' }}
          >
            {/* Neo mũi nhọn (giữa đáy tag) vào đỉnh mô hình */}
            <div className="-translate-x-1/2 -translate-y-full">
              <PeopleTag people={byPlace.get(place.id)!} myUid={myUid} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
