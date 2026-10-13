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

On first use, a parent sets a PIN and chooses the grade. The PIN is required to change grades or open the results panel. Each grade's progress and stars are stored separately in that browser's local storage; the PIN is shared by both grades. Data does not synchronize between devices. The PIN protects the app's parent controls on that device. CSV export is available in the parent panel.

Khi dùng lần đầu, bố mẹ đặt PIN rồi chọn lớp. Cần PIN để đổi lớp hoặc mở khu vực xem kết quả. Tiến độ và số sao của từng lớp được lưu riêng trong trình duyệt; PIN dùng chung cho hai lớp. Dữ liệu không đồng bộ giữa các thiết bị. Có thể xuất CSV trong khu vực bố mẹ.


## Install · Cài đặt

The app is a Progressive Web App. On iPhone or iPad, open it in Safari, tap the install icon in the header, then use Share → Add to Home Screen. On Android, tap the install icon when it appears or choose Install app from the browser menu. The app shell is cached for offline use; when online, each opening checks the latest version.

Ứng dụng hỗ trợ cài như PWA. Trên iPhone hoặc iPad, mở bằng Safari, nhấn biểu tượng cài đặt ở đầu trang, rồi chọn Chia sẻ → Thêm vào Màn hình chính. Trên Android, nhấn biểu tượng cài đặt khi xuất hiện hoặc chọn Cài đặt ứng dụng trong menu trình duyệt. Phần giao diện được lưu để dùng ngoại tuyến; khi có mạng, ứng dụng kiểm tra bản mới mỗi lần mở.
