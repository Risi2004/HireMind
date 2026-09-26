"""HireMind Interview Planning Agent
Powered by Google Agent Development Kit (ADK) & OpenRouter.
Analyzes pre-computed CV and JD structured intelligence from MongoDB,
along with role, company, interview type, difficulty, duration, and optional GitHub data,
to dynamically formulate a personalized, multi-stage interview plan.
Does NOT conduct the interview, evaluate answers, or pre-generate fixed questions.
"""

import json
import logging
import re
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field

from config.settings import (
    MODEL_PROVIDER,
    AI_MODEL,
    OPENROUTER_BASE_URL,
    OPENROUTER_API_KEY,
    get_orchestrator_model,
)

logger = logging.getLogger("InterviewPlannerAgent")

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
# Pydantic Schemas for Planning Agent Output & Validation
# -------------------------------------------------------------------------
class PriorityTopicSchema(BaseModel):
    topic: str = Field(..., description="Specific technical topic, project, or competency to probe")
    priority: str = Field(default="high", description="high | medium | low")
    source: str = Field(default="cv_and_jd", description="cv | jd | cv_and_jd | github | role | interview_type")
    purpose: str = Field(..., description="Actionable rationale for why this topic is planned")


class StageSchema(BaseModel):
    id: str = Field(..., description="Unique identifier for stage, e.g. stage_intro, stage_technical")
    name: str = Field(..., description="Candidate-friendly name of the stage")
    order: int = Field(..., description="Sequential order starting from 1")
    durationMinutes: int = Field(..., description="Allocated time in minutes for this stage")
    targetQuestionCount: int = Field(..., description="Estimated number of questions to explore in this stage")
    difficulty: str = Field(default="intermediate", description="beginner | intermediate | advanced")
    topics: List[str] = Field(default_factory=list, description="Primary focus areas and topics for this stage")
    objectives: List[str] = Field(default_factory=list, description="Assessment goals for this stage")
    questionIntents: List[str] = Field(
        default_factory=list,
        description="High-level question themes/intents to guide the live interviewer (NO fixed script)"
    )


class InterviewPlanSchema(BaseModel):
    version: int = Field(default=1, description="Plan schema version")
    role: str = Field(..., description="Target role title")
    company: str = Field(default="", description="Target company or organization")
    interviewType: str = Field(..., description="Role-Specific | HR & Behavioral | Case & Situational | Skills Assessment | Full Interview")
    difficulty: str = Field(..., description="Beginner | Intermediate | Advanced")
    durationMinutes: int = Field(..., description="Total planned duration in minutes (e.g. 15, 30, 60)")
    estimatedQuestionCount: int = Field(..., description="Total approximate questions across all stages")
    objectives: List[str] = Field(default_factory=list, description="Overarching interview goals")
    priorityTopics: List[PriorityTopicSchema] = Field(default_factory=list, description="Prioritized interview topics")
    candidateStrengthsToValidate: List[str] = Field(default_factory=list, description="Candidate strengths from CV to confirm")
    jdAreasToExplore: List[str] = Field(default_factory=list, description="JD requirements to probe or clarify")
    stages: List[StageSchema] = Field(default_factory=list, description="Sequential interview stages")


