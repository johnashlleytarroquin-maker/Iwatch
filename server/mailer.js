const nodemailer = require('nodemailer');

function createTransporter() {
  const user = process.env.GMAIL_USER || process.env.SMTP_USER;
  const pass = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS;

  if (user && pass) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    });
  }
  return null;
}

/**
 * Sends a 6-digit OTP verification email to the user's Gmail address.
 */
async function sendOtpEmail(toEmail, otpCode, userName = 'User') {
  const transporter = createTransporter();
  const subject = `[Iwatch SOS] Your Email Verification Code: ${otpCode}`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Iwatch Verification Code</title>
    </head>
    <body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F3F4F6;">
      <div style="max-width: 500px; margin: 0 auto; background-color: #FFFFFF; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border: 1px solid #E5E7EB;">
        <!-- Header -->
        <div style="background-color: #24652B; padding: 24px; text-align: center;">
          <h1 style="color: #FFFFFF; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 1px;">Iwatch Security</h1>
          <p style="color: #FABC11; margin: 6px 0 0; font-size: 13px; font-weight: 600;">Campus Emergency Response Network</p>
        </div>

        <!-- Body -->
        <div style="padding: 32px 24px; text-align: left;">
          <h2 style="color: #111827; font-size: 18px; margin-top: 0; font-weight: 700;">Verify Your Gmail Address</h2>
          <p style="color: #4B5563; font-size: 14px; line-height: 1.6; margin: 12px 0;">
            Hello <strong>${userName}</strong>,
          </p>
          <p style="color: #4B5563; font-size: 14px; line-height: 1.6; margin: 12px 0;">
            To complete your registration and secure your Iwatch account, please enter the one-time verification code below into your app:
          </p>

          <!-- OTP Box -->
          <div style="text-align: center; margin: 28px 0;">
            <div style="display: inline-block; background-color: #F0FDF4; border: 2px dashed #24652B; border-radius: 12px; padding: 14px 28px;">
              <span style="font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #24652B;">
                ${otpCode}
              </span>
            </div>
            <p style="color: #6B7280; font-size: 12px; margin-top: 10px;">
              Valid for <strong>10 minutes</strong>. Never share this code with anyone.
            </p>
          </div>

          <p style="color: #6B7280; font-size: 13px; line-height: 1.5; margin-top: 24px;">
            If you did not request this code, someone may have entered your email address by mistake. You can safely ignore this email.
          </p>
        </div>

        <!-- Footer -->
        <div style="background-color: #F9FAFB; padding: 16px 24px; text-align: center; border-top: 1px solid #E5E7EB;">
          <p style="color: #9CA3AF; font-size: 11px; margin: 0;">
            © ${new Date().getFullYear()} Iwatch Campus Emergency Dispatch. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  if (!transporter) {
    console.log(`\n======================================================`);
    console.log(`[EMAIL VERIFICATION (SIMULATED)]`);
    console.log(`To: ${toEmail}`);
    console.log(`Verification Code: ${otpCode}`);
    console.log(`(Configure GMAIL_USER and GMAIL_APP_PASSWORD to send live emails)`);
    console.log(`======================================================\n`);
    return { sent: true, simulated: true, otp: otpCode };
  }

  try {
    const info = await transporter.sendMail({
      from: `"Iwatch Campus Security" <${process.env.GMAIL_USER || process.env.SMTP_USER}>`,
      to: toEmail,
      subject,
      html,
    });
    console.log('[mailer] Verification email sent to:', toEmail, 'Message ID:', info.messageId);
    return { sent: true, simulated: false };
  } catch (err) {
    console.error('[mailer] Failed to send email via Gmail SMTP:', err.message);
    return { sent: false, error: err.message, otp: otpCode };
  }
}

module.exports = { sendOtpEmail };
