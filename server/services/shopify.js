'use strict';

/**
 * Shopify Draft Orders API
 *
 * Creates a draft order containing the bespoke design files product.
 * The design ID is stored in order note_attributes so the webhook handler
 * can look it up after payment.
 *
 * Requires environment variables:
 *   SHOPIFY_STORE_DOMAIN, SHOPIFY_ADMIN_API_TOKEN, SHOPIFY_API_VERSION,
 *   SHOPIFY_PRODUCT_VARIANT_ID, SHOPIFY_PRODUCT_PRICE
 */

const DOMAIN      = process.env.SHOPIFY_STORE_DOMAIN;
const TOKEN       = process.env.SHOPIFY_ADMIN_API_TOKEN;
const API_VERSION = process.env.SHOPIFY_API_VERSION || '2024-01';

function isConfigured() {
  return !!(DOMAIN && TOKEN && process.env.SHOPIFY_PRODUCT_VARIANT_ID);
}

/**
 * Build the Admin API URL for a given path.
 */
function apiUrl(path) {
  return `https://${DOMAIN}/admin/api/${API_VERSION}${path}`;
}

/**
 * POST / PUT / GET helper with auth headers.
 */
async function shopifyFetch(path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': TOKEN,
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(apiUrl(path), opts);
  const data = await res.json();
  if (!res.ok) {
    const msg = JSON.stringify(data.errors || data);
    throw new Error(`Shopify ${method} ${path} → ${res.status}: ${msg}`);
  }
  return data;
}

/**
 * Create a Shopify draft order for a single bespoke design product.
 *
 * @param {object} opts
 * @param {string} opts.designId        - Our internal design UUID
 * @param {string} opts.customerName
 * @param {string} opts.customerEmail
 * @param {object} opts.params          - Bike geometry params (for line-item properties)
 * @returns {{ checkoutUrl: string, shopifyOrderId: string }}
 */
async function createDraftOrder({ designId, customerName, customerEmail, params }) {
  if (!isConfigured()) {
    throw new Error('Shopify is not configured. Check SHOPIFY_* environment variables.');
  }

  const variantId = process.env.SHOPIFY_PRODUCT_VARIANT_ID;
  const price     = process.env.SHOPIFY_PRODUCT_PRICE || '49.00';

  // Build a human-readable summary of key geometry for the order line item
  const geometrySummary = [
    params.reach          && `Reach: ${params.reach}mm`,
    params.chainstay_length && `CS: ${params.chainstay_length}mm`,
    params.ht_angle       && `HTA: ${params.ht_angle}°`,
    params.st_angle       && `STA: ${params.st_angle}°`,
    params.bb_drop        && `BB Drop: ${params.bb_drop}mm`,
  ].filter(Boolean).join(', ');

  const payload = {
    draft_order: {
      line_items: [
        {
          variant_id: Number(variantId),
          quantity: 1,
          price,
          properties: [
            { name: 'Design ID', value: designId },
            { name: 'Geometry', value: geometrySummary },
          ],
        },
      ],
      customer: {
        first_name: customerName.split(' ')[0] || customerName,
        last_name: customerName.split(' ').slice(1).join(' ') || '',
        email: customerEmail,
      },
      email: customerEmail,
      note: `Bespoke bike design — ID: ${designId}`,
      note_attributes: [
        { name: 'design_id', value: designId },
      ],
      use_customer_default_address: false,
    },
  };

  const data = await shopifyFetch('/draft_orders.json', 'POST', payload);
  const draft = data.draft_order;

  return {
    shopifyOrderId: String(draft.id),
    checkoutUrl: draft.invoice_url, // Shopify hosted payment page
  };
}

/**
 * Given an order ID from the webhook payload, return the design_id
 * stored in note_attributes (set when the draft order was created).
 *
 * @param {string|number} shopifyOrderId
 * @returns {string|null} designId
 */
async function getDesignIdFromOrder(shopifyOrderId) {
  if (!isConfigured()) return null;
  try {
    const data = await shopifyFetch(`/orders/${shopifyOrderId}.json`);
    const attrs = data.order?.note_attributes || [];
    const attr = attrs.find(a => a.name === 'design_id');
    return attr ? attr.value : null;
  } catch (err) {
    console.error('shopify.getDesignIdFromOrder error:', err.message);
    return null;
  }
}

module.exports = { isConfigured, createDraftOrder, getDesignIdFromOrder };
