const InterviewSession = require('../models/InterviewSession');
const User = require('../models/User');
const { getPrivateResumeStream } = require('../services/cloudflareR2');
const speechToTextService = require('../services/speechToTextService');
const textToSpeechService = require('../services/textToSpeechService');
const interviewAgentService = require('../services/interviewAgentService');
const codeExecutionService = require('../services/codeExecutionService');

const { getAiServiceUrl, getAiServiceHeaders } = require('../config/aiServiceConfig');
const { recordCompletedDemoInterview } = require('../middleware/demoAccessMiddleware');

const AI_SERVICE_URL = getAiServiceUrl();

/**
 * Helper to convert a readable stream into a Buffer
 */
const streamToBuffer = async (readableStream) => {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readableStream.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    readableStream.on('end', () => resolve(Buffer.concat(chunks)));
    readableStream.on('error', reject);
  });
};

/**
 * Compute stage agenda coverage matrix (Feature 2B)
 */
const calculateAgendaCoverage = (stages = [], currentIdx = 0, currentHops = 0) => {
  if (!Array.isArray(stages) || stages.length === 0) return [];
  return stages.map((st, idx) => ({
    id: st.id || `stage_${idx}`,
    name: st.name || `Stage ${idx + 1}`,
    topics: Array.isArray(st.topics) ? st.topics : [],
    objectives: Array.isArray(st.objectives) ? st.objectives : [],
    status: idx < currentIdx ? 'completed' : (idx === currentIdx ? 'in_progress' : 'upcoming'),
    isCurrent: idx === currentIdx,
    isCompleted: idx < currentIdx,
    currentHops: idx === currentIdx ? Math.min(2, currentHops || 0) : (idx < currentIdx ? 2 : 0),
    maxHops: 2,
  }));
};

/**
 * Natural Conversational Filler / Acknowledgment Generator (Feature 2A)
 */
const getConversationalAcknowledgment = (action, turnIndex = 0, stageName = '', topicName = '', nextStageName = '') => {
  if (action === 'NEXT_STAGE') {
    const transitions = [
      `Great, that gives us a well-rounded picture of your experience with ${topicName || stageName || 'this area'}. Let's transition to our next competency: ${nextStageName || 'the next section'}. `,
      `Understood, thank you for detailing that experience. Moving forward, let's explore ${nextStageName || 'our next area'}. `,
      `Got it, that covers our key points for ${stageName || 'this topic'}. Now let's turn our attention to ${nextStageName || 'the next competency'}. `,
    ];
    return transitions[turnIndex % transitions.length];
  }

  const naturalFillers = [
    "Understood, that makes good sense. ",
    "Got it, thanks for explaining how you approached that. ",
    "Fair point, that's a sound technical consideration. ",
    "Thank you for detailing that experience. ",
    "I see where you're coming from on that. ",
    "That's a helpful perspective. ",
  ];
  return naturalFillers[turnIndex % naturalFillers.length];
};

/**
 * Detect candidate clarification / repeat intent (Feature 2A)
 */
const isCandidateClarificationRequest = (text) => {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();
  if (trimmed.length > 200) return false;
  const clarifyRegex = /\b(clarif(y|ication)|repeat|rephrase|didn't catch|did not catch|say that again|what do you mean|pardon|come again|what was the question|could you explain what you mean|say again|speak slower)\b/i;
  return clarifyRegex.test(trimmed);
};

/**
 * Analyze candidate resume via the Google ADK AI Service and persist in DB.
 * POST /api/interview/:sessionId/analyze-resume
 */
exports.analyzeResume = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { useProfileResume, candidateName } = req.body;

    let fileBuffer = null;
    let originalFilename = 'resume.pdf';
    let mimeType = 'application/pdf';

    // Case 1: User requested to use their existing profile resume from signup
    if (useProfileResume === 'true' || useProfileResume === true) {
      const userId = req.user?._id;
      if (!userId) {
        return res.status(400).json({ message: 'User context is required to use profile resume.' });
      }

      const user = await User.findById(userId);
      if (!user || (!user.resumeFileName && !user.resumeUrl)) {
        return res.status(404).json({ message: 'No profile resume found for this user account.' });
      }

      originalFilename = user.resumeFileName || 'profile-resume.pdf';

      // Attempt to retrieve resume stream from Cloudflare R2
      try {
        const resumeKey = user.resumeUrl.includes('/api/profile/resume/')
          ? `resumes/${user.resumeUrl.split('/api/profile/resume/')[1]}`
          : user.resumeFileName;

        const streamData = await getPrivateResumeStream(resumeKey);
        fileBuffer = await streamToBuffer(streamData.Body);
        mimeType = streamData.ContentType || 'application/pdf';
      } catch (storageErr) {
        console.warn('[Interview Controller] Could not fetch profile resume from cloud storage:', storageErr.message);
        // Fallback placeholder text if cloud stream not reachable in local dev
        fileBuffer = Buffer.from(
          `Candidate Profile: ${user.firstName} ${user.lastName}\nEmail: ${user.email}\nField: ${user.field || 'Software Engineering'}\nSkills: ${(user.skills || []).join(', ')}\nExperience: ${user.experienceLevel || 'Intermediate'}`
        );
        originalFilename = user.resumeFileName || `${user.firstName}_Resume.txt`;
      }
    } else if (req.file) {
      // Case 2: New file uploaded directly from the cockpit
      fileBuffer = req.file.buffer;
      originalFilename = req.file.originalname;
      mimeType = req.file.mimetype;
    } else if (req.body.resumeText) {
      // Case 3: Raw resume text passed directly
      fileBuffer = Buffer.from(req.body.resumeText);
      originalFilename = req.body.resumeFileName || 'resume.txt';
    } else {
      return res.status(400).json({ message: 'Please upload a resume file (.pdf, .docx) or select profile resume.' });
    }

    // Call the Python AI Service (Google ADK Resume Analyzer)
    let aiResponseData = null;
    try {
      const formData = new FormData();
      const fileBlob = new Blob([fileBuffer], { type: mimeType });
      formData.append('file', fileBlob, originalFilename);

      const aiRes = await fetch(`${AI_SERVICE_URL}/agents/resume-analyzer/analyze`, {
        method: 'POST',
        headers: getAiServiceHeaders(),
        body: formData,
        signal: AbortSignal.timeout(120000),
      });

      if (aiRes.ok) {
        aiResponseData = await aiRes.json();
      } else {
        const errText = await aiRes.text();
        let parsedDetail = errText;
        try {
          const jsonErr = JSON.parse(errText);
          parsedDetail = jsonErr.detail || jsonErr.message || errText;
        } catch (_) {}
        console.warn(`[AI Service] Resume analyzer error (${aiRes.status}):`, parsedDetail);
        return res.status(aiRes.status || 502).json({
          success: false,
          message: 'Unable to analyze resume. Please check the file format and try again.',
          error: 'AI_SERVICE_ERROR',
        });
      }
    } catch (aiConnErr) {
      console.warn('[AI Service] Could not connect to Python AI Service:', aiConnErr.message);
      return res.status(503).json({
        success: false,
        message: 'Resume analysis service is temporarily unavailable. Please try again shortly.',
        error: 'AI_SERVICE_OFFLINE',
      });
    }

    const resumeAnalysis = aiResponseData?.analysis;
    const extractedText = aiResponseData?.raw_text_preview || '';

    if (!resumeAnalysis) {
      return res.status(502).json({
        success: false,
        message: 'Unable to extract structured resume details. Please upload a clear PDF or DOCX file.',
        error: 'AI_EMPTY_RESPONSE',
      });
    }

    // Persist in chat-related database (InterviewSession)
    let session = await InterviewSession.findOne({ sessionId });
    if (!session) {
      session = new InterviewSession({
        sessionId,
        userId: req.user?._id || null,
      });
    }

    session.resumeFileName = originalFilename;
    session.resumeText = extractedText || originalFilename;
    session.resumeAnalysis = resumeAnalysis;
    session.status = 'ready';

    // Auto-populate targetRole if not already filled
    if (!session.targetRole && resumeAnalysis.detected_role) {
      session.targetRole = resumeAnalysis.detected_role;
    }

    await session.save();

    return res.status(200).json({
      success: true,
      sessionId,
      resumeFileName: originalFilename,
      resumeAnalysis,
      session,
    });
  } catch (error) {
    console.error('[Interview Controller] Error analyzing resume:', error);
    return res.status(500).json({ message: 'Failed to analyze resume', error: error.message });
  }
};

/**
 * Get interview session details and analysis from chat-related database
 * GET /api/interview/:sessionId
 */
exports.getSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    let session = await InterviewSession.findOne({ sessionId });

    if (!session) {
      // Create blank initial record if not yet existing
      session = await InterviewSession.create({
        sessionId,
        userId: req.user._id,
        status: 'setup',
      });
    }

    return res.status(200).json({
      success: true,
      session,
    });
  } catch (error) {
    console.error('[Interview Controller] Error fetching session:', error);
    return res.status(500).json({ message: 'Failed to fetch interview session', error: error.message });
  }
};

/**
 * Update interview session configuration
 * PUT /api/interview/:sessionId
 */
