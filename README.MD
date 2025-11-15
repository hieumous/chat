<h1 align="center">✨ Full-Stack Chat App with Auth & Emails ✨</h1>


Highlights:

- 🔐 Custom JWT Authentication (no 3rd-party auth)
- ⚡ Real-time Messaging via Socket.io
- 🟢 Online/Offline Presence Indicators
- 🔔 Notification & Typing Sounds (with toggle)
- 📨 Welcome Emails on Signup (Resend)
- 🗂️ Image Uploads (Cloudinary)
- 🧰 REST API with Node.js & Express
- 🧱 MongoDB for Data Persistence
- 🚦 API Rate-Limiting powered by Arcjet
- 🎨 Beautiful UI with React, Tailwind CSS & DaisyUI
- 🧠 Zustand for State Management
- 🧑💻 Git & GitHub Workflow (branches, PRs, merges)
- 🚀 Easy Deployment (free-tier friendly with Sevalla)

---

## 🧪 .env Setup

### Backend (`/backend`)

```bash
PORT=3000
MONGO_URI=your_mongo_uri_here

NODE_ENV=development

JWT_SECRET=your_jwt_secret

RESEND_API_KEY=your_resend_api_key
EMAIL_FROM=your_email_from_address
EMAIL_FROM_NAME=your_email_from_name

CLIENT_URL=http://localhost:5173

CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

ARCJET_KEY=your_arcjet_key
ARCJET_ENV=development
```

---

## 🔧 Run the Backend

```bash
cd backend
npm install
npm run dev
```

## 💻 Run the Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## 📱 Mô phỏng giao diện ứng dụng

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CHAT APPLICATION                               │
├─────────────────────────────────────────────────────────────────────────────┤
│ 🟢 Online Users                                    [⚙️ Settings] [❌ Exit] │
├─────────────────────────────────────────────────────────────────────────────┤
│ 👤 User1 (You)     │                                                       │
│ 👤 User2           │  [10:30] User2: Xin chào mọi người! 👋               │
│ 👤 User3           │                                                       │
│ 👤 User4           │  [10:32] You: Chào bạn! Hôm nay thế nào?             │
│                    │                                                       │
│                    │  [10:33] User3: Mình vừa join room này               │
│                    │                                                       │
│                    │  [10:35] User2: Welcome! 🎉                          │
│                    │                                                       │
│                    │  [10:36] You: Chào mừng bạn mới!                     │
│                    │                                                       │
│                    │  [10:38] User4: Ai muốn chơi game không? 🎮          │
│                    │                                                       │
│                    │                                                       │
│                    │                                                       │
│                    │                                                       │
├────────────────────┼───────────────────────────────────────────────────────┤
│                    │ 💬 Nhập tin nhắn...                    [📎] [😊] [➤] │
└────────────────────┴───────────────────────────────────────────────────────┘
```

### Quy trình chạy ứng dụng

```
┌─ Khởi động server ─┐
│                    │
│  npm run dev       │
│  ✅ Server: 3000   │
│                    │
└────────────────────┘
        ↓
┌─ Mở trình duyệt ───┐
│                    │
│ localhost:5173     │
│ ✅ Connected!      │
│                    │
└────────────────────┘
        ↓
┌─ Đăng nhập/Đăng ký ┐
│                    │
│ Email: [_______]   │
│ Pass:  [_______]   │
│       [Login]      │
│                    │
└────────────────────┘
        ↓
┌─ Vào phòng chat ───┐
│                    │
│ 🎯 Welcome!        │
│ 👥 Users online    │
│ 💬 Start chatting  │
│                    │
└────────────────────┘
```