import { useProfile } from '../lib/profile'
import { BLOCK_3D, GLOSS_3D } from './ui/style3d'

// Avatar người dùng, LUÔN TRONG KHUNG TRÒN (quy ước mục 13). Dùng ở mọi nơi hiện thành viên (gia đình, lương, ghi chú, trạng thái...):
// - Có ảnh trong Thông tin cá nhân (profiles/{uid}.photo, src/lib/profile.ts) thì hiện ảnh thật
// - Chưa có ảnh: vòng tròn 2 chữ cái đầu tên, mỗi tài khoản 1 màu cố định
const AVATAR_COLORS = [
  'from-rose-400 to-pink-600',
  'from-amber-300 to-orange-500',
  'from-emerald-400 to-teal-600',
  'from-sky-400 to-blue-600',
  'from-violet-400 to-purple-600',
  'from-lime-300 to-green-600',
]

// Mỗi tài khoản luôn có cùng 1 màu
function avatarColor(uid: string) {
  let h = 0
  for (const ch of uid) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

// "Vũ Quang" -> "VQ", "Nguyễn Văn An" -> "VA", "abc@mail.com" -> "A"
function initials(name: string) {
  const words = name.split('@')[0].trim().split(/\s+/).filter(Boolean)
  return words
    .slice(-2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

/**
 * @param photo  ảnh muốn hiện ngay (vd ảnh vừa chọn trong form, chưa lưu); không truyền thì lấy ảnh trong hồ sơ của `uid`;
 *               truyền null thì hiện 2 chữ cái (vd vừa bấm "Bỏ ảnh")
 */
export function Avatar({ uid, name, me, size = 'h-9 w-9 text-xs', photo }: { uid: string; name: string; me?: boolean; size?: string; photo?: string | null }) {
  const profile = useProfile(photo === undefined ? uid : undefined)
  const src = photo === undefined ? profile?.photo : photo
  if (src) {
    return (
      // Khung block + overflow-hidden rounded-full, img cũng rounded-full: cắt tròn chắc chắn cả trên iOS cũ
      <span
        title={name}
        className={`${size} relative block shrink-0 overflow-hidden rounded-full border-2 border-white/40 shadow-lg shadow-black/30 ${me ? 'ring-2 ring-white' : ''}`}
      >
        <img src={src} alt="" className="block h-full w-full rounded-full object-cover" draggable={false} />
      </span>
    )
  }
  return (
    <span
      title={name}
      className={`${size} relative flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-bold text-white ${BLOCK_3D} ${avatarColor(uid)} ${
        me ? 'ring-2 ring-white' : ''
      }`}
    >
      <span className={`${GLOSS_3D} !rounded-full`} />
      {initials(name) || '?'}
    </span>
  )
}
