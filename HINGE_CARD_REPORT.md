# HINGE CARD REPORT - v7

Đã thay cơ chế kéo thẻ cũ bằng cơ chế thẻ xoay như cánh cửa 3D.

## Đã sửa

- Bỏ kiểu kéo cả thẻ trượt theo con trỏ.
- Thẻ không còn translate ngang/dọc khi kéo.
- Khi giữ và kéo cạnh trái/phải, thẻ xoay quanh trục dọc ở giữa bằng rotateY.
- Khi giữ và kéo cạnh trên/dưới, thẻ xoay quanh trục ngang ở giữa bằng rotateX.
- Nếu giữ ở vùng giữa thẻ, hướng xoay được quyết định theo hướng kéo chính.
- Khi đang kéo, hiện đường trục dọc/ngang ở giữa thẻ.
- Hiện điểm chạm/điểm giữ trên thẻ để cảm giác như đang nắm vào thẻ.
- Kéo quá nửa chiều thẻ thì thả ra sẽ lật theo hướng kéo.
- Kéo chưa quá nửa thì thả ra bật mượt về vị trí cũ.
- Tap/click nhanh vẫn lật random hướng như cũ.

## File đã sửa

- `assets/js/app.js`
- `assets/css/styles.css`

## Logic ngưỡng lật

- Trục dọc: lấy 50% chiều rộng thẻ làm ngưỡng.
- Trục ngang: lấy 50% chiều cao thẻ làm ngưỡng.
- Vượt ngưỡng: commit flip.
- Chưa vượt ngưỡng: snap back.