exports.updateSession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Only setup/configuration fields may be edited by the client.
    // Status, transcript, evaluation, ownership and quota flags are server-controlled.
    const EDITABLE_FIELDS = [
      'targetRole',
      'company',
      'jobDescription',
      'interviewType',
      'interviewMode',
      'difficulty',
      'duration',
      'isGithubConnected',
      'resumeAnalysis',
      'jdAnalysis',
    ];
    const updates = {};
    for (const field of EDITABLE_FIELDS) {
      if (req.body?.[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    // Support both interviewMode or interviewType carrying the mode
    if (updates.interviewType === 'HR_SIMULATION' || updates.interviewType === 'FEEDBACK_COACHING') {
      updates.interviewMode = updates.interviewType;
      updates.interviewType = 'Role-Specific';
    }

    if (updates.interviewMode) {
      if (!['HR_SIMULATION', 'FEEDBACK_COACHING'].includes(updates.interviewMode)) {
        updates.interviewMode = 'HR_SIMULATION';
      }
    }

    // Guardrail: do not allow changing interviewMode once interview is in progress or completed
    const existingSession = await InterviewSession.findOne({ sessionId });
    if (existingSession && ['in_progress', 'completed', 'ended_by_user'].includes(existingSession.status)) {
      delete updates.interviewMode;
    }

    const session = await InterviewSession.findOneAndUpdate(
      { sessionId },
      { $set: updates, $setOnInsert: { userId: req.user._id } },
      { new: true, upsert: true }
    );

    return res.status(200).json({
      success: true,
      session,
    });
  } catch (error) {
    console.error('[Interview Controller] Error updating session:', error);
    return res.status(500).json({ message: 'Failed to update interview session', error: error.message });
  }
};

/**
 * Get all interview sessions for current authenticated user with their real evaluation scores
 * GET /api/interview/my-sessions
 */
exports.getMySessions = async (req, res) => {
  try {
    const sessions = await InterviewSession.find({ userId: req.user._id })
      .sort({ updatedAt: -1 })
      .select('sessionId targetRole company interviewType difficulty duration status evaluation createdAt updatedAt')
      .lean();

    const formatted = sessions.map((s) => {
      const evalScore = s.evaluation?.overallScore ?? s.evaluation?.score ?? null;
      return {
        id: s.sessionId,
        sessionId: s.sessionId,
        title: s.targetRole || (s.company ? `${s.company} Interview` : 'New Interview'),
        targetRole: s.targetRole || '',
        company: s.company || '',
        track: s.interviewType ? `${s.interviewType} Interview` : 'Role-Specific Interview',
        interviewType: s.interviewType || 'Role-Specific',
        difficulty: s.difficulty || 'Intermediate',
        duration: s.duration || '30 min',
        status: s.status || 'setup',
        score: evalScore !== null ? `${evalScore}%` : null,
        overallScore: evalScore,
        evaluation: s.evaluation || null,
        lastVisitedPath: (s.status === 'completed' || s.status === 'ended_by_user')
          ? `/interview-report?id=${s.sessionId}`
          : `/new-interview/${s.sessionId}`,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      };
    });

    return res.status(200).json({
      success: true,
      sessions: formatted,
    });
  } catch (error) {
    console.error('[Interview Controller] Error fetching user sessions:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch interview sessions', error: error.message });
  }
};


/**
 * Analyze Job Description via Google ADK Job Description Analyzer Agent
 * POST /api/interview/:sessionId/analyze-jd
 */
exports.analyzeJobDescription = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { jobDescription, targetRole, company, resumeAnalysis } = req.body;

    if (!jobDescription || !jobDescription.trim()) {
      return res.status(400).json({ message: 'Job description text is required.' });
    }

    // Retrieve session to get existing resumeAnalysis if not passed in body
    let session = await InterviewSession.findOne({ sessionId });
    const resolvedResumeAnalysis = resumeAnalysis || session?.resumeAnalysis || null;
    const resolvedTargetRole = targetRole || session?.targetRole || '';
    const resolvedCompany = company || session?.company || '';

    let aiResponseData = null;
    try {
      const aiRes = await fetch(`${AI_SERVICE_URL}/agents/jd-analyzer/analyze`, {
        method: 'POST',
        headers: getAiServiceHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          job_description: jobDescription.trim(),
          job_title: resolvedTargetRole,
          company_name: resolvedCompany,
          resume_analysis: resolvedResumeAnalysis,
        }),
        signal: AbortSignal.timeout(120000),
      });

      if (aiRes.ok) {
        aiResponseData = await aiRes.json();
      } else {
        const errText = await aiRes.text();
        let parsedDetail = errText;
        try {
          const jsonErr = JSON.parse(errText);
          parsedDetail = jsonErr.detail || jsonErr.message || errText;
        } catch (_) {}
        console.warn(`[AI Service] JD analyzer error (${aiRes.status}):`, parsedDetail);
        return res.status(aiRes.status || 502).json({
          success: false,
          message: 'Unable to analyze job description. Please check the text and try again.',
          error: 'AI_SERVICE_ERROR',
        });
      }
    } catch (aiConnErr) {
      console.warn('[AI Service] Could not connect to Python AI Service:', aiConnErr.message);
      return res.status(503).json({
        success: false,
        message: 'Job analysis service is temporarily unavailable. Please try again shortly.',
        error: 'AI_SERVICE_OFFLINE',
      });
    }

    const jdAnalysis = aiResponseData?.analysis;
    if (!jdAnalysis) {
      return res.status(502).json({
        success: false,
        message: 'Unable to extract structured job requirements. Please try again.',
        error: 'AI_EMPTY_RESPONSE',
      });
    }

    // Persist in InterviewSession
    if (!session) {
      session = new InterviewSession({
        sessionId,
        userId: req.user?._id || null,
      });
    }

    session.jobDescription = jobDescription;
    session.jdAnalysis = jdAnalysis;
    if (resolvedTargetRole && !session.targetRole) session.targetRole = resolvedTargetRole;
    if (resolvedCompany && !session.company) session.company = resolvedCompany;

    await session.save();

    return res.status(200).json({
      success: true,
      sessionId,
      jdAnalysis,
      session,
    });
  } catch (error) {
    console.error('[Interview Controller] Error analyzing job description:', error);
    return res.status(500).json({ message: 'Failed to analyze job description', error: error.message });
  }
};

/**
 * Permanently delete an interview session and all related records from MongoDB
 * DELETE /api/interview/:sessionId
 */
exports.deleteSession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'Session ID is required.' });
    }

    const filter = req.user.role === 'admin' ? { sessionId } : { sessionId, userId: req.user._id };
    const session = await InterviewSession.findOneAndDelete(filter);

    return res.status(200).json({
      success: true,
      message: 'Interview session and all associated data deleted successfully.',
      deletedSessionId: sessionId,
      existed: Boolean(session),
    });
  } catch (error) {
    console.error('[Interview Controller] Error deleting session:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete interview session', error: error.message });
  }
};

/**
 * Generate a personalized interview plan using Google ADK Interview Planning Agent.
 * Retrieves existing CV & JD structured intelligence from MongoDB.
 * POST /api/interview/:sessionId/plan
 */
exports.generateInterviewPlan = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const {
      interviewMode,
      interviewType,
      difficulty,
      duration,
      targetRole,
      company,
      isGithubConnected,
    } = req.body;

    let session = await InterviewSession.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({ success: false, message: 'Interview session not found.' });
    }

    // Security: Validate ownership if session is bound to a registered user
    if (session.userId && req.user?._id && session.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized access to this interview session.' });
    }

    // Must have CV analysis in DB
    if (!session.resumeAnalysis) {
      return res.status(400).json({
        success: false,
        message: 'Resume analysis is required before generating an interview plan. Please upload or select a resume first.',
        error: 'RESUME_ANALYSIS_MISSING',
      });
    }

    let resolvedMode = interviewMode || session.interviewMode || 'HR_SIMULATION';
    if (interviewType === 'HR_SIMULATION' || interviewType === 'FEEDBACK_COACHING') {
      resolvedMode = interviewType;
    }
    if (!['HR_SIMULATION', 'FEEDBACK_COACHING'].includes(resolvedMode)) {
      resolvedMode = 'HR_SIMULATION';
    }

    // Parse duration in minutes (e.g. "15 min", "30 min", "60 min" -> 15, 30, 60)
    const rawDurationStr = duration || session.duration || '30 min';
    const parsedDuration = parseInt(String(rawDurationStr).replace(/\D/g, ''), 10) || 30;

    const resolvedRole = targetRole || session.targetRole || session.resumeAnalysis?.detected_role || 'Software Engineer';
    const resolvedCompany = company || session.company || session.jdAnalysis?.company_context?.company_name || '';
    const resolvedType = interviewType || session.interviewType || 'Role-Specific';
    const resolvedDifficulty = difficulty || session.difficulty || 'Intermediate';
    const resolvedGithubConnected = isGithubConnected !== undefined ? Boolean(isGithubConnected) : Boolean(session.isGithubConnected);

    // Build optional GitHub context from user profile if connected
    let githubContext = { available: false };
    if (resolvedGithubConnected && req.user?.github?.connected) {
      const userGithub = req.user.github;
      githubContext = {
        available: true,
        username: userGithub.username || '',
        publicReposCount: userGithub.publicRepos || userGithub.repos?.length || 0,
        repos: (userGithub.repos || []).slice(0, 5).map((r) => ({
          name: r.name,
          language: r.language,
          description: r.description,
          stars: r.stars,
        })),
      };
    }

    // Build structured planning context directly from MongoDB structured fields (NO re-analysis)
    const planningContext = {
      candidate: {
        candidateName: session.resumeAnalysis.candidate_name || req.user?.firstName || 'Candidate',
        candidateLevel: `${session.resumeAnalysis.years_of_experience || 1.0} years`,
        yearsOfExperience: session.resumeAnalysis.years_of_experience || 1.0,
        detectedRole: session.resumeAnalysis.detected_role || resolvedRole,
        isTechnicalRole: session.resumeAnalysis.is_technical_role ?? true,
        skills: session.resumeAnalysis.skills || {},
        technologies: session.resumeAnalysis.skills?.frameworks_and_tools || [],
        projects: session.resumeAnalysis.projects || [],
        experience: session.resumeAnalysis.work_experience || [],
        education: session.resumeAnalysis.education || [],
        strengths: session.resumeAnalysis.strengths || [],
        suggestedInterviewFocus: session.resumeAnalysis.suggested_interview_focus || [],
      },
      targetJob: {
        role: resolvedRole,
        company: resolvedCompany,
        requiredSkills: session.jdAnalysis?.requirements?.required_skills || [],
        preferredSkills: session.jdAnalysis?.requirements?.preferred_skills || [],
        responsibilities: session.jdAnalysis?.key_responsibilities || [],
        technologies: session.jdAnalysis?.requirements?.tools_and_technologies || [],
        experienceLevel: session.jdAnalysis?.role_understanding?.seniority_level || 'Mid-Level',
        competencies: session.jdAnalysis?.competencies || [],
        importantAreas: session.jdAnalysis?.important_interview_areas || [],
        candidateAlignment: session.jdAnalysis?.candidate_alignment || null,
      },
      interviewConfiguration: {
        type: resolvedType,
        difficulty: resolvedDifficulty,
        durationMinutes: parsedDuration,
      },
      github: githubContext,
    };

    // Call the Python AI Service (Google ADK Interview Planner Agent)
    let aiResponseData = null;
    try {
      const aiRes = await fetch(`${AI_SERVICE_URL}/agents/interview-planner/plan`, {
        method: 'POST',
        headers: getAiServiceHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(planningContext),
        signal: AbortSignal.timeout(120000),
      });

      if (aiRes.ok) {
        aiResponseData = await aiRes.json();
      } else {
        const errText = await aiRes.text();
        console.warn(`[AI Service] Interview planner error (${aiRes.status}):`, errText);
      }
    } catch (aiConnErr) {
      console.warn('[AI Service] Could not connect to Python AI Service for planning:', aiConnErr.message);
    }

    const internalPlan = aiResponseData?.plan;
    if (!internalPlan) {
      return res.status(502).json({
        success: false,
        message: 'Unable to generate interview plan at this time. Please try again shortly.',
        error: 'PLANNING_FAILED',
      });
    }

    // Build the sanitized, user-facing interview plan (strip out hidden intents, rubrics, scoring criteria)
    const userFacingPlan = {
      role: internalPlan.role,
      company: internalPlan.company,
      interviewType: internalPlan.interviewType,
      difficulty: internalPlan.difficulty,
      duration: `${internalPlan.durationMinutes} minutes`,
      durationMinutes: internalPlan.durationMinutes,
      estimatedQuestionCount: internalPlan.estimatedQuestionCount,
      objectives: internalPlan.objectives || [],
      stages: (internalPlan.stages || []).map((s) => ({
        name: s.name,
        duration: `${s.durationMinutes} minutes`,
        durationMinutes: s.durationMinutes,
        topics: s.topics || [],
      })),
    };

    // Save plan to MongoDB
    session.interviewPlan = internalPlan;
    session.userFacingPlan = userFacingPlan;
    session.targetRole = resolvedRole;
    session.company = resolvedCompany;
    session.interviewType = resolvedType;
    session.interviewMode = resolvedMode;
    session.difficulty = resolvedDifficulty;
    session.duration = `${parsedDuration} min`;
    session.isGithubConnected = resolvedGithubConnected;
    session.status = 'planned';

    await session.save();

    return res.status(200).json({
      success: true,
      sessionId,
      plan: userFacingPlan,
      internalPlan,
      session,
    });
  } catch (error) {
    console.error('[Interview Controller] Error generating interview plan:', error);
    return res.status(500).json({ success: false, message: 'Failed to generate interview plan', error: error.message });
  }
};

