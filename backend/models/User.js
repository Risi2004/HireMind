const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/\S+@\S+\.\S+/, 'Please provide a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters long'],
      select: false, // Masked and hidden by default from all database queries
    },
    avatarUrl: {
      type: String,
      default: '',
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    careerStage: {
      type: String,
      default: '',
    },
    field: {
      type: String,
      default: '',
    },
    experienceLevel: {
      type: String,
      enum: ['Beginner', 'Intermediate', 'Experienced'],
      default: 'Beginner',
    },
    skills: {
      type: [String],
      default: [],
    },
    title: {
      type: String,
      default: '',
    },
    tier: {
      type: String,
      enum: ['FREE', 'PRO', 'ENTERPRISE'],
      default: 'FREE',
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    careerInterests: {
      type: [String],
      default: ['Backend Development', 'Full Stack Development', 'AI Engineering'],
    },
    linkedin: {
      connected: {
        type: Boolean,
        default: false,
      },
      username: {
        type: String,
        default: '',
      },
      profileUrl: {
        type: String,
        default: '',
      },
      name: {
        type: String,
        default: '',
      },
    },
    bio: {
      type: String,
      default: '',
    },
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },
    twoFactorSecret: {
      type: String,
      default: '',
      select: false,
    },
    twoFactorFrequency: {
      type: String,
      enum: ['always', 'every_two_weeks'],
      default: 'always',
    },
    twoFactorTrustedDevices: [
      {
        deviceToken: { type: String, required: true },
        expiresAt: { type: Date, required: true },
        userAgent: { type: String, default: '' },
      },
    ],
    isProfileSetupCompleted: {
      type: Boolean,
      default: false,
    },
    resumeUrl: {
      type: String,
      default: '',
    },
    resumeFileName: {
      type: String,
      default: '',
    },
    github: {
      connected: {
        type: Boolean,
        default: false,
      },
      username: {
        type: String,
        default: '',
      },
      profileUrl: {
        type: String,
        default: '',
      },
      avatarUrl: {
        type: String,
        default: '',
      },
      name: {
        type: String,
        default: '',
      },
      publicRepos: {
        type: Number,
        default: 0,
      },
      accessToken: {
        type: String,
        default: '',
        select: false,
      },
      repos: [
        {
          name: String,
          fullName: String,
          description: String,
          url: String,
          language: String,
          stars: Number,
          forks: Number,
          isPrivate: Boolean,
          defaultBranch: String,
          updatedAt: Date,
        },
      ],
      connectedAt: {
        type: Date,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving if modified (async hook in Mongoose 8+)
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});


// Instance method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Mask password and twoFactorSecret completely from JSON outputs
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.twoFactorSecret;
  return obj;
};

const User = mongoose.model('User', userSchema);
module.exports = User;
