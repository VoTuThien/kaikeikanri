import cascadeLayers from '@csstools/postcss-cascade-layers'
import oklabFunction from '@csstools/postcss-oklab-function'

// Tailwind v4 bọc mọi style trong @layer và dùng màu oklch().
// Safari / iPhone cũ (iOS < 15.4) không hiểu 2 thứ này nên bỏ qua toàn bộ CSS -> giao diện như bị mất CSS.
// Chuyển @layer thành CSS thường và thêm màu rgb dự phòng để máy cũ vẫn hiển thị đúng.
export default {
  plugins: [cascadeLayers(), oklabFunction({ preserve: true })],
}
