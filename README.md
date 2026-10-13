# Math Adventure V3 · Matematyczna Przygoda V3

A Polish–Vietnamese math app for children in grades 2 and 4. Choose a grade before starting. Each grade has its own 200 questions and separately saved progress, plus step-by-step hints, a parent area protected by a PIN, PDF export, and optional email OTP account sync across devices.

Ứng dụng toán song ngữ Ba Lan–Việt cho trẻ lớp 2 và lớp 4. Chọn lớp trước khi bắt đầu. Mỗi lớp có 200 câu hỏi và tiến độ được lưu riêng, cùng với gợi ý từng bước, khu vực bố mẹ có PIN, xuất PDF và tùy chọn đồng bộ tài khoản qua OTP email giữa các thiết bị.

## Files · Tệp

- `index.html` is the complete web app. The question banks are embedded. Supabase Auth and Postgres are used only when a parent chooses email sync.
- `questions.json` contains the 200 grade 4 questions; `questions-grade2.json` contains the 200 grade 2 questions. The app does not fetch these files at runtime.
- `CNAME` configures `math.aloserwis.com` for GitHub Pages.
- `.github/workflows/pages.yml` deploys the repository root to GitHub Pages on every push to `main`.

- `index.html` là webapp độc lập, đã nhúng cả hai bộ câu hỏi và không cần API.
- `questions.json` chứa 200 câu lớp 4; `questions-grade2.json` chứa 200 câu lớp 2. Ứng dụng không tải các tệp này khi chạy.
- `CNAME` cấu hình tên miền `math.aloserwis.com` cho GitHub Pages.
- `.github/workflows/pages.yml` tự triển khai thư mục gốc lên GitHub Pages mỗi khi có thay đổi trên nhánh `main`.

## Data · Dữ liệu

On first use, a parent sets a PIN and chooses the grade. The PIN is required to change grades or open the results panel. Each grade's progress and stars are stored separately in that browser's local storage. Parents can connect an email using a 6-digit OTP in the parent area to sync both grades across devices. The PIN stays on each device and is never sent to the server. PDF export is available in the parent panel.

Khi dùng lần đầu, bố mẹ đặt PIN rồi chọn lớp. Cần PIN để đổi lớp hoặc mở khu vực xem kết quả. Tiến độ và số sao của từng lớp được lưu riêng trong trình duyệt. Bố mẹ có thể kết nối email bằng mã OTP 6 số trong khu vực phụ huynh để đồng bộ kết quả giữa các thiết bị. PIN chỉ lưu trên từng thiết bị và không được gửi lên máy chủ. Báo cáo PDF có trong khu vực phụ huynh.

## Cloud setup · Cấu hình đồng bộ

The Supabase project uses the public publishable key in the browser. The `math_adventure_state` table is protected by row-level security; each authenticated account can access only its own row. Never put a Supabase `service_role` key or the database password in this repository.

Mã publishable công khai của Supabase được dùng trong trình duyệt. Bảng `math_adventure_state` bật RLS để mỗi tài khoản chỉ truy cập dữ liệu của chính mình. Không đưa khóa `service_role` hoặc mật khẩu cơ sở dữ liệu vào repository.

The SQL migration is in `supabase/migrations/`. In Supabase Auth, set the Site URL to `https://math.aloserwis.com` and allow that domain as a redirect. Numeric email OTP requires an email template containing `{{ .Token }}` and a production SMTP provider; Supabase's default template currently sends a sign-in link.

Migration SQL nằm trong `supabase/migrations/`. Trong Supabase Auth, đặt Site URL là `https://math.aloserwis.com` và cho phép domain này chuyển hướng. OTP email dạng số cần mẫu email có `{{ .Token }}` và SMTP dùng cho môi trường thật; mẫu mặc định của Supabase hiện gửi liên kết đăng nhập.

PIN bố mẹ bảo vệ các chức năng phụ huynh trên thiết bị đó; PIN không đồng bộ. Kết quả được xuất thành PDF trong khu vực bố mẹ.

## Install · Cài đặt

The app is a Progressive Web App. On iPhone or iPad, open it in Safari, tap the install icon in the header, then use Share → Add to Home Screen. On Android, tap the install icon when it appears or choose Install app from the browser menu. The app shell is cached for offline use; when online, each opening checks the latest version.

Ứng dụng hỗ trợ cài như PWA. Trên iPhone hoặc iPad, mở bằng Safari, nhấn biểu tượng cài đặt ở đầu trang, rồi chọn Chia sẻ → Thêm vào Màn hình chính. Trên Android, nhấn biểu tượng cài đặt khi xuất hiện hoặc chọn Cài đặt ứng dụng trong menu trình duyệt. Phần giao diện được lưu để dùng ngoại tuyến; khi có mạng, ứng dụng kiểm tra bản mới mỗi lần mở.
