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
