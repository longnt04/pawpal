# 🐾 PawPal

**Tinder cho thú cưng + Shop thú cưng** - Nền tảng kết nối và mua sắm cho người yêu thú cưng.

## 📋 Tech Stack

- **Frontend**: Next.js 14+ với App Router, React, TypeScript
- **Styling**: Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Deployment**: Vercel

## 🚀 Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Thiết Lập Supabase

1. Tạo project tại [supabase.com](https://supabase.com)
2. Chạy SQL schema từ file `DATABASE_SCHEMA.md` trong Supabase SQL Editor
3. Copy URL và Anon Key từ Settings > API

### 3. Environment Variables

Cập nhật file `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Run Development Server

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## 📁 Cấu Trúc Project

```
pawpal/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── auth/           # API routes cho authentication
│   │   │       ├── login/
│   │   │       ├── register/
│   │   │       ├── logout/
│   │   │       └── session/
│   │   ├── login/              # Trang đăng nhập
│   │   ├── register/           # Trang đăng ký
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   ├── lib/
│   │   └── supabase/           # Supabase clients
│   │       ├── client.ts       # Browser client
│   │       ├── server.ts       # Server client
│   │       └── middleware.ts   # Auth middleware
│   └── middleware.ts           # Next.js middleware
├── DATABASE_SCHEMA.md          # Database schema documentation
├── .env.local                  # Environment variables
└── package.json
```

## 🔑 Authentication Flow

### Đăng Ký (Register)

1. Người dùng điền form đăng ký (email, mật khẩu, họ tên, SĐT)
2. API `/api/auth/register` tạo user trong Supabase Auth
3. Tạo profile trong bảng `users`
4. Gửi email xác nhận

### Đăng Nhập (Login)

1. Người dùng điền email/password
2. API `/api/auth/login` xác thực với Supabase
3. Tạo session và set cookies
4. Redirect về trang chủ

## 🗄️ Database Schema

### Core Tables

- **users**: Thông tin người dùng
- **pets**: Thông tin thú cưng
- **matches**: Cặp match giữa thú cưng
- **swipes**: Lịch sử swipe (like/pass)
- **messages**: Tin nhắn giữa các match

### E-commerce Tables

- **products**: Sản phẩm shop
- **orders**: Đơn hàng
- **order_items**: Chi tiết đơn hàng

Chi tiết xem file [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)

## 📝 API Routes

### Authentication

- `POST /api/auth/register` - Đăng ký tài khoản mới
- `POST /api/auth/login` - Đăng nhập
- `POST /api/auth/logout` - Đăng xuất
- `GET /api/auth/session` - Lấy thông tin session

## ⚠️ Lưu Ý Quan Trọng

### Email Rate Limiting

Supabase có rate limit cho việc gửi email (đăng ký/reset password):

- **Free tier**: 3-4 emails/hour
- Nếu gặp lỗi `over_email_send_rate_limit`, đợi 60 giây trước khi thử lại
- Trong development, có thể tắt email confirmation trong Supabase Dashboard:
  - Authentication > Settings > Email Auth
  - Tắt "Enable email confirmations"

### Database Setup

- Phải chạy SQL schema trong `DATABASE_SCHEMA.md` trước khi sử dụng
- Đảm bảo RLS policies được setup đúng

## 📦 Dependencies

### Core

- `next` - React framework
- `react` - UI library
- `typescript` - Type safety

### Supabase

- `@supabase/supabase-js` - Supabase client
- `@supabase/ssr` - Server-side rendering support

### UI/UX

- `tailwindcss` - Styling
- `react-hot-toast` - Toast notifications
- `framer-motion` - Animations
- `lucide-react` - Icons

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
