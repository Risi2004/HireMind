"""HireMind AI Service Gateway
FastAPI Application hosting Google ADK Orchestrator
"""

import sys
import os
import subprocess
from pathlib import Path

# Automatically ensure the script runs inside the project's .venv virtual environment
venv_dir = Path(__file__).resolve().parent / ".venv"
venv_python = venv_dir / "Scripts" / "python.exe" if sys.platform == "win32" else venv_dir / "bin" / "python"
if venv_python.exists() and os.path.abspath(sys.executable).lower() != os.path.abspath(str(venv_python)).lower():
    sys.exit(subprocess.call([str(venv_python)] + sys.argv))

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any

from config.settings import AI_SERVICE_PORT, AI_SERVICE_HOST
from orchestrator.orchestrator import orchestrator_instance
from agents.resume_analyzer import resume_analyzer_instance
from agents.jd_analyzer import jd_analyzer_instance
from agents.interview_planner import interview_planner_instance
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=AI_SERVICE_HOST, port=AI_SERVICE_PORT, reload=True)

