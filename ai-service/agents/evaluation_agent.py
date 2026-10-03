"""HireMind Interview Evaluation Agent
Powered by OpenRouter and Google ADK.
Evaluates the whole completed interview session, analyzing candidate responses,
technical depth, problem-solving, and communication to produce an authoritative
performance synthesis for the Interview Report.
"""

import json
import logging
import re
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from config.settings import (
    MODEL_PROVIDER,
    AI_MODEL,
    OPENROUTER_BASE_URL,
    OPENROUTER_API_KEY,
    get_orchestrator_model,
)

logger = logging.getLogger("InterviewEvaluationAgent")


class EvaluationUnavailableError(RuntimeError):
    """Raised when no genuine model-generated evaluation could be produced."""


# -------------------------------------------------------------------------
# Pydantic Schemas for Evaluation
# -------------------------------------------------------------------------
class SkillScore(BaseModel):
    name: str = Field(..., description="Name of the skill or technical competency")
    score: int = Field(..., ge=0, le=100, description="Score between 0 and 100")
    isFlagged: bool = Field(default=False, description="Flagged as needing attention if score < 70")


class PerformanceMetric(BaseModel):
    name: str = Field(..., description="Evaluation category name")
    score: int = Field(..., ge=0, le=100, description="Score between 0 and 100")
    isFlagged: bool = Field(default=False, description="Flagged if score < 70")


class CommunicationMetric(BaseModel):
    name: str = Field(..., description="Communication dimension name")
    score: int = Field(..., ge=0, le=100, description="Score between 0 and 100")
    isFlagged: bool = Field(default=False, description="Flagged if score < 70")


class AiRecommendation(BaseModel):
    headline: str = Field(..., description="Actionable headline recommendation")
    insight: str = Field(..., description="Detailed AI diagnostic insight")
    primaryFocus: str = Field(..., description="Core area candidate should focus on next")


class EvaluationOutput(BaseModel):
    overallScore: int = Field(..., ge=0, le=100, description="Overall readiness score (0-100)")
    readinessBadge: str = Field(..., description="Readiness status badge (e.g., 'Strong Candidate', 'Good Progress', 'Needs Practice')")
    summary: str = Field(..., description="Executive summary overview of the interview performance")
    technicalSkills: List[SkillScore] = Field(default_factory=list, description="Scores for individual technical competencies")
    strongestSkill: str = Field(..., description="Candidate'asi strongest demonstrated competency")
    needsAttentionSkill: str = Field(..., description="Competency requiring the most improvement")
    performanceBreakdown: List[PerformanceMetric] = Field(default_factory=list, description="Core performance pillars")
    communicationAnalysis: List[CommunicationMetric] = Field(default_factory=list, description="Communication dimensions")
    aiRecommendation: AiRecommendation = Field(..., description="Personalized recommendation and growth path")
    trendScores: List[int] = Field(default_factory=list, description="Turn-by-turn performance progression scores")


