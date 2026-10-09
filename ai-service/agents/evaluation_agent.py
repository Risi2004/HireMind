"""HireMind Interview Evaluation Agent
Powered by OpenRouter with resilient fallback.
Evaluates the completed or early-concluded interview session, analyzing candidate responses,
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
    GEMINI_API_KEY,
    GEMINI_MODEL_NAME,
    is_gemini_configured,
    get_orchestrator_model,
)

from services.llm_client import chat_completion

logger = logging.getLogger("InterviewEvaluationAgent")


class EvaluationUnavailableError(RuntimeError):
    """Raised when no genuine evaluation could be produced."""


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
    strongestSkill: str = Field(..., description="Candidate's strongest demonstrated competency")
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
    Supports early-concluded interviews (e.g. 15 min out of 30 min) by
    evaluating pro-rata all questions completed up to that point.
    """

    SYSTEM_INSTRUCTION = (
        "You are the HireMind Interview Evaluation Agent, an objective, rigorous, and constructive hiring assessment expert.\n"
        "Your role is to evaluate an interview session between an AI Interviewer and a candidate.\n\n"
        "EVALUATION CRITERIA:\n"
        "1. GROUNDING IN ACTUAL TRANSCRIPT: Analyze what the candidate actually said in their responses.\n"
        "   - If the candidate gave thorough, specific, and architectural/strategic answers, award high scores (80-95).\n"
        "   - If the candidate gave brief, vague, or superficial answers, score accurately (60-75).\n"
        "2. ADAPTIVE TO EARLY CONCLUSION: If the interview ended early (e.g. 15 min of a 30-min session), evaluate ONLY what was covered.\n"
        "   - Do NOT penalize the candidate or give 0s for unreached stages.\n"
        "   - Score based on the demonstrated quality of the completed answers pro-rata.\n"
        "3. TECHNICAL & DOMAIN ACCURACY: Assess depth of domain knowledge relevant to the target role.\n"
        "4. COMMUNICATION & STRUCTURE: Evaluate clarity, conciseness, articulation of trade-offs, and reasoning.\n"
        "5. BALANCED & ACTIONABLE: Highlight both demonstrated strengths and concrete growth areas.\n"
        "6. OUTPUT FORMAT: Respond ONLY with a valid JSON object matching the exact schema:\n"
        "{\n"
        '  "overallScore": 82,\n'
        '  "readinessBadge": "Strong Candidate" | "Good Progress" | "Needs Practice",\n'
        '  "summary": "2-3 sentences synthesizing the candidate\'s demonstrated performance.",\n'
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
        if not isinstance(candidate, dict):
            candidate = {}

        target_job = context.get("targetJob") or {}
        if isinstance(target_job, str):
            role = target_job
            company = str(context.get("company") or "Target Company")
        elif isinstance(target_job, dict):
            role = str(target_job.get("role") or context.get("target_role") or "Target Role")
            company = str(target_job.get("company") or context.get("company") or "Target Company")
        else:
            role = str(context.get("target_role") or "Target Role")
            company = str(context.get("company") or "Target Company")

        config = context.get("interviewConfiguration") or {}
        if not isinstance(config, dict):
            config = {}
        target_duration = int(config.get("durationMinutes") or context.get("duration") or 30)
        difficulty = str(config.get("difficulty") or config.get("experienceLevel") or context.get("difficulty") or "Intermediate")
        interview_type = str(config.get("type") or config.get("interviewType") or context.get("interview_type") or "Role-Specific")

        chat_messages = context.get("chatMessages") or context.get("chat_messages") or []

        # Feedback mode: the report must agree with the per-answer coaching already shown
        per_answer = [
            f for f in (context.get("perAnswerFeedbacks") or [])
            if isinstance(f, dict) and isinstance(f.get("score"), (int, float))
        ]
        per_answer_text = ""
        if per_answer:
            avg = round(sum(f["score"] for f in per_answer) / len(per_answer))
            lines = "\n".join(
                f"- Q: {str(f.get('question', ''))[:160]} | score {f['score']} | {str(f.get('summary', ''))[:220]}"
                for f in per_answer
            )
            per_answer_text = (
                f"PER-ANSWER COACH RESULTS ALREADY SHOWN TO THE CANDIDATE (average {avg}):\n{lines}\n"
                "Your overallScore and summary MUST be consistent with these results: stay within about 10 points "
                "of their average unless the transcript clearly justifies otherwise, and mention weak or off-topic "
                "answers rather than describing every answer as accurate.\n\n"
            )
        state = context.get("interviewState") or context.get("interview_state") or {}
        if not isinstance(state, dict):
            state = {}

        candidate_name = str(candidate.get("candidateName") or candidate.get("candidate_name") or "Candidate")

        # Format candidate transcript turns and extract candidate answers
        formatted_dialogue = []
        candidate_turns = 0
        candidate_answers = []
        has_code_submission = False

        for msg in chat_messages:
            raw_role = (msg.get("role") or "").lower()
            speaker = "Candidate" if raw_role in ["candidate", "user"] else "Interviewer" if raw_role in ["interviewer", "assistant"] else "System"
            content = str(msg.get("content") or "").strip()
            if msg.get("codeSubmission") or msg.get("isCode") or "```" in content:
                has_code_submission = True
            if speaker == "Candidate":
                candidate_turns += 1
                candidate_answers.append(content)
            formatted_dialogue.append(f"{speaker}: {content}")

        transcript_text = "\n\n".join(formatted_dialogue) if formatted_dialogue else "No interview dialogue recorded."

        # Detect timing & whether session was concluded early (e.g. 15 min out of 30 min)
        elapsed_minutes = float(state.get("elapsedMinutes") or 0.0)
        if not elapsed_minutes and state.get("elapsedSeconds"):
            elapsed_minutes = round(float(state.get("elapsedSeconds")) / 60.0, 1)

        is_early_end = (
            state.get("status") in ["ended_by_user", "cancelled"]
            or state.get("isEndedByUser", False)
            or context.get("isEndedByUser", False)
            or (elapsed_minutes > 0 and elapsed_minutes < target_duration * 0.85)
            or candidate_turns < 5
        )

        status_label = (
            f"Concluded Early (~{elapsed_minutes} min completed of {target_duration} min planned)"
            if is_early_end and elapsed_minutes > 0
            else "Concluded Early by Candidate" if is_early_end
            else f"Completed Full Session ({target_duration} min)"
        )

        # Build prompt
        prompt = (
            f"Please evaluate this {'PARTIAL / CONCLUDED EARLY' if is_early_end else 'COMPLETED'} interview session:\n\n"
            f"CANDIDATE: {candidate_name}\n"
            f"TARGET ROLE: {role}\n"
            f"TARGET COMPANY: {company}\n"
            f"INTERVIEW TYPE: {interview_type}\n"
            f"DIFFICULTY LEVEL: {difficulty}\n"
            f"SCHEDULED DURATION: {target_duration} minutes\n"
            f"ELAPSED / COMPLETED TIME: ~{elapsed_minutes if elapsed_minutes > 0 else 'Early conclusion'} minutes\n"
            f"STATUS: {status_label}\n"
            f"QUESTIONS ANSWERED: {candidate_turns}\n"
            f"CODE SUBMITTED: {'Yes' if has_code_submission else 'No'}\n\n"
            f"{per_answer_text}"
            f"INTERVIEW TRANSCRIPT (Completed dialogue up to conclusion):\n"
            f"{transcript_text}\n\n"
            f"CRITICAL EVALUATION INSTRUCTIONS:\n"
            f"1. ADAPTIVE TO MID-WAY / EARLY CONCLUSION: If this interview concluded early ({status_label}), "
            f"evaluate ALL questions and domain topics answered UP TO THIS POINT. "
            f"Do NOT award zero or artificially deflated scores for unreached stages; evaluate the answers the candidate actually gave.\n"
            f"2. EXTRACT 3-6 TECHNICAL DOMAIN SKILLS: Extract distinct technical competencies relevant to {role} "
            f"covered in their answers (e.g., Core Principles, Architecture & State, Problem Solving, Code Efficiency). "
            f"Score each skill (0-100). Mark skills < 70 with isFlagged=True and prefix the name with '!'.\n"
            f"3. PERFORMANCE BREAKDOWN: Score 5 pillars: Technical Knowledge, Problem Solving, Communication, Practical Reasoning, Domain Depth.\n"
            f"4. COMMUNICATION ANALYSIS: Score 4 dimensions: Clarity, Answer Structure, Technical Articulation, Pacing & Conciseness.\n"
            f"5. EXECUTIVE SUMMARY & RECOMMENDATION: Write an authoritative 2-3 sentence summary evaluating their demonstrated competence, "
            f"noting whether they concluded early, and give actionable AI recommendations for next steps.\n"
            f"6. Respond ONLY in valid JSON matching the specified schema."
        )

        # Attempt model call
        llm_response = self._call_llm(prompt)
        if llm_response:
            parsed = self._extract_json(llm_response)
            if parsed and (parsed.get("overallScore") is not None or parsed.get("performanceBreakdown")):
                try:
                    return self._normalize_evaluation(
                        parsed, role, company, candidate_name, candidate_answers, is_early_end, elapsed_minutes, target_duration
                    )
                except Exception as val_err:
                    logger.warning(f"Evaluation normalization note: {val_err}. Using grounded synthesis.")

        # No made-up report: if the model produced nothing usable, fail honestly so the
        # backend can tell the candidate to retry instead of showing invented scores.
        raise EvaluationUnavailableError(
            "The evaluation model did not return a valid assessment. Please try again shortly."
        )

    def _call_llm(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        max_tokens: int = 3500,
        temperature: float = 0.2,
        timeout: float = 80.0,
        label: str = "evaluation",
    ) -> Optional[str]:
        """Query LLM (OpenRouter or Gemini) for evaluation synthesis."""
        sys_instruction = system_instruction or self.SYSTEM_INSTRUCTION

        # 1. OpenRouter (reasoning disabled so the token budget goes to the answer itself)
        result = chat_completion(
            sys_instruction,
            prompt,
            max_tokens=max_tokens,
            temperature=temperature,
            timeout=timeout,
            # Long outputs (final report) legitimately take longer before a hedge is worth it
            hedge_after=min(timeout / 2, max(6.0, timeout / 3)),
            label=label,
        )
        if result.ok:
            return result.content

        # 2. Try Gemini Fallback if configured
        if is_gemini_configured():
            try:
                import requests
                gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL_NAME}:generateContent?key={GEMINI_API_KEY}"
                headers = {"Content-Type": "application/json"}
                payload = {
                    "contents": [
                        {"role": "user", "parts": [{"text": f"{sys_instruction}\n\n{prompt}"}]}
                    ],
                    "generationConfig": {
                        "temperature": 0.2,
                        "maxOutputTokens": 3500,
                        "responseMimeType": "application/json",
                    },
                }
                logger.info(f"Synthesizing evaluation via Gemini fallback '{GEMINI_MODEL_NAME}'...")
                response = requests.post(gemini_url, headers=headers, json=payload, timeout=60)
                if response.status_code == 200:
                    data = response.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        if parts:
                            return parts[0].get("text")
            except Exception as e:
                logger.warning(f"Gemini fallback evaluation call note: {e}")

        return None

    def _extract_json(self, raw_text: str) -> Optional[Dict[str, Any]]:
        """Clean markdown code fences, repair minor syntax issues, and parse JSON."""
        if not raw_text:
            return None
        cleaned = raw_text.strip()
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.MULTILINE)
        cleaned = re.sub(r"\s*```$", "", cleaned, flags=re.MULTILINE)

        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            pass

        # Try regex search for outermost { ... }
        match = re.search(r"(\{.*\})", cleaned, re.DOTALL)
        if match:
            candidate_str = match.group(1).strip()
            try:
                return json.loads(candidate_str)
            except json.JSONDecodeError:
                # Fix trailing commas: ,} or ,]
                repaired = re.sub(r",\s*([\]}])", r"\1", candidate_str)
                try:
                    return json.loads(repaired)
                except json.JSONDecodeError:
                    pass

        return None

    def _normalize_evaluation(
        self,
        parsed: Dict[str, Any],
        role: str,
        company: str,
        candidate_name: str,
        candidate_answers: List[str],
        is_early_end: bool,
        elapsed_minutes: float,
        target_duration: int,
    ) -> Dict[str, Any]:
        """Normalize the model's report. Only data the model actually produced is kept:
        missing sections stay empty instead of being filled with invented scores or text."""

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
                score_val = clamp_score(item.get("score"))
                if score_val is None:
                    continue
                name = str(item["name"]).strip()
                is_flagged = bool(item.get("isFlagged", score_val < 70))
                if is_flagged and not name.startswith("!"):
                    name = f"!{name}"
                elif not is_flagged and name.startswith("!"):
                    name = name.lstrip("!")
                cleaned.append({"name": name, "score": score_val, "isFlagged": is_flagged})
            return cleaned

        tech_skills = clean_items(parsed.get("technicalSkills"))
        perf_breakdown = clean_items(parsed.get("performanceBreakdown"))
        comm_analysis = clean_items(parsed.get("communicationAnalysis"))

        overall_score = clamp_score(parsed.get("overallScore"))
        if overall_score is None:
            scored = [item["score"] for item in perf_breakdown + comm_analysis]
            if not scored:
                raise EvaluationUnavailableError("The evaluation model returned no usable scores.")
            overall_score = round(sum(scored) / len(scored))

        readiness_badge = parsed.get("readinessBadge") or (
            "Strong Candidate" if overall_score >= 80 else "Good Progress" if overall_score >= 65 else "Needs Practice"
        )

        strongest = parsed.get("strongestSkill") or (
            max(tech_skills, key=lambda x: x["score"])["name"].lstrip("!") if tech_skills else ""
        )
        needs_attention = parsed.get("needsAttentionSkill") or (
            min(tech_skills, key=lambda x: x["score"])["name"].lstrip("!") if tech_skills else ""
        )

        ai_rec = parsed.get("aiRecommendation") if isinstance(parsed.get("aiRecommendation"), dict) else {}
        ai_rec = {k: str(v) for k, v in ai_rec.items() if k in ("headline", "insight", "primaryFocus") and v}

        trend_scores = [
            score for score in (clamp_score(v) for v in (parsed.get("trendScores") or [])) if score is not None
        ]

        return {
            "overallScore": overall_score,
            "readinessBadge": readiness_badge,
            "summary": str(parsed.get("summary") or "").strip(),
            "technicalSkills": tech_skills,
            "strongestSkill": strongest,
            "needsAttentionSkill": needs_attention,
            "performanceBreakdown": perf_breakdown,
            "communicationAnalysis": comm_analysis,
            "aiRecommendation": ai_rec,
            "trendScores": trend_scores,
        }

    def evaluate_single_answer(
        self,
        question: str,
        answer: str,
        target_role: str = "",
        company: str = "",
        stage_name: str = "",
        topic: str = "",
        candidate_skills: Optional[List[str]] = None,
        difficulty: str = "Intermediate",
        prior_answers: Optional[List[str]] = None,
        **kwargs: Any,
    ) -> Optional[Dict[str, Any]]:
        """Per-answer coaching for Feedback Interview Mode.

        Every comment must be grounded in what the candidate actually said (or specifically
        failed to say) for THIS question. Returns None when no genuine evaluation could be
        produced, so callers can show "feedback unavailable" instead of a template.
        """
        role = target_role or "Software Engineer"
        stage = stage_name or "Interview"
        top = topic or "the question"
        skills_str = ", ".join(str(s) for s in (candidate_skills or [])[:15]) or "not provided"
        prior = [str(a).strip()[:500] for a in (prior_answers or []) if str(a).strip()]
        prior_text = (
            "EARLIER ANSWERS IN THIS INTERVIEW (context only: do NOT grade these, but do not claim the candidate "
            "omitted something they already said here):\n" + "\n".join(f"- {a}" for a in prior) + "\n\n"
        ) if prior else ""

        prompt = (
            f"ROLE: {role}{f' at {company}' if company else ''} | DIFFICULTY: {difficulty} | STAGE: {stage} | TOPIC: {top}\n"
            f"CANDIDATE SKILLS (from CV): {skills_str}\n\n"
            f"{prior_text}"
            f"QUESTION:\n{question}\n\n"
            f"CANDIDATE ANSWER:\n{answer}\n\n"
            "Evaluate THIS answer. Return the JSON object now."
        )

        result = self._call_llm(
            prompt,
            system_instruction=PER_ANSWER_SYSTEM_INSTRUCTION,
            max_tokens=1500,
            temperature=0.3,
            timeout=30,
            label="answer-feedback",
        )
        parsed = self._extract_json(result) if result else None
        if not isinstance(parsed, dict):
            logger.warning("Per-answer feedback unavailable: model returned no parseable JSON")
            return None
        return _normalize_answer_feedback(parsed)


