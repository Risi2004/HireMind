"""HireMind Job Description Analyzer Agent
Powered by Google Agent Development Kit (ADK) & OpenRouter.
Analyzes job descriptions, extracts role requirements, competencies,
interview focus areas, and performs Candidate <-> Role alignment.
"""

import json
import logging
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field

from config.settings import (
    MODEL_PROVIDER,
    AI_MODEL,
    OPENROUTER_BASE_URL,
    OPENROUTER_API_KEY,
    get_orchestrator_model,
)

logger = logging.getLogger("JobDescriptionAnalyzerAgent")

try:
    from google.adk.agents import Agent
    ADK_AVAILABLE = True
except ImportError:
    try:
        from google.adk import Agent
        ADK_AVAILABLE = True
    except ImportError:
        ADK_AVAILABLE = False
        Agent = None


# -------------------------------------------------------------------------
# Pydantic Schemas for Structured JSON Output
# -------------------------------------------------------------------------
class RoleUnderstandingSchema(BaseModel):
    job_title: str = Field(default="", description="Clean standardized job title")
    professional_domain: str = Field(default="", description="Industry/Domain (e.g. Software Engineering, Fintech, Healthcare)")
    is_technical_role: bool = Field(default=True, description="True if software developer, engineer, data scientist, or technical; False for non-technical roles (HR, Marketing, Sales, Legal, etc.)")
    requires_github: bool = Field(default=True, description="True if code repos or GitHub portfolio is relevant for evaluating this role; False otherwise")
    seniority_level: str = Field(default="Mid-Level", description="Entry-Level, Junior, Mid-Level, Senior, Lead, Executive")
    main_purpose: str = Field(default="", description="Core mission and objective of this role")


class RequirementsSchema(BaseModel):
    required_skills: List[str] = Field(default_factory=list, description="Mandatory core technical and functional skills")
    preferred_skills: List[str] = Field(default_factory=list, description="Bonus / nice-to-have skills")
    tools_and_technologies: List[str] = Field(default_factory=list, description="Platforms, frameworks, libraries, software")
    qualifications: List[str] = Field(default_factory=list, description="Required education, degrees, certifications")
    experience_requirements: str = Field(default="", description="Years of experience and background requirements")
    domain_knowledge: List[str] = Field(default_factory=list, description="Domain-specific knowledge areas")


class AlignmentSchema(BaseModel):
    strong_matches: List[str] = Field(default_factory=list, description="Skills/experiences clearly evidenced in candidate resume")
    areas_to_verify: List[str] = Field(default_factory=list, description="Areas mentioned in JD to probe during interview")
    not_evidenced_in_resume: List[str] = Field(default_factory=list, description="JD requirements not explicitly stated on CV (do not assume lack of skill)")
    match_percentage_estimate: int = Field(default=75, description="Estimated alignment percentage 0-100")
    alignment_summary: str = Field(default="", description="2-3 sentence balanced alignment synthesis")


class NextAgentContextSchema(BaseModel):
    key_technical_pillars: List[str] = Field(default_factory=list, description="Primary technical themes for question generation")
    behavioral_themes: List[str] = Field(default_factory=list, description="Cultural & leadership themes to evaluate")
    company_research_cues: List[str] = Field(default_factory=list, description="Keywords for company research agent")
    recommended_difficulty: str = Field(default="Intermediate", description="Beginner, Intermediate, Advanced, Expert")


class JobDescriptionAnalysisSchema(BaseModel):
    role_understanding: RoleUnderstandingSchema = Field(default_factory=RoleUnderstandingSchema)
    requirements: RequirementsSchema = Field(default_factory=RequirementsSchema)
    key_responsibilities: List[str] = Field(default_factory=list, description="Concise, actionable responsibility areas")
    competencies: List[str] = Field(default_factory=list, description="Core competencies e.g. Problem Solving, Architecture, Teamwork")
    important_interview_areas: List[str] = Field(default_factory=list, description="Priority focus areas for the interview")
    candidate_alignment: AlignmentSchema = Field(default_factory=AlignmentSchema)
    company_context: Dict[str, Any] = Field(default_factory=dict, description="Inferred company profile, domain, and culture signals")
    next_agent_context: NextAgentContextSchema = Field(default_factory=NextAgentContextSchema)


