import Stripe from 'stripe';
import { config } from '../config/env.js';
import { prisma } from '../db.js';

// Initialize Stripe only if key is configured
const stripe = config.stripeSecretKey
  ? new Stripe(config.stripeSecretKey)
  : null;

export const stripeService = {
  /**
   * Check if Stripe is configured
   */
  isConfigured(): boolean {
    return stripe !== null;
  },

  /**
   * Create a Stripe customer for a company
   */
  async createCustomer(companyId: string, email: string, name: string) {
    if (!stripe) {
      throw new Error('Stripe not configured');
    }

    const customer = await stripe.customers.create({
      email,
      name,
      metadata: { companyId },
    });

    await prisma.company.update({
      where: { id: companyId },
      data: { stripeCustomerId: customer.id },
    });

    return customer;
  },

  /**
   * Get billing overview for admin dashboard
   */
  async getBillingOverview() {
    if (!stripe) {
      return {
        configured: false,
        message: 'Stripe not configured. Set STRIPE_SECRET_KEY in environment.',
      };
    }

    try {
      // Get active subscriptions from Stripe
      const subscriptions = await stripe.subscriptions.list({
        limit: 100,
        status: 'active',
      });

      // Get company counts by subscription status
      const [
        companiesWithStripe,
        trialingCount,
        activeCount,
        canceledCount,
        pastDueCount,
      ] = await Promise.all([
        prisma.company.count({
          where: { stripeCustomerId: { not: null } },
        }),
        prisma.company.count({ where: { subscriptionStatus: 'trialing' } }),
        prisma.company.count({ where: { subscriptionStatus: 'active' } }),
        prisma.company.count({ where: { subscriptionStatus: 'canceled' } }),
        prisma.company.count({ where: { subscriptionStatus: 'past_due' } }),
      ]);

      // Calculate MRR from active subscriptions
      const mrr = subscriptions.data.reduce((sum, sub) => {
        const item = sub.items.data[0];
        if (!item?.price?.unit_amount) return sum;

        const amount = item.price.unit_amount / 100; // Convert cents to dollars
        const interval = item.price.recurring?.interval;

        // Normalize to monthly
        if (interval === 'year') {
          return sum + amount / 12;
        }
        return sum + amount;
      }, 0);

      return {
        configured: true,
        mrr: Math.round(mrr * 100) / 100, // Round to 2 decimal places
        activeSubscriptions: subscriptions.data.length,
        companiesWithStripe,
        byStatus: {
          trialing: trialingCount,
          active: activeCount,
          canceled: canceledCount,
          pastDue: pastDueCount,
        },
      };
    } catch (error) {
      console.error('[StripeService] Error fetching billing overview:', error);
      return {
        configured: true,
        error: error instanceof Error ? error.message : 'Failed to fetch Stripe data',
        mrr: 0,
        activeSubscriptions: 0,
        companiesWithStripe: 0,
        byStatus: { trialing: 0, active: 0, canceled: 0, pastDue: 0 },
      };
    }
  },

  /**
   * Handle Stripe webhook events
   */
  async handleWebhook(event: Stripe.Event) {
    console.log(`[StripeService] Handling webhook: ${event.type}`);

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        // Access subscription properties safely
        const currentPeriodEnd = (subscription as unknown as { current_period_end?: number }).current_period_end;
        const trialEnd = (subscription as unknown as { trial_end?: number | null }).trial_end;

        await prisma.company.updateMany({
          where: { stripeCustomerId: customerId },
          data: {
            stripeSubscriptionId: subscription.id,
            subscriptionStatus: subscription.status,
            currentPeriodEnd: currentPeriodEnd
              ? new Date(currentPeriodEnd * 1000)
              : null,
            trialEndsAt: trialEnd ? new Date(trialEnd * 1000) : null,
          },
        });
        console.log(`[StripeService] Updated subscription for customer ${customerId}`);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        await prisma.company.updateMany({
          where: { stripeCustomerId: customerId },
          data: {
            subscriptionStatus: 'canceled',
          },
        });
        console.log(`[StripeService] Marked subscription canceled for customer ${customerId}`);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        await prisma.company.updateMany({
          where: { stripeCustomerId: customerId },
          data: {
            subscriptionStatus: 'past_due',
          },
        });
        console.log(`[StripeService] Marked payment failed for customer ${customerId}`);
        break;
      }

      default:
        console.log(`[StripeService] Unhandled event type: ${event.type}`);
    }
  },

  /**
   * Construct webhook event from raw body and signature
   */
  constructWebhookEvent(rawBody: Buffer, signature: string): Stripe.Event {
    if (!stripe || !config.stripeWebhookSecret) {
      throw new Error('Stripe webhook not configured');
    }

    return stripe.webhooks.constructEvent(
      rawBody,
      signature,
      config.stripeWebhookSecret
    );
  },
};