/**
 * Handle live interview chat communication between candidate and AI.
 * Persists messages in MongoDB InterviewSession.
 * POST /api/interview/:sessionId/chat
 */
exports.sendChatMessage = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message content cannot be empty.' });
    }

    let session = await InterviewSession.findOne({ sessionId });
    if (!session) {
      session = new InterviewSession({
        sessionId,
        userId: req.user?._id || null,
        status: 'in_progress',
      });
    }

    const candidateMsg = {
      role: 'candidate',
      content: message.trim(),
      timestamp: new Date(),
    };
    session.chatMessages.push(candidateMsg);

    const candidateTurnCount = session.chatMessages.filter((m) => m.role === 'candidate').length;
    const stages = session.userFacingPlan?.stages || session.interviewPlan?.stages || [];
    const currentStage = stages[Math.min(candidateTurnCount - 1, Math.max(0, stages.length - 1))] || null;
    const candidateName = req.user?.firstName || session.resumeAnalysis?.candidate_name || 'Candidate';
    const role = session.targetRole || 'Software Engineer';
    const company = session.company || 'our engineering team';

    let aiReplyText = '';

    // Attempt AI response generation via OpenRouter
    if (process.env.OPENROUTER_API_KEY) {
      try {
        const stageInfo = currentStage
          ? `Current Stage: ${currentStage.name || currentStage.title}. Topics: ${(currentStage.topics || []).join(', ')}.`
          : '';
        const systemPrompt = `You are the HireMind AI Technical Interviewer conducting an interactive mock interview for candidate ${candidateName} for the ${role} position at ${company}.
${stageInfo}
Difficulty: ${session.difficulty || 'Intermediate'}. Interview Type: ${session.interviewType || 'Role-Specific'}.
Keep responses professional, concise (2-4 sentences max), constructive, and ask the next question that evaluates candidate readiness.`;

        const recentHistory = session.chatMessages.slice(-6).map((m) => ({
          role: m.role === 'candidate' ? 'user' : 'assistant',
          content: m.content,
        }));

        const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          },
          body: JSON.stringify({
            model: process.env.AI_MODEL || 'google/gemini-2.5-flash',
            messages: [{ role: 'system', content: systemPrompt }, ...recentHistory],
            max_tokens: 350,
            temperature: 0.7,
          }),
          signal: AbortSignal.timeout(15000),
        });

        if (aiRes.ok) {
          const aiJson = await aiRes.json();
          aiReplyText = aiJson.choices?.[0]?.message?.content?.trim();
        }
      } catch (llmErr) {
        console.warn('[Interview Controller] OpenRouter live chat note:', llmErr.message);
      }
    }

    // Dynamic contextual fallback if OpenRouter is unreachable or offline
    if (!aiReplyText) {
      const topics = currentStage?.topics?.length
        ? currentStage.topics
        : ['architecture and design patterns', 'state management and concurrency', 'database indexing and performance', 'error handling and resilience'];
      const topic = topics[(candidateTurnCount - 1) % topics.length];

      // Neutral follow-ups only: without the model we cannot judge the answer, so no praise or assessment.
      const dynamicPrompts = [
        `Thank you, ${candidateName}. Let's look at ${topic}: how would you handle high concurrency and prevent race conditions in this scenario?`,
        `Noted. For the ${role} position at ${company}, regarding ${topic}, what metrics or observability signals would you track to detect bottlenecks before users are impacted?`,
        `Thank you. Moving on to ${topic}: could you walk me through a trade-off you made between development velocity and system maintainability?`,
        `Understood. To wrap up this section of our ${session.interviewType || 'technical'} interview, how would you design unit and integration tests to validate the edge cases of your solution?`,
      ];

      aiReplyText = dynamicPrompts[(candidateTurnCount - 1) % dynamicPrompts.length];
    }

    const aiMsg = {
      role: 'interviewer',
      content: aiReplyText,
      timestamp: new Date(),
    };
    session.chatMessages.push(aiMsg);
    session.status = 'in_progress';

    await session.save();

    return res.status(200).json({
      success: true,
      candidateMessage: candidateMsg,
      aiMessage: aiMsg,
      chatMessages: session.chatMessages,
    });
  } catch (error) {
    console.error('[Interview Controller] Error sending chat message:', error);
    return res.status(500).json({ success: false, message: 'Failed to process chat message', error: error.message });
  }
};

/**
 * Begin Live Adaptive Interview.
 * Idempotently starts or resumes the live session, loads stored plan,
 * generates the ONE dynamic opening question, and initializes state.
 * POST /api/interview/:sessionId/begin
 */
