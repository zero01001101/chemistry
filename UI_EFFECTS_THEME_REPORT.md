# UI Effects + Theme Report v4

Đã sửa theo yêu cầu:

## 1. Flashcard xoay lật 3D mượt
- Bỏ kiểu lật phải render lại toàn bộ nên không còn giật một cái.
- Click/bấm thẻ: tự random hướng lật `left / right / up / down`.
- Vuốt trên thẻ:
  - Vuốt trái: thẻ lật theo hướng trái.
  - Vuốt phải: thẻ lật theo hướng phải.
  - Vuốt lên: thẻ lật lên.
  - Vuốt xuống: thẻ lật xuống.
- Dùng `pointer/touch gesture`, `transform-style: preserve-3d`, `backface-visibility`, `will-change: transform`.
- Có hỗ trợ bàn phím: nhấn `Enter` hoặc `Space` để lật random.

## 2. Mode sáng/tối
- Thêm nút đổi theme ngay màn chờ và topbar.
- Mặc định dùng mode sáng vì giao diện cũ quá tối.
- Theme được lưu vào localStorage trong `userData.preferences.theme`, mở lại vẫn giữ theme đã chọn.

## 3. Đổi màu web sáng hơn
- Đổi sang nền sáng xanh trắng, card kính trắng, chữ đậm dễ đọc.
- Vẫn giữ mode tối nếu cần dùng ban đêm.
- Cập nhật theme-color cho mobile browser.

## 4. File đã sửa
- `index.html`
- `assets/css/styles.css`
- `assets/js/app.js`
