"""HireMind Adaptive Live Interview Agent
Powered by OpenRouter and Google ADK.
Conducts one-turn-at-a-time, adaptive, personalized mock interviews
driven by candidate answers and structured interview plans.
"""

import json
import logging
import re
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from config.settings import (
    MODEL_PROVIDER,
    AI_MODEL,
    OPENROUTER_BASE_URL,
    OPENROUTER_API_KEY,
    get_orchestrator_model,
)

logger = logging.getLogger("InterviewAgent")


# -------------------------------------------------------------------------
# Action Enums & Structured Schemas
# -------------------------------------------------------------------------
class InterviewAction(str, Enum):
    FOLLOW_UP = "FOLLOW_UP"
    CLARIFY = "CLARIFY"
    DEEPEN = "DEEPEN"
    NEXT_TOPIC = "NEXT_TOPIC"
    NEXT_STAGE = "NEXT_STAGE"
    END_INTERVIEW = "END_INTERVIEW"


class ReasonCode(str, Enum):
    RELEVANT_DEPTH = "RELEVANT_DEPTH"
    ANSWER_INCOMPLETE = "ANSWER_INCOMPLETE"
    CLARIFICATION_NEEDED = "CLARIFICATION_NEEDED"
    OBJECTIVE_SUFFICIENT = "OBJECTIVE_SUFFICIENT"
    TOPIC_SUFFICIENT = "TOPIC_SUFFICIENT"
    STAGE_COMPLETE = "STAGE_COMPLETE"
    TIME_PROGRESS = "TIME_PROGRESS"
    INTERVIEW_COMPLETE = "INTERVIEW_COMPLETE"
    ANSWER_TOO_VAGUE = "ANSWER_TOO_VAGUE"
    CLAIM_NEEDS_EXAMPLE = "CLAIM_NEEDS_EXAMPLE"
    VALUABLE_DETAIL_FOUND = "VALUABLE_DETAIL_FOUND"
    OBJECTIVE_COVERED = "OBJECTIVE_COVERED"
    FOLLOWUP_LIMIT_REACHED = "FOLLOWUP_LIMIT_REACHED"
    MOVE_TO_NEXT_PRIORITY = "MOVE_TO_NEXT_PRIORITY"
    TIME_PRIORITY = "TIME_PRIORITY"


class ModelActionOutput(BaseModel):
    action: InterviewAction = Field(
        ...,
        description="Next interview action: FOLLOW_UP, CLARIFY, DEEPEN, NEXT_TOPIC, NEXT_STAGE, END_INTERVIEW"
    )
    reasonCode: ReasonCode = Field(
        ...,
        description="Internal reason code for tracking decision logic"
    )
    question: str = Field(
        ...,
        description="The EXACT ONE candidate-facing question to ask (or polite closing statement if END_INTERVIEW)"
    )
    stageId: Optional[str] = Field(
        default="",
        description="ID of the stage being addressed"
    )
    topic: Optional[str] = Field(
        default="",
        description="Specific topic being probed"
    )
    objectiveCovered: Optional[str] = Field(
        default="",
        description="Brief summary or ID of objective advanced by the candidate's last answer"
    )


class TimingPhase(str, Enum):
    EARLY_PHASE = "EARLY_PHASE"
    CORE_PHASE = "CORE_PHASE"
    DEEPENING_PHASE = "DEEPENING_PHASE"
    CLOSING_PREPARATION = "CLOSING_PREPARATION"
    EXTENSION_PHASE = "EXTENSION_PHASE"


class TimingContext(BaseModel):
    targetDurationMinutes: int = Field(default=30)
    elapsedMinutes: float = Field(default=0.0)
    elapsedSeconds: int = Field(default=0)
    remainingTargetMinutes: float = Field(default=30.0)
    remainingTargetSeconds: int = Field(default=1800)
    extensionAllowedMinutes: int = Field(default=10)
    absoluteMaximumMinutes: int = Field(default=40)
    progressPercentage: int = Field(default=0)
    timingPhase: str = Field(default=TimingPhase.EARLY_PHASE.value)


class InterviewStateContext(BaseModel):
    currentStageIndex: int = Field(default=0)
    currentStageId: str = Field(default="")
    currentStageName: str = Field(default="")
    currentTopic: str = Field(default="")
    questionsAsked: int = Field(default=0)
    stageQuestionsAsked: int = Field(default=0)
    followUpDepth: int = Field(default=0)
    coveredTopics: List[str] = Field(default_factory=list)
    coveredObjectives: List[str] = Field(default_factory=list)


