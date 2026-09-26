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
      enum: ['setup', 'analyzing_resume', 'ready', 'planned', 'in_progress', 'completed'],
      default: 'setup',
    },
    chatMessages: [chatMessageSchema],
  },
  {
    timestamps: true,
  }
);

const InterviewSession = mongoose.model('InterviewSession', interviewSessionSchema);
module.exports = InterviewSession;
