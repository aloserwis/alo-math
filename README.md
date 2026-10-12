# Math Adventure V3 · Matematyczna Przygoda V3

A Polish-first, Polish–Vietnamese grade 4 math app with 200 fixed questions, step-by-step hints, saved progress, a parent area protected by a PIN, and CSV export.

Ứng dụng toán lớp 4 song ngữ Ba Lan–Việt, tiếng Ba Lan là ngôn ngữ chính và tiếng Việt là phần chú giải. Có 200 bài cố định, gợi ý từng bước, lưu tiến độ, khu vực bố mẹ có PIN và xuất CSV.

## Files · Tệp

- `index.html` is the complete self-contained web app. The fixed question bank is embedded so the app works without an API.
- `questions.json` is the matching standalone question bank for review and reuse; the app does not fetch it at runtime.
- `CNAME` configures `math.aloserwis.com` for GitHub Pages.
- `.github/workflows/pages.yml` deploys the repository root to GitHub Pages on every push to `main`.

- `index.html` là webapp độc lập, đã nhúng ngân hàng câu hỏi và không cần API.
- `questions.json` là bản dữ liệu câu hỏi riêng để xem và tái sử dụng; ứng dụng không tải tệp này khi chạy.
- `CNAME` cấu hình tên miền `math.aloserwis.com` cho GitHub Pages.
- `.github/workflows/pages.yml` tự triển khai thư mục gốc lên GitHub Pages mỗi khi có thay đổi trên nhánh `main`.

## Data · Dữ liệu

Progress and the parent PIN stay in that browser's local storage and do not synchronize between devices. The PIN is an accidental-entry guard in the app UI, not strong authentication. CSV export is available in the parent panel.

Tiến độ và PIN bố mẹ được lưu cục bộ trong trình duyệt, không đồng bộ giữa các thiết bị. PIN chỉ giúp tránh bé vô tình mở khu vực quản lý, không phải xác thực bảo mật cao. Có thể xuất CSV trong khu vực bố mẹ.
