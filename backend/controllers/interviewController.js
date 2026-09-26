const InterviewSession = require('../models/InterviewSession');
const User = require('../models/User');
const { getPrivateResumeStream } = require('../services/cloudflareR2');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

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
      const userId = req.user?._id || req.body.userId;
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
          message: `AI Service Error (${aiRes.status}): ${parsedDetail}`,
          error: 'AI_SERVICE_ERROR',
        });
      }
    } catch (aiConnErr) {
      console.warn('[AI Service] Could not connect to Python AI Service:', aiConnErr.message);
      return res.status(503).json({
        success: false,
        message: `Python AI Service is offline (${aiConnErr.message}). Please start the Python service on port 8000: "cd ai-service; python main.py"`,
        error: 'AI_SERVICE_OFFLINE',
      });
    }

    const resumeAnalysis = aiResponseData?.analysis;
    const extractedText = aiResponseData?.raw_text_preview || '';

    if (!resumeAnalysis) {
      return res.status(502).json({
        success: false,
        message: 'Python AI Service responded but did not return structured resume analysis.',
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
        userId: req.user?._id || null,
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
    const updates = req.body;

    if (req.user?._id && !updates.userId) {
      updates.userId = req.user._id;
    }

    const session = await InterviewSession.findOneAndUpdate(
      { sessionId },
      { $set: updates },
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
        headers: {
          'Content-Type': 'application/json',
        },
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
          message: `AI Service Error (${aiRes.status}): ${parsedDetail}`,
          error: 'AI_SERVICE_ERROR',
        });
      }
    } catch (aiConnErr) {
      console.warn('[AI Service] Could not connect to Python AI Service:', aiConnErr.message);
      return res.status(503).json({
        success: false,
        message: `Python AI Service is offline (${aiConnErr.message}). Please ensure the AI service is running on port 8000.`,
        error: 'AI_SERVICE_OFFLINE',
      });
    }

    const jdAnalysis = aiResponseData?.analysis;
    if (!jdAnalysis) {
      return res.status(502).json({
        success: false,
        message: 'Python AI Service responded but did not return structured JD analysis.',
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

    const session = await InterviewSession.findOneAndDelete({ sessionId });

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
        headers: {
          'Content-Type': 'application/json',
        },
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
        message: 'Interview Planning Agent did not return a valid plan. Please ensure the AI service is active.',
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