# -------------------------------------------------------------------------
# Agent Implementation
# -------------------------------------------------------------------------
class JobDescriptionAnalyzerAgent:
    """Specialized Sub-Agent responsible for deep job description breakdown,
    competency mapping, employer expectations synthesis, and candidate-role alignment.
    Does NOT conduct the interview or generate final interview questions.
    """

    SYSTEM_INSTRUCTION = (
        "You are the HireMind Job Description Analyzer Agent, a specialized evaluation agent powered by Google ADK.\n"
        "Your core objective is to answer: 'What is this employer looking for, and what should the interview focus on?'\n\n"
        "RULES:\n"
        "1. Do NOT generate interview questions or conduct the interview. Focus purely on deep structured role analysis.\n"
        "2. Extract clear, concise, actionable items. Keep items punchy (3-6 words per bullet, 3-6 items per list) to keep JSON crisp.\n"
        "3. Accurately classify role_understanding.is_technical_role as true for software engineers, developers, QA, DevOps, Data Science, AI/ML, and technical engineering roles, and false for non-technical roles (HR, Marketing, Sales, Operations, Finance, Legal, etc.).\n"
        "4. When comparing with candidate resume: classify evidence as strong_matches, areas_to_verify, and not_evidenced_in_resume.\n"
        "   IMPORTANT: Never state the candidate 'lacks' a skill simply because it isn't listed on their CV; classify it under not_evidenced_in_resume.\n"
        "5. You MUST respond ONLY with a complete, fully closed valid JSON object strictly matching this schema with no markdown outside the JSON:\n"
        "{\n"
        '  "role_understanding": {\n'
        '    "job_title": "Standardized Role Title",\n'
        '    "professional_domain": "Industry Domain",\n'
        '    "is_technical_role": true,\n'
        '    "requires_github": true,\n'
        '    "seniority_level": "Entry-Level | Junior | Mid-Level | Senior | Lead | Executive",\n'
        '    "main_purpose": "Primary objective and purpose of this role"\n'
        "  },\n"
        '  "requirements": {\n'
        '    "required_skills": ["Skill1", "Skill2"],\n'
        '    "preferred_skills": ["NiceToHave1", "NiceToHave2"],\n'
        '    "tools_and_technologies": ["Tool1", "Framework1", "Platform1"],\n'
        '    "qualifications": ["Degree or certification requirement"],\n'
        '    "experience_requirements": "e.g. 3+ years in scalable web platforms",\n'
        '    "domain_knowledge": ["Domain area 1", "Domain area 2"]\n'
        "  },\n"
        '  "key_responsibilities": [\n'
        '    "Specific Responsibility Area 1",\n'
        '    "Specific Responsibility Area 2"\n'
        "  ],\n"
        '  "competencies": [\n'
        '    "Problem Solving", "System Architecture", "Cross-functional Collaboration"\n'
        "  ],\n"
        '  "important_interview_areas": [\n'
        '    "Area 1 that deserves high priority in interview",\n'
        '    "Area 2 that deserves high priority in interview"\n'
        "  ],\n"
        '  "candidate_alignment": {\n'
        '    "strong_matches": ["Skills confirmed by candidate resume"],\n'
        '    "areas_to_verify": ["Items in JD that should be probed in interview"],\n'
        '    "not_evidenced_in_resume": ["JD requirements not explicitly stated on CV"],\n'
        '    "match_percentage_estimate": 80,\n'
        '    "alignment_summary": "2-3 sentence executive alignment summary"\n'
        "  },\n"
        '  "company_context": {\n'
        '    "company_name": "Company Name",\n'
        '    "industry": "Inferred Industry",\n'
        '    "culture_signals": ["Fast-paced", "Quality-focused", "Customer-first"]\n'
        "  },\n"
        '  "next_agent_context": {\n'
        '    "key_technical_pillars": ["Pillar 1", "Pillar 2"],\n'
        '    "behavioral_themes": ["Theme 1", "Theme 2"],\n'
        '    "company_research_cues": ["Keyword 1", "Keyword 2"],\n'
        '    "recommended_difficulty": "Intermediate"\n'
        "  }\n"
        "}"
    )

    def __init__(self, model: Optional[Any] = None):
        self.model = model if model is not None else get_orchestrator_model()
        self.adk_agent: Optional[Any] = None
        self._initialize_adk_agent()

    def _initialize_adk_agent(self):
        """Instantiate Google ADK Agent wrapper."""
        if not ADK_AVAILABLE:
            logger.warning("Google ADK not available for Job Description Analyzer. Using direct OpenRouter caller.")
            return

        try:
            self.adk_agent = Agent(
                name="jd_analyzer",
                model=self.model,
                description="Analyzes Job Descriptions, extracts employer requirements & competencies, and maps candidate alignment.",
                instruction=self.SYSTEM_INSTRUCTION
            )
            logger.info("Google ADK Job Description Analyzer Agent initialized successfully.")
        except Exception as e:
            logger.error(f"Error creating ADK Job Description Analyzer Agent: {e}")
            self.adk_agent = None

    def analyze(
        self,
        job_description: str,
        job_title: str = "",
        company_name: str = "",
        resume_analysis: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Analyze job description and synthesize requirements, competencies,
        interview focus areas, and alignment against candidate resume.
        """
        if not job_description or not job_description.strip():
            raise ValueError("Job description cannot be empty.")

        # Build comprehensive input context
        prompt = self._build_prompt(job_description, job_title, company_name, resume_analysis)

        # Call OpenRouter LLM
        llm_response, error_detail = self._call_llm(prompt)

        if llm_response:
            parsed = self._extract_json(llm_response)
            if parsed:
                try:
                    validated = JobDescriptionAnalysisSchema(**parsed)
                    return validated.model_dump()
                except Exception as val_err:
                    logger.warning(f"Schema validation warning: {val_err}. Retaining parsed output.")
                    return parsed
            else:
                raise ValueError(f"Model responded from '{AI_MODEL}' but output could not be parsed into the required JSON schema.")

        raise RuntimeError(
            f"Job Description analysis failed via OpenRouter ({AI_MODEL}): {error_detail or 'LLM service is unreachable'}. "
            f"Please verify OPENROUTER_API_KEY in ai-service/.env."
        )

    def _build_prompt(
        self,
        job_description: str,
        job_title: str,
        company_name: str,
        resume_analysis: Optional[Dict[str, Any]]
    ) -> str:
        prompt_parts = []
        if job_title:
            prompt_parts.append(f"TARGET ROLE: {job_title}")
        if company_name:
            prompt_parts.append(f"TARGET COMPANY: {company_name}")

        prompt_parts.append("\n--- JOB DESCRIPTION ---")
        prompt_parts.append(job_description[:8000])

        if resume_analysis:
            prompt_parts.append("\n--- CANDIDATE RESUME PROFILE (FOR ALIGNMENT) ---")
            cand_name = resume_analysis.get("candidate_name", "Candidate")
            cand_role = resume_analysis.get("detected_role", "")
            cand_skills = resume_analysis.get("skills", {})
            cand_summary = resume_analysis.get("summary", "")
            cand_exp = resume_analysis.get("years_of_experience", "")

            resume_summary_text = (
                f"Candidate: {cand_name} (Role: {cand_role}, Experience: {cand_exp} yrs)\n"
                f"Summary: {cand_summary}\n"
                f"Technical Skills: {', '.join(cand_skills.get('technical', []))}\n"
                f"Tools & Frameworks: {', '.join(cand_skills.get('frameworks_and_tools', []))}\n"
                f"Soft Skills: {', '.join(cand_skills.get('soft_skills', []))}"
            )
            prompt_parts.append(resume_summary_text)
        else:
            prompt_parts.append("\n--- CANDIDATE RESUME PROFILE ---")
            prompt_parts.append("No resume profile provided. Perform general role & competency breakdown.")

        prompt_parts.append(
            "\nPlease perform the full deep analysis and return the strict JSON schema with role_understanding, "
            "requirements, key_responsibilities, competencies, important_interview_areas, candidate_alignment, "
            "company_context, and next_agent_context."
        )

        return "\n".join(prompt_parts)

    def _call_llm(self, prompt: str) -> tuple[Optional[str], Optional[str]]:
        """Send prompt to OpenRouter endpoint."""
        if MODEL_PROVIDER == "openrouter":
            if not OPENROUTER_API_KEY or "your_openrouter_api_key_here" in OPENROUTER_API_KEY:
                return None, "OPENROUTER_API_KEY is not configured in ai-service/.env"

            try:
                import requests
                base_url = OPENROUTER_BASE_URL.rstrip("/")
                chat_url = f"{base_url}/chat/completions"

                headers = {
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "HTTP-Referer": "https://hiremind.com",
                    "X-Title": "HireMind JD Analyzer",
                }
                payload = {
                    "model": AI_MODEL,
                    "messages": [
                        {"role": "system", "content": self.SYSTEM_INSTRUCTION},
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": 0.1,
                    "max_tokens": 2200,
                    "reasoning": {"max_tokens": 150},
                }

                logger.info(f"Querying OpenRouter model '{AI_MODEL}' for Job Description analysis...")
                response = requests.post(chat_url, headers=headers, json=payload, timeout=90)
                if response.status_code == 200:
                    data = response.json()
                    choices = data.get("choices", [])
                    if choices:
                        msg = choices[0].get("message", {})
                        content = msg.get("content") or ""
                        # If content is empty or contains reasoning blocks, fallback to reasoning text
                        if not content.strip() and msg.get("reasoning"):
                            content = msg.get("reasoning")
                        return content, None
                    return None, "OpenRouter returned empty choices list."
                else:
                    err_msg = f"OpenRouter endpoint returned HTTP {response.status_code}: {response.text[:200]}"
                    logger.warning(err_msg)
                    return None, err_msg
            except Exception as e:
                err_msg = f"Connection failed to OpenRouter endpoint '{OPENROUTER_BASE_URL}': {e}"
                logger.warning(err_msg)
                return None, err_msg

        return None, "No active LLM model provider configured."

    def _extract_json(self, text: str) -> Optional[Dict[str, Any]]:
        """Extract and parse JSON object from LLM response text, with robust healing for reasoning models."""
        try:
            cleaned = text.strip()

            # Remove <think>...</think> reasoning blocks from Qwen / DeepSeek models
            import re
            cleaned = re.sub(r"<think>.*?</think>", "", cleaned, flags=re.DOTALL).strip()

            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            elif cleaned.startswith("```"):
                cleaned = cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            cleaned = cleaned.strip()

            start_idx = cleaned.find("{")
            if start_idx == -1:
                return None

            json_candidate = cleaned[start_idx:]
            end_idx = json_candidate.rfind("}")
            if end_idx != -1:
                json_str = json_candidate[:end_idx + 1]
                try:
                    return json.loads(json_str)
                except Exception:
                    pass

            # Auto-healing for slightly truncated JSON
            # Count open vs close braces & brackets
            open_braces = json_candidate.count("{") - json_candidate.count("}")
            open_brackets = json_candidate.count("[") - json_candidate.count("]")

            # Strip trailing comma or unclosed string
            healed = json_candidate.rstrip()
            if healed.endswith(","):
                healed = healed[:-1]
            if healed.count('"') % 2 != 0:
                healed += '"'

            healed += ("]" * max(0, open_brackets)) + ("}" * max(0, open_braces))
            try:
                return json.loads(healed)
            except Exception as e:
                logger.warning(f"Healed JSON parsing failed: {e}")
        except Exception as e:
            logger.warning(f"Failed to parse JSON from JD Analyzer output: {e}")
        return None


# Singleton instance
jd_analyzer_instance = JobDescriptionAnalyzerAgent()
