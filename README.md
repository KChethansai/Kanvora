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

### Configuration precedence

- Real deployment and process environment variables always win over
  `Backend/.env`. A stale shell, a CI secret, or a platform-injected value is
  never replaced by the file.
- Only `Backend/.env` is loaded. A `.env` in the launch directory — or in any
  other working directory — is ignored, so a copied or archived file cannot
  select the configuration.
- `SECRET_KEY` must be at least 32 characters in production. The backend
  refuses to start otherwise and never falls back to a weaker value.
- Secrets are never logged or printed. A startup failure names the variable
  that is missing or invalid, never its value.
- Actual production secret configuration is an operator and deployment
  responsibility: provision `SECRET_KEY`, `DB_URL`, and the mail and storage
  credentials in the deployment environment, never in the repository.

## Frontend environment

Set `VITE_API_URL` to the deployed API origin (for example,
`https://api.example.com`). It is **required** for a production build: a bundle
without it (or one pointing at `localhost`) refuses to start and shows a
"Kanvora is not configured" screen instead of silently failing every request.
`VITE_GOOGLE_CLIENT_ID` is optional.

## Deployment

The full deployment contract — build and start commands, every required
environment variable, the MongoDB replica-set requirement, the origin and
cookie configuration, SMTP/Cloudinary setup, post-deployment smoke tests,
commit confirmation, rollback, and the single-instance limitations — is in
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

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

Continuous integration runs the same checks on every pull request and push:
see [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

## Operational notes

- Rate-limit buckets and socket room/revocation state are held in process
  memory. Run one API instance, or add a shared rate-limit/socket adapter and
  sticky sessions before scaling horizontally.
- Verification and recovery email is sent inline through SMTP. Configure SMTP
  before opening registration; without it, new accounts cannot verify.
- New card attachments require Cloudinary credentials. Legacy attachment URLs
  are retained, but new files are served through authorized signed delivery.
- Do not place bearer tokens in query strings or paths. Invitation,
  verification, and recovery links use URL fragments; older query/path links
  remain accepted only for compatibility.

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
