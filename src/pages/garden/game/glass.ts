// Nút tròn có icon trong game Vườn mây: dạng KÍNH, không màu riêng (nền trắng trong nhẹ + làm mờ phía sau + viền mảnh sáng + vệt sáng mép trên + bóng đổ).
// Thêm kích thước khi dùng, vd `${GLASS_ROUND} h-10 w-10`. Nhớ gắn `data-round` cho nút (toàn app không bo góc).
export const GLASS_ROUND =
  'flex shrink-0 items-center justify-center rounded-full border border-white/35 bg-white/[0.06] shadow-lg shadow-black/40 inset-shadow-[0_1px_0_rgba(255,255,255,0.45)] backdrop-blur-xl transition active:scale-90 disabled:opacity-35 disabled:active:scale-100'
