import type { Worker } from 'tesseract.js'

// Đọc chữ trên ảnh hoá đơn NGAY TRÊN MÁY bằng Tesseract.js (miễn phí, ảnh không gửi đi đâu).
// File của Tesseract (worker, lõi WebAssembly, dữ liệu tiếng Việt) nằm ở /tesseract/ (scripts/copy-tesseract.mjs), không tải từ CDN;
// lần đầu tải ~5MB rồi lưu trong máy (service worker CacheFirst + IndexedDB của Tesseract).
// Thư viện chỉ được tải khi mở màn hình Đọc hoá đơn (import động).

export interface OcrProgress {
  status: string // chữ hiện cho người dùng
  progress: number // 0..1
}

let workerPromise: Promise<Worker> | null = null
// Người đang chờ tiến độ (worker dùng chung giữa các lần đọc)
let current: ((m: { status: string; progress: number }) => void) | null = null

function getWorker(onProgress: (p: OcrProgress) => void) {
  if (!workerPromise) {
    workerPromise = import('tesseract.js').then(async ({ createWorker, PSM }) => {
      const base = `${location.origin}/tesseract`
      const worker = await createWorker('vie', 1, {
        workerPath: `${base}/worker.min.js`,
        corePath: base,
        langPath: base,
        gzip: true,
        logger: (m) => current?.(m),
      })
      // Hoá đơn: chữ xếp thành cột / dòng, giữ khoảng trắng giữa các cột để tách số tiền theo dòng
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK, preserve_interword_spaces: '1' })
      return worker
    })
    workerPromise.catch(() => {
      workerPromise = null
    })
  }
  current = (m) => onProgress(toProgress(m))
  return workerPromise
}

function toProgress(m: { status: string; progress: number }): OcrProgress {
  const map: Record<string, string> = {
    'loading tesseract core': 'Đang tải bộ đọc chữ',
    'initializing tesseract': 'Đang khởi động',
    'loading language traineddata': 'Đang tải dữ liệu tiếng Việt',
    'initializing api': 'Đang khởi động',
    'recognizing text': 'Đang đọc chữ',
  }
  return { status: map[m.status] ?? 'Đang chuẩn bị', progress: m.progress ?? 0 }
}

// Tắt bộ đọc chữ (rời màn hình) để giải phóng bộ nhớ trên iPhone
export async function stopOcr() {
  const p = workerPromise
  workerPromise = null
  current = null
  if (p) await (await p).terminate().catch(() => undefined)
}

/**
 * Chuẩn bị ảnh cho OCR: thu nhỏ (cạnh dài tối đa 1800px, đủ nét mà iPhone cũ không hết bộ nhớ), chuyển xám và kéo giãn độ tương phản
 * (ảnh chụp hoá đơn giấy nhiệt thường xám nhạt). Trả về canvas để đưa thẳng cho Tesseract, kèm data URL nhỏ để xem trước.
 */
async function prepare(file: Blob): Promise<{ canvas: HTMLCanvasElement; preview: string }> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('Không mở được ảnh.'))
      el.src = url
    })
    const scale = Math.min(1, 1800 / Math.max(img.naturalWidth, img.naturalHeight))
    const w = Math.round(img.naturalWidth * scale)
    const h = Math.round(img.naturalHeight * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0, w, h)
    const data = ctx.getImageData(0, 0, w, h)
    const px = data.data
    // Xám + kéo giãn độ tương phản theo khoảng sáng thực tế của ảnh (bỏ 2% điểm tối / sáng nhất)
    const hist = new Array<number>(256).fill(0)
    for (let i = 0; i < px.length; i += 4) {
      const g = Math.round(px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114)
      px[i] = g
      hist[g]++
    }
    const total = w * h
    let lo = 0
    let hi = 255
    for (let acc = 0; lo < 255 && (acc += hist[lo]) < total * 0.02; lo++);
    for (let acc = 0; hi > 0 && (acc += hist[hi]) < total * 0.02; hi--);
    const range = Math.max(1, hi - lo)
    for (let i = 0; i < px.length; i += 4) {
      const v = Math.max(0, Math.min(255, ((px[i] - lo) * 255) / range))
      px[i] = px[i + 1] = px[i + 2] = v
    }
    ctx.putImageData(data, 0, 0)
    // Ảnh xem trước nhỏ (không giữ ảnh gốc lớn trong bộ nhớ)
    const pv = document.createElement('canvas')
    const ps = Math.min(1, 320 / Math.max(w, h))
    pv.width = Math.round(w * ps)
    pv.height = Math.round(h * ps)
    pv.getContext('2d')!.drawImage(img, 0, 0, pv.width, pv.height)
    return { canvas, preview: pv.toDataURL('image/jpeg', 0.8) }
  } finally {
    URL.revokeObjectURL(url)
  }
}

// Đọc chữ trên ảnh hoá đơn. Trả về chữ thô (tách dữ liệu bằng parseReceipt trong receiptParse.ts)
export async function readReceiptText(file: Blob, onProgress: (p: OcrProgress) => void): Promise<{ text: string; preview: string }> {
  onProgress({ status: 'Đang xử lý ảnh', progress: 0 })
  const { canvas, preview } = await prepare(file)
  const worker = await getWorker(onProgress)
  const { data } = await worker.recognize(canvas)
  return { text: data.text ?? '', preview }
}
