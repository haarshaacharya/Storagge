<p align="center">
  <img src="./public/drstoragge.png" alt="Storagge Logo" width="250">
</p>

<p align="center">
  The all-in-one platform to <b>discover AI tools</b>, <b>stay on top of tech media</b>, and <b>connect with a community of builders</b> — all from one place.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-Strict-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-Build-646CFF?logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/TailwindCSS-Styling-06B6D4?logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Supabase-Backend-3ECF8E?logo=supabase&logoColor=white" alt="Supabase" />
  <img src="https://img.shields.io/badge/License-MIT-lightgrey" alt="License" />
</p>

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#-tech-stack">Tech Stack</a> •
  <a href="#-project-structure">Structure</a> •
  <a href="#-security">Security</a>
</p>

---

## 📖 About

**Storagge** started as an AI Tools Directory and has grown into a complete hub for the AI and tech community — part **media platform**, part **AI tools workspace**, and part **social network** for people building and working with AI.

Users can discover curated AI tools, follow tech events and announcements, build a public profile, connect with other builders, and message each other directly — all wrapped in a fast, modern, dark-themed interface.

---

## ✨ Features

### 🔍 AI Tools Directory
- Fast, real-time search across the entire tools catalog
- Category-wise browsing and filtering
- One-click quick access URLs to every tool
- Usage tracking and trending tools analytics

### 📰 Tech Media & Events
- Public event feed for hackathons, conferences, workshops, meetups, and webinars
- Rich event posts with images, hashtags, dates, and locations
- Public / Private / Followers-only visibility controls
- Like, save, and engage with community posts

### 💬 Workspace & Social
- Direct messaging with image, video, and document sharing
- Real-time delivery powered by Supabase Realtime
- Mutual-follow gated messaging for spam-free conversations
- Connections system — follow, get followed, and build your network
- Notifications for likes, follows, messages, and activity
- Public user profiles with posts, activity, and stats

### 🛡️ Admin & Management
- Secure, role-based Admin Panel
- Add / edit / delete AI tools and categories
- User management and moderation tools
- Dashboard analytics for platform-wide insights

### 🎨 Experience
- Sleek dark, modern UI throughout
- Fully responsive — optimized for desktop, tablet, and mobile
- Resizable, app-like layouts (e.g. drag-to-resize messaging sidebar)
- Infinite scroll feeds and smooth, native-feeling interactions

---

## 🛠️ Tech Stack

| Layer          | Technology                          |
|----------------|--------------------------------------|
| Frontend       | React + TypeScript                   |
| Build Tool     | Vite                                 |
| Styling        | Tailwind CSS                         |
| Icons          | Lucide React                         |
| Backend / DB   | Supabase (Postgres, Auth, Storage, Realtime) |
| Hosting        | Vercel                               |

---

## 🔒 Security

Storagge is built on **Supabase Row Level Security (RLS)** — every sensitive table (conversations, messages, profiles, follows, etc.) is protected at the database level, not just in the frontend. This ensures:

- Users can only access their own conversations and messages
- Profile and account data is never exposed beyond what's intended
- All read/write operations are enforced server-side, independent of client code

---

## 📄 License

Distributed under the **MIT License**.

---

<p align="center">
  <b>👨‍💻 Developer & Founder</b><br/>
  <b>Haarsh Aacharya</b>
</p>
