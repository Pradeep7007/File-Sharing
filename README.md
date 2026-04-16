# DropShare - MERN File Sharing App

A premium, glassmorphism-styled file sharing application built with the MERN stack.

## 🚀 Getting Started

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v16+)
- [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) account (for cloud database)

### 2. Backend Setup
1. Navigate to the `backend` folder: `cd backend`
2. Install dependencies: `npm install`
3. Create a `.env` file with:
   ```env
   PORT=5000
   MONGODB_URI=your_mongodb_connection_string
   FRONTEND_URL=http://localhost:3000
   UPLOAD_DIR=uploads
   ```
4. Start the server: `npm run dev`

### 3. Frontend Setup
1. Navigate to the `frontend` folder: `cd frontend`
2. Install dependencies: `npm install`
3. Create a `.env` file with:
   ```env
   REACT_APP_API_URL=http://localhost:5000
   ```
4. Start the app: `npm start`

## 🛠️ Features
- **Secure Uploads:** Multi-part file uploads supported up to 500MB.
- **Password Protection:** Optional AES-style password hashing for shared links.
- **Auto-Expiry:** Links can be set to expire after 1, 24, or 168 hours.
- **Admin Gallery:** View and manage all active files.
- **Glassmorphism UI:** Stunning, modern interface with dynamic background blobs.

## 🌐 Deployment Logic
- **Backend:** The server is configured for deployment on Vercel/Render. Ensure you add `MONGODB_URI` to your environment variables.
- **File Storage:** Local uploads use `/tmp` on Vercel (ephemeral) and `./uploads` elsewhere.