exports.beginLiveInterview = async (req, res) => {
  try {
    const { sessionId } = req.params;

    let session = await InterviewSession.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({ success: false, message: 'Interview session not found.' });
    }

    if (session.userId && req.user?._id && session.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized access to this session.' });
    }

    if (!session.interviewPlan) {
      return res.status(400).json({
        success: false,
        message: 'No interview plan found for this session. Please generate an interview plan first.',
        error: 'PLAN_MISSING',
      });
    }

    // Parse duration (default 30 min)
    const rawDurationStr = session.duration || session.interviewPlan.durationMinutes || '30 min';
    const parsedDuration = parseInt(String(rawDurationStr).replace(/\D/g, ''), 10) || 30;

    // Initialize interviewState if not present
    if (!session.interviewState) {
      session.interviewState = {};
    }

    const firstStage = (session.interviewPlan.stages && session.interviewPlan.stages[0]) || {
      id: 'stage_intro',
      name: 'Introduction & Background',
      topics: ['Background', 'Motivation'],
    };

    // If session was ended previously, prevent resurrecting/restarting
    if (session.status === 'ended_by_user' || session.status === 'completed') {
      return res.status(400).json({
        success: false,
        isComplete: true,
        message: 'This interview session has already concluded and cannot be restarted.',
      });
    }

    if (req.user?._id && !session.userId) {
      session.userId = req.user._id;
    }

    // If session already started and has an opening question in chatMessages, return it (resume friendly)
    const existingInterviewerMessages = (session.chatMessages || []).filter((m) => m.role === 'interviewer');
    if (session.interviewState.startedAt && existingInterviewerMessages.length > 0 && session.status === 'in_progress' && session.interviewState.questionsAsked > 0) {
      const lastQ = existingInterviewerMessages[existingInterviewerMessages.length - 1].content;
      let resumedAudioUrl = null;
      const isVoiceMode = req.body?.mode === 'voice' || req.query?.mode === 'voice' || req.body?.includeAudio;
      if (isVoiceMode && lastQ) {
        try {
          const speechRes = await textToSpeechService.generateSpeech({ text: lastQ });
          if (speechRes.success) {
            resumedAudioUrl = speechRes.audioUrl;
          }
        } catch (e) {
          console.warn('[Interview Controller] Error synthesizing speech for resumed session:', e);
        }
      }
      return res.status(200).json({
        success: true,
        resumed: true,
        question: lastQ,
        audioUrl: resumedAudioUrl,
        stage: session.interviewState.currentStageName || firstStage.name,
        interviewState: session.interviewState,
        chatMessages: session.chatMessages,
      });
    }

    // Set starting state with authoritative timing
    const startedAt = new Date();
    session.interviewState.startedAt = startedAt;
    session.interviewState.targetDurationMinutes = parsedDuration;
    session.interviewState.absoluteMaximumMinutes = parsedDuration + 10;
    session.interviewState.elapsedMinutes = 0;
    session.interviewState.elapsedSeconds = 0;
    session.interviewState.remainingTargetMinutes = parsedDuration;
    session.interviewState.remainingTargetSeconds = parsedDuration * 60;
    session.interviewState.progressPercentage = 0;
    session.interviewState.timingPhase = 'EARLY_PHASE';
    session.interviewState.status = 'in_progress';
    session.interviewState.currentStageIndex = 0;
    session.interviewState.currentStageId = firstStage.id || 'stage_intro';
    session.interviewState.currentStageName = firstStage.name || 'Introduction & Background';
    session.interviewState.currentTopic = (firstStage.topics && firstStage.topics[0]) || 'Background';
    session.interviewState.questionsAsked = 0;
    session.interviewState.stageQuestionsAsked = 0;
    session.interviewState.followUpDepth = 0;
    session.interviewState.coveredTopics = [];
    session.interviewState.coveredObjectives = [];
    session.interviewState.isProcessing = false;

    const requestedInterviewMode = req.body?.interviewMode || req.query?.interviewMode;
    if (requestedInterviewMode) {
      session.interviewMode = requestedInterviewMode;
      session.interviewState.interviewMode = requestedInterviewMode;
    }
    session.status = 'in_progress';

    // Prepare payload for AI service
    const beginPayload = {
      candidate: {
        candidateName: session.resumeAnalysis?.candidate_name || req.user?.firstName || 'Candidate',
        detectedRole: session.resumeAnalysis?.detected_role || session.targetRole || 'Professional',
        skills: session.resumeAnalysis?.skills || {},
        projects: (session.resumeAnalysis?.projects || []).slice(0, 3),
        experience: (session.resumeAnalysis?.work_experience || []).slice(0, 2),
      },
      targetJob: {
        role: session.targetRole || session.interviewPlan?.role || 'Professional',
        company: session.company || session.interviewPlan?.company || '',
      },
      interviewConfiguration: {
        type: session.interviewType || session.interviewPlan?.interviewType || 'Role-Specific',
        mode: session.interviewMode || session.interviewPlan?.interviewMode || 'HR_SIMULATION',
        difficulty: session.difficulty || session.interviewPlan?.difficulty || 'Intermediate',
        durationMinutes: parsedDuration,
      },
      plan: session.interviewPlan,
    };

    let openingQuestion = '';
    let stageId = firstStage.id || 'stage_intro';
    let stageName = firstStage.name || 'Introduction & Background';
    let topic = (firstStage.topics && firstStage.topics[0]) || 'Background';

    try {
      const aiRes = await fetch(`${AI_SERVICE_URL}/agents/interview-agent/begin`, {
        method: 'POST',
        headers: getAiServiceHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(beginPayload),
        signal: AbortSignal.timeout(45000),
      });

      if (aiRes.ok) {
        const aiData = await aiRes.json();
        openingQuestion = aiData.question;
        if (aiData.stageId) stageId = aiData.stageId;
        if (aiData.stageName) stageName = aiData.stageName;
        if (aiData.topic) topic = aiData.topic;
      } else {
        console.warn(`[Interview Controller] AI Service opening question error (${aiRes.status})`);
      }
    } catch (aiErr) {
      console.warn('[Interview Controller] Could not reach AI service for opening question:', aiErr.message);
    }

    // Contextual fallback if AI service was unreachable
    if (!openingQuestion) {
      const candidateName = session.resumeAnalysis?.candidate_name || req.user?.firstName || 'Candidate';
      const role = session.targetRole || 'Candidate Role';
      const company = session.company || 'our company';
      openingQuestion = `Hello ${candidateName}, welcome to your ${session.interviewType || 'technical'} interview for the ${role} position at ${company}. To kick off our first section, ${stageName}, could you walk me through your background and the experiences that best highlight your qualifications for this position?`;
    }

    // Generate audio if voice mode is requested
    let audioUrl = null;
    const isVoiceMode = req.body?.mode === 'voice' || req.query?.mode === 'voice' || req.body?.includeAudio;
    if (isVoiceMode && openingQuestion) {
      const speechRes = await textToSpeechService.generateSpeech({ text: openingQuestion });
      if (speechRes.success) {
        audioUrl = speechRes.audioUrl;
      }
    }

    // Save opening question in chatMessages (keep audioUrl empty in DB to avoid MongoDB 16MB document limit)
    const interviewerMsg = {
      role: 'interviewer',
      content: openingQuestion,
      audioUrl: '',
      metrics: { stageId, stageName, topic, action: 'START_INTERVIEW' },
      timestamp: new Date(),
    };
    session.chatMessages = [interviewerMsg];

    session.interviewState.currentStageId = stageId;
    session.interviewState.currentStageName = stageName;
    session.interviewState.currentTopic = topic;
    session.interviewState.questionsAsked = 1;
    session.interviewState.stageQuestionsAsked = 1;
    session.interviewState.currentStageHops = 0;
    session.interviewState.maxHopsPerStage = 2;
    session.interviewState.lastQuestion = openingQuestion;
    session.interviewState.lastAction = 'START_INTERVIEW';
    session.interviewState.lastReasonCode = 'RELEVANT_DEPTH';
    const planStages = session.interviewPlan?.stages || [];
    session.interviewState.agendaCoverage = calculateAgendaCoverage(planStages, 0, 0);

    await session.save();

    // Consume one demo pass when the interview starts (idempotent per session),
    // so abandoned interviews cannot be restarted indefinitely without using quota.
    const demoAccessUpdate = await recordCompletedDemoInterview(session);

    return res.status(200).json({
      success: true,
      resumed: false,
      demoAccess: demoAccessUpdate,
      question: openingQuestion,
      audioUrl: audioUrl || null,
      stage: stageName,
      interviewState: session.interviewState,
      chatMessages: session.chatMessages,
    });
  } catch (error) {
    console.error('[Interview Controller] Error beginning live interview:', error);
    return res.status(500).json({ success: false, message: 'Failed to begin live interview', error: error.message });
  }
};

/**
 * Submit candidate answer in live interview.
 * Evaluates answer, calculates authoritative timing (+10 min buffer),
 * decides next action (FOLLOW_UP, CLARIFY, NEXT_TOPIC, NEXT_STAGE, END_INTERVIEW),
 * and returns the ONE next question.
 * POST /api/interview/:sessionId/answer
 */
