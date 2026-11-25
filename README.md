# QuizCrew – Among Us x Quiz

**QuizCrew** là dự án được phát triển trong khuôn khổ môn học **IE104 – Công nghệ Internet và Web (Internet and Web Technologies)**.

Dự án lấy cảm hứng từ trò chơi Among Us, kết hợp với hệ thống câu hỏi Quiz, mang đến trải nghiệm giải trí tương tác giữa nhiều người chơi. Điểm đặc biệt của QuizCrew là người chơi có thể tự thiết kế bộ câu hỏi thông qua file JSON và tích hợp AI để hỗ trợ chỉnh sửa, hoàn thiện nội dung câu hỏi.

## Thành viên nhóm

| Họ và tên             | MSSV     | Vai trò                                                                        |
| --------------------- | -------- | ------------------------------------------------------------------------------ |
| Nguyễn Huỳnh Bảo Phúc | 24521391 | Quản lý mã nguồn, hỗ trợ các thành viên hoàn thiện chức năng và sửa lỗi (bug). |
| Đinh Thanh Phong      | 24521331 | Phát triển tính năng mới và tích hợp AI Model.                                 |
| Trần Phí Bình An      | 22420030 | Thiết kế giao diện và chỉnh sửa logic bản đồ trò chơi.                         |

## 🎥 Demo dự án

- **Website:** [Truy cập website](https://among-us-quiz-game.onrender.com)
- **Video Demo:** [Xem video giới thiệu dự án](Link)

## Tính năng chính

- **Tùy chỉnh bộ câu hỏi (Custom Quiz):** Cho phép người chơi tự thiết kế bộ câu hỏi dành cho trò chơi thông qua file `.json` với cấu trúc đơn giản, dễ chỉnh sửa.
- **Chế độ nhiều người chơi (Multiplayer):** Hỗ trợ nhiều người tham gia và tương tác trong cùng một phòng chơi.
- **Trò chuyện (In-game Chat):** Tích hợp khung chat giúp người chơi giao tiếp trong quá trình chơi.
- **Các cơ chế Among Us cơ bản:**
    - Kill: Tiêu diệt người chơi khác.
    - Report: Báo cáo người chơi đã bị hạ gục.
    - Do Task: Thực hiện các nhiệm vụ trên bản đồ.
- **Quản lý phòng chơi:** Cho phép người chơi tạo phòng mới hoặc tham gia phòng đã tồn tại.
- **Tích hợp AI:** Hỗ trợ người dùng điều chỉnh và hoàn thiện nội dung câu hỏi theo định dạng JSON thông qua AI Model.

## Công nghệ sử dụng

### Frontend

- **ReactJS:** Thư viện JavaScript dùng để xây dựng giao diện người dùng (UI) theo mô hình component, giúp tổ chức và quản lý các thành phần giao diện một cách linh hoạt.
- **Phaser:** Framework phát triển game 2D trên nền tảng HTML5, hỗ trợ xử lý hình ảnh, hoạt ảnh, vật lý và tương tác trong trò chơi. Được sử dụng để xây dựng bản đồ và các cơ chế gameplay của QuizCrew.
- **HTML5:** Ngôn ngữ đánh dấu được sử dụng để xây dựng cấu trúc nội dung và các thành phần trên giao diện website.
- **CSS3:** Ngôn ngữ định dạng giao diện, hỗ trợ thiết kế bố cục, màu sắc, hiệu ứng và khả năng hiển thị trên nhiều kích thước màn hình.
- **JavaScript:** Ngôn ngữ lập trình chính được sử dụng để xử lý logic phía client, tương tác người dùng và kết nối với Backend.

### Backend

- **Node.js:** Môi trường thực thi JavaScript phía máy chủ (Server-side), cho phép xây dựng các ứng dụng Backend bằng JavaScript.
- **Express.js:** Framework xây dựng ứng dụng web trên Node.js, hỗ trợ quản lý API, định tuyến (Routing), xử lý HTTP Request và Response.
- **Socket.IO:** Thư viện hỗ trợ giao tiếp hai chiều theo thời gian thực (Real-time Communication) giữa Client và Server. Được sử dụng để triển khai các tính năng Multiplayer như đồng bộ trạng thái người chơi, di chuyển, trò chuyện và tương tác trong phòng chơi.

### Deploy

- **Render:** Nền tảng Cloud hỗ trợ triển khai và vận hành ứng dụng web. Được sử dụng để deploy các dịch vụ Frontend và Backend, giúp người dùng có thể truy cập trò chơi thông qua Internet mà không cần chạy ứng dụng trực tiếp trên máy tính cá nhân.

## Hướng dẫn cài đặt và chạy dự án

### 1. Clone repository

```bash
git clone <repository-url>
cd <project-folder>
```

### 2. Cấu hình biến môi trường

Tạo file `.env` dựa trên file mẫu `.env.example` được cung cấp trong dự án.

Điền các giá trị cấu hình cần thiết vào file `.env` trước khi khởi chạy ứng dụng.

### 3. Cài đặt và chạy Frontend

Mở terminal tại thư mục gốc của dự án:

```bash
cd frontend
npm install
npm run dev
```

### 4. Cài đặt và chạy Backend

Mở một terminal khác:

```bash
cd backend
npm install
npm run dev
```

Sau khi khởi chạy thành công cả Frontend và Backend, truy cập địa chỉ được hiển thị trong terminal của Frontend để bắt đầu trải nghiệm trò chơi.

## Kết quả đạt được

- Xây dựng thành công trò chơi QuizCrew với các cơ chế gameplay lấy cảm hứng từ Among Us.
- Tái hiện khoảng **90% mức độ tương đồng** so với phiên bản Among Us gốc về giao diện và các cơ chế trò chơi được triển khai.
- Xây dựng hệ thống Multiplayer cho phép nhiều người chơi tương tác trong thời gian thực.
- Tích hợp hệ thống tùy chỉnh câu hỏi bằng JSON và AI hỗ trợ xử lý nội dung câu hỏi.

## 📸 Hình ảnh kết quả

Một số giao diện và chức năng chính của dự án:

<!-- Bổ sung hình ảnh thực tế của dự án tại đây -->

## Nguồn tham khảo

Dự án có tham khảo mã nguồn từ repository:

[Among Us Clone – arizkhalid](https://github.com/arizkhalid/among-us-clone)

Mã nguồn được sử dụng làm tài liệu tham khảo trong quá trình nghiên cứu và phát triển QuizCrew.

---

**QuizCrew – Think fast, find the Impostor!**

_IE104 – Internet and Web Technologies | UIT – VNUHCM_
