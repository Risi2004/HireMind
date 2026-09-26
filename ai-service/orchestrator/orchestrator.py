"""HireMind AI Orchestrator Layer
Powered by Google Agent Development Kit (ADK)
"""

import logging
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from datetime import datetime

from config.settings import (
    MODEL_PROVIDER,
    AI_MODEL,
    OPENROUTER_BASE_URL,
    is_openrouter_configured,
    is_gemini_configured,
    get_orchestrator_model
)

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("HireMindOrchestrator")

try:
    from google.adk.agents import Agent
    ADK_AVAILABLE = True
except ImportError:
    logger.warning("google-adk not yet fully installed or imported in this context.")
    Agent = None
    ADK_AVAILABLE = False


@dataclass
class InterviewSessionState:
    session_id: str
    candidate_name: str
    target_role: str
    interview_type: str  # technical, behavioral, system-design
    created_at: datetime = field(default_factory=datetime.utcnow)
    current_turn: int = 0
    max_questions: int = 5
    conversation_history: List[Dict[str, str]] = field(default_factory=list)
    scores: Dict[str, float] = field(default_factory=dict)
    is_completed: bool = False
    status: str = "in_progress"  # in_progress, completed, failed


class HireMindOrchestrator:
    """Master Orchestrator Agent responsible for managing interview sessions,

    routing turns, and coordinating specialized sub-agents.
    """

    def __init__(self, model: Optional[Any] = None):
        self.model = model if model is not None else get_orchestrator_model()
        self.sessions: Dict[str, InterviewSessionState] = {}
        self.sub_agents: Dict[str, Any] = {}
        self.root_agent: Optional[Any] = None

        self._initialize_adk_agent()

    def _initialize_adk_agent(self):
        """Initialize Google ADK Root Agent."""
        if not ADK_AVAILABLE:
            logger.warning("Google ADK Agent class not available. Running in mock orchestration mode.")
            return

        try:
            instruction = (
                "You are the HireMind Master Interview Orchestrator. "
                "Your role is to orchestrate structured, high-signal, fair mock interviews "
                "for job candidates. You coordinate with specialized sub-agents: "
                "1. Interviewer Agent: asking targeted questions based on the candidate's target role. "
                "2. Evaluator Agent: scoring each answer across technical knowledge, communication, and problem-solving. "
                "3. Feedback Agent: synthesizing performance and providing constructive growth feedback."
            )

            # Initialize Google ADK Agent
            self.root_agent = Agent(
                name="hiremind_orchestrator",
                model=self.model,
                description="Master Orchestrator Agent managing multi-agent interview sessions.",
                instruction=instruction,
                sub_agents=[]
            )
            model_repr = getattr(self.model, "model", str(self.model))
            logger.info(f"Google ADK Master Orchestrator initialized successfully with model '{model_repr}'.")
        except Exception as e:
            logger.error(f"Failed to instantiate Google ADK Agent: {e}")
            self.root_agent = None

    def register_sub_agent(self, agent_name: str, agent_instance: Any):
        """Register a specialized sub-agent (e.g., Interviewer, Evaluator, Feedback)

        with the orchestrator.
        """
        self.sub_agents[agent_name] = agent_instance
        logger.info(f"Sub-agent '{agent_name}' registered with Orchestrator.")

        # Update root ADK agent's sub_agents list if root_agent is active
        if self.root_agent and hasattr(self.root_agent, "sub_agents"):
            if agent_instance not in self.root_agent.sub_agents:
                self.root_agent.sub_agents.append(agent_instance)

    def start_session(
        self,
        session_id: str,
        candidate_name: str,
        target_role: str,
        interview_type: str = "technical",
        max_questions: int = 5
    ) -> Dict[str, Any]:
        """Start a new interview session."""
        session = InterviewSessionState(
            session_id=session_id,
            candidate_name=candidate_name,
            target_role=target_role,
            interview_type=interview_type,
            max_questions=max_questions
        )
        self.sessions[session_id] = session

        welcome_prompt = (
            f"Hello {candidate_name}! Welcome to your {interview_type.capitalize()} interview for the "
            f"{target_role} position. I am your AI Interview Orchestrator. When you are ready, "
            f"let's begin with your background and first question."
        )

        session.conversation_history.append({
            "speaker": "interviewer",
            "content": welcome_prompt,
            "timestamp": datetime.utcnow().isoformat()
        })

        return {
            "session_id": session_id,
            "status": "started",
            "orchestrator_status": "active",
            "adk_initialized": self.root_agent is not None,
            "message": welcome_prompt,
            "turn": 0,
            "total_questions": max_questions
        }

    def process_turn(self, session_id: str, candidate_answer: str) -> Dict[str, Any]:
        """Process a candidate turn in the interview workflow."""
        session = self.sessions.get(session_id)
        if not session:
            return {"error": f"Session '{session_id}' not found."}

        if session.is_completed:
            return {
                "session_id": session_id,
                "status": "completed",
                "message": "This interview session has already concluded."
            }

        session.current_turn += 1

        # Record candidate answer
        session.conversation_history.append({
            "speaker": "candidate",
            "content": candidate_answer,
            "timestamp": datetime.utcnow().isoformat()
        })

        # Check if interview question limit reached
        if session.current_turn >= session.max_questions:
            session.is_completed = True
            session.status = "completed"
            wrapup_msg = (
                f"Thank you, {session.candidate_name}. That concludes our questions for today! "
                "Our Feedback and Evaluation agents are now preparing your performance synthesis."
            )
            session.conversation_history.append({
                "speaker": "interviewer",
                "content": wrapup_msg,
                "timestamp": datetime.utcnow().isoformat()
            })
            return {
                "session_id": session_id,
                "status": "completed",
                "current_turn": session.current_turn,
                "max_questions": session.max_questions,
                "response": wrapup_msg,
                "is_completed": True
            }

        # If interviewer sub-agent is attached, delegate to it; otherwise orchestrator default
        if "interviewer" in self.sub_agents:
            interviewer = self.sub_agents["interviewer"]
            next_question = interviewer.generate_next_question(session, candidate_answer)
        else:
            # Orchestrator default question generation until Interviewer Sub-Agent is linked
            next_question = (
                f"[Question {session.current_turn + 1}/{session.max_questions}] "
                f"Can you explain a challenging scenario you faced while working in {session.target_role} "
                f"and how you resolved it?"
            )

        session.conversation_history.append({
            "speaker": "interviewer",
            "content": next_question,
            "timestamp": datetime.utcnow().isoformat()
        })

        return {
            "session_id": session_id,
            "status": "in_progress",
            "current_turn": session.current_turn,
            "max_questions": session.max_questions,
            "response": next_question,
            "is_completed": False
        }

    def get_session_status(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve the current state of a session."""
        session = self.sessions.get(session_id)
        if not session:
            return None
        return {
            "session_id": session.session_id,
            "candidate_name": session.candidate_name,
            "target_role": session.target_role,
            "interview_type": session.interview_type,
            "current_turn": session.current_turn,
            "max_questions": session.max_questions,
            "status": session.status,
            "is_completed": session.is_completed,
            "turns_count": len(session.conversation_history)
        }

    def get_health(self) -> Dict[str, Any]:
        """Return Orchestrator health and ADK readiness."""
        model_repr = getattr(self.model, "model", str(self.model))
        return {
            "service": "HireMind AI Orchestrator Layer",
            "google_adk_available": ADK_AVAILABLE,
            "orchestrator_agent_initialized": self.root_agent is not None,
            "provider": MODEL_PROVIDER,
            "model": model_repr,
            "aimodel": AI_MODEL,
            "openrouter_configured": is_openrouter_configured(),
            "openrouter_endpoint": OPENROUTER_BASE_URL if MODEL_PROVIDER == "openrouter" else None,
            "gemini_api_key_configured": is_gemini_configured(),
            "active_sessions_count": len(self.sessions),
            "registered_sub_agents": list(self.sub_agents.keys())
        }


# Singleton instance
orchestrator_instance = HireMindOrchestrator()

# Register specialized sub-agents
try:
    from agents.resume_analyzer import resume_analyzer_instance
    orchestrator_instance.register_sub_agent("resume_analyzer", resume_analyzer_instance)
except Exception as e:
    logger.warning(f"Could not auto-register resume_analyzer: {e}")

try:
    from agents.jd_analyzer import jd_analyzer_instance
    orchestrator_instance.register_sub_agent("jd_analyzer", jd_analyzer_instance)
except Exception as e:
    logger.warning(f"Could not auto-register jd_analyzer: {e}")
