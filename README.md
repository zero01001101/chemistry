# Học tiếng Anh Hóa học chuyên ngành — Frontend GitHub Pages

Project này được tạo từ file ZIP `BO_TU_VUNG_HOA_HOC_CHUYEN_NGANH(1).zip`.

## Có gì trong project

- `index.html`: app chính.
- `assets/css/styles.css`: giao diện hiện đại, responsive điện thoại/tablet/desktop, autoscale bằng CSS `clamp`, `svh`, safe-area cho iPhone, hoạt ảnh màn chờ/atom/card/micro.
- `assets/js/app.js`: logic học bài, ôn tập, kiểm tra, nghe, nói, đọc chuẩn, lưu data.
- `data/chemistry-data.js`: data gốc đã trích từ PDF trong ZIP.
- `data/user-data.template.json`: mẫu file data cá nhân.
- `assets/original/`: toàn bộ PDF gốc được giữ nguyên để không mất dữ liệu.

## Dữ liệu đã xử lý

- Số tuần/chủ đề: **24**
- Tổng thuật ngữ trích được từ bảng PDF: **2342**
- Mỗi tuần có nhánh: **Học bài**, **Ôn tập**, **Kiểm tra**, **Nói**, **Data gốc**.
- Bài luyện/đáp án của từng tuần được lưu trong `practiceText` và có link PDF gốc.

## Tính năng mới đã tích hợp

### 1. Đọc chuẩn / Text-to-Speech

- Dùng Web Speech API `speechSynthesis`.
- Ưu tiên giọng nữ tiếng Anh: Samantha, Ava, Victoria, Jenny, Aria, Zira, Google US English... tùy thiết bị có voice nào.
- Có nút **Nữ chuẩn**, **Đọc chậm**, **Đọc ví dụ**, **Test âm**, **Dừng âm**.
- Tự chia câu dài thành đoạn ngắn để hạn chế lỗi âm thanh bị cắt trên Chrome/Safari.
- Safari/iPhone không tự phát âm thanh khi tải trang; app dùng nút bấm/tap để phát, an toàn hơn cho iOS.

### 2. Bài nghe xong chọn đáp án

- Trong tab **Kiểm tra**, chọn kiểu câu **Nghe xong chọn đáp án**.
- App phát thuật ngữ tiếng Anh bằng giọng nữ, người học chọn nghĩa tiếng Việt đúng trong 4 đáp án.
- Vì Safari/iOS chặn autoplay, mỗi câu có nút **Nghe câu hỏi** để tránh lỗi không phát âm.
- Kết quả bài nghe được lưu vào `listeningHistory` trong data cá nhân.

### 3. Bài nói tiếng Anh

- Thêm tab **🎙️ Nói** ở từng tuần.
- 3 chế độ:
  - Đọc thuật ngữ.
  - Đọc câu ví dụ.
  - Nhìn nghĩa Việt → nói thuật ngữ tiếng Anh.
- Dùng `SpeechRecognition` hoặc `webkitSpeechRecognition`.
- Tự nhận transcript, lấy nhiều alternative nếu trình duyệt trả về, chọn transcript có điểm gần nhất.
- Chấm điểm bằng so khớp câu + so khớp token + Levenshtein similarity.
- Hiện rõ:
  - điểm %,
  - transcript tốt nhất,
  - từ thiếu/sai,
  - từ thừa/nghe nhầm,
  - mẹo sửa.
- Nếu trình duyệt không hỗ trợ nhận giọng nói, có fallback **nhập tay transcript** để vẫn luyện được.
- Kết quả nói được lưu vào `speakingHistory` trong data cá nhân.

### 4. Auto scale mọi thiết bị

- Viewport có `viewport-fit=cover` cho Safari/iPhone tai thỏ.
- Layout tự đổi:
  - desktop: nhiều cột,
  - tablet: 2 cột,
  - điện thoại: 1 cột, nút full width.
- Dùng `clamp()` cho font và thẻ lớn để không vỡ chữ.
- Có `prefers-reduced-motion` để giảm animation nếu máy bật chế độ giảm chuyển động.

## Cách up GitHub Pages

1. Tạo repo GitHub mới.
2. Upload toàn bộ file/folder trong project này lên repo, giữ nguyên cấu trúc.
3. Vào `Settings` → `Pages`.
4. Source chọn `Deploy from a branch`.
5. Branch chọn `main`, folder chọn `/root`.
6. Save, đợi GitHub cấp link Pages.

GitHub Pages chạy HTTPS nên phần micro/nhận giọng nói sẽ ổn hơn mở file trực tiếp.

## Lưu data / tiến độ

Vì đây là frontend static chạy trên GitHub Pages, trình duyệt **không thể tự ghi đè file trong repo GitHub** nếu không có backend hoặc GitHub API token. App đã làm 3 tầng lưu:

1. Tự lưu tiến độ vào `localStorage` của trình duyệt.
2. Nút **Xuất/ghi data.json** để tải file backup.
3. Nút **Nhập data.json** để mở lại đúng tiến độ.
4. Trên Chrome/Edge, nút **Ghi file cục bộ** dùng File System Access API để ghi ra file JSON trên máy.

Data cá nhân hiện lưu thêm:

- `masteredTerms`
- `difficultTerms`
- `notes`
- `customTerms`
- `testHistory`
- `listeningHistory`
- `speakingHistory`
- `audioSettings`

Nếu muốn tự động commit data lên GitHub repo sau mỗi lần học thì cần thêm backend/serverless function hoặc GitHub OAuth, không nên nhét token GitHub trực tiếp trong frontend vì lộ token.

## Tính năng kiểm tra

- Trắc nghiệm 4 đáp án English → Vietnamese.
- Trắc nghiệm 4 đáp án Vietnamese → English.
- Điền từ English → Vietnamese.
- Điền từ Vietnamese → English.
- Nghe tiếng Anh → chọn nghĩa tiếng Việt.
- Chế độ trộn tất cả.
- Sau khi nộp: hiện đáp án đúng, câu sai, giải thích, ví dụ ngữ cảnh.
- Câu sai tự đưa vào nhóm “Khó nhớ”.

## Lưu ý Safari / iPhone

- Dùng Safari thật, ưu tiên không chạy trong WebView hoặc PWA nếu nhận giọng nói bị lỗi.
- Cần cấp quyền Microphone.
- Nên mở trên GitHub Pages HTTPS hoặc `localhost`.
- Nút nghe/nói đều cần thao tác bấm/tap, không dùng autoplay để tránh Safari chặn âm thanh.
- Nếu `webkitSpeechRecognition` bị máy tắt, dùng fallback nhập tay trong tab Nói.

## Chạy local

Có thể mở trực tiếp `index.html` để xem giao diện, nhưng micro thường cần HTTPS/localhost. Nên chạy server nhỏ:

```bash
python -m http.server 8000
```

Sau đó mở `http://localhost:8000`.

## Bản v5 - Compact mobile UI

- Rút gọn toàn bộ button trên điện thoại, tránh nút text ngắn nhưng chiếm cả hàng.
- Gom chức năng phụ vào menu ngắn.
- Thêm nút `☷ Bảng` để mở/đóng bảng điều khiển.
- Bảng điều khiển không chiếm cột layout chính nữa, chuyển sang dạng drawer trượt gọn.
- Flashcard toolbar trên màn nhỏ dùng icon `✓`, `!`, `←`, `→` để không bị dài.
