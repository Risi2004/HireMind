const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['interviewer', 'candidate', 'system', 'evaluator'],
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  audioUrl: {
    type: String,
    default: '',
  },
  metrics: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  codeSubmission: {
    code: { type: String, default: '' },
    language: { type: String, default: '' },
    runOutput: { type: String, default: '' },
    aiReview: { type: String, default: '' },
  },
  feedback: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const interviewSessionSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    resumeFileName: {
      type: String,
      default: '',
    },
    resumeText: {
      type: String,
      default: '',
    },
    resumeAnalysis: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    targetRole: {
      type: String,
      default: '',
      trim: true,
    },
    company: {
      type: String,
      default: '',
      trim: true,
    },
    jobDescription: {
      type: String,
      default: '',
    },
    jdAnalysis: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    interviewType: {
      type: String,
      default: 'Role-Specific',
    },
    interviewMode: {
      type: String,
      enum: ['HR_SIMULATION', 'FEEDBACK_COACHING'],
      default: 'HR_SIMULATION',
    },
    difficulty: {
      type: String,
      default: 'Intermediate',
    },
    duration: {
      type: String,
      default: '30 min',
    },
    isGithubConnected: {
      type: Boolean,
      default: false,
    },
    interviewPlan: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    userFacingPlan: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    status: {
      type: String,
      enum: ['setup', 'analyzing_resume', 'ready', 'planned', 'in_progress', 'completed', 'ended_by_user'],
      default: 'setup',
    },
    isDemoCounted: {
      type: Boolean,
      default: false,
    },
    interviewState: {
      status: {
        type: String,
        enum: ['setup', 'ready', 'planned', 'in_progress', 'completed', 'ended_by_user'],
        default: 'setup',
      },
      currentStageIndex: { type: Number, default: 0 },
      currentStageId: { type: String, default: '' },
      currentStageName: { type: String, default: '' },
      currentTopic: { type: String, default: '' },
      currentObjective: { type: String, default: '' },
      questionsAsked: { type: Number, default: 0 },
      stageQuestionsAsked: { type: Number, default: 0 },
      followUpDepth: { type: Number, default: 0 },
      currentStageHops: { type: Number, default: 0 },
      maxHopsPerStage: { type: Number, default: 2 },
      // Adaptive follow-up budget (planned vs adaptive question mix)
      adaptiveTurns: { type: Number, default: 0 },
      stageAdaptiveTurns: { type: Number, default: 0 },
      // Consecutive turns where the agent ignored a required stage change
      policyViolations: { type: Number, default: 0 },
      coveredTopics: [{ type: String }],
      coveredObjectives: [{ type: String }],
      startedAt: { type: Date, default: null },
      endedAt: { type: Date, default: null },
      targetDurationMinutes: { type: Number, default: 30 },
      absoluteMaximumMinutes: { type: Number, default: 40 },
      elapsedMinutes: { type: Number, default: 0 },
      elapsedSeconds: { type: Number, default: 0 },
      remainingTargetMinutes: { type: Number, default: 30 },
      remainingTargetSeconds: { type: Number, default: 1800 },
      progressPercentage: { type: Number, default: 0 },
      timingPhase: { type: String, default: 'EARLY_PHASE' },
      lastQuestion: { type: String, default: '' },
      lastAction: { type: String, default: '' },
      lastReasonCode: { type: String, default: '' },
      isProcessing: { type: Boolean, default: false },
      isEndedByUser: { type: Boolean, default: false },
    },
    chatMessages: [chatMessageSchema],
    perAnswerFeedbacks: [
      {
        turnIndex: { type: Number, default: 0 },
        question: { type: String, default: '' },
        answer: { type: String, default: '' },
        feedback: { type: mongoose.Schema.Types.Mixed, default: null },
        timestamp: { type: Date, default: Date.now },
      },
    ],
    evaluation: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Automatically strip large base64 data URLs from chatMessages before saving to avoid MongoDB 16MB document limit
interviewSessionSchema.pre('save', function () {
  if (Array.isArray(this.chatMessages)) {
    for (const msg of this.chatMessages) {
      if (typeof msg.audioUrl === 'string' && msg.audioUrl.startsWith('data:')) {
        msg.audioUrl = '';
      }
    }
  }
});

const InterviewSession = mongoose.model('InterviewSession', interviewSessionSchema);
module.exports = InterviewSession;

