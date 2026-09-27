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
    evaluation: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const InterviewSession = mongoose.model('InterviewSession', interviewSessionSchema);
module.exports = InterviewSession;
