"""HireMind Resume Analyzer Agent
Powered by Google Agent Development Kit (ADK)
Analyzes candidate resumes (PDF/DOCX text) and outputs structured JSON for Qwen 14B / RunPod.
"""

import json
import re
import logging
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field

from config.settings import (
    MODEL_PROVIDER,
    RUNPOD_MODEL_NAME,
    RUNPOD_ENDPOINT_URL,
    RUNPOD_API_KEY,
    get_orchestrator_model,
)

logger = logging.getLogger("ResumeAnalyzerAgent")

try:
    from google.adk.agents import Agent
    ADK_AVAILABLE = True
except ImportError:
    ADK_AVAILABLE = False
    Agent = None


class SkillsSchema(BaseModel):
    technical: List[str] = Field(default_factory=list)
    frameworks_and_tools: List[str] = Field(default_factory=list)
    soft_skills: List[str] = Field(default_factory=list)


class WorkExperienceSchema(BaseModel):
    company: str = ""
    role: str = ""
    duration: str = ""
    highlights: List[str] = Field(default_factory=list)


class EducationSchema(BaseModel):
    degree: str = ""
    institution: str = ""
    year: str = ""


class ProjectSchema(BaseModel):
    title: str = ""
    tech_stack: List[str] = Field(default_factory=list)
    description: str = ""


class ResumeAnalysisSchema(BaseModel):
    candidate_name: str = "Candidate"
    email: Optional[str] = None
    phone: Optional[str] = None
    detected_role: str = "Software Engineer"
    years_of_experience: float = 1.0
    summary: str = ""
    skills: SkillsSchema = Field(default_factory=SkillsSchema)
    work_experience: List[WorkExperienceSchema] = Field(default_factory=list)
    education: List[EducationSchema] = Field(default_factory=list)
    projects: List[ProjectSchema] = Field(default_factory=list)
    strengths: List[str] = Field(default_factory=list)
    suggested_interview_focus: List[str] = Field(default_factory=list)