PER_ANSWER_SYSTEM_INSTRUCTION = (
    "You are an experienced interview coach reviewing ONE answer from a live mock interview.\n"
    "Your feedback must be specific to this exact answer. A different answer must get visibly different feedback.\n\n"
    "GROUNDING RULES (most important):\n"
    "- Every strength must cite something the candidate actually said, quoting or closely paraphrasing it "
    "(e.g. 'You explained that the Redis TTL was 10 minutes and invalidated on vendor edits').\n"
    "- Every improvement must name a specific gap relative to what THIS question asked "
    "(e.g. 'You did not say where the idempotency key is stored or how long it is kept').\n"
    "- Never praise something the answer does not contain. Never ask for metrics/numbers/trade-offs the "
    "candidate already gave. Never invent facts about the candidate.\n"
    "- Before listing a gap, re-read the answer and confirm it is really missing. If the candidate covered "
    "it partly, name what is still missing beyond what they said (do not claim they omitted it).\n"
    "- Banned generic filler: 'clear and professional communication', 'positive communication', "
    "'engaged with the question', 'good effort', 'use the STAR method' (unless the question is behavioral "
    "and the answer lacks structure), 'add quantifiable metrics' (unless genuinely missing and relevant).\n"
    "- If the answer is vague, off-topic, very short or technically wrong, say so plainly and score it low.\n\n"
    "SCORING (0-100, be calibrated, not generous):\n"
    "- 0-39: off-topic, incorrect, or no real content.\n"
    "- 40-59: relevant but vague or generic; few concrete details; key parts of the question unanswered.\n"
    "- 60-74: relevant with some concrete details, but missing important reasoning, depth or parts of the question.\n"
    "- 75-89: specific, correct and well reasoned; minor gaps only.\n"
    "- 90-100: exceptional depth, precise, with clear reasoning and outcomes.\n\n"
    "IMPROVED ANSWER: write a short model answer (max 80 words) that BUILDS ON the candidate's own "
    "content and fixes the gaps you listed. Do not invent experience: never state in the first person a fix, "
    "tool, number or result the candidate did not mention. Phrase such additions as placeholders the candidate "
    "fills in, e.g. '[how you prevented the race, e.g. a version in the cache key]' or '[your result]'.\n\n"
    "Respond with ONLY this JSON object (no markdown, no extra keys):\n"
    "{\n"
    '  "overallScore": <int>,\n'
    '  "summary": "<1-2 sentences: the single most important takeaway about THIS answer>",\n'
    '  "evaluation": {\n'
    '    "relevance": {"score": <int>, "comment": "<specific, max 20 words>"},\n'
    '    "technical_accuracy": {"score": <int>, "comment": "<specific, max 20 words>"},\n'
    '    "clarity": {"score": <int>, "comment": "<specific, max 20 words>"},\n'
    '    "completeness": {"score": <int>, "comment": "<specific, max 20 words>"},\n'
    '    "supporting_examples": {"score": <int>, "comment": "<specific, max 20 words>"}\n'
    "  },\n"
    '  "strengths": ["<1-2 grounded items, max 30 words each; empty list if none>"],\n'
    '  "areas_for_improvement": ["<1-2 specific gaps, max 30 words each>"],\n'
    '  "actionable_suggestions": ["<1-2 concrete next steps, max 25 words each>"],\n'
    '  "improved_answer_guidance": {"structure": "<short outline>", "example_model_answer": "<max 80 words>"}\n'
    "}"
)

