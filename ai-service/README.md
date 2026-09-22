# HireMind AI Orchestrator Service Layer

A dedicated multi-agent microservice layer powered by **Google Agent Development Kit (ADK)** and FastAPI.

---

## Architecture Overview

```
HireMind Architecture
├── frontend/             (Vite + React UI: Candidate Portal & Admin Portal)
│        │ (HTTP / WebSockets)
│        ▼
├── backend/              (Node.js / Express / MongoDB: Auth, Users, Sessions, Storage)
│        │ (HTTP REST / gRPC)
│        ▼
└── ai-service/           (Python / FastAPI / Google ADK Orchestrator Layer)
     ├── .venv/           (Isolated Python 3.14 virtual environment)
     ├── orchestrator/    (Google ADK Master Orchestrator Agent)
     │   └── orchestrator.py
     ├── agents/          (Specialized Sub-Agents to be implemented one by one)
     │   ├── interviewer_agent.py   (Targeted questioning)
     │   ├── evaluator_agent.py     (Real-time scoring)
     │   └── feedback_agent.py      (Performance synthesis & report)
     ├── config/          (Settings and Gemini API key management)
     │   └── settings.py
     ├── main.py          (FastAPI Gateway: REST & WebSockets)
     └── requirements.txt (google-adk, fastapi, uvicorn, pydantic)
```

---

## Why Separate AI Service from Express Backend?

1. **Native Google ADK Support**: Google ADK is Python-native. Hosting it in Python avoids clunky child-process spawning from Node.js.
2. **Resource & Latency Isolation**: LLM generations, agent reasoning loops, audio processing, and multi-turn workflows run independently without stalling the Node.js event loop or MongoDB CRUD operations.
3. **Independent Scalability**: Can be containerized and deployed to Google Cloud Run or Kubernetes with specialized timeout and concurrency limits.
4. **Clean API Contract**: Decoupled REST communication between `backend` and `ai-service`.

---

## Running the AI Service

```bash
# From workspace root:
cd ai-service

# Activate virtual environment
.venv\Scripts\activate   # Windows
# or source .venv/bin/activate (Linux/Mac)

# Run with Uvicorn
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

---

## Endpoints

- `GET /health` — Check service health, Google ADK readiness, and active sessions.
- `POST /orchestrator/session/start` — Start a new interview session.
- `POST /orchestrator/turn` — Process candidate response and generate next interview turn.
- `GET /orchestrator/session/{session_id}` — Inspect active session state.
- `GET /docs` — Interactive OpenAPI / Swagger UI.
