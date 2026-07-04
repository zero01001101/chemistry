# Báo cáo sửa compact UI + kéo thẻ flashcard

## Đã sửa thêm

- Nút trên mobile không còn bị ép full-width dài vô lý.
- Các nút phụ tiếp tục được gom vào menu ngắn: `☰ Menu`, `📄 Tài liệu`, `🔊 Nghe`.
- Nút mở/đóng bảng điều khiển giữ dạng compact:
  - Desktop/tablet: `☷ Bảng`.
  - Màn nhỏ: tự rút thành icon vuông `☷`.
  - Bảng điều khiển là drawer trượt, bấm nền mờ hoặc nút `×` để đóng.
- Flashcard đã có cơ chế nắm kéo:
  - Bấm nhanh vào thẻ: lật random trái/phải/lên/xuống.
  - Giữ rồi kéo: thẻ trượt theo đúng điểm chạm/trỏ chuột.
  - Kéo chưa quá nửa thẻ rồi thả: thẻ tự bật về vị trí cũ.
  - Kéo quá nửa chiều ngang/dọc rồi thả: thẻ lật theo hướng kéo.
  - Hỗ trợ pointer event cho mobile hiện đại, Safari/iOS, Chrome/Edge; có fallback touch/mouse.
- Có nhãn nhỏ khi kéo: `Thả: lật trái/phải/lên/xuống`.
- Animation dùng transform GPU, hạn chế render lại thẻ nên đỡ giật.

## File đã sửa

- `assets/js/app.js`
- `assets/css/styles.css`
- `DRAG_CARD_COMPACT_REPORT.md`

## Ghi chú test nhanh

- Trên điện thoại: giữ vào thẻ, kéo ngang/dọc, nếu kéo quá khoảng 50% kích thước thẻ thì thả ra sẽ lật.
- Nếu chỉ kéo nhẹ rồi thả, thẻ quay lại vị trí cũ.
- Nếu chỉ tap nhanh, thẻ lật random hướng.
