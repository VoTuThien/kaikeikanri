import cascadeLayers from '@csstools/postcss-cascade-layers'
import oklabFunction from '@csstools/postcss-oklab-function'

// Gradient của Tailwind v4 có dạng "to bottom right in oklab" (chọn không gian màu khi pha màu).
// Safari iOS < 16.2 không hiểu "in oklab" nên bỏ cả gradient -> nền màu của quỹ / thẻ hoạt động bị mất.
// Bỏ phần "in ..." đi: gradient pha màu theo sRGB, khác biệt rất ít khi nhìn.
const gradientFallback = {
  postcssPlugin: 'gradient-interpolation-fallback',
  Declaration(decl) {
    if (decl.prop === '--tw-gradient-position' && / in \w+/.test(decl.value)) {
      decl.value = decl.value.replace(/\s*in \w+(\s+\w+\s+hue)?\s*$/, '').trim() || 'to bottom'
    }
  },
}

// Tailwind v4 bọc mọi style trong @layer và dùng màu oklch().
// Safari / iPhone cũ (iOS < 15.4) không hiểu 2 thứ này nên bỏ qua toàn bộ CSS -> giao diện như bị mất CSS.
// Chuyển @layer thành CSS thường và thêm màu rgb dự phòng để máy cũ vẫn hiển thị đúng.
export default {
  plugins: [gradientFallback, cascadeLayers(), oklabFunction({ preserve: true })],
}
