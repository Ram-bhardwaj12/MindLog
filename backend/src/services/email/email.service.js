import { env } from '../../config/env.js';

/**
 * Escapes characters for HTML output to prevent XSS / markup injection in email templates.
 *
 * @param {unknown} str
 * @returns {string}
 */
export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Builds the plain-text and HTML email content for password resets.
 *
 * @param {object} params
 * @param {string} params.resetUrl
 * @param {number} params.expiresMinutes
 * @returns {{ subject: string, textContent: string, htmlContent: string }}
 */
export function buildPasswordResetTemplates({ resetUrl, expiresMinutes }) {
  const safeUrl = escapeHtml(resetUrl);
  const safeMinutes = escapeHtml(expiresMinutes);

  const textContent =
    `You requested a password reset for your MindLog account.\n\n` +
    `Click the link below to reset your password (valid for ${expiresMinutes} minutes):\n` +
    `${resetUrl}\n\n` +
    `If you didn't request this, ignore this email.\n`;

  const htmlContent =
    `<!DOCTYPE html>\n` +
    `<html>\n` +
    `<head>\n` +
    `  <meta charset="utf-8">\n` +
    `  <title>Reset your MindLog password</title>\n` +
    `</head>\n` +
    `<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 580px; margin: 0 auto; padding: 24px;">\n` +
    `  <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">\n` +
    `    <h2 style="color: #0f172a; margin-top: 0; font-size: 20px; font-weight: 800;">Reset your MindLog password</h2>\n` +
    `    <p style="font-size: 14px; color: #475569; margin: 16px 0;">You requested a password reset for your MindLog account. Click the button below to reset your password (valid for ${safeMinutes} minutes):</p>\n` +
    `    <div style="margin: 28px 0; text-align: center;">\n` +
    `      <a href="${safeUrl}" style="background-color: #007AFF; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 14px; display: inline-block;">Reset Password</a>\n` +
    `    </div>\n` +
    `    <p style="font-size: 12px; color: #64748b; line-height: 1.5;">If the button above does not work, copy and paste this link into your browser:<br><a href="${safeUrl}" style="color: #007AFF; word-break: break-all;">${safeUrl}</a></p>\n` +
    `    <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0;" />\n` +
    `    <p style="font-size: 12px; color: #94a3b8; margin-bottom: 0;">If you didn't request this, ignore this email.</p>\n` +
    `  </div>\n` +
    `</body>\n` +
    `</html>`;

  return {
    subject: 'Reset your MindLog password',
    textContent,
    htmlContent,
  };
}

/**
 * Sends password reset email via Brevo's transactional HTTP API with an 8-second timeout.
 * Never logs secrets, tokens, or recipient email addresses.
 */
async function sendBrevoEmail({ to, resetUrl, expiresMinutes }) {
  const { subject, textContent, htmlContent } = buildPasswordResetTemplates({
    resetUrl,
    expiresMinutes,
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  let response;
  try {
    response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': env.BREVO_API_KEY,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: {
          name: env.EMAIL_FROM_NAME,
          email: env.EMAIL_FROM_ADDRESS,
        },
        to: [{ email: to }],
        subject,
        htmlContent,
        textContent,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError' || controller.signal.aborted) {
      console.warn('[Email Warning] Brevo request timed out');
      throw new Error('Email delivery failed (timeout)');
    }
    console.warn('[Email Warning] Brevo request network error');
    throw new Error('Email delivery failed (network error)');
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const statusClass = `${Math.floor(response.status / 100)}xx`;
    console.warn(`[Email Warning] Brevo request rejected with ${statusClass} status`);
    throw new Error(`Email delivery failed (${statusClass})`);
  }
}

/**
 * Mutable email client object.
 * Methods are called through this object reference at call time so tests can replace
 * or spy on them with node:test `mock.method(emailClient, 'sendPasswordResetEmail')`.
 */
export const emailClient = {
  /**
   * Dispatches a password reset email using the configured provider.
   *
   * @param {object} params
   * @param {string} params.to - Recipient email
   * @param {string} params.resetUrl - Full password reset URL
   * @param {number} params.expiresMinutes - Token lifespan in minutes
   */
  async sendPasswordResetEmail({ to, resetUrl, expiresMinutes }) {
    if (env.EMAIL_PROVIDER === 'console') {
      if (env.isProduction) {
        throw new Error('Console email provider is forbidden in production');
      }
      console.log(`[DEV ONLY] Password reset URL: ${resetUrl}`);
      return;
    }

    if (env.EMAIL_PROVIDER === 'brevo') {
      await sendBrevoEmail({ to, resetUrl, expiresMinutes });
      return;
    }

    throw new Error(`Unsupported email provider: ${env.EMAIL_PROVIDER}`);
  },
};
