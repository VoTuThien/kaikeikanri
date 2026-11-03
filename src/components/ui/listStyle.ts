import { SIZE } from './sizes'

// Kiểu nền dùng chung cho bảng / danh sách (quy ước mục 15 trong CLAUDE.md): mọi phần trong bảng theo kiểu GLASS GRADIENT
// giống các thẻ nổi khác, KHÔNG dùng nền màu đặc. Ngoại lệ: màn hình Tra cứu của app Quỹ (dòng giao dịch có 2 màu nền).

// Header dính trên đầu bảng khi cuộn (vd "Gửi cho: …" ở app Ghi chú): nền glass mờ, nội dung cuộn bên dưới bị làm mờ;
// z-20 để nằm trên hàng đang kéo thả (z-10). Thêm px-* theo lề của bảng.
export const LIST_HEADER = `${SIZE.stickyHeader} sticky top-0 z-20 truncate border-b border-white/10 bg-white/10 text-xs leading-8 font-semibold text-white/80 backdrop-blur-xl`

// Thẻ / hàng trong bảng: trong suốt để hiện nền glass gradient của bảng.
// SwipeActions chỉ vẽ vùng nút đúng bằng phần thẻ đã trượt ra, nên không cần nền đặc để che nút phía sau.
export const LIST_ROW_BG = 'bg-transparent'

// Thẻ glass có trượt sang trái (SwipeActions): nền nút lấn sang phía thẻ chừng này (px), nằm dưới thẻ (quy ước mục 16).
// Nút trong `actions` thêm lề trái bằng chừng này (SWIPE_OVERLAP_PAD) để chữ / icon nằm giữa phần lộ ra.
export const SWIPE_OVERLAP = 16
export const SWIPE_OVERLAP_PAD = 'pl-4'

// Danh sách dạng THẺ TÁCH RỜI (Nhóm quỹ, các danh sách của app Ghi chú): mỗi thẻ là 1 khối glass bo góc có bóng đổ,
// các thẻ cách nhau (LIST_CARDS_GAP), không đặt chung trong 1 bảng glass. Thẻ có trượt thì SwipeActions truyền radius={LIST_CARD_RADIUS}.
export const LIST_CARD = 'rounded-2xl border border-white/20 bg-white/10 shadow-lg shadow-black/20 backdrop-blur-xl'
export const LIST_CARD_RADIUS = 16 // rounded-2xl
export const LIST_CARDS_GAP = 'space-y-3'
// Vùng cuộn của danh sách thẻ: chừa chút lề để bóng đổ của thẻ không bị cắt khi cuộn
export const LIST_CARDS_SCROLL = '-mx-1 px-1 py-1'
// Thẻ đang kéo thả trong danh sách thẻ tách rời: phóng to nhẹ, nằm trên các thẻ khác
export const LIST_CARD_DRAGGING = 'z-10 scale-[1.02]'

// Hàng đang kéo thả (useDragReorder): nền glass sáng hơn + viền mảnh + bóng đổ để nổi lên, không chồng chữ lên hàng khác
export const LIST_DRAGGING = 'z-10 rounded-xl border border-white/25 bg-white/15 shadow-xl shadow-black/40 backdrop-blur-xl'
