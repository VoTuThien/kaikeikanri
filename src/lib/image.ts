// Xử lý ảnh ngay trên máy (không cần Firebase Storage): cắt vuông ở giữa rồi thu nhỏ, trả về data URL JPEG
// để lưu thẳng vào Firestore. 256px chất lượng 0.82 thường chỉ khoảng 20–40KB, vừa đủ nét cho avatar.
// Trình duyệt tự xoay ảnh theo hướng chụp (EXIF) khi vẽ, nên ảnh chụp dọc trên iPhone không bị nằm ngang.

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Không đọc được ảnh'))
    }
    img.src = url
  })
}

export async function fileToSquareDataUrl(file: File, size = 256, quality = 0.82): Promise<string> {
  const img = await loadImage(file)
  const side = Math.min(img.naturalWidth, img.naturalHeight)
  const sx = (img.naturalWidth - side) / 2
  const sy = (img.naturalHeight - side) / 2
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Trình duyệt không hỗ trợ xử lý ảnh')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size)
  return canvas.toDataURL('image/jpeg', quality)
}