# -------------------------------------------------------------------------
# Interview Evaluation Agent Implementation
# -------------------------------------------------------------------------
class InterviewEvaluationAgent:
    """Evaluates the entire interview transcript, question-answer pairs,
    and stage progression to synthesize an objective evaluation report.
    """

    SYSTEM_INSTRUCTION = (
        "You are the HireMind Interview Evaluation Agent, an objective, rigorous, and constructive hiring assessment expert.\n"
        "Your role is to evaluate a completed interview session between an AI Interviewer and a candidate.\n\n"
        "EVALUATION CRITERIA:\n"
        "1. GROUNDING IN ACTUAL TRANSCRIPT: Analyze what the candidate actually said in their responses.\n"
        "   - Do not invent answers or score based on assumptions.\n"
        "   - If the candidate gave thorough, specific, and architectural/strategic answers, award high scores (80-95).\n"
        "   - If the candidate gave vague, superficial, or evasive answers, score accurately lower (55-75).\n"
        "2. TECHNICAL & DOMAIN ACCURACY: Assess depth of domain knowledge relevant to the target role (Software, Marketing, Accounting, HR, etc.).\n"
        "3. COMMUNICATION & STRUCTURE: Evaluate clarity, conciseness, articulation of trade-offs, and reasoning.\n"
        "4. BALANCED & ACTIONABLE: Highlight both demonstrated strengths and concrete growth areas.\n"
        "5. OUTPUT FORMAT: Respond ONLY with a valid JSON object matching the exact schema:\n"
        "{\n"
        '  "overallScore": 82,\n'
        '  "readinessBadge": "Strong Candidate" | "Good Progress" | "Needs Practice",\n'
        '  "summary": "2-3 sentences synthesizing the candidate\'s overall performance.",\n'
        '  "technicalSkills": [\n'
        '    {"name": "Skill Name", "score": 85, "isFlagged": false},\n'
        '    {"name": "!Needs Work Skill", "score": 62, "isFlagged": true}\n'
        "  ],\n"
        '  "strongestSkill": "Skill Name",\n'
        '  "needsAttentionSkill": "Skill Name",\n'
        '  "performanceBreakdown": [\n'
        '    {"name": "Technical Knowledge", "score": 84, "isFlagged": false},\n'
        '    {"name": "Problem Solving", "score": 80, "isFlagged": false},\n'
        '    {"name": "!Communication", "score": 68, "isFlagged": true},\n'
        '    {"name": "Practical Reasoning", "score": 78, "isFlagged": false},\n'
        '    {"name": "Domain Depth", "score": 82, "isFlagged": false}\n'
        "  ],\n"
        '  "communicationAnalysis": [\n'
        '    {"name": "Clarity", "score": 80, "isFlagged": false},\n'
        '    {"name": "!Answer Structure", "score": 64, "isFlagged": true},\n'
        '    {"name": "Technical Articulation", "score": 82, "isFlagged": false},\n'
        '    {"name": "Pacing & Conciseness", "score": 75, "isFlagged": false}\n'
        "  ],\n"
        '  "aiRecommendation": {\n'
        '    "headline": "Primary Focus: Structure Your Answers",\n'
        '    "insight": "AI Insight explanation...",\n'
        '    "primaryFocus": "Concrete growth area"\n'
        "  },\n"
        '  "trendScores": [70, 76, 82, 85, 82]\n'
        "}"
    )

    def __init__(self, model: Optional[Any] = None):
        self.model = model if model is not None else get_orchestrator_model()

    def evaluate_interview(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze the interview transcript and metadata to generate comprehensive evaluation."""
        candidate = context.get("candidate") or context.get("cv_analysis") or {}
        target_job = context.get("targetJob") or {"role": context.get("target_role"), "company": context.get("company")}
        config = context.get("interviewConfiguration") or {
            "type": context.get("interview_type"),
            "difficulty": context.get("difficulty"),
            "durationMinutes": context.get("duration"),
        }
        chat_messages = context.get("chatMessages") or context.get("chat_messages") or []
        state = context.get("interviewState") or context.get("interview_state") or {}

        candidate_name = candidate.get("candidateName") or candidate.get("candidate_name") or "Candidate"
        role = target_job.get("role") or context.get("target_role") or "Target Role"
        company = target_job.get("company") or context.get("company") or "Target Company"
        interview_type = config.get("type") or context.get("interview_type") or "Role-Specific"
        difficulty = config.get("difficulty") or context.get("difficulty") or "Intermediate"

        # Format candidate transcript turns and extract covered topics
        formatted_dialogue = []
        candidate_turns = 0
        has_code_submission = False

        for msg in chat_messages:
            speaker = "Candidate" if msg.get("role") in ["candidate", "user"] else "Interviewer"
            content = msg.get("content", "").strip()
            if msg.get("codeSubmission") or msg.get("isCode") or "```" in content:
                has_code_submission = True
            formatted_dialogue.append(f"{speaker}: {content}")
            if speaker == "Candidate":
                candidate_turns += 1

        transcript_text = "\n\n".join(formatted_dialogue) if formatted_dialogue else "No interview dialogue recorded."

        # Detect whether session was completed or concluded mid-way
        is_midway = (
            state.get("status") in ["ended_by_user", "cancelled"]
            or state.get("isEndedByUser", False)
            or candidate_turns < 5
        )

        status_label = "Concluded Mid-way by Candidate" if is_midway else "Completed Full Session"

        # Build prompt
        prompt = (
            f"Please evaluate this {'PARTIAL / MID-WAY' if is_midway else 'COMPLETED'} interview session:\n\n"
            f"CANDIDATE: {candidate_name}\n"
            f"TARGET ROLE: {role}\n"
            f"TARGET COMPANY: {company}\n"
            f"INTERVIEW TYPE: {interview_type}\n"
            f"DIFFICULTY: {difficulty}\n"
            f"QUESTIONS ASKED: {state.get('questionsAsked', candidate_turns)}\n"
            f"CANDIDATE TURNS: {candidate_turns}\n"
            f"CODE SUBMITTED: {'Yes' if has_code_submission else 'No'}\n"
            f"STATUS: {status_label}\n\n"
            f"INTERVIEW TRANSCRIPT:\n"
            f"{transcript_text}\n\n"
            f"CRITICAL DOMAIN SCORING INSTRUCTIONS:\n"
            f"1. ADAPTIVE TO MID-WAY/PARTIAL SESSIONS: If the candidate concluded early ({status_label}), evaluate ONLY the questions and domain topics they actually completed. Do NOT give zero scores for unreached stages; score the competencies demonstrated in their answers so far.\n"
            f"2. EXTRACT TOPIC-BY-TOPIC DOMAIN SKILLS: Extract individual technicalSkills for each distinct domain area covered (e.g. CV Project Architecture, Core Theory/Principles, Case Study Scenarios, Coding Challenge, etc.). For each skill, provide an accurate score (0-100) reflecting their depth in that domain.\n"
            f"3. IF CODE WAS SUBMITTED: Evaluate the candidate's code solution, syntax, correctness, and Big-O efficiency as a dedicated competency.\n"
            f"4. SUMMARY: In summary (2-3 sentences), clearly state whether this was a mid-way or complete session, summarize their demonstrated domain depth, and note key areas.\n"
            f"5. Mark skills/criteria with score < 70 with isFlagged=True and prefix the name with '!'.\n"
            f"Respond ONLY in valid JSON matching the specified schema."
        )

        llm_response = self._call_llm(prompt)
        if llm_response:
            parsed = self._extract_json(llm_response)
            if parsed and parsed.get("overallScore") is not None:
                try:
                    validated = EvaluationOutput(**parsed)
                    return validated.model_dump()
                except Exception as val_err:
                    logger.warning(f"EvaluationOutput validation notice: {val_err}. Normalizing output.")
                    return self._normalize_evaluation(parsed, role, company, candidate_name)

        # No made-up report: if the model could not produce an evaluation, say so and let
        # the caller retry later, rather than inventing scores from word counts.
        raise EvaluationUnavailableError(
            "The evaluation model did not return a valid assessment. Please try again shortly."
        )

    def _call_llm(self, prompt: str) -> Optional[str]:
        """Query OpenRouter for evaluation synthesis."""
        if MODEL_PROVIDER == "openrouter":
            if not OPENROUTER_API_KEY or "your_openrouter_api_key_here" in OPENROUTER_API_KEY:
                return None

            try:
                import requests
                base_url = OPENROUTER_BASE_URL.rstrip("/")
                chat_url = f"{base_url}/chat/completions"

                headers = {
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "HTTP-Referer": "https://hiremind.com",
                    "X-Title": "HireMind Evaluation Agent",
                }
                payload = {
                    "model": AI_MODEL,
                    "messages": [
                        {"role": "system", "content": self.SYSTEM_INSTRUCTION},
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": 0.2,
                    "max_tokens": 1200,
                }

                logger.info(f"Synthesizing evaluation via OpenRouter '{AI_MODEL}'...")
                response = requests.post(chat_url, headers=headers, json=payload, timeout=50)
                if response.status_code == 200:
                    data = response.json()
                    choices = data.get("choices", [])
                    if choices:
                        return choices[0].get("message", {}).get("content")
            except Exception as e:
                logger.warning(f"OpenRouter evaluation call note: {e}")

        return None

    def _extract_json(self, raw_text: str) -> Optional[Dict[str, Any]]:
        """Clean markdown code fences and parse JSON."""
        if not raw_text:
            return None
        cleaned = raw_text.strip()
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.MULTILINE)
        cleaned = re.sub(r"\s*```$", "", cleaned, flags=re.MULTILINE)

        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            pass

        match = re.search(r"(\{.*\})", cleaned, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(1))
            except json.JSONDecodeError:
                pass

        return None

    def _normalize_evaluation(
        self,
        parsed: Dict[str, Any],
        role: str,
        company: str,
        candidate_name: str
    ) -> Dict[str, Any]:
        """Normalize a model evaluation that failed strict schema validation.

        Only data the model actually produced is kept. Missing sections become empty
        rather than being filled with invented scores or boilerplate text.
        """

        def clamp_score(value: Any) -> Optional[int]:
            try:
                return max(0, min(100, int(round(float(value)))))
            except (TypeError, ValueError):
                return None

        def clean_items(items: Any) -> List[Dict[str, Any]]:
            cleaned = []
            for item in items if isinstance(items, list) else []:
                if not isinstance(item, dict) or not item.get("name"):
                    continue
                item_score = clamp_score(item.get("score"))
                if item_score is None:
                    continue
                cleaned.append({
                    "name": str(item["name"]),
                    "score": item_score,
                    "isFlagged": bool(item.get("isFlagged", item_score < 70)),
                })
            return cleaned

        score = clamp_score(parsed.get("overallScore"))
        if score is None:
            raise EvaluationUnavailableError("The evaluation model returned an invalid overall score.")

        badge = parsed.get("readinessBadge") or (
            "Strong Candidate" if score >= 80 else "Good Progress" if score >= 65 else "Needs Practice"
        )
        tech_skills = clean_items(parsed.get("technicalSkills"))
        ai_rec = parsed.get("aiRecommendation") if isinstance(parsed.get("aiRecommendation"), dict) else {}
        trend_scores = [
            s for s in (clamp_score(v) for v in parsed.get("trendScores") or []) if s is not None
        ]

        return {
            "overallScore": score,
            "readinessBadge": badge,
            "summary": str(parsed.get("summary") or ""),
            "technicalSkills": tech_skills,
            "strongestSkill": parsed.get("strongestSkill") or (tech_skills[0]["name"] if tech_skills else ""),
            "needsAttentionSkill": parsed.get("needsAttentionSkill") or (tech_skills[-1]["name"] if tech_skills else ""),
            "performanceBreakdown": clean_items(parsed.get("performanceBreakdown")),
            "communicationAnalysis": clean_items(parsed.get("communicationAnalysis")),
            "aiRecommendation": ai_rec,
            "trendScores": trend_scores,
        }


# Singleton instance
evaluation_agent_instance = InterviewEvaluationAgent()
