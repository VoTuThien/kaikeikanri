# Script dựng mô hình Vườn mây (Blender 5.3 + MCP)

Chạy trong Blender đang mở `design/vuon-may/tang-may.blend` (qua MCP `execute_blender_code`):

```python
exec(open(r"C:\projects\dev_gia_dinh\kaikeikanri\design\vuon-may\scripts\h2.py", encoding="utf-8").read())
```

**Luôn chạy `h2.py` trước** (mỗi lần Blender khởi động lại): nạp các hàm dùng chung vào `bpy.app.driver_namespace`:
- `ns["H2"]`: `get_coll`, `mat`, `lathe` (xoay mặt cắt), `torus`, `tube`, `sphere`, `join` (áp modifier + transform rồi gộp), `rad` / `rin` (bán kính ngoài / trong theo mặt cắt),
  `make_pot` (tạo chậu `<prefix>_n` gồm `_Than` / `_Dat` / `_DiemCay`), `add_level` (gộp + gắn lớp `_Lv{cấp}` đang ẩn), `wall_hits` / `fit_plants` (đo cây xuyên thành chậu → `PLANT_FIT`).
- `ns["render_lv"](names, path, level, res, pad, transparent, world_off)`: render trực giao nghiêng 22°, chỉ bật lớp `_Lv{level}`, tông màu Standard.
- `ns["render_crop"](root, path)`: icon cây chín (chỉ bật `<root>_GD3`, nghiêng 18°, khung vuông 384px) → cắt vuông + 256px webp ở `public/game/cay/`.
- `ns["render_lv_glow"](names, base, level, ...)`: render 2 lần (`<base>_t.png` nền trong + `<base>_k.png` nền đen) để ghép giữ quầng sáng.

| File | Việc |
|---|---|
| `h2.py` | hàm dùng chung (xem trên) |
| `glow_merge.py <base> <out> [hex]` | (Python ngoài Blender, cần Pillow) ghép `<base>_t.png` + `<base>_k.png` thành ảnh nền trong suốt còn quầng sáng; dùng cho ảnh chậu 192px, icon tiền, icon cục roll |
| `ph_base.py` → `ph_levels.py` | bộ chậu Phượng Hoàng (cấp 1, rồi cấp 2–6). Chạy theo nhóm 2 chậu: đặt `bpy.app.driver_namespace["PH_ONLY"] = [1, 2]` trước khi `exec` (cả 6 một lần dễ làm Blender quá thời gian) |
| `bt_base.py` → `bt_levels.py` | bộ chậu Băng Tinh |
| `sl_levels.py` | cấp 2–6 bộ Sứ Lam (phần dựng cấp 1 đã chạy trực tiếp, không lưu file; cần `ns["SL_M"]`, `ns["sl_specs"]` đã có trong phiên Blender) |
| `manh_sao.py` / `bua.py` / `phan_bon.py` | icon item: mảnh vỡ sao (`ManhSao_Sang`, `ManhSao`), bùa (`Bua_B` / `_A` / `_S` / `_GiuCap`), túi phân bón (`PhanBon_B` / `_A`, chép lưới túi hạt) |
| `item_icons.py <dir>` | (Python ngoài Blender) cắt + xuất 8 icon item 128px webp vào `public/game/sao/`, `bua/`, `phan/` |
| `tui_hat.py` | mô hình túi hạt giống `TuiHat` |
| `buom.py` | bươm bướm `Buom` (collection `ConTrung`); xuất lại `con-trung.glb` cùng 4 con kia: tạm đặt gốc 5 khung về (0,0,0), `export_texcoords=False`, meshopt |
| `gacha_sim.ts` | mô phỏng 300.000 lần quay gacha để kiểm tra tỉ lệ / bảo đảm: `npx tsx design/vuon-may/scripts/gacha_sim.ts` |

Các bộ chậu cũ hơn (Đất nung, Mây tre, Biển cả, Rừng nấm, Trung thu, Mật ong, Thiên hà), cây trồng, máy, côn trùng, cục roll, icon tiền
đã dựng bằng mã chạy trực tiếp, không lưu file — mô hình vẫn nằm trong `tang-may.blend`. Dựng bộ mới thì theo mẫu `ph_base.py` / `ph_levels.py`.

Xuất `.glb` (mẫu, xem CLAUDE.md "GĐ2" / "Thêm bộ chậu mới"): tạm đặt gốc về (0,0,0), thêm Decimate tên `XuatGiam` cho `_Than` / `_Lv*`,
`bpy.ops.export_scene.gltf(use_selection=True, export_apply=True, export_extras=True, export_yup=True, export_materials='EXPORT',
export_vertex_color='MATERIAL', export_meshopt_compression_enable=True)`, rồi trả lại vị trí / xoá modifier.
