# Mobile fix v3

Bản này đã thêm lớp `MOBILE HARDENING PATCH v3` ở cuối `assets/css/styles.css` để ghi đè toàn bộ responsive cũ.

Đã xử lý:

- Khóa `overflow-x:hidden` cho `html/body/app` để không còn kéo ngang.
- Ép toàn bộ layout lớn về 1 cột trên mobile: splash, topbar, sidebar, tuần, học bài, kiểm tra, nghe, nói.
- Ép tất cả nút/tab/action full width ở màn nhỏ.
- Sửa text dài bằng `overflow-wrap:anywhere` cho thuật ngữ hóa học dài.
- Sửa input iPhone bằng `font-size:16px` để Safari không tự zoom.
- Sửa bảng data thành block trên mobile.
- Sửa drawer lưu data trên điện thoại không bị tràn khỏi màn.
- Sửa atom splash tự co theo viewport, không làm vỡ layout.
- Sửa flashcard, quiz, speaking/listening panel cho điện thoại 360px/390px/430px.

File chính đã sửa:

```txt
assets/css/styles.css
```