_EVAL_KEYS = ("relevance", "technical_accuracy", "clarity", "completeness", "supporting_examples", "communication")


def _clean_text_list(value: Any, limit: int = 3) -> List[str]:
    if not isinstance(value, list):
        return []
    return [str(v).strip() for v in value if isinstance(v, (str, int, float)) and str(v).strip()][:limit]


def _normalize_answer_feedback(parsed: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Map the model JSON onto the shape the UI expects, keeping ONLY model-produced data."""

    def score_of(value: Any) -> Optional[int]:
        try:
            return max(0, min(100, int(round(float(value)))))
        except (TypeError, ValueError):
            return None

    raw_eval = parsed.get("evaluation") if isinstance(parsed.get("evaluation"), dict) else {}
    evaluation: Dict[str, Dict[str, Any]] = {}
    for key in _EVAL_KEYS:
        item = raw_eval.get(key)
        if isinstance(item, dict):
            item_score = score_of(item.get("score"))
            comment = str(item.get("comment") or "").strip()
            if item_score is not None:
                evaluation[key] = {"score": item_score, "comment": comment}

    # The model's own overall score tends to anchor on one value (e.g. 82 for every decent
    # answer), so derive it from the per-criterion scores, which do track the answer.
    weights = {
        "relevance": 0.20,
        "technical_accuracy": 0.30,
        "completeness": 0.25,
        "supporting_examples": 0.15,
        "clarity": 0.10,
    }
    weighted = [(evaluation[k]["score"], w) for k, w in weights.items() if k in evaluation]
    if len(weighted) >= 3:
        overall = round(sum(score * w for score, w in weighted) / sum(w for _, w in weighted))
    else:
        overall = score_of(parsed.get("overallScore", parsed.get("score")))

    strengths = _clean_text_list(parsed.get("strengths"))
    improvements = _clean_text_list(parsed.get("areas_for_improvement") or parsed.get("areasForImprovement"))
    suggestions = _clean_text_list(parsed.get("actionable_suggestions") or parsed.get("actionableSuggestions"))
    summary = str(parsed.get("summary") or "").strip()

    if overall is None or not (summary or strengths or improvements):
        logger.warning("Per-answer feedback discarded: model JSON missing score or content")
        return None

    guidance_raw = parsed.get("improved_answer_guidance") or parsed.get("improvedAnswerGuidance") or {}
    guidance = {}
    if isinstance(guidance_raw, dict):
        structure = str(guidance_raw.get("structure") or "").strip()
        example = str(guidance_raw.get("example_model_answer") or guidance_raw.get("exampleAnswer") or "").strip()
        if structure:
            guidance["structure"] = structure
        if example:
            guidance["example_model_answer"] = example
            guidance["exampleAnswer"] = example

    feedback: Dict[str, Any] = {
        "overallScore": overall,
        "score": overall,
        "summary": summary,
        "evaluation": evaluation,
        "strengths": strengths,
        "areas_for_improvement": improvements,
        "areasForImprovement": improvements,
        "actionable_suggestions": suggestions,
        "actionableSuggestions": suggestions,
    }
    if guidance:
        feedback["improved_answer_guidance"] = guidance
        feedback["improvedAnswerGuidance"] = guidance
    return feedback


def quick_spoken_feedback(
    agent: "InterviewEvaluationAgent",
    question: str,
    answer: str,
    target_role: str = "",
    stage_name: str = "",
    topic: str = "",
) -> str:
    """Short spoken coaching line for voice Feedback Mode (~2 sentences).

    Returns "" when the model is unavailable; the interviewer then simply moves on rather
    than speaking canned praise.
    """
    system_instruction = (
        "You are an interview coach speaking to the candidate right after their answer in a live voice "
        "interview. In 2 short sentences (max 45 words): first name ONE specific thing from their answer "
        "that worked (refer to what they actually said), then the ONE most important concrete improvement "
        "for this answer. If the answer was vague or wrong, say that kindly but clearly instead of praising it. "
        "Never ask for details they already gave. Plain spoken English: no scores, lists, markdown or quotes, "
        "and do not ask a new question."
    )
    prompt = (
        f"ROLE: {target_role or 'Software Engineer'} | STAGE: {stage_name or 'Interview'} | TOPIC: {topic or 'general'}\n\n"
        f"QUESTION: {question}\n\nCANDIDATE ANSWER: {answer}\n\nSpeak the feedback now."
    )
    raw = agent._call_llm(
        prompt,
        system_instruction=system_instruction,
        max_tokens=140,
        temperature=0.4,
        timeout=12,
        label="spoken-feedback",
    )
    text = (raw or "").strip().strip('"').replace("**", "").replace("\n", " ").strip()
    if not text or text.startswith("{"):
        return ""
    return text


evaluation_agent_instance = InterviewEvaluationAgent()
evaluation_agent = evaluation_agent_instance

