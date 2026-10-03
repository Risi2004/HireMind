"""HireMind AI Service Gateway
FastAPI Application hosting Google ADK Orchestrator
"""

import sys
import os
import logging
import subprocess
from pathlib import Path

logger = logging.getLogger("HireMindAIService")

# Automatically ensure the script runs inside the project's .venv virtual environment
venv_dir = Path(__file__).resolve().parent / ".venv"
venv_python = venv_dir / "Scripts" / "python.exe" if sys.platform == "win32" else venv_dir / "bin" / "python"
if venv_python.exists() and os.path.abspath(sys.executable).lower() != os.path.abspath(str(venv_python)).lower():
    sys.exit(subprocess.call([str(venv_python)] + sys.argv))

import hmac

from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List

from config.settings import AI_SERVICE_PORT, AI_SERVICE_HOST, AI_SERVICE_API_KEY, IS_PRODUCTION
from orchestrator.orchestrator import orchestrator_instance
from agents.resume_analyzer import resume_analyzer_instance
from agents.jd_analyzer import jd_analyzer_instance
from agents.interview_planner import interview_planner_instance
from agents.interview_agent import interview_agent_instance
from services.stt_service import stt_service_instance
from services.tts_service import tts_service_instance
from utils.text_extractor import extract_text_from_resume

app = FastAPI(
    title="HireMind AI Orchestrator Service",
    description="Multi-agent interview orchestration layer powered by Google ADK (Agent Development Kit)",
    version="1.0.0"
)

# This service is called server-to-server by the HireMind backend only.
# Browsers never call it directly, so no cross-origin access is granted.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=[],
)

# Endpoints reachable without the internal API key (health probes / landing)
PUBLIC_PATHS = {"/", "/health"}


@app.middleware("http")
async def require_internal_api_key(request: Request, call_next):
    """Reject any request that does not carry the shared backend secret.

    Without this, anyone on the internet could call the LLM / STT / TTS endpoints
    directly and spend the OpenRouter credits.
    """
    if request.method == "OPTIONS" or request.url.path in PUBLIC_PATHS:
        return await call_next(request)

    if not AI_SERVICE_API_KEY:
        if IS_PRODUCTION:
            return JSONResponse(
                status_code=503,
                content={"detail": "AI service is not configured: AI_SERVICE_API_KEY is missing."},
            )
        # Local development without a key: allow, but make it visible
        return await call_next(request)

    supplied = request.headers.get("x-internal-api-key", "")
    if not hmac.compare_digest(supplied.encode(), AI_SERVICE_API_KEY.encode()):
        return JSONResponse(status_code=401, content={"detail": "Unauthorized"})

    return await call_next(request)


class StartSessionRequest(BaseModel):
    session_id: str = Field(..., description="Unique interview session ID")
    candidate_name: str = Field(..., description="Candidate display name")
    target_role: str = Field(..., description="Target job position (e.g. Full Stack Developer)")
    interview_type: str = Field(default="technical", description="Interview style (technical, behavioral, system-design)")
    max_questions: int = Field(default=5, ge=1, le=20, description="Max questions in this interview")


class TurnRequest(BaseModel):
    session_id: str = Field(..., description="Interview session ID")
    candidate_answer: str = Field(..., description="Candidate's speech transcript or typed answer")


@app.get("/")
def root():
    return {
        "status": "online",
        "service": "HireMind AI Orchestrator Service",
        "framework": "Google Agent Development Kit (ADK)",
        "docs_url": "/docs"
    }


@app.get("/health")
def health_check():
    """Health check endpoint reporting ADK status and active sessions."""
    return orchestrator_instance.get_health()


