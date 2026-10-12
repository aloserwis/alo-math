# Math Adventure V3 · Matematyczna Przygoda V3

A Polish–Vietnamese math app for children in grades 2 and 4. Choose a grade before starting. Each grade has its own 200 questions and separately saved progress, plus step-by-step hints, a parent area protected by a PIN, and CSV export.

Ứng dụng toán song ngữ Ba Lan–Việt cho trẻ lớp 2 và lớp 4. Chọn lớp trước khi bắt đầu. Mỗi lớp có 200 câu hỏi và tiến độ được lưu riêng, cùng với gợi ý từng bước, khu vực bố mẹ có PIN và chức năng xuất CSV.

## Files · Tệp

- `index.html` is the complete self-contained web app. Both question banks are embedded, so it works without an API.
- `questions.json` contains the 200 grade 4 questions; `questions-grade2.json` contains the 200 grade 2 questions. The app does not fetch these files at runtime.
- `CNAME` configures `math.aloserwis.com` for GitHub Pages.
- `.github/workflows/pages.yml` deploys the repository root to GitHub Pages on every push to `main`.

- `index.html` là webapp độc lập, đã nhúng cả hai bộ câu hỏi và không cần API.
- `questions.json` chứa 200 câu lớp 4; `questions-grade2.json` chứa 200 câu lớp 2. Ứng dụng không tải các tệp này khi chạy.
- `CNAME` cấu hình tên miền `math.aloserwis.com` cho GitHub Pages.
- `.github/workflows/pages.yml` tự triển khai thư mục gốc lên GitHub Pages mỗi khi có thay đổi trên nhánh `main`.

## Data · Dữ liệu

Each grade's progress and stars are stored separately in that browser's local storage. The parent PIN is shared by both grades and stored on that device. Data does not synchronize between devices. The PIN is an accidental-entry guard in the app UI, not strong authentication. CSV export is available in the parent panel.

Tiến độ và số sao của mỗi lớp được lưu riêng trong bộ nhớ trình duyệt. PIN bố mẹ dùng chung cho hai lớp và được lưu trên thiết bị đó. Dữ liệu không đồng bộ giữa các thiết bị. PIN chỉ giúp tránh bé vô tình mở khu vực quản lý, không phải xác thực bảo mật cao. Có thể xuất CSV trong khu vực bố mẹ.