class ResumeAnalyzerAgent:
    """Specialized Sub-Agent responsible for deep resume parsing,

    skill extraction, and experience profiling via Qwen 14B.
    """

    SYSTEM_INSTRUCTION = (
        "You are the HireMind Resume Analyzer Agent, a specialized AI agent powered by Google ADK. "
        "Your task is to thoroughly analyze the provided candidate resume text and extract high-signal structured profile data. "
        "You MUST respond ONLY with a valid JSON object strictly matching this schema with no markdown commentary, no conversational filler:\n"
        "{\n"
        '  "candidate_name": "Full name of candidate",\n'
        '  "email": "Email address or null",\n'
        '  "phone": "Phone number or null",\n'
        '  "detected_role": "Primary role/title inferred from experience",\n'
        '  "years_of_experience": 3.5,\n'
        '  "summary": "2-3 sentence executive professional summary",\n'
        '  "skills": {\n'
        '    "technical": ["Language1", "Language2", ...],\n'
        '    "frameworks_and_tools": ["Framework1", "Tool1", ...],\n'
        '    "soft_skills": ["Skill1", "Skill2", ...]\n'
        "  },\n"
        '  "work_experience": [\n'
        "    {\n"
        '      "company": "Company Name",\n'
        '      "role": "Job Title",\n'
        '      "duration": "Start - End Date",\n'
        '      "highlights": ["Key achievement 1", "Key achievement 2"]\n'
        "    }\n"
        "  ],\n"
        '  "education": [\n'
        "    {\n"
        '      "degree": "Degree / Major",\n'
        '      "institution": "University / College",\n'
        '      "year": "Graduation Year"\n'
        "    }\n"
        "  ],\n"
        '  "projects": [\n'
        "    {\n"
        '      "title": "Project Name",\n'
        '      "tech_stack": ["Tech1", "Tech2"],\n'
        '      "description": "Project overview and candidate impact"\n'
        "    }\n"
        "  ],\n"
        '  "strengths": ["Key core capability 1", "Key core capability 2"],\n'
        '  "suggested_interview_focus": ["Recommended technical area to probe", "System design topic to ask"]\n'
        "}"
    )

    def __init__(self, model: Optional[Any] = None):
        self.model = model if model is not None else get_orchestrator_model()
        self.adk_agent: Optional[Any] = None
        self._initialize_adk_agent()

    def _initialize_adk_agent(self):
        """Instantiate Google ADK Agent wrapper."""
        if not ADK_AVAILABLE:
            logger.warning("Google ADK not available. Using fallback resume analyzer.")
            return

        try:
            self.adk_agent = Agent(
                name="resume_analyzer",
                model=self.model,
                description="Analyzes resumes in PDF/DOCX and extracts structured skills, experience, and interview suggestions.",
                instruction=self.SYSTEM_INSTRUCTION
            )
            logger.info("Google ADK Resume Analyzer Agent initialized successfully.")
        except Exception as e:
            logger.error(f"Error creating ADK Resume Analyzer Agent: {e}")
            self.adk_agent = None

    def analyze(self, resume_text: str, filename: str = "resume.pdf") -> Dict[str, Any]:
        """Analyze extracted resume text and return structured JSON."""
        if not resume_text or not resume_text.strip():
            raise ValueError(f"Extracted resume text from '{filename}' is empty or unreadable.")

        # 1. Try LLM Call (RunPod Qwen 14B or Gemini)
        llm_response, error_detail = self._call_llm(resume_text)
        if llm_response:
            parsed = self._extract_json(llm_response)
            if parsed:
                try:
                    # Validate schema
                    validated = ResumeAnalysisSchema(**parsed)
                    return validated.model_dump()
                except Exception as val_err:
                    logger.warning(f"Schema validation warning: {val_err}. Retaining parsed output.")
                    return parsed
            else:
                raise ValueError(f"Model responded from '{RUNPOD_MODEL_NAME}' but output could not be parsed into the required JSON schema.")

        # If LLM failed, do not use silent mock data; raise explicit error so user knows the exact issue
        raise RuntimeError(
            f"Resume analysis failed via Qwen 14B: {error_detail or 'LLM service is unreachable'}. "
            f"Please verify your RunPod pod is active at '{RUNPOD_ENDPOINT_URL}'."
        )

    def _call_llm(self, resume_text: str) -> tuple[Optional[str], Optional[str]]:
        """Send prompt to configured LLM (RunPod OpenAI API / LiteLLM / Gemini).
        Returns (response_text, error_detail)
        """
        prompt = (
            f"Please analyze the following resume text and output the required structured JSON format:\n\n"
            f"--- BEGIN RESUME TEXT ---\n"
            f"{resume_text[:12000]}\n"
            f"--- END RESUME TEXT ---"
        )

        # Case A: Try RunPod OpenAI-compatible endpoint directly
        if MODEL_PROVIDER == "runpod":
            if not RUNPOD_ENDPOINT_URL or "your-pod-id" in RUNPOD_ENDPOINT_URL:
                return None, f"RUNPOD_ENDPOINT is not configured or still set to placeholder in ai-service/.env ({RUNPOD_ENDPOINT_URL})"

            try:
                import requests
                base_url = RUNPOD_ENDPOINT_URL.rstrip("/")
                chat_url = f"{base_url}/chat/completions"

                headers = {
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {RUNPOD_API_KEY}"
                }
                payload = {
                    "model": RUNPOD_MODEL_NAME,
                    "messages": [
                        {"role": "system", "content": self.SYSTEM_INSTRUCTION},
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.2,
                    "max_tokens": 2048
                }

                logger.info(f"Querying RunPod model '{RUNPOD_MODEL_NAME}' at '{chat_url}'...")
                response = requests.post(chat_url, headers=headers, json=payload, timeout=30)
                if response.status_code == 200:
                    data = response.json()
                    content = data["choices"][0]["message"]["content"]
                    return content, None
                else:
                    err_msg = f"RunPod endpoint returned HTTP {response.status_code}: {response.text[:200]}"
                    logger.warning(err_msg)
                    return None, err_msg
            except Exception as e:
                err_msg = f"Connection failed to RunPod endpoint '{RUNPOD_ENDPOINT_URL}': {e}"
                logger.warning(err_msg)
                return None, err_msg

        return None, "No active LLM model provider configured."

    def _extract_json(self, text: str) -> Optional[Dict[str, Any]]:
        """Extract and parse JSON object from LLM response text."""
        try:
            # Strip markdown block quotes if present
            cleaned = text.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            elif cleaned.startswith("```"):
                cleaned = cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            cleaned = cleaned.strip()

            # Find matching braces
            start_idx = cleaned.find("{")
            end_idx = cleaned.rfind("}")
            if start_idx != -1 and end_idx != -1:
                json_str = cleaned[start_idx:end_idx + 1]
                return json.loads(json_str)
        except Exception as e:
            logger.warning(f"Failed to parse JSON from LLM output: {e}")
        return None

    def _heuristic_fallback(self, text: str, filename: str) -> Dict[str, Any]:
        """Resilient rule-based extractor to guarantee structured response

        even when offline or when LLM endpoint is unreachable.
        """
        lines = [line.strip() for line in text.split("\n") if line.strip()]

        # Guess candidate name from first few lines
        candidate_name = "Candidate"
        for line in lines[:5]:
            if len(line.split()) in [2, 3, 4] and not any(char in line for char in ["@", "http", "Resume", "CV", "Page"]):
                candidate_name = line
                break

        # Guess Email
        email_match = re.search(r"[\w\.-]+@[\w\.-]+\.\w+", text)
        email = email_match.group(0) if email_match else None

        # Guess Phone
        phone_match = re.search(r"(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}", text)
        phone = phone_match.group(0) if phone_match else None

        # Technical skills dictionary matching
        tech_keywords = [
            "Python", "JavaScript", "TypeScript", "React", "Node.js", "Express",
            "FastAPI", "Django", "Java", "C++", "C#", "Go", "Rust", "SQL",
            "PostgreSQL", "MongoDB", "Redis", "Docker", "Kubernetes", "AWS",
            "Azure", "GCP", "HTML", "CSS", "TailwindCSS", "Git", "REST API",
            "GraphQL", "Microservices", "Machine Learning", "PyTorch", "TensorFlow"
        ]
        found_tech = []
        for kw in tech_keywords:
            if re.search(rf"\b{re.escape(kw)}\b", text, re.IGNORECASE):
                found_tech.append(kw)

        if not found_tech:
            found_tech = ["Software Engineering", "Problem Solving", "Web Development"]

        # Infer role
        role_candidates = [
            "Senior Backend Engineer", "Full Stack Developer", "Frontend Developer",
            "Backend Developer", "DevOps Engineer", "Data Engineer", "Software Engineer"
        ]
        detected_role = "Software Engineer"
        for role in role_candidates:
            if re.search(rf"\b{re.escape(role)}\b", text, re.IGNORECASE):
                detected_role = role
                break

        # Calculate estimated years
        years_matches = re.findall(r"(?:19|20)\d{2}", text)
        years_of_experience = 2.0
        if years_matches:
            numeric_years = [int(y) for y in years_matches if 2000 <= int(y) <= 2030]
            if len(numeric_years) >= 2:
                diff = max(numeric_years) - min(numeric_years)
                years_of_experience = max(1.0, min(15.0, float(diff)))

        summary = (
            f"Experienced {detected_role} with proven proficiency in {', '.join(found_tech[:4])}. "
            f"Demonstrates comprehensive background across software delivery and engineering problem-solving."
        )

        return {
            "candidate_name": candidate_name,
            "email": email,
            "phone": phone,
            "detected_role": detected_role,
            "years_of_experience": years_of_experience,
            "summary": summary,
            "skills": {
                "technical": found_tech[:10],
                "frameworks_and_tools": [s for s in found_tech if s in ["Docker", "Kubernetes", "AWS", "Git", "PostgreSQL", "MongoDB"]],
                "soft_skills": ["System Design", "Agile Collaboration", "Code Quality", "Communication"]
            },
            "work_experience": [
                {
                    "company": "Industry Experience",
                    "role": detected_role,
                    "duration": f"{int(years_of_experience)} Years Track Record",
                    "highlights": [
                        f"Architected scalable features utilizing {', '.join(found_tech[:3])}.",
                        "Optimized services for low latency and high availability.",
                        "Collaborated with cross-functional product and engineering teams."
                    ]
                }
            ],
            "education": [
                {
                    "degree": "B.Sc. in Computer Science or Equivalent",
                    "institution": "Accredited University",
                    "year": str(max(numeric_years)) if years_matches and numeric_years else "2022"
                }
            ],
            "projects": [
                {
                    "title": f"{detected_role} Core Applications",
                    "tech_stack": found_tech[:4],
                    "description": "Production services and full-stack modules designed for maintainability and scale."
                }
            ],
            "strengths": [
                f"Hands-on expertise with {found_tech[0] if found_tech else 'Modern Development'}",
                "Structured analytical thinking and clean architecture",
                "Proven ability to learn and adapt to production systems"
            ],
            "suggested_interview_focus": [
                f"Deep dive into {found_tech[0] if found_tech else 'core systems'} best practices",
                "System architecture and distributed error handling",
                "Real-world trade-offs in database and API design"
            ]
        }


# Global singleton instance
resume_analyzer_instance = ResumeAnalyzerAgent()
