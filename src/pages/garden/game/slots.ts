// Chỗ đặt chậu CỐ ĐỊNH của từng tầng mây (xem CLAUDE.md "Bộ chậu" / GĐ2): tầng 1: 12, tầng 2: 6, tầng 3: 5, tầng 4: 4.
// Toạ độ lấy từ Blender (`design/vuon-may/tang-may.blend`), đổi sang trục của three.js: (x, z, -y) — điểm giữa đáy chậu trên mặt mây.
// Đã kiểm tra trong Blender: mặt mây phẳng quanh chỗ đặt (bán kính 0,5–0,6), cách máy và các chậu khác.
// `shape` = dáng chậu đất nung mặc định (1 tròn, 2 bát, 3 ống cao, 4 vuông, 5 bầu, 6 có đĩa) — sau này người chơi tự chọn chậu (GĐ3).
// Tầng 1: chỗ thứ i ↔ ô đất thứ i của vườn (`plots[i]`); 6 chỗ đầu là 6 ô mở sẵn.

export interface Slot {
  pos: [number, number, number]
  shape: number
}

const b = (x: number, y: number, z: number, shape: number): Slot => ({ pos: [x, z, -y], shape })

export const SLOTS: Slot[][] = [
  [
    b(-2.7, -0.75, 0.498, 2), b(-1.35, -0.75, 0.385, 1), b(0, -0.75, 0.57, 6),
    b(-2.7, 0.65, 0.366, 4), b(-1.35, 0.65, 0.436, 5), b(0, 0.65, 0.286, 3),
    b(0.36, 2.16, 0.52, 5), b(-1.05, 1.87, 0.64, 1), b(-2.35, 1.87, 0.43, 2),
    b(-2.05, -1.83, 0.59, 3), b(-0.65, -1.83, 0.58, 4), b(0.65, -1.83, 0.59, 6),
  ],
  [
    b(-2.45, 1.75, 4.385, 1), b(-3.65, 1.65, 4.339, 2), b(-4, 2.65, 4.442, 3),
    b(-2.79, 2.87, 4.364, 4), b(-2.42, 3.92, 4.612, 5), b(-1.14, 4, 4.754, 6),
  ],
  [
    b(1.83, 2.6, 8.246, 1), b(3.4, 3.5, 8.124, 4), b(2.8, 4.65, 8.082, 5), b(4.1, 4.6, 8.222, 6), b(4.6, 3.5, 8.36, 2),
  ],
  [
    b(-1.2, 5.1, 11.563, 2), b(-2.88, 5.16, 11.742, 3), b(-1.2, 6.3, 11.473, 4), b(0.45, 5.4, 11.723, 6),
  ],
]

// id cây trong CROPS → tên mô hình trong `cay-trong.glb` (`Cay_<Ten>`, con `Cay_<Ten>_GD0…GD3`)
export const PLANT_NODE: Record<string, string> = {
  cai: 'Cai', carot: 'CaRot', cachua: 'CaChua', ngo: 'Ngo', dau: 'Dau', huongduong: 'HuongDuong', duahau: 'DuaHau', bingo: 'BiNgo',
}

// Cây to quá so với 1 số dáng chậu (lá / quả xuyên thành chậu) thì thu nhỏ theo hệ số này — đo bằng số liệu trong Blender
export const PLANT_FIT: Record<string, Record<number, number>> = {
  bingo: { 3: 0.9, 5: 0.85 },
  duahau: { 3: 0.8, 4: 0.9, 5: 0.75, 6: 0.9 },
}
export const plantFit = (crop: string, shape: number) => PLANT_FIT[crop]?.[shape] ?? 1
