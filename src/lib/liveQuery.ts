import { useEffect, useState, useSyncExternalStore } from 'react'
import { requireFamily } from './family'

// Dữ liệu realtime có NHỚ TẠM (giữ trong bộ nhớ suốt lúc mở app):
// - Lần đầu mở 1 màn hình (chưa có gì) thì trả null -> màn hình hiện skeleton như cũ
// - Những lần sau (vd vuốt qua lại giữa màn hình chính và màn hình 2 bên, mở lại 1 app con) thì trả ngay dữ liệu đã có,
//   KHÔNG hiện skeleton nữa (tránh chớp skeleton -> nội dung); trong lúc chờ dữ liệu mới từ server thì hiện
//   vòng xoay nhỏ ở góc trái dưới (RefreshIndicator) cho biết trang đang được cập nhật lại.

const cache = new Map<string, unknown>()

// Số truy vấn đang cập nhật lại (đã có dữ liệu cũ, chờ dữ liệu mới) -> vòng xoay nhỏ
let refreshing = 0
const listeners = new Set<() => void>()
function addRefreshing(d: number) {
  refreshing = Math.max(0, refreshing + d)
  listeners.forEach((l) => l())
}
export function useRefreshing() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => refreshing > 0,
  )
}

// Hết thời gian này mà chưa có dữ liệu từ server (vd mất mạng) thì thôi quay vòng xoay
const REFRESH_TIMEOUT = 6000

/**
 * @param key  khoá nhớ tạm duy nhất cho truy vấn (null = chưa sẵn sàng / không truy vấn)
 * @param subscribe  đăng ký realtime; gọi onData(giá trị, fromCache) mỗi lần có dữ liệu, trả về hàm huỷ đăng ký
 */
export function useLiveQuery<T>(key: string | null, subscribe: (onData: (value: T, fromCache: boolean) => void) => () => void): T | null {
  const [data, setData] = useState<{ key: string | null; value: T | null }>(() => ({
    key,
    value: key && cache.has(key) ? (cache.get(key) as T) : null,
  }))

  useEffect(() => {
    if (!key) return
    const had = cache.has(key)
    setData({ key, value: had ? (cache.get(key) as T) : null })
    // Đã có dữ liệu cũ: hiện vòng xoay nhỏ cho tới khi có dữ liệu mới từ server
    let waiting = had
    if (waiting) addRefreshing(1)
    const stop = () => {
      if (!waiting) return
      waiting = false
      addRefreshing(-1)
    }
    const timer = window.setTimeout(stop, REFRESH_TIMEOUT)
    const unsub = subscribe((value, fromCache) => {
      cache.set(key, value)
      setData({ key, value })
      if (!fromCache) stop()
    })
    return () => {
      unsub()
      window.clearTimeout(timer)
      stop()
    }
    // subscribe được tạo lại mỗi lần render; truy vấn chỉ đổi khi key đổi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  // Key vừa đổi mà effect chưa chạy: lấy theo key mới (từ bộ nhớ tạm nếu có) để không hiện nhầm dữ liệu cũ
  if (data.key !== key) return key && cache.has(key) ? (cache.get(key) as T) : null
  return data.value
}

// Khoá nhớ tạm theo gia đình đang chọn, vd familyKey('funds') -> "fam123:funds"
export const familyKey = (...parts: (string | number)[]) => [requireFamily(), ...parts].join(':')
