import { Icon3D } from '../../../components/ui/Icon3D'

// Icon vật phẩm trong game: có ảnh dựng bằng Blender (bùa, phân bón, mảnh sao…) thì hiện ảnh, chưa có thì icon nét (Icon3D)
export function ItemImg({ img, emoji, className = 'h-7 w-7' }: { img?: string; emoji: string; className?: string }) {
  if (!img) return <Icon3D emoji={emoji} className={className} />
  return <img src={img} alt="" aria-hidden="true" draggable={false} decoding="async" className={`${className} shrink-0 object-contain select-none`} />
}
