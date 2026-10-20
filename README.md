# Kanvora

A modern full-stack Kanvora-inspired task management application built using the MERN stack. This project allows users to create boards, manage tasks visually, organize workflows, and improve productivity through drag-and-drop task management.

---

# 📌 Project Overview

This project is a complete task management application developed using React, Node.js, Express, and MongoDB. The application replicates the core functionalities of the platform including:

- Board creation
- List management
- Task cards
- Drag-and-drop interactions
- Authentication system
- Responsive dashboard

The project demonstrates real-world full-stack development practices including REST API development, JWT authentication, MongoDB schema design, React state management, and frontend-backend integration.

---

# 🎯 Main Objectives

The primary goals of this project are:

- Learn full-stack MERN development
- Understand REST API architecture
- Implement authentication and authorization
- Practice MongoDB relationships and schemas
- Build reusable React components
- Handle frontend and backend deployment
- Create responsive UI/UX designs
- Implement drag-and-drop functionality

---

# 🚀 Features

## 🔐 Authentication System

- User Registration
- User Login
- Secure Password Hashing using bcryptjs
- JWT Authentication
- Protected Routes
- Session Management

---

## 📋 Board Management

- Create Boards
- Edit Board Names
- Delete Boards
- Personalized User Workspace
- Dynamic Board Rendering

---

## 📑 List Management

- Add New Lists
- Rename Existing Lists
- Delete Lists
- Reorder Lists Dynamically

---

## 📝 Card Management

- Create Task Cards
- Edit Card Details
- Delete Cards
- Move Cards Between Lists
- Drag-and-Drop Support

---

## 🎨 User Interface Features

- Fully Responsive Layout
- Interactive Dashboard
- Smooth Animations
- Modern UI Design
- Mobile Friendly Interface
- Clean Navigation System

---

## ⚡ Additional Functionalities

- REST API Integration
- MongoDB Database Storage
- State Management
- Error Handling
- Toast Notifications
- Loading Indicators

---

# 🛠️ Tech Stack

| Layer          | Technologies                                |
| -------------- | ------------------------------------------- |
| Frontend       | React.js, React Router, Axios, Tailwind CSS |
| Backend        | Node.js, Express.js                         |
| Database       | MongoDB Atlas, Mongoose                     |
| Authentication | JWT, bcryptjs                               |
| Deployment     | Vercel, Render                              |
| Tools          | Git, GitHub, VS Code, Postman               |

---

# ⚙️ Configuration and verification

Kanvora is a two-package MERN app: `Backend/` (Express, Mongoose, Socket.IO) and
`Frontend/` (React, Vite, Zustand, Tailwind).

## Backend environment

The backend refuses to start without `NODE_ENV`, `DB_URL`, and `SECRET_KEY`, and
production additionally requires `CLIENT_URL` and an explicit `TRUST_PROXY`
hop count. Use a MongoDB replica set; board mutations rely on transactions.

| Variable | Required | Notes |
| --- | --- | --- |
| `NODE_ENV` | yes | `production`, `development`, or `test` |
| `DB_URL` | yes | MongoDB replica-set connection string |
| `SECRET_KEY` | yes | At least 32 characters in production |
| `CLIENT_URL` | production | Comma-separated allowed frontend origins |
| `TRUST_PROXY` | production | `0` when directly exposed, `1` behind one proxy; integer 0–10 |
| `PORT` | no | Defaults to `5000` |
| `COOKIE_SAME_SITE` | no | `lax`, `strict`, or `none` |
| `SESSION_TTL_DAYS` | no | 1–30 days; defaults to 7 |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` | production | Required for verification and password-recovery mail |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | uploads | Required for new private card attachments |
| `GOOGLE_CLIENT_ID` | no | Enables Google sign-in when configured on both sides |

## Frontend environment

Set `VITE_API_URL` to the deployed API origin (for example,
`https://api.example.com`). `VITE_GOOGLE_CLIENT_ID` is optional.

## Local verification

```bash
cd Backend
NODE_ENV=test npm test
KANVORA_TEST_DB_URL='mongodb://127.0.0.1:27028/kanvora_test?directConnection=true&replicaSet=kanvora-test' \
  npm run test:integration
npm run check

cd ../Frontend
npm test -- --run
npm run build
```

Integration tests refuse remote, production, or authenticated database targets.
The test database must be a disposable MongoDB replica set.

---

# 📁 Project Structure

```bash
Kanvora/
│
├── Backend/
│   ├── APIs/
│   ├── authorization/
│   ├── config/
│   ├── controllers/
│   ├── middlewares/
│   ├── models/
│   ├── scripts/
│   ├── tests/
│   ├── utils/
│   ├── server.js
│   └── package.json
│
├── Frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── content/
│   │   ├── store/
│   │   ├── tests/
│   │   ├── utils/
│   │   └── App.jsx
│   └── package.json
│
├── docs/
├── README.md
└── .gitignore
```
