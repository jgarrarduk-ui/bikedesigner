'use strict';

/**
 * Shopify webhook handler
 *
 * Listens for `orders/paid` events from Shopify.
 * On receipt: validates HMAC, finds matching design, generates download token,
 * sends email with download link.
 *
 * Shopify setup:
 *   Admin → Settings → Notifications → Webhooks
 *   Topic: orders/paid
 *   URL:   https://your-domain.com/api/webhooks/shopify/orders-paid
 *   Format: JSON
 *   Secret: set as SHOPIFY_WEBHOOK_SECRET env var
 */

const express  = require('express');
const crypto   = require('crypto');
const { v4: uuidv4 } = require('uuid');
const db       = require('../db');
const email    = require('../services/email');
const shopify  = require('../services/shopify');

const router = express.Router();

// ── HMAC validation middleware ───────────────────────────────────────────────
function verifyShopifyHmac(req, res, next) {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret) {
    // Webhook secret not configured — allow through in dev, warn loudly
    console.warn('[webhook] SHOPIFY_WEBHOOK_SECRET not set — skipping HMAC check (dev mode only)');
    return next();
  }

  const hmacHeader = req.headers['x-shopify-hmac-sha256'];
  if (!hmacHeader) {
    return res.status(401).json({ error: 'Missing HMAC header' });
  }

  // req.rawBody is populated by express.raw() in index.js for this route
  const digest = crypto
    .createHmac('sha256', secret)
    .update(req.rawBody)
    .digest('base64');

  const safe = Buffer.from(digest);
  const provided = Buffer.from(hmacHeader);

  if (safe.length !== provided.length || !crypto.timingSafeEqual(safe, provided)) {
    console.warn('[webhook] HMAC mismatch — rejecting request');
    return res.status(401).json({ error: 'HMAC verification failed' });
  }

  next();
}

// ── orders/paid ──────────────────────────────────────────────────────────────
router.post(
  '/shopify/orders-paid',
  express.raw({ type: 'application/json' }),  // raw body for HMAC
  (req, res, next) => {
    req.rawBody = req.body;
    try { req.body = JSON.parse(req.rawBody.toString('utf8')); } catch { req.body = {}; }
    next();
  },
  verifyShopifyHmac,
  async (req, res) => {
    // Acknowledge Shopify immediately (must respond within 5s)
    res.status(200).json({ received: true });

    const order = req.body;
    const shopifyOrderId = String(order.id || '');
    console.log(`[webhook] orders/paid — Shopify order ${shopifyOrderId}`);

    if (!shopifyOrderId) return;

    // ── Find design by Shopify order ID ─────────────────────────────────────
    let design = db.prepare('SELECT * FROM designs WHERE shopify_order_id = ?').get(shopifyOrderId);

    // Fallback: look up design_id from note_attributes via Shopify API
    if (!design) {
      const designId = await shopify.getDesignIdFromOrder(shopifyOrderId);
      if (designId) {
        design = db.prepare('SELECT * FROM designs WHERE id = ?').get(designId);
      }
    }

    if (!design) {
      console.warn(`[webhook] No design found for Shopify order ${shopifyOrderId}`);
      return;
    }

    if (design.status === 'paid' || design.status === 'delivered') {
      console.info(`[webhook] Design ${design.id} already processed — skipping`);
      return;
    }

    // ── Mark as paid, generate download token ────────────────────────────────
    const downloadToken = uuidv4().replace(/-/g, '');
    const expiryHours   = Number(process.env.DOWNLOAD_TOKEN_EXPIRES_HOURS) || 72;
    const expiresAt     = new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString();

    db.prepare(`
      UPDATE designs
      SET status = 'paid', download_token = ?, download_expires_at = ?
      WHERE id = ?
    `).run(downloadToken, expiresAt, design.id);

    // ── Send download email ──────────────────────────────────────────────────
    const base        = process.env.BASE_URL || 'http://localhost:3001';
    const downloadUrl = `${base}/api/download/${downloadToken}`;
    const expiresText = `${expiryHours} hours`;

    try {
      await email.sendDownloadEmail({
        to: design.customer_email,
        customerName: design.customer_name,
        designId: design.id,
        downloadUrl,
        expiresAt: expiresText,
      });

      db.prepare(`UPDATE designs SET status = 'delivered', delivered_at = CURRENT_TIMESTAMP WHERE id = ?`)
        .run(design.id);

      console.log(`[webhook] Delivered design ${design.id} to ${design.customer_email}`);
    } catch (err) {
      console.error(`[webhook] Failed to send email for design ${design.id}:`, err.message);
      db.prepare(`UPDATE designs SET status = 'failed' WHERE id = ?`).run(design.id);
    }
  },
);

module.exports = router;
