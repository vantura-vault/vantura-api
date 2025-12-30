import { Router, Request, Response } from 'express';
import express from 'express';
import { stripeService } from '../services/stripeService.js';

const router = Router();

/**
 * POST /webhooks/stripe
 * Handle Stripe webhook events
 *
 * Note: This endpoint uses raw body parsing for signature verification.
 * It must be mounted BEFORE the express.json() middleware.
 */
router.post(
  '/stripe',
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'] as string;

    if (!sig) {
      console.error('[Webhook] No Stripe signature header');
      res.status(400).json({ error: 'No signature header' });
      return;
    }

    if (!stripeService.isConfigured()) {
      console.error('[Webhook] Stripe not configured');
      res.status(400).json({ error: 'Stripe not configured' });
      return;
    }

    try {
      const event = stripeService.constructWebhookEvent(req.body, sig);
      await stripeService.handleWebhook(event);
      res.json({ received: true });
    } catch (error) {
      console.error('[Webhook] Error processing Stripe webhook:', error);
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Webhook error',
      });
    }
  }
);

export default router;
