# Báo cáo sửa UI compact button + bảng điều khiển

## Đã sửa

- Bỏ kiểu nút dài full-width không cần thiết trên mobile.
- Rút ngắn text nút chính: `Học`, `Ôn`, `Thi`, `Nói`, `Gốc`, `T01...T24`.
- Gom các nút phụ vào menu `☰ Menu`, `📄 Tài liệu`, `🔊 Nghe`, `⋯`.
- Thêm nút `☷ Bảng` để mở/đóng bảng điều khiển.
- Bảng điều khiển chuyển sang dạng drawer trượt, không chiếm cột layout chính nữa.
- Trên điện thoại, nút `☷ Bảng` và `☰ Menu` tự rút thành icon vuông 40px.
- Các nút `Thuộc`/`Khó` trên flashcard ở màn nhỏ rút thành icon `✓` và `!` để không kéo dài toolbar.
- Tuần nhanh trong bảng điều khiển rút thành `T01`, `T02`, ... để không dài dòng.
- Layout chính dùng toàn bộ chiều ngang màn hình, không bị panel bên trái làm bóp méo nội dung.

## File đã sửa

- `assets/js/app.js`
- `assets/css/styles.css`
- `COMPACT_BUTTON_PANEL_REPORT.md`

## Cách dùng

- Bấm `☷ Bảng` để mở bảng điều khiển.
- Bấm `×` hoặc chạm nền mờ để đóng bảng.
- Trên mobile, topbar chỉ giữ các nút cực ngắn để tránh dài, lệch, tràn màn hình.