@app.post("/orchestrator/session/start")
def start_session(payload: StartSessionRequest):
    """Start an interview session orchestrated by Google ADK."""
    try:
        result = orchestrator_instance.start_session(
            session_id=payload.session_id,
            candidate_name=payload.candidate_name,
            target_role=payload.target_role,
            interview_type=payload.interview_type,
            max_questions=payload.max_questions
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/orchestrator/turn")
def process_turn(payload: TurnRequest):
    """Submit candidate response and receive next orchestrator / interviewer turn."""
    result = orchestrator_instance.process_turn(
        session_id=payload.session_id,
        candidate_answer=payload.candidate_answer
    )
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@app.get("/orchestrator/session/{session_id}")
def get_session(session_id: str):
    """Inspect interview session telemetry and state."""
    session = orchestrator_instance.get_session_status(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found.")
    return session


class ResumeTextPayload(BaseModel):
    raw_text: str = Field(..., description="Raw resume text")
    filename: Optional[str] = Field(default="resume.txt", description="Original filename")


@app.post("/agents/resume-analyzer/analyze")
async def analyze_resume_endpoint(
    file: Optional[UploadFile] = File(None),
    raw_text: Optional[str] = Form(None),
    filename: Optional[str] = Form(None)
):
    """Analyze candidate resume using the Google ADK Resume Analyzer Agent.
    Accepts multipart file upload (.pdf, .docx) OR raw text.
    """
    try:
        extracted_text = ""
        resolved_filename = "resume.pdf"

        if file:
            resolved_filename = file.filename or "resume.pdf"
            file_bytes = await file.read()
            extracted_text = extract_text_from_resume(file_bytes, resolved_filename)
        elif raw_text:
            extracted_text = raw_text.strip()
            if filename:
                resolved_filename = filename
        else:
            raise HTTPException(status_code=400, detail="Either a resume file or raw_text must be provided.")

        if not extracted_text:
            raise HTTPException(status_code=400, detail="Could not extract readable text from the provided resume.")

        # Run analysis through Google ADK agent
        analysis_result = resume_analyzer_instance.analyze(extracted_text, filename=resolved_filename)

        return {
            "status": "success",
            "filename": resolved_filename,
            "raw_text_length": len(extracted_text),
            "raw_text_preview": extracted_text[:300],
            "analysis": analysis_result
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Resume analysis failed: {str(e)}")


class JobDescriptionPayload(BaseModel):
    job_description: str = Field(..., description="Job description text")
    job_title: Optional[str] = Field(default="", description="Target job title")
    target_role: Optional[str] = Field(default="", description="Alternative target job title")
    company_name: Optional[str] = Field(default="", description="Target company name")
    company: Optional[str] = Field(default="", description="Alternative target company name")
    resume_analysis: Optional[Dict[str, Any]] = Field(default=None, description="Pre-computed resume analysis")


@app.post("/agents/jd-analyzer/analyze")
def analyze_job_description_endpoint(payload: JobDescriptionPayload):
    """Analyze job description using Google ADK Job Description Analyzer Agent.
    Synthesizes requirements, responsibilities, competencies, interview focus areas,
    and maps candidate alignment.
    """
    try:
        if not payload.job_description or not payload.job_description.strip():
            raise HTTPException(status_code=400, detail="Job description text cannot be empty.")

        resolved_role = (payload.job_title or payload.target_role or "").strip()
        resolved_company = (payload.company_name or payload.company or "").strip()

        analysis = jd_analyzer_instance.analyze(
            job_description=payload.job_description.strip(),
            job_title=resolved_role,
            company_name=resolved_company,
            resume_analysis=payload.resume_analysis
        )
        return {
            "status": "success",
            "analysis": analysis
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Job Description analysis failed: {str(e)}")


class InterviewPlanningPayload(BaseModel):
    candidate: Dict[str, Any] = Field(default_factory=dict, description="Structured candidate profile from DB")
    targetJob: Dict[str, Any] = Field(default_factory=dict, description="Structured target role & JD analysis from DB")
    interviewConfiguration: Dict[str, Any] = Field(default_factory=dict, description="Type, difficulty, duration")
    github: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Optional GitHub context from DB/user profile")


@app.post("/agents/interview-planner/plan")
def plan_interview_endpoint(payload: InterviewPlanningPayload):
    """Generate personalized interview plan using Google ADK Interview Planning Agent.
    Consumes pre-computed CV, JD, and configuration data from DB.
    """
    try:
        plan = interview_planner_instance.plan_interview(payload.model_dump())
        return {
            "status": "success",
            "plan": plan
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Interview planning failed: {str(e)}")


class InterviewAgentBeginPayload(BaseModel):
    candidate: Dict[str, Any] = Field(default_factory=dict, description="Structured candidate profile")
    targetJob: Dict[str, Any] = Field(default_factory=dict, description="Structured target role & company")
    interviewConfiguration: Dict[str, Any] = Field(default_factory=dict, description="Interview type, difficulty, duration")
    plan: Dict[str, Any] = Field(default_factory=dict, description="Stored interview plan")


@app.post("/agents/interview-agent/begin")
def interview_agent_begin_endpoint(payload: InterviewAgentBeginPayload):
    """Generate the single opening question for live interview based on stored plan."""
    try:
        result = interview_agent_instance.generate_opening_question(payload.model_dump())
        return {
            "status": "success",
            **result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate opening interview question: {str(e)}")


class InterviewAgentTurnPayload(BaseModel):
    candidate: Dict[str, Any] = Field(default_factory=dict)
    targetJob: Dict[str, Any] = Field(default_factory=dict)
    interviewConfiguration: Dict[str, Any] = Field(default_factory=dict)
    plan: Dict[str, Any] = Field(default_factory=dict)
    timing: Dict[str, Any] = Field(default_factory=dict)
    state: Dict[str, Any] = Field(default_factory=dict)
    conversationHistory: List[Dict[str, Any]] = Field(default_factory=list)
    latestAnswer: str = Field(..., description="Candidate's latest answer")


@app.post("/agents/interview-agent/next")
def interview_agent_next_endpoint(payload: InterviewAgentTurnPayload):
    """Evaluate candidate answer, decide action (FOLLOW_UP, CLARIFY, NEXT_TOPIC, NEXT_STAGE, END_INTERVIEW),
    and generate strictly ONE next question.
    """
    try:
        result = interview_agent_instance.process_turn(payload.model_dump())
        return {
            "status": "success",
            **result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process interview turn: {str(e)}")


from agents.evaluation_agent import evaluation_agent_instance


class EvaluationPayload(BaseModel):
    candidate: Optional[Dict[str, Any]] = Field(default_factory=dict)
    targetJob: Optional[Dict[str, Any]] = Field(default_factory=dict)
    interviewConfiguration: Optional[Dict[str, Any]] = Field(default_factory=dict)
    chatMessages: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    interviewState: Optional[Dict[str, Any]] = Field(default_factory=dict)

    # Also accept backend snake_case variants
    session_id: Optional[str] = None
    target_role: Optional[str] = None
    company: Optional[str] = None
    interview_type: Optional[str] = None
    difficulty: Optional[str] = None
    duration: Optional[int] = None
    cv_analysis: Optional[Dict[str, Any]] = None
    jd_analysis: Optional[Dict[str, Any]] = None
    interview_plan: Optional[Dict[str, Any]] = None
    chat_messages: Optional[List[Dict[str, Any]]] = None
    interview_state: Optional[Dict[str, Any]] = None


@app.post("/agents/evaluation-agent/evaluate")
def evaluation_agent_endpoint(payload: EvaluationPayload):
    """Evaluate completed or mid-way interview session and synthesize full performance report."""
    try:
        data = payload.model_dump()
        # Normalize fields between camelCase and snake_case
        if not data.get("chatMessages") and data.get("chat_messages"):
            data["chatMessages"] = data["chat_messages"]
        if not data.get("targetJob") and data.get("target_role"):
            data["targetJob"] = {"role": data.get("target_role"), "company": data.get("company")}
        if not data.get("candidate") and data.get("cv_analysis"):
            data["candidate"] = data["cv_analysis"]
        if not data.get("interviewConfiguration") and data.get("interview_type"):
            data["interviewConfiguration"] = {
                "type": data.get("interview_type"),
                "difficulty": data.get("difficulty"),
                "durationMinutes": data.get("duration")
            }
        if not data.get("interviewState") and data.get("interview_state"):
            data["interviewState"] = data["interview_state"]

        evaluation = evaluation_agent_instance.evaluate_interview(data)
        return {
            "status": "success",
            "evaluation": evaluation
        }
    except Exception as e:
        logger.exception("Failed to evaluate interview:")
        raise HTTPException(status_code=500, detail=f"Failed to evaluate interview: {str(e)}")


# -------------------------------------------------------------
# Voice Interview Endpoints (STT & TTS)
# -------------------------------------------------------------
class VoiceSynthesisPayload(BaseModel):
    text: str = Field(..., description="Interviewer question text to synthesize")
    voice: Optional[str] = Field(default=None, description="Prebuilt voice name (e.g. Puck, Aoede, Charon)")
    format: Optional[str] = Field(default="json", description="'json' for base64 response, 'audio' for direct WAV binary")


@app.post("/voice/transcribe")
async def voice_transcribe_endpoint(file: UploadFile = File(...)):
    """Transcribe candidate speech audio to text using Whisper Large V3 Turbo."""
    try:
        content = await file.read()
        filename = file.filename or "recording.webm"
        mime_type = file.content_type or "audio/webm"

        result = stt_service_instance.transcribe_audio(
            audio_bytes=content,
            filename=filename,
            mime_type=mime_type
        )
        if not result.get("success"):
            return {
                "status": "error",
                "error": result.get("error", "Transcription failed"),
                "text": "",
                "latencyMs": result.get("latencyMs", 0)
            }

        return {
            "status": "success",
            "text": result["text"],
            "language": result.get("language", "en"),
            "duration": result.get("duration"),
            "latencyMs": result.get("latencyMs", 0)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Voice transcription failed: {str(e)}")


@app.post("/voice/synthesize")
def voice_synthesize_endpoint(payload: VoiceSynthesisPayload):
    """Synthesize interviewer speech from question text using Gemini 3.8 Flash-Lite TTS."""
    try:
        result = tts_service_instance.generate_speech(
            text=payload.text,
            voice=payload.voice
        )
        if not result.get("success"):
            raise HTTPException(status_code=500, detail=result.get("error", "TTS synthesis failed"))

        audio_bytes = result["audio_bytes"]

        if payload.format == "audio":
            return Response(
                content=audio_bytes,
                media_type="audio/wav",
                headers={
                    "X-Latency-Ms": str(result.get("latencyMs", 0)),
                    "X-Cached": str(result.get("cached", False)),
                }
            )

        import base64
        audio_b64 = base64.b64encode(audio_bytes).decode("ascii")
        return {
            "status": "success",
            "audioUrl": f"data:audio/wav;base64,{audio_b64}",
            "voice": result.get("voice"),
            "model": result.get("model"),
            "cached": result.get("cached", False),
            "latencyMs": result.get("latencyMs", 0)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS synthesis failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=AI_SERVICE_HOST, port=AI_SERVICE_PORT, reload=True)