exports.submitLiveAnswer = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { answer, inputMode = 'text', durationSeconds, sttLatencyMs, mode } = req.body;

    if (!answer || !answer.trim()) {
      return res.status(400).json({ success: false, message: 'Answer content cannot be empty.' });
    }

    let session = await InterviewSession.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({ success: false, message: 'Interview session not found.' });
    }

    if (session.userId && req.user?._id && session.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized access to this session.' });
    }

    // Check if interview already concluded
    if (session.status === 'completed' || session.status === 'ended_by_user') {
      return res.status(400).json({
        success: false,
        message: 'This interview has already concluded. No further answers can be submitted.',
        isComplete: true,
      });
    }

    // Duplicate submission protection
    if (session.interviewState?.isProcessing) {
      return res.status(409).json({
        success: false,
        message: 'Your previous answer is currently being processed. Please wait a moment.',
        error: 'DUPLICATE_SUBMISSION',
      });
    }

    // Check if last message was candidate or if this exact answer was just submitted
    const candidateMessages = (session.chatMessages || []).filter((m) => m.role === 'candidate');
    const lastCandidateMsg = candidateMessages[candidateMessages.length - 1];
    if (lastCandidateMsg && lastCandidateMsg.content === answer.trim()) {
      return res.status(409).json({
        success: false,
        message: 'This answer has already been submitted.',
        error: 'DUPLICATE_SUBMISSION',
      });
    }

    // Lock session processing
    if (!session.interviewState) session.interviewState = {};
    session.interviewState.isProcessing = true;

    // Authoritative Backend Interview Clock
    const startedAtMs = session.interviewState.startedAt
      ? new Date(session.interviewState.startedAt).getTime()
      : Date.now();
    const nowMs = Date.now();
    const elapsedSeconds = Math.max(0, Math.floor((nowMs - startedAtMs) / 1000));
    const elapsedMinutes = parseFloat((elapsedSeconds / 60).toFixed(1));
    const targetDuration = session.interviewState.targetDurationMinutes || 30;
    const absoluteMax = session.interviewState.absoluteMaximumMinutes || (targetDuration + 10);
    const remainingTargetSeconds = Math.max(0, targetDuration * 60 - elapsedSeconds);
    const remainingTargetMinutes = parseFloat((remainingTargetSeconds / 60).toFixed(1));
    const progressRatio = targetDuration > 0 ? (elapsedMinutes / targetDuration) : 0;
    const progressPercentage = Math.min(100, Math.round(progressRatio * 100));

    // Determine Pacing Phase based on percentage of TARGET duration
    let timingPhase = 'EARLY_PHASE';
    if (progressRatio < 0.25) {
      timingPhase = 'EARLY_PHASE';
    } else if (progressRatio < 0.70) {
      timingPhase = 'CORE_PHASE';
    } else if (progressRatio < 0.90) {
      timingPhase = 'DEEPENING_PHASE';
    } else if (progressRatio <= 1.00) {
      timingPhase = 'CLOSING_PREPARATION';
    } else {
      timingPhase = 'EXTENSION_PHASE';
    }

    session.interviewState.elapsedMinutes = elapsedMinutes;
    session.interviewState.elapsedSeconds = elapsedSeconds;
    session.interviewState.remainingTargetMinutes = remainingTargetMinutes;
    session.interviewState.remainingTargetSeconds = remainingTargetSeconds;
    session.interviewState.progressPercentage = progressPercentage;
    session.interviewState.timingPhase = timingPhase;

    // Identify question being answered from dialogue history
    const previousInterviewerMsg = (session.chatMessages || [])
      .filter((m) => m.role === 'interviewer')
      .slice(-1)[0];
    const questionBeingAnswered =
      previousInterviewerMsg?.content || session.interviewState?.lastQuestion || 'Interview Question';

    // Save candidate answer
    const candidateMsg = {
      role: 'candidate',
      content: answer.trim(),
      metrics: {
        inputMode: inputMode || (mode === 'voice' ? 'voice' : 'text'),
        answerDurationSeconds: durationSeconds || null,
        sttLatencyMs: sttLatencyMs || null,
      },
      timestamp: new Date(),
    };
    session.chatMessages.push(candidateMsg);
    await session.save();

    // Candidate Clarification / Repeat Handling (Feature 2A)
    const isClarify = isCandidateClarificationRequest(answer);
    if (isClarify) {
      const candidateName = session.resumeAnalysis?.candidate_name || req.user?.firstName || 'there';
      const clarifyPrefixes = [
        `Certainly, ${candidateName}! To clarify: `,
        `Of course, let me repeat that with more context: `,
        `Happy to clarify, ${candidateName}. Here is what I mean: `,
      ];
      const clarifyPrefix = clarifyPrefixes[(session.interviewState.questionsAsked || 0) % clarifyPrefixes.length];
      const clarifyQuestion = `${clarifyPrefix}${questionBeingAnswered}`;

      const clarifyAction = 'CLARIFY';
      const clarifyReason = 'CANDIDATE_CLARIFICATION';

      session.interviewState.lastQuestion = clarifyQuestion;
      session.interviewState.lastAction = clarifyAction;
      session.interviewState.lastReasonCode = clarifyReason;
      session.interviewState.isProcessing = false;

      // Do NOT increment stage questions or hops for a clarification request
      let audioUrl = null;
      const isVoiceMode = mode === 'voice' || inputMode === 'voice' || req.body?.includeAudio;
      if (isVoiceMode && clarifyQuestion) {
        const speechRes = await textToSpeechService.generateSpeech({ text: clarifyQuestion });
        if (speechRes.success) {
          audioUrl = speechRes.audioUrl;
        }
      }

      const interviewerMsg = {
        role: 'interviewer',
        content: clarifyQuestion,
        audioUrl: '',
        metrics: {
          stageId: session.interviewState.currentStageId,
          stageName: session.interviewState.currentStageName,
          topic: session.interviewState.currentTopic,
          action: clarifyAction,
          reasonCode: clarifyReason,
        },
        timestamp: new Date(),
      };
      session.chatMessages.push(interviewerMsg);

      const planStages = session.interviewPlan?.stages || [];
      session.interviewState.agendaCoverage = calculateAgendaCoverage(
        planStages,
        session.interviewState.currentStageIndex || 0,
        session.interviewState.currentStageHops || 0
      );

      await session.save();

      return res.status(200).json({
        success: true,
        feedback: null,
        questionBeingAnswered,
        candidateAnswer: answer.trim(),
        nextQuestion: clarifyQuestion,
        question: clarifyQuestion,
        audioUrl: audioUrl || null,
        action: clarifyAction,
        reasonCode: clarifyReason,
        stage: session.interviewState.currentStageName,
        topic: session.interviewState.currentTopic,
        isComplete: false,
        interviewState: session.interviewState,
        chatMessages: session.chatMessages,
        interviewMode: session.interviewMode || 'HR_SIMULATION',
      });
    }

    // Prepare payload for AI Service with authoritative timing
    const stages = session.interviewPlan?.stages || [];
    const currStageIdx = session.interviewState.currentStageIndex || 0;
    const currStage = stages[currStageIdx] || stages[0] || {};

    const turnPayload = {
      candidate: {
        candidateName: session.resumeAnalysis?.candidate_name || req.user?.firstName || 'Candidate',
        detectedRole: session.resumeAnalysis?.detected_role || session.targetRole || 'Professional',
        skills: session.resumeAnalysis?.skills || {},
        projects: (session.resumeAnalysis?.projects || []).slice(0, 3),
        experience: (session.resumeAnalysis?.work_experience || []).slice(0, 2),
      },
      targetJob: {
        role: session.targetRole || session.interviewPlan?.role || 'Professional',
        company: session.company || session.interviewPlan?.company || '',
      },
      interviewConfiguration: {
        type: session.interviewType || session.interviewPlan?.interviewType || 'Role-Specific',
        difficulty: session.difficulty || session.interviewPlan?.difficulty || 'Intermediate',
        durationMinutes: targetDuration,
      },
      plan: session.interviewPlan || {},
      timing: {
        targetDurationMinutes: targetDuration,
        elapsedMinutes,
        elapsedSeconds,
        remainingTargetMinutes,
        remainingTargetSeconds,
        extensionAllowedMinutes: 10,
        absoluteMaximumMinutes: absoluteMax,
        progressPercentage,
        timingPhase,
      },
      state: {
        currentStageIndex: currStageIdx,
        currentStageId: session.interviewState.currentStageId || currStage.id || 'stage_intro',
        currentStageName: session.interviewState.currentStageName || currStage.name || 'Current Stage',
        currentTopic: session.interviewState.currentTopic || (currStage.topics && currStage.topics[0]) || 'General',
        questionsAsked: session.interviewState.questionsAsked || 1,
        stageQuestionsAsked: session.interviewState.stageQuestionsAsked || 1,
        followUpDepth: session.interviewState.followUpDepth || 0,
        coveredTopics: session.interviewState.coveredTopics || [],
        coveredObjectives: session.interviewState.coveredObjectives || [],
      },
      conversationHistory: session.chatMessages.slice(-12).map((m) => ({
        role: m.role,
        content: m.content,
      })),
      latestAnswer: answer.trim(),
    };

    let aiResult = null;
    try {
      const aiRes = await fetch(`${AI_SERVICE_URL}/agents/interview-agent/next`, {
        method: 'POST',
        headers: getAiServiceHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(turnPayload),
        signal: AbortSignal.timeout(50000),
      });

      if (aiRes.ok) {
        aiResult = await aiRes.json();
      } else {
        console.warn(`[Interview Controller] AI agent turn error HTTP ${aiRes.status}`);
      }
    } catch (aiErr) {
      console.warn('[Interview Controller] Could not connect to AI service for turn:', aiErr.message);
    }

    // Resilient fallback if AI service was offline or failed
    if (!aiResult || !aiResult.question) {
      const isTimeUp = elapsedMinutes >= absoluteMax;
      if (isTimeUp) {
        aiResult = {
          action: 'END_INTERVIEW',
          reasonCode: 'TIME_PROGRESS',
          question: `Thank you for your time today. We have reached the time limit for this interview session. We have captured all your responses and will now proceed to complete the session. Have a great day!`,
          stageId: currStage.id,
          stageName: currStage.name,
          topic: session.interviewState.currentTopic,
          isComplete: true,
        };
      } else {
        const topicLabel = session.interviewState.currentTopic || currStage.name || 'this area';
        aiResult = {
          action: 'FOLLOW_UP',
          reasonCode: 'RELEVANT_DEPTH',
          question: `Thank you for sharing your experience with ${topicLabel}. Could you elaborate on how you handled any edge cases or unexpected constraints in that scenario?`,
          stageId: currStage.id,
          stageName: currStage.name,
          topic: session.interviewState.currentTopic,
          isComplete: false,
        };
      }
    }

    // Apply state transitions
    let action = aiResult.action || 'FOLLOW_UP';
    let reasonCode = aiResult.reasonCode || 'RELEVANT_DEPTH';
    let nextQuestion = (aiResult.question || '').trim();

    // 1. Authoritative Absolute Maximum Duration Check (+10 min buffer)
    const isAbsoluteMaxReached = elapsedMinutes >= absoluteMax;
    if (isAbsoluteMaxReached) {
      console.log(`[DURATION_PACING] Absolute maximum duration reached (${elapsedMinutes}m >= ${absoluteMax}m). Concluding session.`);
      action = 'END_INTERVIEW';
      reasonCode = 'TIME_PROGRESS';
    }

    // 2. Early Completion Guardrail:
    // Selected duration is a TARGET experience, not merely a ceiling to exit as soon as topics were visited once.
    // An interview must NOT conclude early if substantial target time remains (less than 85% elapsed).
    const isPrematureEnd = (action === 'END_INTERVIEW' || aiResult.isComplete) &&
      progressRatio < 0.85 &&
      !isAbsoluteMaxReached &&
      session.status !== 'ended_by_user';

    if (isPrematureEnd) {
      console.log(`[EARLY_COMPLETION_PREVENTED] Agent attempted END_INTERVIEW prematurely at ${elapsedMinutes}m / ${targetDuration}m (${progressPercentage}%). Continuing with interview depth.`);
      action = 'DEEPEN';
      reasonCode = 'RELEVANT_DEPTH';
      aiResult.isComplete = false;

      // If the question was a closing statement, replace with an authentic deepening question
      const lowerQ = nextQuestion.toLowerCase();
      if (
        lowerQ.includes('thank you for your time') ||
        lowerQ.includes('reached the conclusion') ||
        lowerQ.includes('do you have any questions for me') ||
        lowerQ.includes('wrap up') ||
        lowerQ.includes('conclude our interview')
      ) {
        const topic = session.interviewState.currentTopic || 'system architecture';
        const role = session.targetRole || 'Software Engineer';
        const deepeningPool = [
          `We still have good time to explore your experience for the ${role} position. Regarding ${topic}, what alternative architectures or technical trade-offs did you evaluate, and why did you settle on your final choice?`,
          `Building on your approach to ${topic}, if you were to scale this solution to handle 10x higher throughput or zero-downtime deployments, what bottlenecks would you anticipate and how would you resolve them?`,
          `Could you walk me through a complex edge case, failure mode, or debugging challenge you personally encountered while working with ${topic}?`,
          `From a code maintainability and team velocity standpoint, how did you design testing, monitoring, or observability around ${topic}?`
        ];
        nextQuestion = deepeningPool[(session.interviewState.questionsAsked || 0) % deepeningPool.length];
      }
    }

    const isComplete = Boolean(action === 'END_INTERVIEW' || isAbsoluteMaxReached);

    // Update covered topics
    if (session.interviewState.currentTopic && !session.interviewState.coveredTopics.includes(session.interviewState.currentTopic)) {
      if (action === 'NEXT_TOPIC' || action === 'NEXT_STAGE' || action === 'END_INTERVIEW') {
        session.interviewState.coveredTopics.push(session.interviewState.currentTopic);
      }
    }

    // Deterministic Stage Transition & Follow-Up Hops Guardrail (Feature 2B):
    // Max 2 follow-up hops per core stage/competency.
    const stageQuestionTarget = Math.max(1, currStage.targetQuestionCount || 2);
    const questionsInCurrentStage = (session.interviewState.stageQuestionsAsked || 0) + 1;
    const currentHops = (session.interviewState.currentStageHops || 0) + 1;
    session.interviewState.currentStageHops = currentHops;

    const shouldAdvanceStage =
      action === 'NEXT_STAGE' ||
      questionsInCurrentStage >= stageQuestionTarget ||
      currentHops >= 2 ||
      (session.interviewState.followUpDepth || 0) >= 2;

    if (shouldAdvanceStage && currStageIdx + 1 < stages.length && action !== 'END_INTERVIEW') {
      action = 'NEXT_STAGE';
      reasonCode = 'STAGE_COMPLETE';
    }

    // Advance Stage or Topic with Pacing-aware redistribution
    if (action === 'FOLLOW_UP' || action === 'CLARIFY' || action === 'DEEPEN') {
      session.interviewState.followUpDepth = (session.interviewState.followUpDepth || 0) + 1;
    } else if (action === 'NEXT_TOPIC') {
      session.interviewState.followUpDepth = 0;
      session.interviewState.currentStageHops = 0;
      if (aiResult.topic) session.interviewState.currentTopic = aiResult.topic;
    } else if (action === 'NEXT_STAGE') {
      session.interviewState.followUpDepth = 0;
      session.interviewState.currentStageHops = 0;
      session.interviewState.stageQuestionsAsked = 0;
      const nextIdx = currStageIdx + 1;

      if (nextIdx < stages.length) {
        // Prevent premature transition into closing stage if significant target time remains (<85%)
        const isNextClosing = nextIdx === stages.length - 1 &&
          ((stages[nextIdx].name || '').toLowerCase().includes('closing') ||
           (stages[nextIdx].name || '').toLowerCase().includes('wrap') ||
           (stages[nextIdx].name || '').toLowerCase().includes('q&a'));

        if (isNextClosing && progressRatio < 0.85) {
          console.log(`[PACING] Holding back closing stage transition (${progressPercentage}% of target ${targetDuration}m elapsed). Deepening current stage.`);
          const topics = currStage.topics || [];
          if (topics.length > 1) {
            const currTopIdx = topics.indexOf(session.interviewState.currentTopic);
            session.interviewState.currentTopic = topics[(currTopIdx + 1) % topics.length];
          }
        } else {
          session.interviewState.currentStageIndex = nextIdx;
          session.interviewState.currentStageId = stages[nextIdx].id;
          session.interviewState.currentStageName = stages[nextIdx].name;
          session.interviewState.currentTopic = (stages[nextIdx].topics && stages[nextIdx].topics[0]) || 'General';
        }
      } else {
        // All planned stages visited, but significant target time remains.
        // Redistribute available time to deepen technical trade-offs, scenarios, and JD requirements.
        console.log(`[PACING] All stages visited but ${remainingTargetMinutes}m remaining. Redistributing time to deepen interview.`);
        session.interviewState.followUpDepth = 0;
        session.interviewState.currentStageHops = 0;
        const topics = currStage.topics || [];
        if (topics.length > 0) {
          session.interviewState.currentTopic = topics[(session.interviewState.questionsAsked || 0) % topics.length];
        }
      }
    }

    session.interviewState.questionsAsked = (session.interviewState.questionsAsked || 0) + 1;
    session.interviewState.stageQuestionsAsked = (session.interviewState.stageQuestionsAsked || 0) + 1;

    // Conversational Acknowledgments & Natural Fillers (Feature 2A)
    const hasExistingGreeting = /^(understood|got it|fair point|thank you|thanks|i see|great|excellent|that makes sense|certainly|of course)/i.test(nextQuestion);
    if (!hasExistingGreeting && action !== 'END_INTERVIEW' && !isComplete) {
      const nextStageName = stages[session.interviewState.currentStageIndex]?.name || 'the next section';
      const ackPrefix = getConversationalAcknowledgment(
        action,
        session.interviewState.questionsAsked || 0,
        currStage.name || session.interviewState.currentStageName,
        session.interviewState.currentTopic,
        nextStageName
      );
      nextQuestion = `${ackPrefix}${nextQuestion}`;
    }

    session.interviewState.lastQuestion = nextQuestion;
    session.interviewState.lastAction = action;
    session.interviewState.lastReasonCode = reasonCode;
    session.interviewState.isProcessing = false;

    // Update Stage Agenda Coverage Matrix (Feature 2B)
    session.interviewState.agendaCoverage = calculateAgendaCoverage(
      stages,
      session.interviewState.currentStageIndex || 0,
      session.interviewState.currentStageHops || 0
    );

    // Handle completion
    let demoAccessUpdate = null;
    if (isComplete) {
      session.status = 'completed';
      session.interviewState.status = 'completed';
      session.interviewState.endedAt = new Date();
      demoAccessUpdate = await recordCompletedDemoInterview(session);
    }

    // Generate audio if voice mode is active
    let audioUrl = null;
    const isVoiceMode = mode === 'voice' || inputMode === 'voice' || req.body?.includeAudio;
    if (isVoiceMode && nextQuestion) {
      const speechRes = await textToSpeechService.generateSpeech({ text: nextQuestion });
      if (speechRes.success) {
        audioUrl = speechRes.audioUrl;
      }
    }

    // Single Answer Feedback Evaluation for Feedback Interview Mode
    let feedbackData = null;
    if (session.interviewMode === 'FEEDBACK_COACHING') {
      try {
        const evalRes = await fetch(`${AI_SERVICE_URL}/agents/evaluation-agent/evaluate-answer`, {
          method: 'POST',
          headers: getAiServiceHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            question: questionBeingAnswered,
            answer: answer.trim(),
            targetRole: session.targetRole || session.interviewPlan?.role || 'Software Engineer',
            company: session.company || '',
            stageName: session.interviewState.currentStageName || currStage.name || 'Technical Stage',
            topic: session.interviewState.currentTopic || 'Core Competency',
            candidateSkills: (session.resumeAnalysis?.skills?.technical || session.resumeAnalysis?.skills || []),
          }),
          signal: AbortSignal.timeout(45000),
        });

        if (evalRes.ok) {
          const evalJson = await evalRes.json();
          feedbackData = evalJson.feedback || null;
        } else {
          console.warn(`[Interview Controller] AI feedback evaluation status HTTP ${evalRes.status}`);
        }
      } catch (evalErr) {
        console.warn('[Interview Controller] Single answer evaluation request note:', evalErr.message);
      }

      // Contextual fallback so candidate is never left without coaching
      if (!feedbackData) {
        const words = answer.trim().split(/\s+/).length;
        const fallbackScore = Math.min(88, Math.max(60, 65 + Math.min(words / 4, 20)));
        feedbackData = {
          overallScore: Math.round(fallbackScore),
          answerEvaluation: {
            relevance: `Directly engages with ${session.interviewState.currentTopic || 'the question topic'}.`,
            relevanceScore: Math.round(fallbackScore),
            technicalAccuracy: 'Demonstrates working foundational technical knowledge.',
            technicalAccuracyScore: Math.round(fallbackScore - 2),
            clarityAndOrganization: 'Logically organized response.',
            clarityScore: Math.round(fallbackScore),
            completeness: 'Addresses the core prompt. Articulating trade-offs and edge cases would increase depth.',
            completenessScore: Math.round(fallbackScore - 3),
            supportingExamples: 'References practical candidate experience.',
            communicationEffectiveness: 'Professional, articulate delivery.',
          },
          strengths: [
            `Addressed the core intent regarding ${session.interviewState.currentTopic || 'the technical topic'}.`,
            'Maintained clear, professional communication.',
          ],
          areasForImprovement: [
            'Could state explicit trade-offs (e.g. latency, memory, consistency, or scale).',
            'Include quantifiable metrics or production impact.',
          ],
          actionableSuggestions: [
            'Structure technical responses using the STAR method (Situation, Task, Action, Result).',
            'Highlight production edge cases and validation strategies.',
          ],
          improvedAnswerGuidance: {
            structure: '1. Context & Objective -> 2. Architecture & Patterns -> 3. Trade-off Analysis -> 4. Measurable Result',
            exampleAnswer: `When approaching ${session.interviewState.currentTopic || 'this challenge'}, I assess requirements, choose a pattern balancing simplicity and scale, and validate edge cases with automated testing.`,
          },
        };
      }

      // Attach feedback to the saved candidate message
      const savedCandidateMsg = session.chatMessages[session.chatMessages.length - 1];
      if (savedCandidateMsg && savedCandidateMsg.role === 'candidate') {
        savedCandidateMsg.feedback = feedbackData;
        if (!savedCandidateMsg.metrics) savedCandidateMsg.metrics = {};
        savedCandidateMsg.metrics.feedback = feedbackData;
      }

      if (!session.perAnswerFeedbacks) session.perAnswerFeedbacks = [];
      session.perAnswerFeedbacks.push({
        turnIndex: session.interviewState.questionsAsked || 1,
        question: questionBeingAnswered,
        answer: answer.trim(),
        feedback: feedbackData,
        timestamp: new Date(),
      });
    }

    // Append interviewer's next question (or closing statement) to chatMessages (omit base64 from DB)
    const interviewerMsg = {
      role: 'interviewer',
      content: nextQuestion,
      audioUrl: '',
      metrics: {
        stageId: session.interviewState.currentStageId,
        stageName: session.interviewState.currentStageName,
        topic: session.interviewState.currentTopic,
        action,
        reasonCode,
      },
      timestamp: new Date(),
    };
    session.chatMessages.push(interviewerMsg);

    await session.save();

    console.log(`[VOICE_TURN_COMPLETED] sessionId=${sessionId}, turn=${session.interviewState.questionsAsked}, mode=${inputMode || mode || 'text'}, interviewMode=${session.interviewMode || 'HR_SIMULATION'}`);

    return res.status(200).json({
      success: true,
      feedback: session.interviewMode === 'FEEDBACK_COACHING' ? feedbackData : null,
      questionBeingAnswered,
      candidateAnswer: answer.trim(),
      nextQuestion,
      question: nextQuestion,
      audioUrl: audioUrl || null,
      action,
      reasonCode,
      stage: session.interviewState.currentStageName,
      topic: session.interviewState.currentTopic,
      isComplete,
      demoAccess: demoAccessUpdate,
      interviewState: session.interviewState,
      chatMessages: session.chatMessages,
      interviewMode: session.interviewMode || 'HR_SIMULATION',
    });
  } catch (error) {
    console.error('[Interview Controller] Error submitting live answer:', error);
    // Ensure lock is released on unexpected failure
    try {
      await InterviewSession.updateOne({ sessionId: req.params.sessionId }, { $set: { 'interviewState.isProcessing': false } });
    } catch (_) {}
    return res.status(500).json({ success: false, message: 'Failed to process interview answer', error: error.message });
  }
};

