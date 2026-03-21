'use strict';

/**
 * Email service — sends order confirmation and download link emails.
 *
 * Uses nodemailer with any SMTP provider (Gmail, Mailgun, SendGrid, etc.).
 * Configure via SMTP_* environment variables.
 */

const nodemailer = require('nodemailer');

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

function isConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

/**
 * Send the download email to the customer after payment is confirmed.
 *
 * @param {object} opts
 * @param {string} opts.to              - Customer email address
 * @param {string} opts.customerName
 * @param {string} opts.designId
 * @param {string} opts.downloadUrl     - Signed download URL
 * @param {string} opts.expiresAt       - Human readable expiry, e.g. "72 hours"
 */
async function sendDownloadEmail({ to, customerName, designId, downloadUrl, expiresAt }) {
  if (!isConfigured()) {
    console.warn('[email] SMTP not configured — skipping email to', to);
    console.info('[email] Download URL would have been:', downloadUrl);
    return;
  }

  const transport = createTransport();
  const firstName = customerName.split(' ')[0] || 'there';

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Your Bespoke Bike Design Files</title></head>
<body style="font-family:monospace;background:#f4f4f4;padding:40px 0;">
  <table width="600" align="center" style="background:#fff;border-radius:8px;padding:40px;border:1px solid #ddd;">
    <tr><td>
      <h1 style="font-family:monospace;color:#111;font-size:22px;margin-bottom:4px;">
        Creature Cycles
      </h1>
      <p style="color:#666;font-size:13px;margin-top:0;">Bespoke Frame Design Files</p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">

      <p style="font-size:15px;color:#222;">Hi ${firstName},</p>
      <p style="font-size:15px;color:#222;line-height:1.6;">
        Thank you for your order! Your bespoke bike design files are ready to download.
        The package includes:
      </p>
      <ul style="font-size:14px;color:#444;line-height:2;">
        <li><strong>design.json</strong> — Full parameter set (all geometry values)</li>
        <li><strong>design.pdf</strong> — 2D frame drawing with annotations</li>
      </ul>

      <div style="text-align:center;margin:32px 0;">
        <a href="${downloadUrl}"
           style="background:#111;color:#fff;text-decoration:none;padding:14px 32px;
                  border-radius:4px;font-family:monospace;font-size:15px;font-weight:bold;">
          Download Design Files
        </a>
      </div>

      <p style="font-size:13px;color:#888;">
        This link expires in ${expiresAt}. Design ID: <code>${designId}</code>
      </p>

      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
      <p style="font-size:12px;color:#aaa;">
        Questions? Reply to this email or contact
        <a href="mailto:${process.env.EMAIL_REPLY_TO || ''}" style="color:#888;">
          ${process.env.EMAIL_REPLY_TO || 'hello@creature-cycles.com'}
        </a>
      </p>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `Hi ${firstName},

Your bespoke bike design files are ready!

Download here: ${downloadUrl}

This link expires in ${expiresAt}.
Design ID: ${designId}

Files included:
  - design.json  (full geometry parameters)
  - design.pdf   (2D frame drawing)

Questions? Reply to this email.

– Creature Cycles`;

  await transport.sendMail({
    from: process.env.EMAIL_FROM || '"Creature Cycles" <hello@creature-cycles.com>',
    replyTo: process.env.EMAIL_REPLY_TO,
    to,
    subject: 'Your Bespoke Bike Design Files — Creature Cycles',
    text,
    html,
  });

  console.log(`[email] Sent download email to ${to} for design ${designId}`);
}

/**
 * Send an order confirmation email immediately after checkout is created
 * (before payment). Just lets the customer know we received their design.
 */
async function sendOrderConfirmation({ to, customerName, designId }) {
  if (!isConfigured()) return;

  const transport = createTransport();
  const firstName = customerName.split(' ')[0] || 'there';

  await transport.sendMail({
    from: process.env.EMAIL_FROM || '"Creature Cycles" <hello@creature-cycles.com>',
    replyTo: process.env.EMAIL_REPLY_TO,
    to,
    subject: `Creature Cycles — Design #${designId.slice(0, 8).toUpperCase()} received`,
    text: `Hi ${firstName},\n\nWe've received your bespoke bike design (ID: ${designId}).\n\nComplete your purchase at the checkout link we sent you and your design files will be emailed to you automatically.\n\n– Creature Cycles`,
  });
}

module.exports = { isConfigured, sendDownloadEmail, sendOrderConfirmation };
