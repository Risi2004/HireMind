# 🧠 HireMind — AI-Powered Talent & Mock Interview Platform

[![Live Demo](https://img.shields.io/badge/Live_Deployment-Vercel-black?style=for-the-badge&logo=vercel)](https://hire-mind-ai-henna.vercel.app/)
[![React](https://img.shields.io/badge/Frontend-React_19_|_Vite_8-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Backend-Node.js_|_Express_5-339933?style=for-the-badge&logo=nodedotjs)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/AI_Service-Python_|_FastAPI_|_Google_ADK-3776AB?style=for-the-badge&logo=python)](https://fastapi.tiangolo.com/)
[![MongoDB](https://img.shields.io/badge/Database-MongoDB_Atlas-47A248?style=for-the-badge&logo=mongodb)](https://www.mongodb.com/)

> **Live Production URL:** [https://hire-mind-ai-henna.vercel.app/](https://hire-mind-ai-henna.vercel.app/)

**HireMind** is an enterprise-ready, multi-agent AI mock interview and talent readiness platform. It conducts realistic, conversational, multi-stage interviews tailored to a candidate's background and specific job requirements. Featuring real-time voice input/output, interactive live coding sandboxes, adaptive question progression, and deep diagnostic reporting, HireMind helps candidates prepare for technical and behavioral interviews.

---

## 📑 Table of Contents

- [System Architecture](#-system-architecture)
- [Tech Stack](#-tech-stack)
- [Key Features](#-key-features)
- [Feature Status: Functional vs. Mocked / Simulated](#-feature-status-functional-vs-mocked--simulated)
- [Project Directory Structure](#-project-directory-structure)
- [Local Development Setup](#-local-development-setup)
  - [Prerequisites](#prerequisites)
  - [1. Backend Setup](#1-backend-setup-nodejs--express)
  - [2. AI Service Setup](#2-ai-service-setup-python--fastapi--google-adk)
  - [3. Frontend Setup](#3-frontend-setup-react--vite)
- [Environment Variables Guide](#-environment-variables-guide)
- [Deployment Architecture](#-deployment-architecture)
- [License](#-license)

---

## 🏛 System Architecture

HireMind uses a decoupled three-tier microservice architecture:

```
┌────────────────────────────────────────────────────────────────────────┐
│                          Candidate & Admin UI                          │
│        React 19 + Vite 8 + React Router 7 + Monaco Code Editor         │
│                 (Hosted on Vercel: hire-mind-ai-henna)                 │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / REST / SSE Stream
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        HireMind Backend Gateway                        │
│          Node.js 18+ / Express 5 / MongoDB Mongoose 9 / Multer         │
│   • Auth & MFA (TOTP)     • Cloudflare R2 Private Bucket Storage       │
│   • Demo/Pilot Access     • Judge0 Sandbox Runner                      │
│   • Nodemailer Email OTP  • Server-Sent Events (SSE) Live Feed         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Private REST (HMAC API Key)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      HireMind AI Orchestrator Layer                    │
│             Python 3.14 / FastAPI / Google Agent Development Kit       │
│   • Resume Analyzer Agent      • Job Description Analyzer Agent        │
│   • Interview Planning Agent   • Adaptive Interviewer Agent            │
│   • Code Review Agent          • Multi-Factor Evaluation Agent         │
│   • Whisper STT (Speech-to-Text) & Gemini Flash-Lite TTS (Voice)       │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 💻 Tech Stack

### Frontend (`/frontend`)
- **Core:** [React 19](https://react.dev/) with [Vite 8](https://vite.dev/)
- **Routing:** [React Router 7](https://reactrouter.com/)
- **Code Editor:** [@monaco-editor/react](https://github.com/suren-atoyan/monaco-react) (VS Code editor component)
- **Styling:** Custom Vanilla CSS Design System with dark mode, glassmorphism, responsive viewports, and micro-animations.
- **Icons & Media:** Custom SVG vector icon suite and HTML5 Audio / MediaRecorder APIs.

### Backend Gateway (`/backend`)
- **Runtime:** [Node.js](https://nodejs.org/) (>= 18.0.0)
- **Framework:** [Express 5](https://expressjs.com/)
- **Database & ODM:** [MongoDB Atlas](https://www.mongodb.com/atlas) with [Mongoose 9](https://mongoosejs.com/)
- **Authentication & Security:** JWT (`jsonwebtoken`), Password Hashing (`bcryptjs`), TOTP 2FA (`otplib`, `qrcode`), Helmet, Sliding-window IP Rate Limiting.
- **File & Media Storage:** [Cloudflare R2](https://www.cloudflare.com/developer-platform/r2/) object storage via AWS SDK v3 (`@aws-sdk/client-s3`).
- **Code Sandbox Execution:** [Judge0 CE API](https://ce.judge0.com/) for isolated multi-language code compilation and execution.
- **Email Delivery:** [Nodemailer](https://nodemailer.com/) via SMTP (Gmail / Custom SMTP).

### AI Service (`/ai-service`)
- **Runtime & Web Framework:** Python 3.14+, [FastAPI](https://fastapi.tiangolo.com/), and [Uvicorn](https://www.uvicorn.org/).
- **AI Agent Framework:** [Google Agent Development Kit (ADK)](https://github.com/google/adk).
- **LLM Engine:** OpenRouter (`qwen/qwen-2.5-72b-instruct`) and Google Gemini (`gemini-2.0-flash`).
- **Speech-to-Text (STT):** OpenAI Whisper Large V3 Turbo via OpenRouter API.
- **Text-to-Speech (TTS):** Google Gemini 3.8 Flash-Lite TTS with server-side in-memory audio caching.
- **Document Processing:** `pypdf` (PDF extraction) and `python-docx` (Word document parsing).

---

## ✨ Key Features

### 1. Robust Security & Authentication
- **Email OTP Verification:** User registration requires a one-time 6-digit email code.
- **Two-Factor Authentication (2FA / TOTP):** Authenticator app integration (Google Authenticator, Microsoft Authenticator, 2FAS) with QR code setup, manual recovery keys, and trusted device tokens.
- **Rate-Limited API Endpoints:** Built-in sliding-window protection preventing brute-force password guessing or OTP spam.
- **Private Cloudflare R2 Storage:** Resumes and avatar photos are stored in private R2 buckets and streamed through authenticated proxy endpoints.

### 2. Candidate Profiling & Intelligence
- **Resume Parsing & Skill Tag Extraction:** Extracts technical skills, frameworks, seniority level, and previous experience from uploaded `.pdf` and `.docx` resumes.
- **GitHub Integration:** Connects candidate GitHub profiles via OAuth 2.0 or direct username search to scan public repositories, tech stacks, and README files.

### 3. Smart Interview Setup Wizard
- **Configurable Parameters:** Target Role, Target Company, Job Description (JD), Difficulty level (`Beginner`, `Intermediate`, `Experienced`), and Duration (`15 min`, `30 min`, `45 min`, `60 min`).
- **Two Dedicated Interview Modes:**
  - **`HR_SIMULATION` (Realistic Mock):** Simulates a true hiring interview with no interim answers or interruptions. Full performance diagnostic is delivered upon completion.
  - **`FEEDBACK_COACHING` (Interactive Practice):** Evaluates every answer in real time, delivering actionable coaching tips and suggestions immediately following each response.

### 4. Multi-Agent AI Interview Engine
- **JD Analyzer Agent:** Analyzes job descriptions for required competencies, core responsibilities, and cultural signals, cross-referencing against the candidate's resume to identify gaps.
- **Interview Planning Agent:** Builds a personalized multi-stage interview agenda tailored to the candidate's level and available time.
- **Adaptive Live Interview Agent:** Conducts turn-by-turn conversational interviews with intelligent follow-up logic (depth caps, time-budget constraints, and stage transitions).
- **Code Review Agent:** Analyzes candidate code submissions from the live editor, assessing correctness, time/space complexity, edge cases, and code style.
- **Evaluation Agent:** Synthesizes overall performance across Technical Knowledge, Problem Solving, Communication, and Role Alignment into a comprehensive scorecard.

### 5. Interactive Live Interview Room
- **Voice-First Experience:** Browser audio capture transcribed via Whisper Large V3 Turbo; interviewer responses synthesized into natural spoken audio via Gemini Flash-Lite TTS.
- **Embedded Monaco Code Editor:** Multi-language live coding environment supporting JavaScript, Python, TypeScript, Java, and C++ with Judge0 execution.
- **Live Stage Progress Tracker:** Visual agenda displaying covered topics, current interview stage, and remaining time.
- **Emergency Session Recovery:** Mid-interview reload support, graceful manual wrap-up, and automated overtime policy enforcement.

### 6. Post-Interview Performance Diagnostics
- Comprehensive score radar across 4 core competencies.
- Specific strengths and key areas for growth.
- Turn-by-turn transcript audit with per-question critiques and exemplary answer models.

### 7. Administrator Governance & Pilot Gatekeeper
- **Pilot / Demo Access Quotas:** Restricts live AI interviews to demo accounts with configurable interview limits to control model API costs.
- **Real-Time Admin Dashboard:** View active sessions, system health, user quotas, error logs, and token telemetry.
- **Audit Interviews & Feedback:** Review past candidate transcripts and candidate feedback submissions.

---

## 🔍 Feature Status: Functional vs. Mocked / Simulated

To provide complete transparency on the system implementation:

| Feature / Subsystem | Status | Implementation Details |
| :--- | :---: | :--- |
| **User Sign Up & Login (JWT)** | 🟢 **Fully Functional** | Passwords hashed with `bcryptjs`, JWT token issuance, authenticated route guards. |
| **Email OTP Verification** | 🟢 **Fully Functional** | Dispatches real 6-digit verification codes via SMTP (`nodemailer`). |
| **Two-Factor Authentication (2FA)** | 🟢 **Fully Functional** | Standards-compliant RFC 6238 TOTP using `otplib` and QR code generator. |
| **Resume Upload & Parsing** | 🟢 **Fully Functional** | Uploads `.pdf`/`.docx` to Cloudflare R2; parses text using `pypdf`/`python-docx`. |
| **GitHub OAuth & Repository Sync** | 🟢 **Fully Functional** | Real GitHub OAuth 2.0 flow and REST API integration to fetch public repositories and READMEs. |
| **JD & Resume Gap Analysis** | 🟢 **Fully Functional** | Real LLM agent reasoning comparing CV skills against job requirements. |
| **Adaptive Live AI Interviewer** | 🟢 **Fully Functional** | Live multi-turn LLM reasoning with stage hopping, follow-ups, and timing phases. |
| **Voice Speech-to-Text (STT)** | 🟢 **Fully Functional** | Browser `MediaRecorder` records `.webm` audio; transcribed via Whisper Large V3 Turbo. |
| **Voice Text-to-Speech (TTS)** | 🟢 **Fully Functional** | Gemini Flash-Lite TTS produces spoken audio with fallback to browser Web Speech API. |
| **Live Code Execution** | 🟢 **Fully Functional** | Runs code in isolated sandbox via Judge0 CE API (JS, Python, TS, Java, C++). |
| **Comprehensive Diagnostic Report** | 🟢 **Fully Functional** | Full multi-dimensional evaluation report synthesized by Evaluation Agent. |
| **Admin Pilot Quota Management** | 🟢 **Fully Functional** | Admins can grant, refresh, or revoke demo interview passes in real time. |
| **Candidate Webcam Display** | 🟡 **Simulated / Client-Only** | Streams local camera video to the UI via `getUserMedia()`. No server-side facial recognition or computer vision emotion tracking is run. |
| **AI Interviewer Video Feed** | 🟡 **Simulated Animation** | Animated digital avatar displaying states (`speaking`, `listening`, `thinking`). Does not use photorealistic generative video streaming (e.g. HeyGen/Tavus). |
| **LinkedIn Integration** | 🟡 **Profile Link Only** | Stores and validates LinkedIn profile URL. Automated scraping or OAuth is not enabled due to LinkedIn API restrictions. |
| **Payment / Subscription Billing** | ⚪ **Not Implemented (Pilot Mode)** | Platform currently operates in private pilot preview governed by admin-issued demo quotas; payment gateway (Stripe) is not wired. |

---

## 📁 Project Directory Structure

```
HireMind/
├── .gitignore
├── render.yaml                    # Infrastructure blueprint for Render deployment
├── vercel.json                    # Routing rewrites for Vercel deployment
├── README.md                      # Project documentation
│
├── frontend/                      # Client-side React 19 application
│   ├── src/
│   │   ├── admin/                 # Administrator portal (Dashboard, Users, Pilot Access, Logs)
│   │   ├── assets/                # Icons, logos, and illustration assets
│   │   ├── components/            # Shared components (ProtectedRoute, Modals, Navbar, etc.)
│   │   ├── config/                # API base URL configuration
│   │   ├── context/               # AuthContext & ProfileSetupContext
│   │   ├── pages/                 # Candidate views:
│   │   │   ├── Home.jsx           # Landing page
│   │   │   ├── Login.jsx / Signup.jsx
│   │   │   ├── ProfileSetup.jsx   # Multi-step profile builder
│   │   │   ├── Dashboard.jsx      # Candidate dashboard
│   │   │   ├── NewInterview.jsx   # Interview setup wizard
│   │   │   ├── InterviewRoom.jsx  # Live interactive interview interface
│   │   │   └── InterviewReport.jsx# Diagnostic performance report
│   │   ├── App.jsx                # Route definitions & security gates
│   │   └── index.css              # Global design system & theme variables
│   ├── package.json
│   └── vite.config.js
│
├── backend/                       # Node.js Express 5 API Gateway
│   ├── config/                    # MongoDB connection & initial admin seeder
│   ├── controllers/               # Route logic (auth, profile, interview, admin)
│   ├── middleware/                # JWT auth, demo access guard, rate limiters
│   ├── models/                    # Mongoose schemas:
│   │   ├── User.js                # Profile, credentials, 2FA, demo quotas
│   │   ├── InterviewSession.js    # Sessions, chat logs, code submissions, report
│   │   └── Otp.js                 # Verification code schema with TTL expiry
│   ├── routes/                    # API route definitions
│   ├── services/                  # Integrations:
│   │   ├── cloudflareR2.js        # S3-compatible file storage
│   │   ├── codeExecutionService.js# Judge0 code execution client
│   │   ├── emailService.js        # Nodemailer OTP and alert dispatch
│   │   ├── interviewAgentService.js# HTTP proxy to Python AI service
│   │   └── realtimeService.js     # Server-Sent Events (SSE) manager
│   ├── index.js                   # Express application entrypoint
│   └── package.json
│
└── ai-service/                    # Python FastAPI AI Microservice
    ├── agents/                    # Specialized AI sub-agents:
    │   ├── resume_analyzer.py     # PDF/Word CV parsing & skill extraction
    │   ├── jd_analyzer.py         # Job description requirement analysis
    │   ├── interview_planner.py   # Multi-stage interview agenda synthesis
    │   ├── interview_agent.py     # Live adaptive question generator
    │   ├── code_review_agent.py   # Live coding submission evaluator
    │   └── evaluation_agent.py    # Final report & per-answer coach scorer
    ├── config/                    # Environment settings & model provider config
    ├── orchestrator/              # Google ADK Master Orchestrator
    ├── services/                  # LLM client, Whisper STT, Gemini TTS
    ├── utils/                     # Text extraction utilities
    ├── main.py                    # FastAPI application & REST endpoints
    └── requirements.txt
```

---

## 🚀 Local Development Setup

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **Python**: v3.10 to v3.14
- **MongoDB**: Local MongoDB instance or free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster URI
- **Git**

---

### 1. Backend Setup (Node.js / Express)

1. Open a terminal and navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create your `.env` configuration file:
   ```bash
   cp .env.example .env
   ```

4. Configure key values inside `backend/.env`:
   ```env
   PORT=5000
   NODE_ENV=development
   MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/hiremind?retryWrites=true&w=majority
   JWT_SECRET=super_secret_jwt_key_at_least_32_characters_long
   CLIENT_URL=http://localhost:5173

   # Admin credentials (auto-seeded on server boot)
   ADMIN_EMAIL=admin@hiremind.com
   ADMIN_PASSWORD=AdminSecurePassword123!

   # AI Service Connection
   AI_SERVICE_URL=http://localhost:8000
   AI_SERVICE_API_KEY=shared_internal_secret_key_12345

   # Cloudflare R2 Storage (Optional for local dev)
   CLOUDFLARE_R2_ACCOUNT_ID=your_cloudflare_account_id
   CLOUDFLARE_R2_ACCESS_KEY_ID=your_access_key_id
   CLOUDFLARE_R2_SECRET_ACCESS_KEY=your_secret_access_key
   CLOUDFLARE_R2_BUCKET_NAME=hire-mind

   # Email Service (SMTP)
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your_email@gmail.com
   SMTP_PASS=your_gmail_app_password
   SMTP_FROM=HireMind Team <noreply@hiremind.com>

   # GitHub OAuth (Optional for local dev)
   GITHUB_CLIENT_ID=your_github_oauth_client_id
   GITHUB_CLIENT_SECRET=your_github_oauth_client_secret
   ```

5. Seed the initial admin account (optional, also runs on startup):
   ```bash
   npm run seed:admin
   ```

6. Start the backend development server:
   ```bash
   npm run dev
   ```
   *The backend will start on `http://localhost:5000`.*

---

### 2. AI Service Setup (Python / FastAPI / Google ADK)

1. Open a second terminal and navigate to the `ai-service` directory:
   ```bash
   cd ai-service
   ```

2. Create and activate a Python virtual environment:
   - **Windows:**
     ```powershell
     python -m venv .venv
     .venv\Scripts\activate
     ```
   - **macOS / Linux:**
     ```bash
     python3 -m venv .venv
     source .venv/bin/activate
     ```

3. Install the required Python packages:
   ```bash
   pip install -r requirements.txt
   ```

4. Create your `.env` configuration file:
   ```bash
   cp .env.example .env
   ```

5. Configure key values inside `ai-service/.env`:
   ```env
   AI_SERVICE_PORT=8000
   AI_SERVICE_HOST=0.0.0.0
   ENVIRONMENT=development

   # Shared secret matching backend's AI_SERVICE_API_KEY
   AI_SERVICE_API_KEY=shared_internal_secret_key_12345

   # Model Selection
   MODEL_PROVIDER=openrouter
   aimodel=qwen/qwen-2.5-72b-instruct
   OPENROUTER_API_KEY=your_openrouter_api_key
   OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

   # Gemini API (Alternative provider & TTS)
   GEMINI_API_KEY=your_gemini_api_key
   GEMINI_MODEL_NAME=gemini-2.0-flash

   # Speech Models
   STT_MODEL=openai/whisper-large-v3-turbo
   TTS_MODEL=gemini-3.8-flash-lite-tts
   TTS_VOICE=Puck
   ```

6. Start the AI service with Uvicorn:
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```
   *The AI service will run on `http://localhost:8000` (Swagger docs available at `http://localhost:8000/docs`).*

---

### 3. Frontend Setup (React / Vite)

1. Open a third terminal and navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create your `.env` file:
   ```bash
   cp .env.example .env
   ```

4. Configure your API endpoint:
   ```env
   # Leave blank in local development to utilize Vite's internal proxy,
   # or specify the local backend URL:
   VITE_API_URL=http://localhost:5000
   ```

5. Start the frontend development server:
   ```bash
   npm run dev
   ```
   *The application will open on `http://localhost:5173`.*

---

## 🔐 Environment Variables Guide

| Variable | Service | Required | Purpose |
| :--- | :---: | :---: | :--- |
| `MONGO_URI` | Backend | **Yes** | MongoDB Atlas connection string |
| `JWT_SECRET` | Backend | **Yes** | Secret key for signing and verifying JSON Web Tokens |
| `CLIENT_URL` | Backend | **Yes** | Allowed CORS origins for the frontend application |
| `ADMIN_EMAIL` | Backend | **Yes** | Email for the pre-seeded platform administrator |
| `ADMIN_PASSWORD` | Backend | **Yes** | Password for the pre-seeded platform administrator |
| `AI_SERVICE_URL` | Backend | **Yes** | Internal or public URL pointing to the FastAPI service |
| `AI_SERVICE_API_KEY` | Both | **Yes** | Shared internal secret securing server-to-server calls |
| `OPENROUTER_API_KEY` | AI Service | **Yes** | API key used for Qwen LLM reasoning & Whisper STT |
| `GEMINI_API_KEY` | AI Service | Optional | API key for Gemini LLM and Gemini TTS voice synthesis |
| `CLOUDFLARE_R2_*` | Backend | Optional | Credentials for private resume and avatar storage |
| `SMTP_*` | Backend | Optional | SMTP server settings for real OTP email dispatch |
| `GITHUB_CLIENT_*` | Backend | Optional | GitHub OAuth App ID and secret for repo synchronization |
| `VITE_API_URL` | Frontend | Production | URL pointing to the deployed backend on Render |

---

## 🌐 Deployment Architecture

### 1. Frontend on Vercel
- **Repository Root:** `frontend`
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Route Rewrites:** Managed via [`frontend/vercel.json`](file:///c:/Users/User/Desktop/HireMind/frontend/vercel.json) to redirect all SPA requests to `/index.html`.

### 2. Backend & AI Service on Render
The repository includes a ready-to-deploy [`render.yaml`](file:///c:/Users/User/Desktop/HireMind/render.yaml) blueprint defining:
- `hiremind-backend`: Node.js web service running `node index.js`.
- `hiremind-ai-service`: Python web service running `uvicorn main:app`.
- Automatic environment variable synchronization and health probe monitoring on `/api/health` and `/health`.