/**
 * Retry answer evaluation for the most recent candidate turn in Feedback Interview Mode.
 * POST /api/interview/:sessionId/retry-answer-evaluation
 */
exports.retryAnswerEvaluation = async (req, res) => {
  try {
    const { sessionId } = req.params;
    let session = await InterviewSession.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({ success: false, message: 'Interview session not found.' });
    }
    if (session.userId && req.user?._id && session.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized access to this session.' });
    }

    const candidateMsgs = (session.chatMessages || []).filter((m) => m.role === 'candidate');
    if (candidateMsgs.length === 0) {
      return res.status(400).json({ success: false, message: 'No candidate answer found to evaluate.' });
    }
    const lastCandidateMsg = candidateMsgs[candidateMsgs.length - 1];

    // Find question asked immediately before this candidate answer
    const candIdx = session.chatMessages.indexOf(lastCandidateMsg);
    let questionText = 'Interview Question';
    for (let i = candIdx - 1; i >= 0; i--) {
      if (session.chatMessages[i].role === 'interviewer') {
        questionText = session.chatMessages[i].content;
        break;
      }
    }

    let feedback = null;
    try {
      const evalRes = await fetch(`${AI_SERVICE_URL}/agents/evaluation-agent/evaluate-answer`, {
        method: 'POST',
        headers: getAiServiceHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          question: questionText,
          answer: lastCandidateMsg.content,
          targetRole: session.targetRole || session.interviewPlan?.role || 'Software Engineer',
          company: session.company || '',
          stageName: session.interviewState?.currentStageName || 'Technical Stage',
          topic: session.interviewState?.currentTopic || 'Core Concept',
          candidateSkills: session.resumeAnalysis?.skills?.technical || session.resumeAnalysis?.skills || [],
        }),
        signal: AbortSignal.timeout(45000),
      });

      if (evalRes.ok) {
        const evalJson = await evalRes.json();
        feedback = evalJson.feedback || null;
      }
    } catch (err) {
      console.warn('[Retry Answer Eval] AI service error:', err.message);
    }

    if (!feedback) {
      const words = lastCandidateMsg.content.trim().split(/\s+/).length;
      const fallbackScore = Math.min(88, Math.max(60, 65 + Math.min(words / 4, 20)));
      feedback = {
        overallScore: Math.round(fallbackScore),
        answerEvaluation: {
          relevance: `Directly engages with ${session.interviewState?.currentTopic || 'the question topic'}.`,
          relevanceScore: Math.round(fallbackScore),
          technicalAccuracy: 'Demonstrates working foundational technical knowledge.',
          technicalAccuracyScore: Math.round(fallbackScore - 2),
          clarityAndOrganization: 'Logically organized response.',
          clarityScore: Math.round(fallbackScore),
          completeness: 'Addresses the core prompt. Articulating trade-offs and edge cases would increase depth.',
          completenessScore: Math.round(fallbackScore - 3),
          supportingExamples: 'References practical candidate experience.',
          communicationEffectiveness: 'Professional, articulate delivery.',
        },
        strengths: [
          `Addressed the core intent regarding ${session.interviewState?.currentTopic || 'the technical topic'}.`,
          'Maintained clear, professional communication.',
        ],
        areasForImprovement: [
          'Could state explicit trade-offs (e.g. latency, memory, consistency, or scale).',
          'Include quantifiable metrics or production impact.',
        ],
        actionableSuggestions: [
          'Structure technical responses using the STAR method (Situation, Task, Action, Result).',
          'Highlight production edge cases and validation strategies.',
        ],
        improvedAnswerGuidance: {
          structure: '1. Context & Objective -> 2. Architecture & Patterns -> 3. Trade-off Analysis -> 4. Measurable Result',
          exampleAnswer: `When approaching ${session.interviewState?.currentTopic || 'this challenge'}, I assess requirements, choose a pattern balancing simplicity and scale, and validate edge cases with automated testing.`,
        },
      };
    }

    lastCandidateMsg.feedback = feedback;
    if (!lastCandidateMsg.metrics) lastCandidateMsg.metrics = {};
    lastCandidateMsg.metrics.feedback = feedback;

    if (!session.perAnswerFeedbacks) session.perAnswerFeedbacks = [];
    session.perAnswerFeedbacks.push({
      turnIndex: session.interviewState?.questionsAsked || 1,
      question: questionText,
      answer: lastCandidateMsg.content,
      feedback,
      timestamp: new Date(),
    });

    await session.save();

    return res.status(200).json({
      success: true,
      feedback,
      questionBeingAnswered: questionText,
      candidateAnswer: lastCandidateMsg.content,
    });
  } catch (err) {
    console.error('[Retry Answer Eval] Error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retry answer evaluation', error: err.message });
  }
};

