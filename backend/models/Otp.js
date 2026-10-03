const mongoose = require('mongoose');

const MAX_OTP_ATTEMPTS = 5;

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  otp: {
    type: String,
    required: true,
  },
  // Separates account verification codes from password reset codes,
  // so a reset code can never be used to activate/sign in to an account and vice versa.
  purpose: {
    type: String,
    enum: ['verify', 'reset'],
    default: 'verify',
  },
  // Failed guesses against this code; the code is destroyed after MAX_OTP_ATTEMPTS.
  attempts: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 600, // MongoDB TTL index: documents automatically delete after 10 minutes
  },
});

const Otp = mongoose.model('Otp', otpSchema);
module.exports = Otp;
module.exports.MAX_OTP_ATTEMPTS = MAX_OTP_ATTEMPTS;
