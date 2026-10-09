const nodemailer = require('nodemailer');
const { getClientUrl } = require('../config/clientConfig');

const getTransporter = () => {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port: Number(port),
    secure: Number(port) === 465,
    auth: {
      user,
      pass,
    },
  });
};

/**
 * Sends a 6-digit OTP verification email.
 *
 * @param {string} email
 * @param {string} otp
 * @param {string} firstName
 */
const sendOtpEmail = async (email, otp, firstName = 'Candidate') => {
  const clientUrl = getClientUrl();
  const supportEmail = process.env.SUPPORT_EMAIL || 'support@hiremind.com';
  const transporter = getTransporter();

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 40px 20px; }
          .container { max-width: 540px; margin: 0 auto; background: #1e293b; border-radius: 16px; border: 1px solid rgba(255,255,255,0.08); padding: 36px; box-shadow: 0 10px 30px rgba(0,0,0,0.4); }
          .logo { font-size: 24px; font-weight: 800; letter-spacing: -0.5px; color: #60a5fa; margin-bottom: 24px; display: inline-block; }
          .title { font-size: 20px; font-weight: 700; color: #ffffff; margin-bottom: 12px; }
          .text { font-size: 14px; line-height: 1.6; color: #94a3b8; margin-bottom: 24px; }
          .otp-box { background: #0f172a; border: 1px solid rgba(96,165,250,0.3); border-radius: 12px; padding: 18px 24px; text-align: center; margin-bottom: 24px; }
          .otp-code { font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #38bdf8; }
          .notice { font-size: 12px; color: #64748b; margin-top: 10px; }
          .btn-container { text-align: center; margin: 28px 0 20px; }
          .btn { display: inline-block; background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #ffffff !important; text-decoration: none; font-weight: 600; font-size: 14px; padding: 13px 30px; border-radius: 9px; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4); }
          .footer { font-size: 12px; color: #475569; text-align: center; margin-top: 32px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">HireMind</div>
          <div class="title">Verify Your Email Address</div>
          <p class="text">Hi ${firstName},</p>
          <p class="text">Welcome to HireMind! To complete your registration and activate your account, please enter the following verification code:</p>
          <div class="otp-box">
            <div class="otp-code">${otp}</div>
            <div class="notice">This code expires in 10 minutes. Do not share this code with anyone.</div>
          </div>
          <div class="btn-container">
            <a href="${clientUrl}/login" class="btn">Open HireMind to Verify &rarr;</a>
          </div>
          <p class="text">If you didn't create an account with HireMind, you can safely ignore this email.</p>
          <div class="footer">
            &copy; ${new Date().getFullYear()} HireMind. All rights reserved. <br/>
            Need help? Contact <a href="mailto:${supportEmail}" style="color: #60a5fa;">${supportEmail}</a>
          </div>
        </div>
      </body>
    </html>
  `;

  if (!transporter) {
    console.log('\n=============================================');
    console.log(`[HireMind Email] (Dev Mock Mode) OTP for ${email}: ${otp}`);
    console.log('=============================================\n');
    return true;
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM || '"HireMind" <noreply@hiremind.com>',
    to: email,
    subject: 'HireMind Verification Code: ' + otp,
    html: htmlContent,
  });

  return true;
};

/**
 * Sends an Onboarding Welcome Email immediately after account creation.
 * All CTA button links are constructed dynamically using getClientUrl().
 *
 * @param {string} email
 * @param {string} firstName
 */
const sendOnboardingEmail = async (email, firstName = 'Candidate') => {
  const clientUrl = getClientUrl();
  const onboardingLink = `${clientUrl}/profile-setup`;
  const supportEmail = process.env.SUPPORT_EMAIL || 'support@hiremind.com';
  const transporter = getTransporter();

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 40px 20px; }
          .container { max-width: 560px; margin: 0 auto; background: #1e293b; border-radius: 16px; border: 1px solid rgba(255,255,255,0.08); padding: 36px; box-shadow: 0 10px 30px rgba(0,0,0,0.4); }
          .logo { font-size: 24px; font-weight: 800; letter-spacing: -0.5px; color: #60a5fa; margin-bottom: 24px; display: inline-block; }
          .title { font-size: 22px; font-weight: 700; color: #ffffff; margin-bottom: 12px; }
          .text { font-size: 14px; line-height: 1.6; color: #94a3b8; margin-bottom: 20px; }
          .highlight-card { background: rgba(59, 130, 246, 0.08); border-left: 4px solid #3b82f6; border-radius: 6px; padding: 16px; margin: 24px 0; }
          .highlight-title { font-size: 14px; font-weight: 600; color: #60a5fa; margin-bottom: 6px; }
          .highlight-list { margin: 0; padding-left: 18px; color: #cbd5e1; font-size: 13px; line-height: 1.6; }
          .btn-container { text-align: center; margin: 32px 0; }
          .btn { display: inline-block; background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #ffffff !important; text-decoration: none; font-weight: 600; font-size: 15px; padding: 14px 32px; border-radius: 10px; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4); }
          .footer { font-size: 12px; color: #475569; text-align: center; margin-top: 32px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">HireMind</div>
          <div class="title">Welcome to HireMind, ${firstName}! 🚀</div>
          <p class="text">Your account has been successfully verified and activated. You are now ready to start practicing personalized, realistic AI mock interviews.</p>
          
          <div class="highlight-card">
            <div class="highlight-title">What you can do next:</div>
            <ul class="highlight-list">
              <li>Complete your candidate profile & upload your target resume</li>
              <li>Simulate real-world technical and behavioral interview tracks</li>
              <li>Get immediate performance scoring, speech analysis, and improvement tips</li>
            </ul>
          </div>

          <div class="btn-container">
            <a href="${onboardingLink}" class="btn">Complete Your Profile &rarr;</a>
          </div>

          <p class="text" style="font-size: 13px; color: #64748b;">If the button above does not work, copy and paste this link into your browser:<br/><a href="${onboardingLink}" style="color: #60a5fa; word-break: break-all;">${onboardingLink}</a></p>

          <div class="footer">
            &copy; ${new Date().getFullYear()} HireMind. All rights reserved. <br/>
            Have questions? Contact us at <a href="mailto:${supportEmail}" style="color: #60a5fa;">${supportEmail}</a>
          </div>
        </div>
      </body>
    </html>
  `;

  if (!transporter) {
    console.log('\n=============================================');
    console.log(`[HireMind Email] (Dev Mock Mode) Onboarding email dispatched to ${email} with CTA: ${onboardingLink}`);
    console.log('=============================================\n');
    return true;
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM || '"HireMind" <noreply@hiremind.com>',
    to: email,
    subject: 'Welcome to HireMind! Get ready for your next interview',
    html: htmlContent,
  });

  return true;
};

/**
 * Sends a 6-digit OTP email specifically for Password Reset.
 *
 * @param {string} email
 * @param {string} otp
 * @param {string} firstName
 */
const sendPasswordResetOtpEmail = async (email, otp, firstName = 'Candidate') => {
  const clientUrl = getClientUrl();
  const resetLink = `${clientUrl}/forgot-password`;
  const supportEmail = process.env.SUPPORT_EMAIL || 'support@hiremind.com';
  const transporter = getTransporter();

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 40px 20px; }
          .container { max-width: 540px; margin: 0 auto; background: #1e293b; border-radius: 16px; border: 1px solid rgba(255,255,255,0.08); padding: 36px; box-shadow: 0 10px 30px rgba(0,0,0,0.4); }
          .logo { font-size: 24px; font-weight: 800; letter-spacing: -0.5px; color: #60a5fa; margin-bottom: 24px; display: inline-block; }
          .title { font-size: 20px; font-weight: 700; color: #ffffff; margin-bottom: 12px; }
          .text { font-size: 14px; line-height: 1.6; color: #94a3b8; margin-bottom: 24px; }
          .otp-box { background: #0f172a; border: 1px solid rgba(244, 63, 94, 0.35); border-radius: 12px; padding: 18px 24px; text-align: center; margin-bottom: 24px; }
          .otp-code { font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #f43f5e; }
          .notice { font-size: 12px; color: #64748b; margin-top: 10px; }
          .btn-container { text-align: center; margin: 28px 0 20px; }
          .btn { display: inline-block; background: linear-gradient(135deg, #f43f5e, #e11d48); color: #ffffff !important; text-decoration: none; font-weight: 600; font-size: 14px; padding: 13px 30px; border-radius: 9px; box-shadow: 0 4px 14px rgba(244, 63, 94, 0.4); }
          .footer { font-size: 12px; color: #475569; text-align: center; margin-top: 32px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">HireMind</div>
          <div class="title">Password Reset Code</div>
          <p class="text">Hi ${firstName},</p>
          <p class="text">We received a request to reset the password for your HireMind account. Use the verification code below to set a new password:</p>
          <div class="otp-box">
            <div class="otp-code">${otp}</div>
            <div class="notice">This code expires in 10 minutes. If you did not request a password reset, please secure your account immediately.</div>
          </div>
          <div class="btn-container">
            <a href="${resetLink}" class="btn">Reset Password on HireMind &rarr;</a>
          </div>
          <p class="text">Need to return to login? <a href="${clientUrl}/login" style="color: #60a5fa;">Click here to sign in</a></p>
          <div class="footer">
            &copy; ${new Date().getFullYear()} HireMind. All rights reserved. <br/>
            Contact support at <a href="mailto:${supportEmail}" style="color: #60a5fa;">${supportEmail}</a>
          </div>
        </div>
      </body>
    </html>
  `;

  if (!transporter) {
    console.log('\n=============================================');
    console.log(`[HireMind Email] (Dev Mock Mode) Password Reset OTP for ${email}: ${otp}`);
    console.log('=============================================\n');
    return true;
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM || '"HireMind" <noreply@hiremind.com>',
    to: email,
    subject: 'HireMind Password Reset Code: ' + otp,
    html: htmlContent,
  });

  return true;
};

/**
 * Sends an official Account Deletion confirmation email.
 *
 * @param {string} email
 * @param {string} firstName
 */
const sendAccountDeletionEmail = async (email, firstName = 'Candidate') => {
  const clientUrl = getClientUrl();
  const supportEmail = process.env.SUPPORT_EMAIL || 'support@hiremind.com';
  const transporter = getTransporter();
  const deletedAt = new Date().toUTCString();

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 40px 20px; }
          .container { max-width: 540px; margin: 0 auto; background: #1e293b; border-radius: 16px; border: 1px solid rgba(239, 68, 68, 0.3); padding: 36px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
          .logo { font-size: 24px; font-weight: 800; letter-spacing: -0.5px; color: #f87171; margin-bottom: 20px; display: inline-block; }
          .badge { display: inline-block; background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; padding: 4px 10px; border-radius: 6px; margin-bottom: 16px; }
          .title { font-size: 20px; font-weight: 700; color: #ffffff; margin-bottom: 12px; }
          .text { font-size: 14px; line-height: 1.6; color: #94a3b8; margin-bottom: 20px; }
          .details-card { background: #0f172a; border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 18px 20px; margin-bottom: 24px; }
          .item { font-size: 13px; color: #cbd5e1; margin-bottom: 8px; line-height: 1.5; }
          .item:last-child { margin-bottom: 0; }
          .item strong { color: #f8fafc; }
          .cta-btn { display: inline-block; background: #334155; color: #f8fafc !important; text-decoration: none; font-size: 13px; font-weight: 600; padding: 11px 24px; border-radius: 8px; }
          .footer { font-size: 12px; color: #475569; text-align: center; margin-top: 32px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">HireMind</div>
          <div><span class="badge">Account Terminated</span></div>
          <div class="title">Your Account Has Been Deleted</div>
          <p class="text">Hi ${firstName},</p>
          <p class="text">This email confirms that your HireMind candidate account has been permanently deleted as requested on <strong>${deletedAt}</strong>.</p>
          
          <div class="details-card">
            <div class="item">&#10003; <strong>Credentials & Profile:</strong> All account credentials and personal profile details removed.</div>
            <div class="item">&#10003; <strong>Uploaded Files & Documents:</strong> Your profile photo and stored resume documents have been permanently purged.</div>
            <div class="item">&#10003; <strong>Interview History:</strong> AI mock interview transcripts, session scores, and evaluation logs have been deleted.</div>
          </div>

          <div style="text-align: center; margin: 24px 0 16px;">
            <a href="${clientUrl}/signup" class="cta-btn">Join HireMind Again &rarr;</a>
          </div>

          <p class="text">If you did not make this request or believe this was done in error, please contact our security team immediately at <a href="mailto:${supportEmail}" style="color: #60a5fa;">${supportEmail}</a>.</p>
          
          <div class="footer">
            &copy; ${new Date().getFullYear()} HireMind. All rights reserved. <br/>
            Want to join again in the future? <a href="${clientUrl}/signup" style="color: #60a5fa;">Create a new account</a>
          </div>
        </div>
      </body>
    </html>
  `;

  if (!transporter) {
    console.log('\n=============================================');
    console.log(`[HireMind Email] (Dev Mock Mode) Account Deletion Confirmation sent to ${email}`);
    console.log('=============================================\n');
    return true;
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || '"HireMind Security" <noreply@hiremind.com>',
      to: email,
      subject: 'HireMind Account Deletion Confirmation',
      html: htmlContent,
    });
  } catch (err) {
    console.error('[Email Service] Failed to send account deletion email:', err.message);
  }

  return true;
};

/**
 * Sends an email notifying a candidate that they have been granted Demo Access to the AI Mock Interview.
 * Includes how many interviews they can attempt and a direct CTA button with the deployed link.
 *
 * @param {string} email
 * @param {string} firstName
 * @param {number} allowedInterviews
 * @param {string} notes
 * @param {boolean} isRefresh
 */
const sendDemoAccessGrantedEmail = async (
  email,
  firstName = 'Candidate',
  allowedInterviews = 3,
  notes = '',
  isRefresh = false
) => {
  const clientUrl = getClientUrl();
  const interviewLink = `${clientUrl}/new-interview`;
  const supportEmail = process.env.SUPPORT_EMAIL || 'support@hiremind.com';
  const transporter = getTransporter();

  const title = isRefresh
    ? 'Your Demo Interview Quota Has Been Refreshed! 🎯'
    : "You've Been Granted Demo Access to AI Mock Interview! 🎯";

  const intro = isRefresh
    ? `Great news! An administrator has refreshed your demo interview quota on HireMind. You now have <strong>${allowedInterviews} mock interview attempt(s)</strong> available.`
    : `Congratulations! An administrator has authorized your account for private demo access to the HireMind AI Mock Interview platform. You can now conduct <strong>${allowedInterviews} personalized mock interview attempt(s)</strong>.`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 40px 20px; }
          .container { max-width: 560px; margin: 0 auto; background: #1e293b; border-radius: 16px; border: 1px solid rgba(56, 189, 248, 0.25); padding: 36px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
          .logo { font-size: 24px; font-weight: 800; letter-spacing: -0.5px; color: #38bdf8; margin-bottom: 20px; display: inline-block; }
          .badge { display: inline-block; background: rgba(56, 189, 248, 0.12); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; padding: 4px 10px; border-radius: 6px; margin-bottom: 16px; }
          .title { font-size: 22px; font-weight: 700; color: #ffffff; margin-bottom: 12px; }
          .text { font-size: 14px; line-height: 1.6; color: #94a3b8; margin-bottom: 20px; }
          .quota-card { background: #0f172a; border: 1px solid rgba(59, 130, 246, 0.35); border-radius: 12px; padding: 20px 24px; margin: 24px 0; text-align: center; }
          .quota-label { font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
          .quota-num { font-size: 36px; font-weight: 800; color: #38bdf8; letter-spacing: -0.5px; }
          .quota-sub { font-size: 13px; color: #94a3b8; margin-top: 4px; }
          .feature-box { background: rgba(15, 23, 42, 0.5); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 16px; margin-bottom: 24px; text-align: left; }
          .feature-title { font-size: 13px; font-weight: 700; color: #cbd5e1; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
          .feature-item { font-size: 13px; color: #94a3b8; margin-bottom: 6px; line-height: 1.5; }
          .feature-item:last-child { margin-bottom: 0; }
          .btn-container { text-align: center; margin: 30px 0 24px; }
          .btn { display: inline-block; background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #ffffff !important; text-decoration: none; font-weight: 600; font-size: 15px; padding: 14px 34px; border-radius: 10px; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4); }
          .footer { font-size: 12px; color: #475569; text-align: center; margin-top: 32px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">HireMind</div>
          <div><span class="badge">Demo Access Authorized</span></div>
          <div class="title">${title}</div>
          <p class="text">Hi ${firstName},</p>
          <p class="text">${intro}</p>

          <div class="quota-card">
            <div class="quota-label">Your Interview Quota</div>
            <div class="quota-num">${allowedInterviews} ${allowedInterviews === 1 ? 'Interview' : 'Interviews'}</div>
            <div class="quota-sub">Full access to adaptive technical, theory, coding & case study rounds</div>
          </div>

          <div class="feature-box">
            <div class="feature-title">What you have unlocked:</div>
            <div class="feature-item">&#10003; <strong>Adaptive AI Interviewer:</strong> Questions calibrated to your resume, projects, and target role.</div>
            <div class="feature-item">&#10003; <strong>Voice Mode:</strong> Real-time Whisper V3 transcription and natural interviewer voice speech.</div>
            <div class="feature-item">&#10003; <strong>Live Code Sandbox:</strong> Hands-on technical challenges with automated test suite and execution.</div>
            <div class="feature-item">&#10003; <strong>Executive Evaluation:</strong> Radar scoring, STAR methodology metrics, and tailored improvement roadmaps.</div>
          </div>

          <div class="btn-container">
            <a href="${interviewLink}" class="btn">Start Your Demo Mock Interview &rarr;</a>
          </div>

          <p class="text" style="font-size: 13px; color: #64748b; text-align: center;">
            Direct link: <br/><a href="${interviewLink}" style="color: #60a5fa; word-break: break-all;">${interviewLink}</a>
          </p>

          <div class="footer">
            &copy; ${new Date().getFullYear()} HireMind. All rights reserved. <br/>
            Have questions? Contact our support team at <a href="mailto:${supportEmail}" style="color: #60a5fa;">${supportEmail}</a>
          </div>
        </div>
      </body>
    </html>
  `;

  if (!transporter) {
    console.log('\n=============================================');
    console.log(`[HireMind Email] (Dev Mock Mode) Demo Access Granted sent to ${email} with ${allowedInterviews} interviews`);
    console.log(`[HireMind Email] CTA Link: ${interviewLink}`);
    console.log('=============================================\n');
    return true;
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || '"HireMind Demo" <noreply@hiremind.com>',
      to: email,
      subject: isRefresh
        ? `HireMind: Your AI Interview Quota Was Refreshed (${allowedInterviews} attempts)`
        : `HireMind: You've Been Granted Demo Access (${allowedInterviews} attempts)`,
      html: htmlContent,
    });
  } catch (err) {
    console.error('[Email Service] Failed to send demo access email:', err.message);
  }

  return true;
};

/**
 * Sends an email notification to candidate when their demo interview access is revoked/cancelled.
 *
 * @param {string} email
 * @param {string} firstName
 * @param {string} reason
 */
const sendDemoAccessRevokedEmail = async (email, firstName = 'Candidate', reason = '') => {
  const clientUrl = getClientUrl();
  const supportEmail = process.env.SUPPORT_EMAIL || 'support@hiremind.com';
  const dashboardLink = `${clientUrl}/dashboard`;
  const transporter = getTransporter();

  const cleanReason = reason && reason !== 'Cancelled by administrator' && reason !== 'Revoked by administrator'
    ? reason.trim()
    : 'Your demo preview period has concluded or was updated by an administrator.';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 40px 20px; }
          .container { max-width: 560px; margin: 0 auto; background: #1e293b; border-radius: 16px; border: 1px solid rgba(255,255,255,0.08); padding: 38px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
          .logo { font-size: 26px; font-weight: 800; letter-spacing: -0.5px; color: #60a5fa; margin-bottom: 20px; display: inline-block; }
          .badge { display: inline-block; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.35); color: #f87171; font-size: 12px; font-weight: 700; padding: 5px 12px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 16px; }
          .title { font-size: 22px; font-weight: 700; color: #ffffff; margin-bottom: 14px; line-height: 1.3; }
          .text { font-size: 14px; line-height: 1.6; color: #94a3b8; margin-bottom: 20px; }
          .reason-card { background: #0f172a; border: 1px solid rgba(239, 68, 68, 0.25); border-radius: 12px; padding: 20px; margin-bottom: 24px; text-align: left; }
          .reason-label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #ef4444; font-weight: 700; margin-bottom: 6px; }
          .reason-text { font-size: 14px; color: #e2e8f0; line-height: 1.5; }
          .info-box { background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 18px 20px; margin-bottom: 28px; }
          .info-title { font-size: 13px; font-weight: 600; color: #cbd5e1; margin-bottom: 8px; }
          .info-desc { font-size: 13px; color: #94a3b8; line-height: 1.5; margin: 0; }
          .btn-container { text-align: center; margin: 28px 0 20px; }
          .btn { display: inline-block; background: linear-gradient(135deg, #334155, #1e293b); color: #ffffff !important; border: 1px solid rgba(255,255,255,0.15); text-decoration: none; font-weight: 600; font-size: 14px; padding: 13px 30px; border-radius: 10px; }
          .footer { font-size: 12px; color: #475569; text-align: center; margin-top: 32px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">HireMind</div>
          <div><span class="badge">Demo Access Notice</span></div>
          <div class="title">AI Mock Interview Demo Access Concluded</div>
          <p class="text">Hi ${firstName},</p>
          <p class="text">This notice is to inform you that your temporary demo account access for HireMind's AI Mock Interview has been concluded or revoked by an administrator.</p>

          <div class="reason-card">
            <div class="reason-label">Notice Details</div>
            <div class="reason-text">${cleanReason}</div>
          </div>

          <div class="info-box">
            <div class="info-title">What happens next?</div>
            <p class="info-desc">
              Your profile, saved resume, interview history, and past evaluation performance reports remain accessible on your candidate dashboard. Full platform access for AI Mock Interviews will be expanding soon.
            </p>
          </div>

          <div class="btn-container">
            <a href="${dashboardLink}" class="btn">Go to Candidate Dashboard &rarr;</a>
          </div>

          <div class="footer">
            &copy; ${new Date().getFullYear()} HireMind. All rights reserved. <br/>
            Need more information or wish to request renewed access? Contact an administrator or email <a href="mailto:${supportEmail}" style="color: #60a5fa;">${supportEmail}</a>
          </div>
        </div>
      </body>
    </html>
  `;

  if (!transporter) {
    console.log('\n=============================================');
    console.log(`[HireMind Email] (Dev Mock Mode) Demo Access Revoked sent to ${email}`);
    console.log(`[HireMind Email] Reason: ${cleanReason}`);
    console.log('=============================================\n');
    return true;
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || '"HireMind Support" <noreply@hiremind.com>',
      to: email,
      subject: 'HireMind: Update Regarding Your AI Interview Demo Access',
      html: htmlContent,
    });
  } catch (err) {
    console.error('[Email Service] Failed to send demo access revoked email:', err.message);
  }

  return true;
};

const DEFAULT_PILOT_FEEDBACK_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSc6PAv6O_xDxA4-MyHmbOnXNE8fN1qeLKcwn5yBp5TV5b4SHg/viewform?usp=dialog';

/**
 * Asks a demo (pilot) candidate to fill the pilot testing feedback form after an interview.
 *
 * @param {string} email
 * @param {string} firstName
 * @param {string} targetRole - Role of the interview just finished (optional)
 */
const sendPilotFeedbackEmail = async (email, firstName = 'Candidate', targetRole = '') => {
  const formUrl = process.env.PILOT_FEEDBACK_FORM_URL || DEFAULT_PILOT_FEEDBACK_FORM_URL;
  const supportEmail = process.env.SUPPORT_EMAIL || 'support@hiremind.com';
  const transporter = getTransporter();
  const roleText = targetRole ? ` for the <strong>${targetRole}</strong> role` : '';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 40px 20px; }
          .container { max-width: 560px; margin: 0 auto; background: #1e293b; border-radius: 16px; border: 1px solid rgba(56, 189, 248, 0.25); padding: 36px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
          .logo { font-size: 24px; font-weight: 800; letter-spacing: -0.5px; color: #38bdf8; margin-bottom: 20px; display: inline-block; }
          .badge { display: inline-block; background: rgba(56, 189, 248, 0.12); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; padding: 4px 10px; border-radius: 6px; margin-bottom: 16px; }
          .title { font-size: 22px; font-weight: 700; color: #ffffff; margin-bottom: 12px; }
          .text { font-size: 14px; line-height: 1.6; color: #94a3b8; margin-bottom: 20px; }
          .btn-container { text-align: center; margin: 30px 0 24px; }
          .btn { display: inline-block; background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #ffffff !important; text-decoration: none; font-weight: 600; font-size: 15px; padding: 14px 34px; border-radius: 10px; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4); }
          .footer { font-size: 12px; color: #475569; text-align: center; margin-top: 32px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">HireMind</div>
          <div><span class="badge">Pilot Testing Feedback</span></div>
          <div class="title">Thanks for completing your mock interview! 🙌</div>
          <p class="text">Hi ${firstName},</p>
          <p class="text">You just finished an AI mock interview${roleText} on HireMind as part of our pilot program. Your experience helps us shape the product, so we'd love to hear what worked well and what didn't.</p>
          <p class="text">The feedback form only takes a few minutes to complete.</p>

          <div class="btn-container">
            <a href="${formUrl}" class="btn">Fill the Pilot Feedback Form &rarr;</a>
          </div>

          <p class="text" style="font-size: 13px; color: #64748b; text-align: center;">
            Direct link: <br/><a href="${formUrl}" style="color: #60a5fa; word-break: break-all;">${formUrl}</a>
          </p>

          <div class="footer">
            &copy; ${new Date().getFullYear()} HireMind. All rights reserved. <br/>
            Have questions? Contact our support team at <a href="mailto:${supportEmail}" style="color: #60a5fa;">${supportEmail}</a>
          </div>
        </div>
      </body>
    </html>
  `;

  if (!transporter) {
    console.log('\n=============================================');
    console.log(`[HireMind Email] (Dev Mock Mode) Pilot feedback request sent to ${email}`);
    console.log(`[HireMind Email] Form Link: ${formUrl}`);
    console.log('=============================================\n');
    return true;
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || '"HireMind Team" <noreply@hiremind.com>',
      to: email,
      subject: 'HireMind: How was your mock interview? Share your pilot feedback',
      html: htmlContent,
    });
  } catch (err) {
    console.error('[Email Service] Failed to send pilot feedback email:', err.message);
  }

  return true;
};

module.exports = {
  sendOtpEmail,
  sendOnboardingEmail,
  sendPasswordResetOtpEmail,
  sendAccountDeletionEmail,
  sendDemoAccessGrantedEmail,
  sendDemoAccessRevokedEmail,
  sendPilotFeedbackEmail,
};


