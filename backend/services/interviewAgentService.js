/**
 * Interview Agent Service
 * Interacts with the AI Service Interview Agent (BRAIN).
 * Owns interview reasoning, question selection, and stage/topic progression.
 */

const { getAiServiceUrl } = require('../config/aiServiceConfig');
const AI_SERVICE_URL = getAiServiceUrl();

class InterviewAgentService {
  /**
   * Generates opening interview question based on candidate, JD, and plan.
   * @param {Object} payload
   * @returns {Promise<Object>}
   */
  async generateOpeningQuestion(payload) {
    const startTime = Date.now();
    console.log('[INTERVIEW_AGENT_STARTED] Action: START_INTERVIEW');

    try {
      const response = await fetch(`${AI_SERVICE_URL}/agents/interview-agent/begin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(50000),
      });

      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        console.warn(`[InterviewAgentService] [ERROR] Opening question returned HTTP ${response.status}`);
        return null;
      }

      const result = await response.json();
      console.log(`[INTERVIEW_AGENT_COMPLETED] Opening question generated in ${latencyMs}ms`);
      return { ...result, latencyMs };
    } catch (err) {
      console.warn('[InterviewAgentService] [ERROR] Opening question request failed:', err.message);
      return null;
    }
  }

  /**
   * Processes candidate answer and generates adaptive next question.
   * @param {Object} turnPayload
   * @returns {Promise<Object>}
   */
  async processTurn(turnPayload) {
    const startTime = Date.now();
    console.log('[INTERVIEW_AGENT_STARTED] Processing candidate turn');

    try {
      const response = await fetch(`${AI_SERVICE_URL}/agents/interview-agent/next`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(turnPayload),
        signal: AbortSignal.timeout(50000),
      });

      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        console.warn(`[InterviewAgentService] [ERROR] Turn evaluation returned HTTP ${response.status}`);
        return null;
      }

      const result = await response.json();
      console.log(`[INTERVIEW_AGENT_COMPLETED] Turn action=${result.action}, latency=${latencyMs}ms`);
      return { ...result, latencyMs };
    } catch (err) {
      console.warn('[InterviewAgentService] [ERROR] Turn evaluation request failed:', err.message);
      return null;
    }
  }
}

module.exports = new InterviewAgentService();