/**
 * Manually end the live interview.
 * Preserves transcript and state, marking status as 'ended_by_user'.
 * POST /api/interview/:sessionId/end
 */
exports.manualEndLiveInterview = async (req, res) => {
  try {
    const { sessionId } = req.params;

    let session = null;
    if (sessionId && sessionId !== 'default' && sessionId !== 'latest') {
      session = await InterviewSession.findOne({ sessionId });
    }
    if (!session) {
      session = await InterviewSession.findOne({ userId: req.user._id }).sort({ updatedAt: -1 });
    }
    if (!session) {
      return res.status(404).json({ success: false, message: 'Interview session not found.' });
    }

    session.status = 'ended_by_user';
    if (!session.interviewState) session.interviewState = {};
    session.interviewState.status = 'ended_by_user';
    session.interviewState.isEndedByUser = true;
    session.interviewState.endedAt = new Date();
    session.interviewState.isProcessing = false;

    // Calculate elapsed minutes and seconds for pro-rata evaluation
    if (session.interviewState.startedAt) {
      const startedAtMs = new Date(session.interviewState.startedAt).getTime();
      const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000));
      session.interviewState.elapsedSeconds = elapsedSeconds;
      session.interviewState.elapsedMinutes = parseFloat((elapsedSeconds / 60).toFixed(1));
    } else if (req.body?.elapsedMinutes) {
      session.interviewState.elapsedMinutes = parseFloat(req.body.elapsedMinutes) || 0;
      session.interviewState.elapsedSeconds = parseInt(req.body.elapsedSeconds, 10) || Math.round((session.interviewState.elapsedMinutes || 0) * 60);
    }

    // Reset stale cached evaluation so fresh evaluation is generated on report page
    session.evaluation = null;

    // Append a closing notice if interview wasn't already closed
    const lastMsg = session.chatMessages?.[session.chatMessages.length - 1];
    if (!lastMsg || lastMsg.role !== 'system') {
      session.chatMessages.push({
        role: 'system',
        content: 'The interview was concluded by the candidate.',
        timestamp: new Date(),
      });
    }

    await session.save();
    const demoAccessUpdate = await recordCompletedDemoInterview(session);

    return res.status(200).json({
      success: true,
      status: 'ended_by_user',
      isComplete: true,
      sessionId: session.sessionId,
      demoAccess: demoAccessUpdate,
      message: 'Interview concluded successfully.',
      interviewState: session.interviewState,
      chatMessages: session.chatMessages,
    });
  } catch (error) {
    console.error('[Interview Controller] Error ending interview:', error);
    return res.status(500).json({ success: false, message: 'Failed to end interview', error: error.message });
  }
};

/**
 * Get or trigger Interview Evaluation via the AI Evaluation Agent.
 * Synthesizes dynamic scores, breakdown, communication analysis,
 * strengths, improvements, and recommendations.
 * GET /api/interview/:sessionId/evaluation
 * POST /api/interview/:sessionId/evaluate
 */
exports.getOrGenerateEvaluation = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const forceRefresh = req.query.force === 'true' || req.body?.force === true;

    let session = null;
    if (sessionId && sessionId !== 'latest' && sessionId !== 'recent' && sessionId !== 'default') {
      session = await InterviewSession.findOne({ sessionId });
    }
    if (!session) {
      session = await InterviewSession.findOne({ userId: req.user._id }).sort({ updatedAt: -1 });
    }
    if (!session) {
      return res.status(404).json({ success: false, message: 'Interview session not found.' });
    }

    const candidateName = session.resumeAnalysis?.candidate_name || req.user?.firstName || 'Candidate';
    const targetRole = session.targetRole || session.resumeAnalysis?.detected_role || 'Software Engineer';
    const company = session.company || 'Engineering Team';

    // If already evaluated and not forced, return cached evaluation
    if (session.evaluation && !forceRefresh) {
      return res.status(200).json({
        success: true,
        evaluation: session.evaluation,
        session: {
          sessionId: session.sessionId,
          targetRole,
          company,
          candidateName,
          interviewType: session.interviewType || 'Role-Specific',
          interviewMode: session.interviewMode || 'HR_SIMULATION',
          difficulty: session.difficulty || 'Intermediate',
          duration: session.duration || '30 min',
          status: session.status,
          createdAt: session.createdAt,
        },
        chatMessages: session.chatMessages || [],
      });
    }

    // Call Python AI Service's evaluation agent
    let evaluationData = null;
    try {
      const payload = {
        session_id: session.sessionId,
        sessionId: session.sessionId,
        target_role: targetRole,
        targetRole,
        targetJob: {
          role: targetRole,
          company,
        },
        company,
        interview_type: session.interviewType || 'Role-Specific',
        interviewType: session.interviewType || 'Role-Specific',
        interviewConfiguration: {
          jobRole: targetRole,
          company,
          interviewType: session.interviewType || 'Role-Specific',
          experienceLevel: session.difficulty || 'Intermediate',
          durationMinutes: parseInt(String(session.duration || '30').replace(/\D/g, ''), 10) || 30,
        },
        difficulty: session.difficulty || 'Intermediate',
        duration: parseInt(String(session.duration || '30').replace(/\D/g, ''), 10) || 30,
        isEndedByUser: session.status === 'ended_by_user' || session.interviewState?.isEndedByUser === true,
        cv_analysis: session.resumeAnalysis,
        candidate: session.resumeAnalysis,
        jd_analysis: session.jdAnalysis,
        interview_plan: session.interviewPlan,
        chat_messages: session.chatMessages || [],
        chatMessages: session.chatMessages || [],
        interview_state: session.interviewState || {},
        interviewState: session.interviewState || {},
      };

      const aiRes = await fetch(`${AI_SERVICE_URL}/agents/evaluation-agent/evaluate`, {
        method: 'POST',
        headers: getAiServiceHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(90000),
      });

      if (aiRes.ok) {
        const json = await aiRes.json();
        evaluationData = json.evaluation;
      } else {
        const errText = await aiRes.text();
        console.warn(`[AI Service] Evaluation Agent error (${aiRes.status}):`, errText);
      }
    } catch (aiErr) {
      console.warn('[AI Service] Could not connect to Python Evaluation Agent:', aiErr.message);
    }

    // No genuine evaluation -> tell the client honestly instead of inventing scores.
    // Nothing is cached, so the report page can simply retry later.
    if (!evaluationData) {
      return res.status(503).json({
        success: false,
        error: 'EVALUATION_UNAVAILABLE',
        retryable: true,
        message: 'Your interview report could not be generated right now because the AI evaluator is unavailable. Your transcript is saved — please try again in a few minutes.',
        session: {
          sessionId: session.sessionId,
          targetRole,
          company,
          candidateName,
          status: session.status,
          createdAt: session.createdAt,
        },
      });
    }

    // Persist evaluation
    session.evaluation = evaluationData;
    await session.save();
    const demoAccessUpdate = await recordCompletedDemoInterview(session);

    return res.status(200).json({
      success: true,
      evaluation: session.evaluation,
      demoAccess: demoAccessUpdate,
      session: {
        sessionId: session.sessionId,
        targetRole,
        company,
        candidateName,
        interviewType: session.interviewType || 'Role-Specific',
        interviewMode: session.interviewMode || 'HR_SIMULATION',
        difficulty: session.difficulty || 'Intermediate',
        duration: session.duration || '30 min',
        status: session.status,
        createdAt: session.createdAt,
      },
      chatMessages: session.chatMessages || [],
    });
  } catch (error) {
    console.error('[Interview Controller] Error evaluating session:', error);
    return res.status(500).json({ success: false, message: 'Failed to evaluate interview session', error: error.message });
  }
};

