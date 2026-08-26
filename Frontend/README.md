# HospitalManagement — Frontend

Next.js 16 (App Router) — giao diện cho hệ thống tối ưu luồng khám chữa bệnh. Phase này: **đăng nhập/đăng xuất Staff (Admin/Doctor) + Dashboard Admin**.

## Stack

- **Next.js 16** (App Router, Turbopack mặc định)
- **TanStack Query** — server state (gọi API, cache, tự refetch)
- **Zustand** — client state (auth: token, user), persist vào `localStorage`
- **React Hook Form + Zod** — validate form, cùng triết lý với backend
- **Tailwind CSS v4** — styling (UI primitive tự viết, không dùng shadcn/ui CLI để tránh phụ thuộc mạng lúc setup)

## Cấu trúc

```
src/
  app/
    (staff)/
      login/page.tsx          # đăng nhập Staff — public, tự redirect nếu đã đăng nhập
      admin/
        layout.tsx              # AuthGuard(['ADMIN']) + StaffShell (sidebar/header)
        page.tsx                 # Dashboard — widget số liệu thời gian thực
      doctor/
        layout.tsx               # AuthGuard(['DOCTOR'])
        page.tsx                  # placeholder — UI Doctor build ở phase sau
    layout.tsx                  # root layout, bọc <Providers>
    page.tsx                    # "/" -> redirect "/login"
    providers.tsx                # QueryClientProvider
  features/                    # logic theo domain — KHÔNG chứa page/layout
    auth/
      types.ts   api.ts   store.ts   hooks.ts
    doctors/  visits/  admin-queue/  activity-log/
      api.ts + hooks.ts          # đủ dùng cho widget Dashboard
  components/
    ui/                         # Button, Input, Label, Card — primitive tự viết
    layout/
      auth-guard.tsx              # bảo vệ route ở CLIENT (xem ghi chú bên dưới)
      staff-shell.tsx  staff-sidebar.tsx  staff-header.tsx
  lib/
    api-client.ts                # fetch wrapper — hiểu response envelope backend, tự refresh token khi 401
    utils.ts                      # cn() gộp class Tailwind
```

**Quy tắc:** component trong `app/` không gọi API trực tiếp — luôn qua hook trong `features/*/hooks.ts`. Tách UI khỏi logic.

## Vì sao AuthGuard chạy ở client, không dùng `proxy.ts` (middleware)?

Token lưu ở `localStorage` (quyết định đã chốt khi bắt đầu — đơn giản, đủ cho đồ án). `proxy.ts` của Next.js chạy ở edge/server, **không đọc được `localStorage`** — nên bảo vệ route phải làm ở client (`AuthGuard` component), sau khi Zustand hydrate xong từ localStorage. Đánh đổi: có 1 khoảnh khắc "Đang tải..." trước khi biết chắc user đã đăng nhập hay chưa (không tránh được với cách lưu token này). Nếu sau này đổi sang httpOnly cookie (an toàn hơn, chống XSS), có thể chuyển bảo vệ route sang `proxy.ts` để tránh flash này.

## Cài đặt

```powershell
npm install
Copy-Item .env.example .env.local
```

Sửa `.env.local` nếu Backend không chạy ở `http://localhost:3000`.

## Chạy dev

```powershell
npm run dev
```

Chạy ở **port 3001** (đã cấu hình sẵn trong `package.json`) — vì Backend NestJS mặc định chiếm port 3000, tránh xung đột khi chạy song song 2 project.

M�� `http://localhost:3001/login`.

## Test đăng nhập

Dùng tài khoản Admin đã seed ở Backend Phase 1 (`npm run prisma:seed` bên Backend):
```
Email: admin@hospital.local
Password: ChangeMe123!  (hoặc giá trị SEED_ADMIN_PASSWORD bạn đã đặt)
```

Đăng nhập Admin → vào `/admin` (Dashboard). Đăng nhập Doctor → vào `/doctor` (placeholder, xác nhận login/logout hoạt động đúng cho cả 2 role — UI Doctor thật build ở phase sau).

## Build production

```powershell
npm run build
npm start
```

**Lưu ý:** đã bỏ `next/font/google` (Geist) — sandbox lúc build project này bị chặn `fonts.googleapis.com`, nên đổi sang font hệ thống để build không phụ thuộc mạng ngoài. Trên máy bạn có thể thêm lại `next/font/google` nếu muốn, hoặc giữ nguyên (font hệ thống vẫn đẹp và nhẹ hơn).

## Roadmap tiếp theo (đề xuất)
1. ~~Login/Logout Staff + Admin Dashboard~~ ✅ (phase này)
2. Trang quản lý Doctor (CRUD — khớp `/users/doctors` backend)
3. Trang quản lý Room/RoomType/PatientType/Device/DoctorAssignment
4. Workflow Builder UI (kéo-thả FlowStep + FlowDependency, trực quan hoá DAG)
5. Doctor dashboard thật — hàng đợi phòng, start/complete exam
6. Patient portal (route group `(patient)`) — đăng ký OTP, theo dõi Visit, hiện QR
7. Kết nối WebSocket thật (`socket.io-client` đã cài sẵn, chưa dùng) — thay TanStack Query polling bằng real-time invalidate