# -------------------------------------------------------------------------
# Interview Agent Implementation
# -------------------------------------------------------------------------
class InterviewAgent:
    """Adaptive Live Interview Agent that conducts text-based interviews
    one question at a time, probing candidate answers dynamically.
    """

    SYSTEM_INSTRUCTION = (
        "You are the HireMind Adaptive Live Interview Agent, an experienced, perceptive, and highly professional conversational interviewer.\n"
        "Your mission is to conduct a realistic, human-sounding, and deeply adaptive interview asking strictly ONE question at a time.\n\n"
        "CORE ARCHITECTURE:\n"
        "- The INTERVIEW PLAN defines WHAT needs to be explored (stages, topics, objectives).\n"
        "- The CANDIDATE'S ANSWERS determine HOW the conversation progresses.\n"
        "- Priority Order:\n"
        "  1. Candidate's latest answer\n"
        "  2. Conversation history and memory of what the candidate said earlier\n"
        "  3. Current stage objectives\n"
        "  4. Remaining Interview Plan objectives\n"
        "  5. Candidate CV / Job Description / Role / Company context\n"
        "  6. Interview difficulty\n"
        "  7. Remaining interview time\n\n"
        "COMMUNICATION RULES FOR NATURAL HUMAN DIALOGUE:\n"
        "1. STRICTLY ONE CONCISE QUESTION PER TURN (1-2 sentences). Never combine multiple questions or ask compound multi-part questions.\n"
        "2. NO ROBOTIC TEMPLATES: Never use repetitive formulaic phrases like 'Regarding [Topic], could you describe your hands-on experience and typical workflow in this area?' or 'Regarding Collaboration...'. Formulate natural, conversational questions.\n"
        "3. NO MECHANICAL STAGE ANNOUNCEMENTS: Never announce internal database stage names (e.g. 'Let's move to our next section: Scenario & Problem Solving'). Instead, transition seamlessly (e.g. 'Let's move into problem solving. Tell me about a situation where something didn't work as expected and how you approached it.').\n"
        "4. REDUCE REPETITIVE PRAISE: Do NOT constantly praise or evaluate answers ('That's a mature way to handle it', 'That's a well-structured approach'). Use brief, varied neutral acknowledgments ('Understood.', 'That makes sense.', 'Thanks.', 'Let's dig into that.', 'You mentioned X earlier...') or ask the question directly without any filler.\n"
        "5. ADAPTIVE FOLLOW-UPS & DEEPENING:\n"
        "   - Actively listen for specific technologies, architectures, business metrics, trade-offs, debugging steps, or outcomes in the candidate's response.\n"
        "   - Connect directly to what they said (e.g. 'You mentioned separating routes, controllers, and models. Did you run into any challenges keeping error handling consistent across those layers?').\n"
        "   - If the candidate gives theoretical claims without real evidence, ask for a concrete example or their specific responsibility.\n"
        "6. INCOMPLETE, SHORT, OR VAGUE ANSWERS:\n"
        "   - If the candidate gives a short or vague response (e.g. 'I had an API problem and fixed it' or 'I used React'), do NOT immediately abandon the topic. Ask ONE targeted clarification or expansion question (e.g. 'What was actually going wrong with the API, and how did you identify the root cause?').\n"
        "   - Do not trap or interrogate: if they struggle after 1-2 clarification attempts, transition forward gracefully.\n"
        "7. AVOID FOLLOW-UP LOOPS:\n"
        "   - Max 2 follow-ups per topic. Move to NEXT_TOPIC or NEXT_STAGE once sufficient evidence is gathered, or follow-up limit is reached.\n"
        "8. CONVERSATION MEMORY:\n"
        "   - Remember details and tools the candidate introduced earlier in the same interview. When appropriate, naturally connect later questions back to those earlier details (e.g. 'You mentioned earlier that you used both Node.js and Spring Boot. What differences did you notice in how you structured backend applications with them?').\n"
        "9. CONVERSATION REFERENCE SAFETY (AVOID AMBIGUOUS PRONOUNS & LABELS):\n"
        "   - Before generating a question containing references such as:\n"
        "     'that implementation', 'that project', 'that issue', 'that approach', 'it', 'this situation'\n"
        "     verify that the referenced subject is completely clear from the recent conversation.\n"
        "   - If multiple projects, scenarios, technologies, or problems have recently been discussed, EXPLICITLY NAME THE SUBJECT INSTEAD.\n"
        "     * Bad: 'What was the biggest challenge during that implementation?'\n"
        "     * Better: 'In the React project you described earlier, what was the biggest implementation challenge you faced?'\n"
        "     * Bad: 'How did you solve that?'\n"
        "     * Better: 'For the intermittent API failure scenario, how would you determine whether the database connection pool was the source of the problem?'\n"
        "   - AVOID REPETITION: Avoid asking the candidate to repeat an experience or story that has already been sufficiently discussed unless the new question explores a clearly different aspect of that experience.\n"
        "10. INTERVIEW TYPE CONTROLS FOCUS:\n"
        "   - 'HR & Behavioral': Teamwork, conflict, leadership, accountability, motivation, learning.\n"
        "   - 'Role-Specific': Core responsibilities, technical/functional processes, industry standards for the target role.\n"
        "   - 'Case & Situational': Realistic workplace dilemmas, troubleshooting, performance issues, business scenarios.\n"
        "   - 'Skills Assessment / Technical': Practical professional depth. (Note: Not only coding! Accounting=reconciliations, variances, GAAP; Marketing=CAC/LTV, attribution, ad fatigue; Software=architecture, concurrency, APIs; HR=retention, compliance).\n"
        "   - 'Full Interview': A balanced blend following the plan's stages without staying in technical questions the whole time.\n"
        "11. DIFFICULTY CALIBRATION:\n"
        "   - 'Beginner': Clear fundamentals, basic implementation, supportive tone.\n"
        "   - 'Intermediate': Practical reasoning, design choices, debugging, trade-offs.\n"
        "   - 'Advanced': Scalability, high-stakes trade-offs, edge cases, failure modes, organizational impact.\n"
        "12. DO NOT INVENT EXPERIENCE:\n"
        "   - If a skill is in the JD but absent from the CV, ask if the candidate has worked with it; never assume they know it.\n"
        "13. CLOSING BEHAVIOR:\n"
        "   - Near completion, invite candidate questions. Conclude warmly and professionally as an interview simulation. Never make promises about real-world hiring decisions, offers, or next steps.\n"
        "14. DURATION & PACING PRINCIPLES (CRITICAL):\n"
        "   - TARGET DURATION IS THE GOAL: The selected duration (15m, 30m, 60m) is the TARGET INTERVIEW EXPERIENCE, not merely an upper ceiling to exit as soon as stages are touched.\n"
        "   - DO NOT END EARLY: Touching each stage or objective once DOES NOT mean the interview is finished. If substantial target time remains (less than 85-90% of target duration elapsed), you MUST NOT end the interview.\n"
        "   - USE REMAINING TIME TO INCREASE DEPTH: When target time remains, intelligently deepen the conversation:\n"
        "     * Probe implementation details, system architecture, and concrete code/data flow.\n"
        "     * Explore trade-offs, alternative approaches considered, and reasoning behind decisions.\n"
        "     * Ask debugging, troubleshooting, failure mode, and edge-case scenarios.\n"
        "     * Revisit important CV experiences from a different technical or leadership angle.\n"
        "     * Explore high-priority Job Description requirements that have not yet been deeply validated.\n"
        "     * NEVER generate random filler questions just to consume time; all deeper questions must be relevant to the candidate's CV, JD, role, and prior answers.\n"
        "   - QUESTION COUNT IS GUIDANCE ONLY: The targetQuestionCount in the interview plan is planning guidance, NEVER a hard stop. If 10 questions have been asked but only 14 minutes of a 30-minute interview have passed, continue deepening. Conversely, if answers are long and detailed, do not force unnecessary questions.\n"
        "   - 5 PACING PHASES:\n"
        "     * EARLY PHASE (0%–25%): Introduction, background, CV context, initial role exploration. Do not rush.\n"
        "     * CORE PHASE (25%–70%): Major interview plan objectives, role-specific questions, technical/skills questions, behavioral questions, scenarios, meaningful follow-ups.\n"
        "     * DEEPENING / COMPLETION PHASE (70%–90%): Explore weakly covered objectives, test trade-offs, explore scale and edge cases, verify remaining JD requirements.\n"
        "     * CLOSING PREPARATION (90%–100%): Finish active discussions, invite candidate questions, and transition naturally toward wrap-up.\n"
        "     * EXTENSION PHASE (100% to Target+10m): Controlled extension buffer (up to 10 minutes maximum). Only use when an active scenario needs finishing or candidate questions are being answered. Never start brand new low-priority topics.\n"
        "   - ABSOLUTE MAXIMUM: The interview must never continue beyond targetDuration + 10 minutes.\n"
        "15. OUTPUT FORMAT: Respond ONLY with a valid JSON object matching this schema:\n"
        "{\n"
        '  "action": "FOLLOW_UP" | "CLARIFY" | "DEEPEN" | "NEXT_TOPIC" | "NEXT_STAGE" | "END_INTERVIEW",\n'
        '  "reasonCode": "RELEVANT_DEPTH" | "ANSWER_INCOMPLETE" | "CLARIFICATION_NEEDED" | "OBJECTIVE_SUFFICIENT" | "TOPIC_SUFFICIENT" | "STAGE_COMPLETE" | "TIME_PROGRESS" | "INTERVIEW_COMPLETE" | "ANSWER_TOO_VAGUE" | "CLAIM_NEEDS_EXAMPLE" | "VALUABLE_DETAIL_FOUND" | "OBJECTIVE_COVERED" | "FOLLOWUP_LIMIT_REACHED" | "MOVE_TO_NEXT_PRIORITY" | "TIME_PRIORITY",\n'
        '  "question": "The single natural candidate-facing question",\n'
        '  "stageId": "stage_id_here",\n'
        '  "topic": "topic_name_here",\n'
        '  "objectiveCovered": "brief note on objective advanced"\n'
        "}"
    )

    def __init__(self, model: Optional[Any] = None):
        self.model = model if model is not None else get_orchestrator_model()

    def generate_opening_question(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Generate ONE dynamic opening question based on plan, CV, JD, and interview type."""
        candidate = context.get("candidate", {})
        target_job = context.get("targetJob", {})
        config = context.get("interviewConfiguration", {})
        plan = context.get("plan", {})

        candidate_name = candidate.get("candidateName") or "Candidate"
        role = target_job.get("role") or candidate.get("detectedRole") or "Professional"
        company = target_job.get("company") or "our team"
        interview_type = config.get("type") or plan.get("interviewType") or "Role-Specific"
        difficulty = config.get("difficulty") or plan.get("difficulty") or "Intermediate"

        stages = plan.get("stages", [])
        first_stage = stages[0] if stages else {}
        first_stage_id = first_stage.get("id", "stage_intro")
        first_stage_name = first_stage.get("name", "Introduction & Background")
        first_topics = first_stage.get("topics", ["Professional Background", "Motivation"])
        first_topic = first_topics[0] if first_topics else "Professional Background"

        # Build prompt for opening question
        prompt = (
            f"Generate the ONE OPENING QUESTION for this interview.\n\n"
            f"Candidate Name: {candidate_name}\n"
            f"Target Role: {role}\n"
            f"Target Company: {company}\n"
            f"Interview Type: {interview_type}\n"
            f"Difficulty: {difficulty}\n"
            f"First Stage: {first_stage_name} (ID: {first_stage_id})\n"
            f"Stage Topics: {', '.join(first_topics)}\n"
            f"Candidate Projects: {[p.get('name') for p in candidate.get('projects', [])[:3]]}\n"
            f"Candidate Experience: {[e.get('title') or e.get('role') for e in candidate.get('experience', [])[:2]]}\n\n"
            f"Instructions:\n"
            f"- Welcome {candidate_name} warmly to the {interview_type} interview for {role} at {company}.\n"
            f"- Ask ONE focused, engaging opening question tailored to {interview_type} and their background.\n"
            f"- For 'Skills Assessment / Technical', ask them to introduce their technical journey or a signature project.\n"
            f"- For 'HR & Behavioral', ask what motivated them toward this career transition or role.\n"
            f"- For 'Case & Situational', set the stage and ask an introductory situational calibration question.\n"
            f"- Respond with JSON containing: action='NEXT_TOPIC', reasonCode='RELEVANT_DEPTH', stageId='{first_stage_id}', topic='{first_topic}', question='...'"
        )

        llm_response, _ = self._call_llm(prompt)
        if llm_response:
            parsed = self._extract_json(llm_response)
            if parsed and parsed.get("question"):
                return {
                    "action": "START_INTERVIEW",
                    "reasonCode": parsed.get("reasonCode", "RELEVANT_DEPTH"),
                    "question": parsed["question"].strip(),
                    "stageId": first_stage_id,
                    "stageName": first_stage_name,
                    "topic": first_topic,
                }

        # Resilient opening fallback
        return self._fallback_opening_question(
            candidate_name, role, company, interview_type, first_stage_id, first_stage_name, first_topic, candidate
        )

    def process_turn(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Process candidate's latest answer, decide action, and produce the ONE next question."""
        candidate = context.get("candidate", {})
        target_job = context.get("targetJob", {})
        config = context.get("interviewConfiguration", {})
        plan = context.get("plan", {})
        timing_dict = context.get("timing", {})
        timing = TimingContext(**timing_dict) if timing_dict else TimingContext()
        state_dict = context.get("state", {})
        state = InterviewStateContext(**state_dict) if state_dict else InterviewStateContext()
        history = context.get("conversationHistory", [])
        latest_answer = (context.get("latestAnswer") or "").strip()

        # 1. Authoritative Time Check: If absolute maximum reached (+10 min buffer)
        if timing.elapsedMinutes >= timing.absoluteMaximumMinutes:
            logger.info(f"Absolute maximum duration reached ({timing.elapsedMinutes:.1f} >= {timing.absoluteMaximumMinutes}m). Forcing interview completion.")
            candidate_name = candidate.get("candidateName") or "Candidate"
            return {
                "action": InterviewAction.END_INTERVIEW.value,
                "reasonCode": ReasonCode.TIME_PROGRESS.value,
                "question": f"Thank you so much for your time and thoughtful responses today, {candidate_name}. We have reached the conclusion of our scheduled interview. You presented your experience and problem-solving clearly, and we will now finalize your interview records. Have a wonderful rest of your day!",
                "stageId": state.currentStageId,
                "stageName": state.currentStageName,
                "topic": state.currentTopic,
                "isComplete": True,
            }

        # Compute progress ratio based on selected target duration
        progress_ratio = (timing.elapsedMinutes / timing.targetDurationMinutes) if timing.targetDurationMinutes > 0 else 0.0

        # 2. Extract current stage and next stage info from plan
        stages = plan.get("stages", [])
        curr_idx = state.currentStageIndex
        curr_stage = stages[curr_idx] if 0 <= curr_idx < len(stages) else (stages[-1] if stages else {})
        next_stage = stages[curr_idx + 1] if 0 <= curr_idx + 1 < len(stages) else None
        is_last_stage = curr_idx >= len(stages) - 1

        # Check stage progression conditions
        stage_target_q = curr_stage.get("targetQuestionCount", 2)
        stage_topics = curr_stage.get("topics", [])
        stage_objectives = curr_stage.get("objectives", [])

        # Build prompt with dynamic pacing context
        prompt = self._build_turn_prompt(
            candidate=candidate,
            target_job=target_job,
            config=config,
            curr_stage=curr_stage,
            next_stage=next_stage,
            is_last_stage=is_last_stage,
            timing=timing,
            state=state,
            history=history,
            latest_answer=latest_answer,
            progress_ratio=progress_ratio,
        )

        llm_response, error_detail = self._call_llm(prompt)

        if llm_response:
            parsed = self._extract_json(llm_response)
            if parsed and parsed.get("question"):
                try:
                    # Validate against Pydantic schema
                    validated = ModelActionOutput(**parsed)
                    res_action = validated.action.value
                    res_reason = validated.reasonCode.value
                    res_question = validated.question.strip()
                    res_stage_id = validated.stageId or curr_stage.get("id", state.currentStageId)
                    res_topic = validated.topic or state.currentTopic

                    # Force stage progression if model tries to stay stuck in deep follow-up loop
                    if res_action == InterviewAction.FOLLOW_UP.value and state.followUpDepth >= 2:
                        res_action = InterviewAction.NEXT_TOPIC.value
                        res_reason = ReasonCode.TOPIC_SUFFICIENT.value

                    # Guardrail: Early completion prevention
                    # Selected duration is a TARGET experience. An interview must NOT conclude early if substantial target time remains (<88% elapsed)
                    if res_action == InterviewAction.END_INTERVIEW.value:
                        if progress_ratio < 0.88 and timing.elapsedMinutes < timing.absoluteMaximumMinutes:
                            logger.info(f"Prevented premature END_INTERVIEW at {timing.elapsedMinutes:.1f}m / {timing.targetDurationMinutes}m ({progress_ratio*100:.0f}%). Overriding to DEEPEN.")
                            res_action = InterviewAction.DEEPEN.value
                            res_reason = ReasonCode.RELEVANT_DEPTH.value
                            if any(w in res_question.lower() for w in ["thank you for your time", "wrap up", "conclude our interview", "have a wonderful rest", "conclude our scheduled", "do you have any questions for me", "conclusion of our"]):
                                topic_label = res_topic or state.currentTopic or curr_stage.get("name") or "your recent work"
                                res_question = f"Before we transition toward wrapping up, I'd like to explore your experience with {topic_label}: could you walk me through a specific technical trade-off or unexpected failure mode you had to resolve in that context?"

                    # If timing is near or past target (>= 90%) and in final stage, allow natural conclusion
                    if progress_ratio >= 0.90 and is_last_stage and res_action != InterviewAction.END_INTERVIEW.value:
                        if state.stageQuestionsAsked >= 1:
                            res_action = InterviewAction.END_INTERVIEW.value
                            res_reason = ReasonCode.INTERVIEW_COMPLETE.value

                    is_complete = (res_action == InterviewAction.END_INTERVIEW.value)

                    return {
                        "action": res_action,
                        "reasonCode": res_reason,
                        "question": res_question,
                        "stageId": res_stage_id,
                        "stageName": curr_stage.get("name", state.currentStageName),
                        "topic": res_topic,
                        "objectiveCovered": validated.objectiveCovered or "",
                        "isComplete": is_complete,
                    }
                except Exception as val_err:
                    logger.warning(f"Validation error on parsed action output: {val_err}. Using normalized dictionary.")
                    return self._normalize_turn_output(parsed, curr_stage, state, timing, is_last_stage)
            else:
                logger.warning(f"Could not extract valid JSON from LLM response for interview turn. Using heuristic adaptive response.")
        else:
            logger.warning(f"LLM call failed for interview turn ({error_detail}). Using heuristic adaptive response.")

        # Resilient heuristic fallback
        return self._heuristic_adaptive_response(
            candidate=candidate,
            target_job=target_job,
            config=config,
            curr_stage=curr_stage,
            next_stage=next_stage,
            is_last_stage=is_last_stage,
            timing=timing,
            state=state,
            latest_answer=latest_answer,
        )

    def _build_turn_prompt(
        self,
        candidate: Dict[str, Any],
        target_job: Dict[str, Any],
        config: Dict[str, Any],
        curr_stage: Dict[str, Any],
        next_stage: Optional[Dict[str, Any]],
        is_last_stage: bool,
        timing: TimingContext,
        state: InterviewStateContext,
        history: List[Dict[str, str]],
        latest_answer: str,
        progress_ratio: float = 0.0,
    ) -> str:
        candidate_name = candidate.get("candidateName") or "Candidate"
        role = target_job.get("role") or "Candidate Role"
        company = target_job.get("company") or "Target Company"
        interview_type = config.get("type", "Role-Specific")
        difficulty = config.get("difficulty", "Intermediate")

        # Extract conversation memory: key points previously mentioned by candidate
        candidate_memory_points = []
        for msg in history:
            if msg.get("role") in ["candidate", "user"]:
                content = (msg.get("content") or "").strip()
                if content and content != latest_answer:
                    # Capture concise summary snippets for memory
                    cleaned_snippet = re.sub(r"\s+", " ", content)
                    if len(cleaned_snippet) > 120:
                        cleaned_snippet = cleaned_snippet[:117] + "..."
                    candidate_memory_points.append(cleaned_snippet)

        memory_text = "\n".join([f"- {p}" for p in candidate_memory_points[-6:]]) if candidate_memory_points else "None yet."

        # Format recent dialogue (last 8 turns for conversational depth)
        formatted_history = []
        for msg in history[-8:]:
            role_label = "Interviewer" if msg.get("role") in ["interviewer", "assistant"] else candidate_name
            formatted_history.append(f"{role_label}: {msg.get('content', '')}")
        history_text = "\n".join(formatted_history) if formatted_history else "No previous dialog."

        stage_topics = curr_stage.get("topics", [])
        stage_objectives = curr_stage.get("objectives", [])
        stage_intents = curr_stage.get("questionIntents", [])

        # Dynamic Percentage-Based Pacing Phase Guidance
        progress_pct = int(round(progress_ratio * 100))
        target_mins = timing.targetDurationMinutes or 30
        elapsed_mins = timing.elapsedMinutes

        if progress_ratio < 0.25:
            timing_phase = "EARLY_PHASE (0%–25% of Target Duration)"
            phase_directives = (
                f"- EARLY PHASE ({progress_pct}% elapsed): Focus on introduction, background, important CV context, and initial role exploration.\n"
                f"- Do NOT rush through stages. Listen actively and establish a comfortable conversational cadence."
            )
        elif progress_ratio < 0.70:
            timing_phase = "CORE_PHASE (25%–70% of Target Duration)"
            phase_directives = (
                f"- CORE PHASE ({progress_pct}% elapsed): Focus on major Interview Plan objectives, role-specific questions, technical/skills depth, behavioral competencies, and scenarios.\n"
                f"- Ask meaningful adaptive follow-ups into architecture, trade-offs, metrics, and real-world execution.\n"
                f"- Question count is GUIDANCE ONLY: Do not rush to wrap up just because a question count was reached."
            )
        elif progress_ratio < 0.90:
            timing_phase = "DEEPENING_PHASE (70%–90% of Target Duration)"
            phase_directives = (
                f"- DEEPENING / COMPLETION PHASE ({progress_pct}% elapsed): Check which objectives need stronger evidence.\n"
                f"- Explore weakly covered objectives, test trade-offs, explore edge cases, failure modes, or unvalidated JD requirements.\n"
                f"- DO NOT END EARLY: Substantial target time remains. Continue deepening candidate experience meaningfully."
            )
        elif progress_ratio <= 1.00:
            timing_phase = "CLOSING_PREPARATION (90%–100% of Target Duration)"
            phase_directives = (
                f"- CLOSING PREPARATION ({progress_pct}% elapsed): You are approaching target duration ({elapsed_mins:.1f}m / {target_mins}m).\n"
                f"- Complete active conversational threads. Transition smoothly toward candidate questions and wrap-up."
            )
        else:
            timing_phase = f"EXTENSION_PHASE (100%+ of Target Duration, +{elapsed_mins - target_mins:.1f}m extension used)"
            phase_directives = (
                f"- EXTENSION PHASE ({progress_pct}% elapsed): The interview has entered the controlled extension buffer (up to +10m max: {timing.absoluteMaximumMinutes}m).\n"
                f"- Only continue if completing an active scenario, finishing a valuable follow-up, or addressing candidate questions.\n"
                f"- Do NOT start new low-priority topics. Transition naturally to END_INTERVIEW."
            )
        # Format candidate projects from CV
        raw_projects = candidate.get("projects", [])
        formatted_projects = []
        for p in raw_projects[:3]:
            p_title = p.get("title") or p.get("name") or "Project"
            tech_items = p.get("tech_stack", [])
            p_tech = ", ".join(tech_items) if isinstance(tech_items, list) else str(tech_items)
            p_desc = p.get("description", "")
            formatted_projects.append(f"- {p_title} (Stack: {p_tech}): {p_desc}")
        projects_text = "\n".join(formatted_projects) if formatted_projects else "No specific projects listed in CV."

        # Stage question count cap
        stage_target_q = curr_stage.get('targetQuestionCount', 2)

        prompt = (
            f"TARGET ROLE: {role} at {company}\n"
            f"INTERVIEW TYPE: {interview_type}\n"
            f"DIFFICULTY: {difficulty}\n"
            f"AUTHORITATIVE CLOCK: Elapsed {timing.elapsedMinutes:.1f} min / Target {timing.targetDurationMinutes} min (Max {timing.absoluteMaximumMinutes} min, {progress_pct}% of Target)\n"
            f"CURRENT PACING PHASE: {timing_phase}\n"
            f"{phase_directives}\n\n"
            f"CANDIDATE CV PROJECTS (EXTRACTED FROM RESUME):\n"
            f"{projects_text}\n\n"
            f"CURRENT STAGE: {curr_stage.get('name', 'Current Stage')} (ID: {curr_stage.get('id')})\n"
            f"Stage Objectives: {'; '.join(stage_objectives)}\n"
            f"Stage Topics: {'; '.join(stage_topics)}\n"
            f"Stage Question Intents: {'; '.join(stage_intents)}\n"
            f"Questions Asked in Stage: {state.stageQuestionsAsked} (Planning Target: {stage_target_q})\n"
            f"Total Questions Asked: {state.questionsAsked}\n"
            f"Current Topic: {state.currentTopic or (stage_topics[0] if stage_topics else 'General')}\n"
            f"Follow-up Depth on Current Topic: {state.followUpDepth} (Max 2)\n"
            f"Covered Topics So Far: {', '.join(state.coveredTopics) if state.coveredTopics else 'None'}\n\n"
            f"EARLIER CONVERSATION MEMORY (Candidate mentioned earlier in this interview):\n"
            f"{memory_text}\n\n"
            f"RECENT DIALOGUE:\n"
            f"{history_text}\n\n"
            f"LATEST CANDIDATE ANSWER:\n"
            f"\"{latest_answer}\"\n\n"
            f"STAGE-SPECIFIC QUESTION ARCHETYPES (CRITICAL - ALWAYS ADHERE TO THE ACTIVE STAGE):\n"
            f"1. IF IN PROJECT DEEP DIVE STAGE ('stage_experience' or 'Project' in stage name):\n"
            f"   - NEVER ask generically 'what projects have you worked on?' or 'tell me about a project'.\n"
            f"   - DIRECTLY NAME one of the candidate's actual projects from the CV above (e.g. 'I see on your resume that you built [Project Title] with [Stack]...').\n"
            f"   - Ask about its architecture, data flow, how they solved the biggest technical bottleneck, or a design trade-off.\n"
            f"2. IF IN THEORY / PRINCIPLES STAGE ('stage_theory' or 'Theory' or 'Skills' in stage name):\n"
            f"   - DO NOT ask about past projects. Pivot completely to foundational technical concepts, architecture principles, memory/concurrency, or database mechanisms (e.g. database indexing, event loop, immutability, caching invalidation, or API idempotency).\n"
            f"3. IF IN SCENARIO / CASE STUDY STAGE ('stage_scenario' or 'Scenario' in stage name):\n"
            f"   - Present a concrete, realistic production or operational dilemma (e.g. sudden latency spike under traffic, database deadlock, or data inconsistency) and ask how they isolate, debug, and resolve it.\n"
            f"4. IF IN CODING / PROBLEM SOLVING STAGE ('stage_coding' or 'Coding' in stage name):\n"
            f"   - Present a clear, self-contained coding problem (e.g. algorithm, data structure manipulation, rate limiter, or parsing logic) with expected inputs, outputs, and constraints.\n"
            f"   - Tell the candidate: 'You can write and run your solution directly in the Code Editor on your screen, and submit it when ready.'\n"
            f"   - If the candidate just submitted code in their answer, evaluate their code: highlight its time/space complexity (Big-O), correctness, and any edge-case considerations, then transition to the next stage.\n"
            f"5. IF IN GK / INDUSTRY TRENDS / BEHAVIORAL STAGE ('stage_gk_behavioral' or 'GK' in stage name):\n"
            f"   - Ask about modern industry trends, technology ecosystem evolution (e.g. microservices vs modular monoliths, AI integration into development workflows), or a team collaboration dilemma.\n\n"
            f"PACING & PROGRESSION DECISION RULES (Follow in priority order):\n"
            f"1. STAGE PROGRESSION MANDATE:\n"
            f"   - If questions asked in current stage >= {stage_target_q} OR followUpDepth >= 2:\n"
            f"     You MUST select action='NEXT_STAGE' to keep the interview dynamic and well-rounded across all stages.\n"
            f"     Do NOT stay in the same stage or loop on the same project.\n"
            f"2. ACTION SELECTION:\n"
            f"   - If questions asked in stage < {stage_target_q} and followUpDepth < 2:\n"
            f"     * If answer is vague or incomplete: choose CLARIFY with reasonCode='ANSWER_TOO_VAGUE'.\n"
            f"     * If answer has valuable details: choose FOLLOW_UP with reasonCode='VALUABLE_DETAIL_FOUND'.\n"
            f"   - Otherwise: choose NEXT_STAGE with reasonCode='STAGE_COMPLETE'.\n"
            f"   - If in closing/wrap-up AND elapsed time >= 90% of target duration: choose END_INTERVIEW with reasonCode='INTERVIEW_COMPLETE'.\n"
            f"3. CRAFT THE ONE QUESTION:\n"
            f"   - Natural, human interviewer language. Strictly ONE question (1-2 sentences max).\n"
            f"   - Begin with a warm, natural acknowledgment of their specific answer (e.g., 'Understood, that makes good sense.', 'Got it, thanks for explaining that.', 'Fair point.') before asking the next question.\n"
            f"   - When transitioning stages, clearly acknowledge concluding the current competency before introducing the next area.\n"
            f"   - Avoid robotic transitions. Provide smooth, empathetic, professional conversational flow.\n"
            f"Respond ONLY in valid JSON."
        )

        return prompt

    def _call_llm(self, prompt: str) -> tuple[Optional[str], Optional[str]]:
        """Call OpenRouter or configured model provider with structured system instructions."""
        if MODEL_PROVIDER == "openrouter":
            if not OPENROUTER_API_KEY or "your_openrouter_api_key_here" in OPENROUTER_API_KEY:
                return None, "OPENROUTER_API_KEY is not configured"

            try:
                import requests
                base_url = OPENROUTER_BASE_URL.rstrip("/")
                chat_url = f"{base_url}/chat/completions"

                headers = {
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "HTTP-Referer": "https://hiremind.com",
                    "X-Title": "HireMind Live Interview Agent",
                }
                payload = {
                    "model": AI_MODEL,
                    "messages": [
                        {"role": "system", "content": self.SYSTEM_INSTRUCTION},
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": 0.3,
                    "max_tokens": 600,
                    "reasoning": {"max_tokens": 100},
                }

                logger.info(f"Querying OpenRouter model '{AI_MODEL}' for live interview turn...")
                response = requests.post(chat_url, headers=headers, json=payload, timeout=45)
                if response.status_code == 200:
                    data = response.json()
                    choices = data.get("choices", [])
                    if choices:
                        msg = choices[0].get("message", {})
                        content = msg.get("content") or ""
                        if not content.strip() and msg.get("reasoning"):
                            content = msg.get("reasoning")
                        return content, None
                    return None, "OpenRouter returned empty choices"
                else:
                    err_msg = f"OpenRouter returned HTTP {response.status_code}: {response.text[:200]}"
                    logger.warning(err_msg)
                    return None, err_msg
            except Exception as e:
                err_msg = f"Connection failed to OpenRouter endpoint: {e}"
                logger.warning(err_msg)
                return None, err_msg

        return None, f"Unsupported MODEL_PROVIDER '{MODEL_PROVIDER}'"

    def _extract_json(self, raw_text: str) -> Optional[Dict[str, Any]]:
        """Clean markdown markers and parse JSON safely."""
        if not raw_text:
            return None

        cleaned = raw_text.strip()
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.MULTILINE)
        cleaned = re.sub(r"\s*```$", "", cleaned, flags=re.MULTILINE)

        # Attempt direct parse
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            pass

        # Attempt to isolate outer curly braces
        match = re.search(r"(\{.*\})", cleaned, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(1))
            except json.JSONDecodeError:
                pass

        return None

    def _normalize_turn_output(
        self,
        parsed: Dict[str, Any],
        curr_stage: Dict[str, Any],
        state: InterviewStateContext,
        timing: TimingContext,
        is_last_stage: bool
    ) -> Dict[str, Any]:
        """Normalize raw JSON dict into guaranteed contract."""
        action = parsed.get("action", "NEXT_TOPIC")
        if action not in [a.value for a in InterviewAction]:
            action = "NEXT_TOPIC"

        reason_code = parsed.get("reasonCode", "TOPIC_SUFFICIENT")
        if reason_code not in [r.value for r in ReasonCode]:
            reason_code = "TOPIC_SUFFICIENT"

        stage_id = parsed.get("stageId") or curr_stage.get("id", state.currentStageId)
        topic = parsed.get("topic") or state.currentTopic or curr_stage.get("name") or "your recent project work"

        question = parsed.get("question", "").strip()
        if not question:
            question = f"Could you elaborate on the key challenges or trade-offs you encountered when working with {topic}?"

        if action in ["FOLLOW_UP", "DEEPEN"] and state.followUpDepth >= 2:
            action = "NEXT_TOPIC"
            reason_code = "FOLLOWUP_LIMIT_REACHED"

        # Early completion guardrail in normalization
        progress_ratio = (timing.elapsedMinutes / timing.targetDurationMinutes) if timing.targetDurationMinutes > 0 else 0.0
        if action == "END_INTERVIEW":
            if progress_ratio < 0.88 and timing.elapsedMinutes < timing.absoluteMaximumMinutes:
                logger.info(f"Prevented normalized premature END_INTERVIEW at {timing.elapsedMinutes:.1f}m / {timing.targetDurationMinutes}m ({progress_ratio*100:.0f}%). Overriding to DEEPEN.")
                action = "DEEPEN"
                reason_code = "RELEVANT_DEPTH"
                if any(w in question.lower() for w in ["thank you for your time", "wrap up", "conclude our interview", "have a wonderful rest", "conclude our scheduled", "do you have any questions for me", "conclusion of our"]):
                    question = f"Before we begin transitioning toward wrapping up, I'd like to explore your experience with {topic}: could you walk me through a specific technical trade-off or unexpected failure mode you had to resolve in that context?"

        is_complete = (action == "END_INTERVIEW")

        return {
            "action": action,
            "reasonCode": reason_code,
            "question": question,
            "stageId": stage_id,
            "stageName": curr_stage.get("name", state.currentStageName),
            "topic": topic,
            "objectiveCovered": parsed.get("objectiveCovered", ""),
            "isComplete": is_complete,
        }

    def _fallback_opening_question(
        self,
        candidate_name: str,
        role: str,
        company: str,
        interview_type: str,
        stage_id: str,
        stage_name: str,
        topic: str,
        candidate: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Context-rich fallback opening question when LLM is unavailable."""
        projects = candidate.get("projects", [])
        project_ref = f", such as {projects[0].get('name')}" if projects else ""

        if "behavioral" in interview_type.lower() or "hr" in interview_type.lower():
            q = (
                f"Hello {candidate_name}, welcome to your interview for the {role} role at {company}. "
                f"To begin, could you introduce yourself and tell me what motivated you to pursue this opportunity?"
            )
        elif "case" in interview_type.lower() or "situational" in interview_type.lower():
            q = (
                f"Welcome {candidate_name}. In this session, we will explore practical scenarios you would face as a {role} at {company}. "
                f"To start off, could you briefly summarize your professional background and the types of complex challenges you most enjoy tackling?"
            )
        elif "skills" in interview_type.lower() or "technical" in interview_type.lower():
            q = (
                f"Hello {candidate_name}, welcome to your technical skills assessment for the {role} position at {company}. "
                f"To kick things off, could you walk me through your core technical background and highlight a recent project{project_ref} where you had substantial hands-on ownership?"
            )
        else:
            q = (
                f"Hello {candidate_name}, welcome to your interview for the {role} position at {company}. "
                f"Let's start by walking through your background and the experiences on your resume that best prepare you for this role."
            )

        return {
            "action": "START_INTERVIEW",
            "reasonCode": "RELEVANT_DEPTH",
            "question": q,
            "stageId": stage_id,
            "stageName": stage_name,
            "topic": topic,
        }

    def _heuristic_adaptive_response(
        self,
        candidate: Dict[str, Any],
        target_job: Dict[str, Any],
        config: Dict[str, Any],
        curr_stage: Dict[str, Any],
        next_stage: Optional[Dict[str, Any]],
        is_last_stage: bool,
        timing: TimingContext,
        state: InterviewStateContext,
        latest_answer: str,
    ) -> Dict[str, Any]:
        """High-quality deterministic fallback that analyzes answer length, keywords,
        and stage progression across any professional domain without robotic templates.
        Enforces target duration and time redistribution.
        """
        candidate_name = candidate.get("candidateName") or "Candidate"
        role = target_job.get("role") or "Candidate Role"
        stage_topics = curr_stage.get("topics", ["Key Competencies"])
        stage_target_q = curr_stage.get("targetQuestionCount", 2)
        words = latest_answer.split()
        progress_ratio = (timing.elapsedMinutes / timing.targetDurationMinutes) if timing.targetDurationMinutes > 0 else 0.0

        # Check for conclusion / time limit:
        # Only conclude if absolute maximum is reached OR (in last stage AND progress is >= 88% of target)
        is_time_to_close = (timing.elapsedMinutes >= timing.absoluteMaximumMinutes) or (
            is_last_stage and progress_ratio >= 0.88
        )
        if is_time_to_close:
            return {
                "action": InterviewAction.END_INTERVIEW.value,
                "reasonCode": ReasonCode.INTERVIEW_COMPLETE.value,
                "question": f"Thank you so much for your time and thoughtful responses today, {candidate_name}. We have reached the conclusion of our interview simulation for the {role} position. Do you have any questions for me before we wrap up?",
                "stageId": curr_stage.get("id", state.currentStageId),
                "stageName": curr_stage.get("name", state.currentStageName),
                "topic": "Closing",
                "objectiveCovered": "Final interview wrap-up",
                "isComplete": True,
            }

        # If in last stage but substantial target time remains, redistribute time to deeper scenario or architectural reflection
        if is_last_stage and progress_ratio < 0.88 and timing.elapsedMinutes < timing.absoluteMaximumMinutes:
            return {
                "action": InterviewAction.DEEPEN.value,
                "reasonCode": ReasonCode.RELEVANT_DEPTH.value,
                "question": f"Looking back across the systems and projects you've worked on, what is one major design decision or trade-off you made that you would approach differently if you were rebuilding it today?",
                "stageId": curr_stage.get("id", state.currentStageId),
                "stageName": curr_stage.get("name", state.currentStageName),
                "topic": "Architectural Retrospective & Design Trade-offs",
                "objectiveCovered": "Deep technical reflection",
                "isComplete": False,
            }

        # 1. Answer too short or vague -> Clarify
        if len(words) < 8 and state.followUpDepth == 0:
            lower_ans = latest_answer.lower()
            matched_tech = next((t for t in ["react", "node", "spring", "sql", "api", "database", "python", "docker", "aws", "kubernetes"] if t in lower_ans), None)
            if matched_tech:
                display_tech = matched_tech.upper() if matched_tech in ["sql", "api", "aws"] else matched_tech.title()
                clarify_q = f"In your work with {display_tech}, what was your specific responsibility and what was the main technical challenge you solved?"
            elif any(t in lower_ans for t in ["problem", "issue", "bug", "error", "failed", "crash"]):
                subject = state.currentTopic or "technical issue"
                clarify_q = f"For that {subject.lower()} scenario, what was actually failing and how did you determine the root cause?"
            else:
                subject = state.currentTopic or "this area"
                clarify_q = f"Could you walk me through a specific situation or example where you applied {subject.lower()}?"

            return {
                "action": InterviewAction.CLARIFY.value,
                "reasonCode": ReasonCode.ANSWER_TOO_VAGUE.value,
                "question": clarify_q,
                "stageId": curr_stage.get("id", state.currentStageId),
                "stageName": curr_stage.get("name", state.currentStageName),
                "topic": state.currentTopic or stage_topics[0],
                "objectiveCovered": "",
                "isComplete": False,
            }

        # 2. Answer has detail & followUpDepth < 2 -> Dive deeper into trade-offs/metrics/challenges
        if len(words) >= 12 and state.followUpDepth < 2:
            lower_ans = latest_answer.lower()
            topic_subject = state.currentTopic or "that workflow"
            if any(k in lower_ans for k in ["performance", "speed", "scale", "bottleneck", "latency", "redis", "cache"]):
                followup_q = "In that performance optimization, how did you quantify the latency or throughput gains, and what trade-offs did you consider?"
            elif any(k in lower_ans for k in ["team", "conflict", "client", "stakeholder", "disagree", "feedback"]):
                followup_q = "When navigating that disagreement with your stakeholders, how did you reach alignment, and what would you do differently in retrospect?"
            elif any(k in lower_ans for k in ["decision", "chose", "opted", "architecture", "strategy", "controller", "service"]):
                followup_q = f"What alternative architectural designs did you evaluate before settling on your chosen solution for {topic_subject.lower()}, and why was it the best fit?"
            elif any(k in lower_ans for k in ["reconciliation", "variance", "ledger", "audit", "gaap", "cac", "funnel", "conversion"]):
                followup_q = "For that scenario, what specific metrics or anomalies led you to that conclusion, and how did you validate the final outcome?"
            else:
                followup_q = f"In the {topic_subject.lower()} work you described, what was the biggest implementation challenge you faced, and how did you resolve it?"

            return {
                "action": InterviewAction.FOLLOW_UP.value,
                "reasonCode": ReasonCode.VALUABLE_DETAIL_FOUND.value,
                "question": followup_q,
                "stageId": curr_stage.get("id", state.currentStageId),
                "stageName": curr_stage.get("name", state.currentStageName),
                "topic": state.currentTopic or stage_topics[0],
                "objectiveCovered": "Deep dive into execution & trade-offs",
                "isComplete": False,
            }

        # 3. Stage questions reached -> Natural transition to NEXT_STAGE (with timing guard)
        if state.stageQuestionsAsked >= stage_target_q and next_stage:
            next_topics = next_stage.get("topics", ["Key Responsibilities"])
            next_topic = next_topics[0] if next_topics else "Domain Responsibilities"
            stage_name_lower = (next_stage.get("name") or "").lower()

            # Prevent premature transition into closing/wrap-up stage if substantial target time remains (<85%)
            if ("closing" in stage_name_lower or "wrap" in stage_name_lower) and progress_ratio < 0.85 and timing.elapsedMinutes < timing.absoluteMaximumMinutes:
                topic_subject = state.currentTopic or "your hands-on domain work"
                return {
                    "action": InterviewAction.DEEPEN.value,
                    "reasonCode": ReasonCode.RELEVANT_DEPTH.value,
                    "question": f"Before we begin moving toward the final phase, I'd like to explore how you handle complex edge cases in {topic_subject.lower()}: what was an unexpected constraint or failure mode you encountered, and how did you resolve it?",
                    "stageId": curr_stage.get("id", state.currentStageId),
                    "stageName": curr_stage.get("name", state.currentStageName),
                    "topic": state.currentTopic or "Edge Cases & Failure Modes",
                    "objectiveCovered": "Deep technical resilience",
                    "isComplete": False,
                }

            if "behavior" in stage_name_lower or "fit" in stage_name_lower or "collab" in stage_name_lower:
                next_q = "I'd also like to understand how you collaborate with teammates. Could you tell me about a time you had to coordinate closely with others through a disagreement or tight deadline?"
            elif "scenario" in stage_name_lower or "problem" in stage_name_lower or "case" in stage_name_lower:
                next_q = "Let's move into problem solving. Tell me about a situation where something didn't work as expected and how you approached diagnosing it."
            elif "experience" in stage_name_lower or "project" in stage_name_lower or "deep" in stage_name_lower:
                next_q = "Let's shift focus to your hands-on project work. Could you walk me through a major technical or strategic decision you made in your recent projects?"
            elif "closing" in stage_name_lower or "wrap" in stage_name_lower:
                next_q = "That covers our core assessment areas. What questions do you have for me about the role, team, or our technical direction before we conclude?"
            else:
                next_q = f"Moving forward, I'd like to explore how you handle {next_topic.lower() if next_topic else 'core domain responsibilities'}. Can you share a concrete situation where that came into play?"

            return {
                "action": InterviewAction.NEXT_STAGE.value,
                "reasonCode": ReasonCode.STAGE_COMPLETE.value,
                "question": next_q,
                "stageId": next_stage.get("id"),
                "stageName": next_stage.get("name"),
                "topic": next_topic,
                "objectiveCovered": "Stage transition",
                "isComplete": False,
            }

        # 4. Move to NEXT_TOPIC in current stage naturally
        curr_topic_idx = 0
        if state.currentTopic in stage_topics:
            curr_topic_idx = stage_topics.index(state.currentTopic)
        next_topic = stage_topics[(curr_topic_idx + 1) % len(stage_topics)] if stage_topics else "Key Responsibilities"

        return {
            "action": InterviewAction.NEXT_TOPIC.value,
            "reasonCode": ReasonCode.TOPIC_SUFFICIENT.value,
            "question": f"That makes sense. Shifting focus slightly to {next_topic.lower()}—how have you typically approached that in your past experience?",
            "stageId": curr_stage.get("id", state.currentStageId),
            "stageName": curr_stage.get("name", state.currentStageName),
            "topic": next_topic,
            "objectiveCovered": f"Exploration of {next_topic}",
            "isComplete": False,
        }


# Singleton instance
interview_agent_instance = InterviewAgent()
