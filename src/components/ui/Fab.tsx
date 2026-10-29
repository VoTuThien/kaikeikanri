import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Skeleton } from './Skeleton'

// Nút nổi (Floating Action Button): tròn, góc phải dưới, chỉ có icon nét trắng đơn giản (quy ước trong CLAUDE.md).
// Không dùng icon 3D, không hiệu ứng khối nổi: chỉ có bóng đổ để nút nổi lên trên giao diện.

// Góc phải dưới của khung app (khung rộng tối đa 28rem ở giữa màn hình), chừa thanh home của iPhone
const POSITION = {
  right: 'max(1rem, calc((100vw - 28rem) / 2 + 1rem))',
  bottom: 'max(1.25rem, calc(env(safe-area-inset-bottom) + 0.75rem))',
}

// Kích thước nút; mọi FAB bằng nhau để xếp cạnh nhau thẳng hàng
const FAB_SIZE = 'h-14 w-14'

// Khoảng trống chừa ở cuối danh sách cuộn để mục cuối không bị FAB che
export const FAB_SPACE = 'pb-20'

// Icon nét trắng theo chức năng
export type FabIcon = 'add' | 'delete' | 'save' | 'edit' | 'cancel' | 'logout' | 'locate' | 'bell' | 'send'

const ICON_PATHS: Record<FabIcon, string[]> = {
  add: ['M12 5v14', 'M5 12h14'],
  save: ['M5 12.5l4.5 4.5L19 7'],
  delete: ['M4 7h16', 'M9 7V4.5h6V7', 'M6 7l1 12.5a1.5 1.5 0 0 0 1.5 1.5h7a1.5 1.5 0 0 0 1.5-1.5L18 7', 'M10 11v6', 'M14 11v6'],
  edit: ['M4 20h4L19 9l-4-4L4 16v4z', 'M13.5 6.5l4 4'],
  cancel: ['M6 6l12 12', 'M18 6L6 18'],
  logout: ['M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3', 'M10 17l5-5-5-5', 'M15 12H3'],
  // Tâm ngắm: cập nhật vị trí hiện tại
  locate: ['M12 19a7 7 0 1 0 0-14 7 7 0 0 0 0 14z', 'M12 2v3', 'M12 19v3', 'M2 12h3', 'M19 12h3', 'M12 13.2a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4z'],
  // Chuông: thông báo
  bell: ['M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16z', 'M10 20.5a2 2 0 0 0 4 0'],
  // Máy bay giấy: gửi yêu cầu
  send: ['M21 3L10 14', 'M21 3l-7 18-4-7-7-4 18-7z'],
}

function FabSvg({ icon }: { icon: FabIcon }) {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="#ffffff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICON_PATHS[icon].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}

type Variant = 'primary' | 'secondary' | 'danger'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-gradient-to-br from-fuchsia-500 to-indigo-500 shadow-fuchsia-900/50',
  secondary: 'bg-slate-500/70 backdrop-blur-xl shadow-black/40',
  danger: 'bg-rose-500 shadow-rose-900/50',
}

const BASE = `${FAB_SIZE} flex shrink-0 items-center justify-center rounded-full shadow-lg transition hover:brightness-110 active:scale-90 disabled:opacity-60`

// Nhóm FAB: nhiều nút thì xếp HÀNG NGANG, nút chính đặt cuối (nằm sát góc phải)
export function FabGroup({ children }: { children: ReactNode }) {
  return (
    <div className="fixed z-40 flex flex-row items-center gap-3" style={POSITION}>
      {children}
    </div>
  )
}

interface FabProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: FabIcon
  label: string // không hiện chữ, dùng cho trình đọc màn hình và chú thích khi giữ chuột
  variant?: Variant
  loading?: boolean
}

export function Fab({ icon, label, variant = 'primary', loading, disabled, className = '', ...rest }: FabProps) {
  return (
    <button aria-label={label} title={label} className={`${BASE} ${VARIANTS[variant]} ${className}`} disabled={disabled || loading} {...rest}>
      {loading ? <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <FabSvg icon={icon} />}
    </button>
  )
}

export function FabLink({ to, icon, label, variant = 'primary', badge = 0 }: { to: string; icon: FabIcon; label: string; variant?: Variant; badge?: number }) {
  return (
    <Link to={to} aria-label={badge ? `${label} (${badge})` : label} title={label} className={`${BASE} ${VARIANTS[variant]} relative`}>
      <FabSvg icon={icon} />
      {/* Số đếm (vd số yêu cầu chưa xử lý) ở góc trên phải */}
      {badge > 0 && (
        <span className="absolute -top-1 -right-1 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-indigo-950 bg-rose-500 px-1 text-xs leading-none font-bold text-white">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </Link>
  )
}

// Nhóm FAB cho màn hình form Tạo / Sửa (xếp ngang, nút chính bên phải):
// - Tạo mới: chỉ có nút lưu
// - Sửa: [xoá] [lưu]. Bấm xoá thì đổi thành [huỷ] [xoá] (bấm xoá lần nữa mới xoá thật)
// Nút lưu nằm ngoài <form> nên gắn vào form bằng thuộc tính `form={formId}`.
export function SaveDeleteFabs({
  formId,
  canDelete,
  confirming,
  saving,
  deleting,
  saveLabel,
  deleteLabel,
  onAskDelete,
  onCancelDelete,
  onDelete,
}: {
  formId: string
  canDelete: boolean
  confirming: boolean
  saving: boolean
  deleting: boolean
  saveLabel: string
  deleteLabel: string
  onAskDelete: () => void
  onCancelDelete: () => void
  onDelete: () => void
}) {
  return (
    <FabGroup>
      {canDelete && confirming && <Fab icon="cancel" label="Huỷ xoá" variant="secondary" onClick={onCancelDelete} />}
      {canDelete && (
        <Fab
          icon="delete"
          label={confirming ? `${deleteLabel} (xác nhận)` : deleteLabel}
          variant="danger"
          loading={deleting}
          onClick={confirming ? onDelete : onAskDelete}
          className={confirming ? 'ring-4 ring-rose-300/60' : ''}
        />
      )}
      {!confirming && <Fab type="submit" form={formId} icon="save" label={saveLabel} loading={saving} />}
    </FabGroup>
  )
}

// Skeleton của nhóm FAB: cùng vị trí, cùng số nút
export function FabSkeleton({ count = 1 }: { count?: number }) {
  return (
    <FabGroup>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className={`${FAB_SIZE} rounded-full`} />
      ))}
    </FabGroup>
  )
}
