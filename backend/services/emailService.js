const nodemailer = require('nodemailer');

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
  const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/+$/, '');
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
 * All CTA button links are constructed dynamically using process.env.CLIENT_URL.
 *
 * @param {string} email
 * @param {string} firstName
 */
const sendOnboardingEmail = async (email, firstName = 'Candidate') => {
  const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/+$/, '');
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

module.exports = {
  sendOtpEmail,
  sendOnboardingEmail,
};