# -------------------------------------------------------------------------
# Planning Agent Implementation
# -------------------------------------------------------------------------
class InterviewPlannerAgent:
    """Specialized Sub-Agent responsible for generating a personalized,
    multi-stage interview plan based on existing CV & JD intelligence in MongoDB.
    """

    SYSTEM_INSTRUCTION = (
        "You are the HireMind Interview Planning Agent, an elite AI system architect powered by Google ADK.\n"
        "Your sole responsibility is to answer: 'Based on this candidate, target job, company, and interview configuration, "
        "what should this interview cover and how should the time be allocated?'\n\n"
        "CRITICAL CONSTRAINTS:\n"
        "1. DO NOT conduct the interview or evaluate candidate answers.\n"
        "2. DO NOT PRE-GENERATE FIXED QUESTIONS (No 'Question 1: ...', 'Question 2: ...').\n"
        "   Instead, produce Stage Name, Duration in Minutes, Topics, Objectives, and Question Intents (e.g. 'Explore candidate architectural decisions in Project X').\n"
        "3. The sum of stage durationMinutes MUST EXACTLY MATCH the total durationMinutes specified in the configuration.\n"
        "4. Ground topics deeply in the candidate's actual projects, technologies, and work experience provided in the context.\n"
        "   If the candidate lists specific projects (e.g. 'FoodLoop'), include concrete project architecture topics rather than generic placeholders.\n"
        "5. Tailor the stages to the requested interviewType:\n"
        "   - 'HR & Behavioral': Emphasize communication, teamwork, conflict resolution, leadership, and adaptability.\n"
        "   - 'Role-Specific': Emphasize core role skills, candidate projects, and specific JD competencies.\n"
        "   - 'Case & Situational': Emphasize real-world problem scenarios, trade-offs, and critical decision-making.\n"
        "   - 'Skills Assessment': Emphasize technical breadth, practical knowledge, and core architectural principles.\n"
        "   - 'Full Interview': A balanced journey covering Intro, Experience & Projects, Technical Core, Problem Solving, Behavioral, and Closing.\n"
        "6. Calibrate question count and depth to the selected duration and difficulty:\n"
        "   - 15 min: 4-6 questions across 3-4 stages.\n"
        "   - 30 min: 8-12 questions across 5-6 stages.\n"
        "   - 60 min: 14-18 questions across 6-7 stages.\n"
        "7. Support non-technical roles (e.g. Marketing, Business Analyst, HR, Finance) equally well when provided.\n"
        "8. You MUST respond ONLY with a complete, fully closed valid JSON object matching this schema:\n"
        "{\n"
        '  "version": 1,\n'
        '  "role": "Role Title",\n'
        '  "company": "Company Name",\n'
        '  "interviewType": "Role-Specific",\n'
        '  "difficulty": "Intermediate",\n'
        '  "durationMinutes": 30,\n'
        '  "estimatedQuestionCount": 10,\n'
        '  "objectives": [\n'
        '    "Validate candidate hands-on experience with ...",\n'
        '    "Assess problem-solving approaches in ..."\n'
        "  ],\n"
        '  "priorityTopics": [\n'
        "    {\n"
        '      "topic": "Specific Topic Name",\n'
        '      "priority": "high",\n'
        '      "source": "cv_and_jd",\n'
        '      "purpose": "Why this topic is prioritized"\n'
        "    }\n"
        "  ],\n"
        '  "candidateStrengthsToValidate": ["Strength 1", "Strength 2"],\n'
        '  "jdAreasToExplore": ["JD Area 1", "JD Area 2"],\n'
        '  "stages": [\n'
        "    {\n"
        '      "id": "stage_intro",\n'
        '      "name": "Introduction & Background",\n'
        '      "order": 1,\n'
        '      "durationMinutes": 3,\n'
        '      "targetQuestionCount": 1,\n'
        '      "difficulty": "intermediate",\n'
        '      "topics": ["Candidate Background", "Role Motivation"],\n'
        '      "objectives": ["Establish rapport", "Understand career trajectory"],\n'
        '      "questionIntents": ["Understand current journey and motivation for this role"]\n'
        "    }\n"
        "  ]\n"
        "}"
    )

    def __init__(self, model: Optional[Any] = None):
        self.model = model if model is not None else get_orchestrator_model()
        self.adk_agent: Optional[Any] = None
        self._initialize_adk_agent()

    def _initialize_adk_agent(self):
        """Instantiate Google ADK Agent wrapper."""
        if not ADK_AVAILABLE:
            logger.warning("Google ADK not available for Interview Planning Agent. Using direct OpenRouter caller.")
            return

        try:
            self.adk_agent = Agent(
                name="interview_planner",
                model=self.model,
                description="Generates personalized interview plans based on structured CV, JD, and setup configurations.",
                instruction=self.SYSTEM_INSTRUCTION
            )
            logger.info("Google ADK Interview Planner Agent initialized successfully.")
        except Exception as e:
            logger.error(f"Error creating ADK Interview Planner Agent: {e}")
            self.adk_agent = None

    def plan_interview(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Generate a personalized interview plan from structured context."""
        candidate = context.get("candidate", {})
        target_job = context.get("targetJob", {})
        config = context.get("interviewConfiguration", {})
        github_data = context.get("github", {})

        role = target_job.get("role") or candidate.get("detectedRole") or "Software Engineer"
        company = target_job.get("company") or ""
        interview_type = config.get("type", "Role-Specific")
        difficulty = config.get("difficulty", "Intermediate")
        raw_duration = config.get("durationMinutes", 30)

        try:
            duration_minutes = int(raw_duration)
        except Exception:
            duration_minutes = 30

        # Build prompt from existing DB intelligence
        prompt = self._build_prompt(candidate, target_job, interview_type, difficulty, duration_minutes, github_data)

        # 1. Query LLM (OpenRouter / LiteLLM)
        llm_response, error_detail = self._call_llm(prompt)

        if llm_response:
            parsed = self._extract_json(llm_response)
            if parsed:
                try:
                    # Normalize & enforce total duration match
                    parsed = self._normalize_plan(parsed, role, company, interview_type, difficulty, duration_minutes)
                    validated = InterviewPlanSchema(**parsed)
                    return validated.model_dump()
                except Exception as val_err:
                    logger.warning(f"Schema validation warning: {val_err}. Retaining normalized parsed output.")
                    return parsed
            else:
                logger.warning(f"Could not parse valid JSON from model response for interview planning. Falling back to resilient planner.")
        else:
            logger.warning(f"Interview planning LLM query encountered issue: {error_detail}. Falling back to resilient planner.")

        # 2. Resilient fallback generator to ensure zero failure
        return self._heuristic_fallback(candidate, target_job, interview_type, difficulty, duration_minutes, github_data)

    def _build_prompt(
        self,
        candidate: Dict[str, Any],
        target_job: Dict[str, Any],
        interview_type: str,
        difficulty: str,
        duration_minutes: int,
        github_data: Dict[str, Any]
    ) -> str:
        prompt_parts = [
            f"TARGET ROLE: {target_job.get('role', 'Candidate Role')}",
            f"TARGET COMPANY: {target_job.get('company', 'Target Company') or 'Not specified'}",
            f"INTERVIEW TYPE: {interview_type}",
            f"DIFFICULTY: {difficulty}",
            f"TOTAL DURATION: {duration_minutes} minutes",
            "",
            "--- CANDIDATE PROFILE (FROM DB CV ANALYSIS) ---",
            f"Candidate Name: {candidate.get('candidateName', 'Candidate')}",
            f"Seniority / Experience: {candidate.get('candidateLevel', '') or candidate.get('yearsOfExperience', '1-3')} years",
            f"Core Technical Skills: {', '.join(candidate.get('skills', {}).get('technical', []) or candidate.get('technologies', []))}",
            f"Tools & Frameworks: {', '.join(candidate.get('skills', {}).get('frameworks_and_tools', []) or [])}",
            f"Strengths: {', '.join(candidate.get('strengths', []) or [])}",
        ]

        # Candidate Projects
        projects = candidate.get("projects", [])
        if projects:
            prompt_parts.append("\nCandidate Projects:")
            for p in projects[:3]:
                title = p.get("title") or "Project"
                tech = ", ".join(p.get("tech_stack", []))
                desc = p.get("description", "")
                prompt_parts.append(f"- {title} (Stack: {tech}): {desc}")

        # Work Experience
        work_exp = candidate.get("experience", [])
        if work_exp:
            prompt_parts.append("\nCandidate Work Experience:")
            for w in work_exp[:2]:
                c_name = w.get("company", "Company")
                c_role = w.get("role", "Role")
                dur = w.get("duration", "")
                prompt_parts.append(f"- {c_role} at {c_name} ({dur})")

        # Target Job Requirements
        prompt_parts.append("\n--- TARGET JOB REQUIREMENTS (FROM DB JD ANALYSIS) ---")
        prompt_parts.append(f"Required Skills: {', '.join(target_job.get('requiredSkills', []))}")
        prompt_parts.append(f"Preferred Skills: {', '.join(target_job.get('preferredSkills', []))}")
        prompt_parts.append(f"Key Responsibilities: {', '.join(target_job.get('responsibilities', [])[:4])}")
        prompt_parts.append(f"Key Competencies: {', '.join(target_job.get('competencies', [])[:4])}")

        # Alignment signals if present
        alignment = target_job.get("candidateAlignment", {})
        if alignment:
            strong = alignment.get("strong_matches", [])
            to_verify = alignment.get("areas_to_verify", [])
            unproven = alignment.get("not_evidenced_in_resume", [])
            if strong:
                prompt_parts.append(f"Confirmed Candidate Matches: {', '.join(strong[:4])}")
            if to_verify:
                prompt_parts.append(f"Areas to Probe from JD: {', '.join(to_verify[:4])}")
            if unproven:
                prompt_parts.append(f"JD Requirements not in CV: {', '.join(unproven[:3])}")

        # Optional GitHub Signals
        if github_data.get("available") or github_data.get("connected"):
            prompt_parts.append("\n--- GITHUB CONTEXT ---")
            prompt_parts.append(f"GitHub Connected: Yes ({github_data.get('publicReposCount', 0)} repos)")
            repos = github_data.get("repos", [])
            if repos:
                repo_names = [r.get("name") for r in repos[:4] if isinstance(r, dict) and r.get("name")]
                if repo_names:
                    prompt_parts.append(f"Public Repositories: {', '.join(repo_names)}")

        prompt_parts.append(
            f"\nDesign a personalized, structured interview plan for {duration_minutes} minutes. "
            f"Ensure the sum of stage durationMinutes is EXACTLY {duration_minutes}. "
            "Output only the strict JSON schema."
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
                    "X-Title": "HireMind Interview Planner",
                }
                payload = {
                    "model": AI_MODEL,
                    "messages": [
                        {"role": "system", "content": self.SYSTEM_INSTRUCTION},
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": 0.2,
                    "max_tokens": 2500,
                    "reasoning": {"max_tokens": 150},
                }

                logger.info(f"Querying OpenRouter model '{AI_MODEL}' for Interview Planning...")
                response = requests.post(chat_url, headers=headers, json=payload, timeout=90)
                if response.status_code == 200:
                    data = response.json()
                    choices = data.get("choices", [])
                    if choices:
                        msg = choices[0].get("message", {})
                        content = msg.get("content") or ""
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
        """Extract and parse JSON object from LLM response text with healing."""
        try:
            cleaned = text.strip()
            # Remove <think>...</think> reasoning blocks
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

            # Auto-healing for truncated responses
            open_braces = json_candidate.count("{") - json_candidate.count("}")
            open_brackets = json_candidate.count("[") - json_candidate.count("]")

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
            logger.warning(f"Failed to parse JSON from Interview Planner output: {e}")
        return None

    def _normalize_plan(
        self,
        plan: Dict[str, Any],
        role: str,
        company: str,
        interview_type: str,
        difficulty: str,
        total_duration: int
    ) -> Dict[str, Any]:
        """Ensures that stage durations sum up to total_duration and all required fields are well-formed."""
        plan["version"] = 1
        plan["role"] = plan.get("role") or role
        plan["company"] = plan.get("company") or company
        plan["interviewType"] = plan.get("interviewType") or interview_type
        plan["difficulty"] = plan.get("difficulty") or difficulty
        plan["durationMinutes"] = total_duration

        stages = plan.get("stages", [])
        if not stages:
            return self._heuristic_fallback({}, {"role": role, "company": company}, interview_type, difficulty, total_duration, {})

        # Normalize stage durations so sum == total_duration
        current_sum = sum(int(s.get("durationMinutes", 0)) for s in stages)
        if current_sum <= 0:
            per_stage = max(1, total_duration // len(stages))
            for s in stages:
                s["durationMinutes"] = per_stage
            current_sum = sum(s["durationMinutes"] for s in stages)

        if current_sum != total_duration:
            diff = total_duration - current_sum
            # Add or subtract diff from largest core stage (usually stage with index > 0 and < last)
            core_idx = min(len(stages) - 2, max(1, len(stages) // 2))
            stages[core_idx]["durationMinutes"] = max(1, stages[core_idx]["durationMinutes"] + diff)

        # Enforce consecutive order and ids
        total_questions = 0
        for i, s in enumerate(stages):
            s["order"] = i + 1
            if not s.get("id"):
                s["id"] = f"stage_{i+1}"
            s["targetQuestionCount"] = max(1, int(s.get("targetQuestionCount", 2)))
            total_questions += s["targetQuestionCount"]

        plan["stages"] = stages
        plan["estimatedQuestionCount"] = max(total_questions, int(plan.get("estimatedQuestionCount", total_questions)))

        return plan

    def _heuristic_fallback(
        self,
        candidate: Dict[str, Any],
        target_job: Dict[str, Any],
        interview_type: str,
        difficulty: str,
        duration_minutes: int,
        github_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Deterministic, high-signal fallback plan tailored to candidate data & setup choices.
        Guarantees zero system downtime even when offline.
        """
        role = target_job.get("role") or candidate.get("detectedRole") or "Software Engineer"
        company = target_job.get("company") or "the hiring organization"

        # Extract real candidate tech & projects
        tech_skills = candidate.get("skills", {}).get("technical", []) or candidate.get("technologies", [])
        frameworks = candidate.get("skills", {}).get("frameworks_and_tools", [])
        all_skills = list(dict.fromkeys(tech_skills + frameworks))
        if not all_skills:
            all_skills = ["Software Engineering", "System Design", "Problem Solving", "APIs"]

        projects = candidate.get("projects", [])
        project_name = projects[0].get("title") if projects else "Core Portfolio Project"
        project_tech = projects[0].get("tech_stack", []) if projects else all_skills[:3]

        jd_reqs = target_job.get("requiredSkills", []) or all_skills[:4]

        # Prioritize topics
        priority_topics = [
            PriorityTopicSchema(
                topic=all_skills[0] if all_skills else "Core Domain Competencies",
                priority="high",
                source="cv_and_jd",
                purpose=f"Validate core proficiency required for {role}"
            ),
            PriorityTopicSchema(
                topic=f"{project_name} Architecture & Design",
                priority="high",
                source="cv",
                purpose="Probe hands-on implementation, architectural decisions, and production trade-offs"
            ),
            PriorityTopicSchema(
                topic=jd_reqs[0] if jd_reqs else "Applied Problem Solving",
                priority="medium",
                source="jd",
                purpose=f"Assess alignment with key job responsibilities at {company}"
            ),
        ]

        if len(all_skills) > 1:
            priority_topics.append(
                PriorityTopicSchema(
                    topic=all_skills[1],
                    priority="medium",
                    source="cv",
                    purpose="Assess secondary technical tooling and ecosystem familiarity"
                )
            )

        # Dynamic Stage Construction based on Duration and Type
        stages: List[StageSchema] = []

        if duration_minutes <= 15:
            # 15-Minute Crisp Plan (3-4 stages, 4-6 questions)
            if interview_type == "HR & Behavioral":
                stages = [
                    StageSchema(
                        id="stage_intro",
                        name="Introduction & Career Goals",
                        order=1,
                        durationMinutes=3,
                        targetQuestionCount=1,
                        difficulty=difficulty.lower(),
                        topics=["Background", "Role Motivation"],
                        objectives=["Establish rapport and understand motivations"],
                        questionIntents=["Explore career journey and alignment with this role"]
                    ),
                    StageSchema(
                        id="stage_behavioral_core",
                        name="Collaboration & Communication",
                        order=2,
                        durationMinutes=9,
                        targetQuestionCount=3,
                        difficulty=difficulty.lower(),
                        topics=["Teamwork", "Conflict Resolution", "Workplace Scenarios"],
                        objectives=["Assess interpersonal communication and team dynamics"],
                        questionIntents=["Probe past collaborative challenges and resolution tactics"]
                    ),
                    StageSchema(
                        id="stage_closing",
                        name="Summary & Candidate Questions",
                        order=3,
                        durationMinutes=3,
                        targetQuestionCount=1,
                        difficulty=difficulty.lower(),
                        topics=["Role Expectations", "Closing Thoughts"],
                        objectives=["Wrap up and address candidate queries"],
                        questionIntents=["Provide space for candidate questions"]
                    ),
                ]
            else:
                stages = [
                    StageSchema(
                        id="stage_intro",
                        name="Introduction & Role Context",
                        order=1,
                        durationMinutes=2,
                        targetQuestionCount=1,
                        difficulty=difficulty.lower(),
                        topics=["Candidate Profile", "Role Overview"],
                        objectives=["Confirm background and establish context"],
                        questionIntents=["Brief intro and alignment with target role"]
                    ),
                    StageSchema(
                        id="stage_core_skills",
                        name="Core Skills & Project Deep Dive",
                        order=2,
                        durationMinutes=9,
                        targetQuestionCount=3,
                        difficulty=difficulty.lower(),
                        topics=[all_skills[0], f"{project_name} Execution"],
                        objectives=["Validate direct hands-on competence"],
                        questionIntents=[
                            f"Validate implementation depth in {all_skills[0]}",
                            f"Explore key engineering decisions in {project_name}"
                        ]
                    ),
                    StageSchema(
                        id="stage_problem_solving",
                        name="Practical Problem Solving",
                        order=3,
                        durationMinutes=4,
                        targetQuestionCount=1,
                        difficulty=difficulty.lower(),
                        topics=["Practical Scenario", "Troubleshooting"],
                        objectives=["Assess reasoning under realistic constraints"],
                        questionIntents=["Present a realistic workplace scenario and evaluate reasoning"]
                    ),
                ]
        elif duration_minutes <= 30:
            # 30-Minute Standard Plan (5-6 stages, 8-10 questions)
            if interview_type == "HR & Behavioral":
                stages = [
                    StageSchema(
                        id="stage_intro",
                        name="Introduction & Career Narrative",
                        order=1,
                        durationMinutes=3,
                        targetQuestionCount=1,
                        difficulty=difficulty.lower(),
                        topics=["Personal Background", "Professional Growth"],
                        objectives=["Understand candidate trajectory and communication style"],
                        questionIntents=["Review career transitions and motivation for this role"]
                    ),
                    StageSchema(
                        id="stage_teamwork",
                        name="Teamwork & Cross-functional Collaboration",
                        order=2,
                        durationMinutes=7,
                        targetQuestionCount=2,
                        difficulty=difficulty.lower(),
                        topics=["Cross-functional Collaboration", "Communication"],
                        objectives=["Evaluate ability to work in multidisciplinary teams"],
                        questionIntents=["Discuss working with diverse stakeholders under tight deadlines"]
                    ),
                    StageSchema(
                        id="stage_adversity",
                        name="Conflict, Feedback & Adaptability",
                        order=3,
                        durationMinutes=8,
                        targetQuestionCount=2,
                        difficulty=difficulty.lower(),
                        topics=["Constructive Feedback", "Handling Ambiguity", "Adaptability"],
                        objectives=["Assess resilience and emotional intelligence"],
                        questionIntents=["Explore a situation where candidate navigated conflicting priorities"]
                    ),
                    StageSchema(
                        id="stage_leadership",
                        name="Initiative & Ownership",
                        order=4,
                        durationMinutes=8,
                        targetQuestionCount=2,
                        difficulty=difficulty.lower(),
                        topics=["Driving Outcomes", "Problem Solving"],
                        objectives=["Assess autonomous initiative and accountability"],
                        questionIntents=["Examine a project or challenge where candidate took strong initiative"]
                    ),
                    StageSchema(
                        id="stage_closing",
                        name="Company Fit & Candidate Questions",
                        order=5,
                        durationMinutes=4,
                        targetQuestionCount=1,
                        difficulty=difficulty.lower(),
                        topics=["Culture & Values", "Closing Q&A"],
                        objectives=["Ensure mutual alignment and answer candidate questions"],
                        questionIntents=["Discuss alignment with team values and field questions"]
                    ),
                ]
            elif interview_type == "Case & Situational":
                stages = [
                    StageSchema(
                        id="stage_intro",
                        name="Introduction & Problem Context",
                        order=1,
                        durationMinutes=3,
                        targetQuestionCount=1,
                        difficulty=difficulty.lower(),
                        topics=["Role Context", "Framing"],
                        objectives=["Set problem-solving baseline"],
                        questionIntents=["Outline interview format and confirm candidate focus areas"]
                    ),
                    StageSchema(
                        id="stage_scenario_1",
                        name="Operational Case Scenario",
                        order=2,
                        durationMinutes=10,
                        targetQuestionCount=3,
                        difficulty=difficulty.lower(),
                        topics=["Requirements Clarification", "Structured Thinking"],
                        objectives=["Assess structured thinking and requirements decomposition"],
                        questionIntents=["Present complex real-world scenario and explore candidate decomposition"]
                    ),
                    StageSchema(
                        id="stage_tradeoffs",
                        name="Trade-off Analysis & Decision Making",
                        order=3,
                        durationMinutes=10,
                        targetQuestionCount=3,
                        difficulty=difficulty.lower(),
                        topics=["Trade-offs", "Edge Cases", "Risk Assessment"],
                        objectives=["Evaluate decision-making under resource constraints"],
                        questionIntents=["Test handling of shifting requirements and performance bottlenecks"]
                    ),
                    StageSchema(
                        id="stage_closing",
                        name="Retrospective & Conclusion",
                        order=4,
                        durationMinutes=7,
                        targetQuestionCount=2,
                        difficulty=difficulty.lower(),
                        topics=["Reflections", "Candidate Q&A"],
                        objectives=["Reflect on proposed solutions and wrap up"],
                        questionIntents=["Evaluate self-reflection and answer questions about the role"]
                    ),
                ]
            else:
                # Role-Specific / Full Interview / Skills Assessment (Default)
                stages = [
                    StageSchema(
                        id="stage_intro",
                        name="Introduction & Overview",
                        order=1,
                        durationMinutes=2,
                        targetQuestionCount=1,
                        difficulty=difficulty.lower(),
                        topics=["Candidate Profile", "Role Overview"],
                        objectives=["Set conversational tone and outline agenda"],
                        questionIntents=["Brief review of background and role interest"]
                    ),
                    StageSchema(
                        id="stage_experience",
                        name="Experience & Project Deep Dive",
                        order=2,
                        durationMinutes=7,
                        targetQuestionCount=2,
                        difficulty=difficulty.lower(),
                        topics=[f"{project_name} Architecture", "Personal Contributions"],
                        objectives=["Assess candidate depth in past projects and engineering choices"],
                        questionIntents=[
                            f"Explore candidate contribution and technical choices in {project_name}",
                            "Discuss challenges faced and how candidate debugged or solved them"
                        ]
                    ),
                    StageSchema(
                        id="stage_technical_core",
                        name="Role-Specific Skills & Validation",
                        order=3,
                        durationMinutes=11,
                        targetQuestionCount=3,
                        difficulty=difficulty.lower(),
                        topics=[all_skills[0]] + (all_skills[1:3] if len(all_skills) > 1 else ["Best Practices"]),
                        objectives=["Validate core competencies required by the job description"],
                        questionIntents=[
                            f"Probe intermediate principles of {all_skills[0]}",
                            "Assess practical application to real-world production environments"
                        ]
                    ),
                    StageSchema(
                        id="stage_problem_solving",
                        name="Scenario & Problem Solving",
                        order=4,
                        durationMinutes=6,
                        targetQuestionCount=2,
                        difficulty=difficulty.lower(),
                        topics=["Real-world Scenario", "Troubleshooting"],
                        objectives=["Assess logical reasoning and resilience under edge cases"],
                        questionIntents=["Present a practical issue and observe reasoning process"]
                    ),
                    StageSchema(
                        id="stage_closing",
                        name="Behavioral Fit & Closing",
                        order=5,
                        durationMinutes=4,
                        targetQuestionCount=1,
                        difficulty=difficulty.lower(),
                        topics=["Collaboration", "Candidate Q&A"],
                        objectives=["Evaluate team fit and answer candidate questions"],
                        questionIntents=["Assess collaboration style and invite candidate questions"]
                    ),
                ]
        else:
            # 60-Minute Comprehensive Plan (6-7 stages, 14-16 questions)
            stages = [
                StageSchema(
                    id="stage_intro",
                    name="Introduction & Career Narrative",
                    order=1,
                    durationMinutes=4,
                    targetQuestionCount=1,
                    difficulty=difficulty.lower(),
                    topics=["Background", "Career Trajectory", "Motivation"],
                    objectives=["Understand career evolution and motivation for the role"],
                    questionIntents=["Review trajectory, motivations, and expectations"]
                ),
                StageSchema(
                    id="stage_projects",
                    name="Architecture & Past Project Exploration",
                    order=2,
                    durationMinutes=12,
                    targetQuestionCount=3,
                    difficulty=difficulty.lower(),
                    topics=[f"{project_name} Architecture", "System Design Decisions"],
                    objectives=["Deeply evaluate architectural judgment and implementation rigor"],
                    questionIntents=[
                        f"Detailed walkthrough of {project_name} architecture",
                        "Evaluate how candidate handled scale, security, and performance constraints"
                    ]
                ),
                StageSchema(
                    id="stage_core_skills",
                    name="Core Competencies & Deep Technical Probe",
                    order=3,
                    durationMinutes=18,
                    targetQuestionCount=5,
                    difficulty=difficulty.lower(),
                    topics=all_skills[:4],
                    objectives=["Comprehensive verification of all key JD requirements"],
                    questionIntents=[
                        f"In-depth assessment of {all_skills[0]} concepts and paradigms",
                        "Explore ecosystem tooling, performance tuning, and standards"
                    ]
                ),
                StageSchema(
                    id="stage_scenario",
                    name="System Design / Case Problem Solving",
                    order=4,
                    durationMinutes=14,
                    targetQuestionCount=3,
                    difficulty=difficulty.lower(),
                    topics=["End-to-End Design", "Trade-offs", "Edge Case Handling"],
                    objectives=["Assess capacity to design maintainable solutions under complex requirements"],
                    questionIntents=["Tackle an open-ended practical scenario and evaluate design trade-offs"]
                ),
                StageSchema(
                    id="stage_behavioral",
                    name="Behavioral, Leadership & Culture",
                    order=5,
                    durationMinutes=7,
                    targetQuestionCount=2,
                    difficulty=difficulty.lower(),
                    topics=["Team Leadership", "Conflict Resolution", "Growth Mindset"],
                    objectives=["Assess cultural alignment, mentorship, and adaptability"],
                    questionIntents=["Discuss handling technical disagreement and prioritizing business impact"]
                ),
                StageSchema(
                    id="stage_closing",
                    name="Wrap-up & Candidate Q&A",
                    order=6,
                    durationMinutes=5,
                    targetQuestionCount=1,
                    difficulty=difficulty.lower(),
                    topics=["Next Steps", "Candidate Questions"],
                    objectives=["Conclude gracefully and address candidate questions"],
                    questionIntents=["Answer candidate questions and summarize interview"]
                ),
            ]

        # Calculate total question count
        total_questions = sum(s.targetQuestionCount for s in stages)

        return {
            "version": 1,
            "role": role,
            "company": company,
            "interviewType": interview_type,
            "difficulty": difficulty,
            "durationMinutes": duration_minutes,
            "estimatedQuestionCount": total_questions,
            "objectives": [
                f"Validate candidate competence in {all_skills[0]} and related tech stack",
                f"Explore practical contributions and architecture in {project_name}",
                f"Assess problem-solving and scenario analysis tailored to {role}",
                "Evaluate communication clarity, professional collaboration, and culture fit"
            ],
            "priorityTopics": [t.model_dump() for t in priority_topics],
            "candidateStrengthsToValidate": candidate.get("strengths", [])[:3] or [f"Proficiency in {all_skills[0]}"],
            "jdAreasToExplore": target_job.get("requiredSkills", [])[:3] or ["Role-specific workflows"],
            "stages": [s.model_dump() for s in stages]
        }


# Global singleton instance
interview_planner_instance = InterviewPlannerAgent()