/**
 * Transcribe candidate voice recording using Whisper Large V3 Turbo.
 * POST /api/interview/:sessionId/voice/transcribe
 */
exports.transcribeCandidateVoice = async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        success: false,
        error: 'EMPTY_AUDIO',
        message: 'No audio file was received. Please record your answer and try again.',
      });
    }

    const session = await InterviewSession.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({ success: false, message: 'Interview session not found.' });
    }

    if (session.userId && req.user?._id && session.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized access to this session.' });
    }

    if (session.status === 'completed' || session.status === 'ended_by_user') {
      return res.status(400).json({
        success: false,
        message: 'This interview has already concluded.',
        isComplete: true,
      });
    }

    const result = await speechToTextService.transcribeAudio({
      audioBuffer: req.file.buffer,
      filename: req.file.originalname || 'candidate_answer.webm',
      mimetype: req.file.mimetype || 'audio/webm',
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error || 'STT_FAILED',
        message: result.message || "We couldn't clearly capture that answer. Please try again.",
        latencyMs: result.latencyMs,
      });
    }

    return res.status(200).json({
      success: true,
      text: result.text,
      language: result.language,
      duration: result.duration,
      latencyMs: result.latencyMs,
    });
  } catch (error) {
    console.error('[Interview Controller] [ERROR] Voice transcription error:', error);
    return res.status(500).json({
      success: false,
      error: 'AUDIO_UPLOAD_FAILED',
      message: 'Failed to transcribe audio. You can retry recording or type your answer instead.',
      detail: error.message,
    });
  }
};

/**
 * Synthesize interviewer speech using Gemini 3.8 Flash-Lite TTS.
 * POST /api/interview/:sessionId/voice/speech
 */
exports.synthesizeInterviewerSpeech = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { text, voice } = req.body;

    const session = await InterviewSession.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({ success: false, message: 'Interview session not found.' });
    }

    const cleanText = (text || session.interviewState?.lastQuestion || '').trim();
    if (!cleanText) {
      return res.status(400).json({ success: false, message: 'No question text provided to speak.' });
    }

    const result = await textToSpeechService.generateSpeech({ text: cleanText, voice });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error || 'TTS_FAILED',
        message: result.message || 'Audio synthesis failed. Text question can be used.',
      });
    }

    return res.status(200).json({
      success: true,
      audioUrl: result.audioUrl,
      voice: result.voice,
      model: result.model,
      cached: result.cached,
      latencyMs: result.latencyMs,
    });
  } catch (error) {
    console.error('[Interview Controller] [ERROR] Speech synthesis error:', error);
    return res.status(500).json({
      success: false,
      error: 'TTS_FAILED',
      message: 'Failed to synthesize speech.',
      detail: error.message,
    });
  }
};

/**
 * Execute candidate code in sandbox via Judge0
 * POST /api/interview/:sessionId/code/run
 */
exports.runCode = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { code, language, stdin } = req.body;

    const session = await InterviewSession.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({ success: false, message: 'Interview session not found.' });
    }

    if (!code || !code.trim()) {
      return res.status(400).json({ success: false, message: 'No code provided to execute.' });
    }

    const result = await codeExecutionService.executeCode({
      code,
      language: language || 'javascript',
      stdin: stdin || '',
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error('[Interview Controller] Error running code:', error);
    return res.status(500).json({ success: false, message: 'Code execution failed', error: error.message });
  }
};

/**
 * Submit candidate code solution to AI interviewer for evaluation & next question
 * POST /api/interview/:sessionId/code/submit
 */
exports.submitCodeSolution = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { code, language, explanation, runOutput, durationSeconds } = req.body;

    const session = await InterviewSession.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({ success: false, message: 'Interview session not found.' });
    }

    if (!code || !code.trim()) {
      return res.status(400).json({ success: false, message: 'Code solution is required.' });
    }

    const cleanExplanation = (explanation || '').trim();
    const candidateContent = cleanExplanation
      ? `[Code Submission in ${language || 'code'}]:\n${cleanExplanation}\n\`\`\`${language || 'text'}\n${code}\n\`\`\``
      : `[Code Submission in ${language || 'code'}]:\n\`\`\`${language || 'text'}\n${code}\n\`\`\``;

    const candidateMsg = {
      role: 'candidate',
      content: candidateContent,
      codeSubmission: {
        code,
        language: language || 'javascript',
        runOutput: runOutput || '',
      },
      metrics: {
        stageId: session.interviewState?.currentStageId,
        stageName: session.interviewState?.currentStageName,
        inputMode: 'code',
        durationSeconds: durationSeconds || 0,
      },
      timestamp: new Date(),
    };
    session.chatMessages.push(candidateMsg);

    const stages = session.interviewPlan?.stages || [];
    const currStageIdx = session.interviewState.currentStageIndex || 0;
    const currStage = stages[currStageIdx] || {};
    const nextIdx = Math.min(currStageIdx + 1, stages.length - 1);
    const nextStage = stages[nextIdx] || currStage;

    const promptSummary = `The candidate has submitted a code solution in ${language || 'code'} for the coding challenge.
Candidate code:
\`\`\`${language || 'text'}
${code.slice(0, 1500)}
\`\`\`
Execution Output: ${runOutput || 'Code executed successfully.'}
Candidate's explanation: ${cleanExplanation || 'Candidate implemented the solution directly.'}

Evaluate their solution concisely (1-2 sentences): acknowledge correctness, highlight the time & space complexity (Big-O), and note any edge-case considerations. Then smoothly transition to our next section: ${nextStage.name || 'the next phase'} by asking the first question for that section.`;

    let aiReviewText = '';
    let isAiReviewed = false;
    try {
      const reviewRes = await fetch(`${AI_SERVICE_URL}/agents/code-review/review`, {
        method: 'POST',
        headers: getAiServiceHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          code,
          language: language || '',
          runOutput: runOutput || '',
          explanation: cleanExplanation,
          nextStageName: nextStage.name || '',
          nextStageTopics: Array.isArray(nextStage.topics) ? nextStage.topics : [],
        }),
        signal: AbortSignal.timeout(45000),
      });
      if (reviewRes.ok) {
        const data = await reviewRes.json();
        aiReviewText = (data.review || '').trim();
        isAiReviewed = Boolean(aiReviewText);
      } else {
        console.warn(`[Interview Controller] Code review unavailable (HTTP ${reviewRes.status})`);
      }
    } catch (err) {
      console.warn('[Interview Controller] Code review request failed:', err.message);
    }

    if (!aiReviewText) {
      // Honest fallback: acknowledge the submission without claiming anything about its
      // correctness or complexity, and move on with a question from the next stage's plan.
      const nextTopic = (Array.isArray(nextStage.topics) && nextStage.topics[0]) || '';
      const nextName = nextStage.name || 'the next section';
      aiReviewText = `Thank you, I've saved your solution. I couldn't review it automatically just now, so it will be assessed in your final report. Let's move on to ${nextName}.${
        nextTopic ? ` Could you walk me through your experience with ${nextTopic}?` : ' Could you tell me how you would approach the problems in this area?'
      }`;
    }

    // Advance to next stage
    session.interviewState.currentStageIndex = nextIdx;
    session.interviewState.currentStageId = nextStage.id || 'stage_next';
    session.interviewState.currentStageName = nextStage.name || 'Next Stage';
    session.interviewState.currentTopic = (nextStage.topics && nextStage.topics[0]) || 'General';
    session.interviewState.stageQuestionsAsked = 0;
    session.interviewState.followUpDepth = 0;
    session.interviewState.currentStageHops = 0;
    session.interviewState.questionsAsked = (session.interviewState.questionsAsked || 0) + 1;
    session.interviewState.lastQuestion = aiReviewText;
    session.interviewState.lastAction = 'NEXT_STAGE';
    session.interviewState.lastReasonCode = 'STAGE_COMPLETE';
    session.interviewState.agendaCoverage = calculateAgendaCoverage(stages, nextIdx, 0);

    // Generate interviewer voice if requested
    let audioUrl = null;
    if (req.body?.mode === 'voice' || req.query?.mode === 'voice' || req.body?.includeAudio) {
      const speechRes = await textToSpeechService.generateSpeech({ text: aiReviewText });
      if (speechRes.success) {
        audioUrl = speechRes.audioUrl;
      }
    }

    const interviewerMsg = {
      role: 'interviewer',
      content: aiReviewText,
      audioUrl: '', // Base64 stripped to avoid 16MB MongoDB limit
      metrics: {
        stageId: nextStage.id,
        stageName: nextStage.name,
        action: 'NEXT_STAGE',
        reasonCode: isAiReviewed ? 'CODE_REVIEWED' : 'CODE_REVIEW_UNAVAILABLE',
      },
      timestamp: new Date(),
    };
    session.chatMessages.push(interviewerMsg);

    await session.save();

    return res.status(200).json({
      success: true,
      nextQuestion: aiReviewText,
      question: aiReviewText,
      audioUrl: audioUrl || null,
      aiReview: aiReviewText,
      stage: nextStage.name,
      interviewState: session.interviewState,
      chatMessages: session.chatMessages,
    });
  } catch (error) {
    console.error('[Interview Controller] Error submitting code solution:', error);
    return res.status(500).json({ success: false, message: 'Failed to process code submission', error: error.message });
  }
};





