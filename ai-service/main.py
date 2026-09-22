"""HireMind AI Service Gateway
FastAPI Application hosting Google ADK Orchestrator
"""

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any

from config.settings import AI_SERVICE_PORT, AI_SERVICE_HOST
from orchestrator.orchestrator import orchestrator_instance
from agents.resume_analyzer import resume_analyzer_instance
from utils.text_extractor import extract_text_from_resume

app = FastAPI(
    title="HireMind AI Orchestrator Service",
    description="Multi-agent interview orchestration layer powered by Google ADK (Agent Development Kit)",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=AI_SERVICE_HOST, port=AI_SERVICE_PORT, reload=True)
