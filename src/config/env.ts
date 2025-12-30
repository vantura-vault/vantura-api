import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  // LLM configuration for Post Suggestions
  llmApiKey: process.env.LLM_API_KEY,
  llmApiBase: process.env.LLM_API_BASE || 'https://api.openai.com/v1',
  llmModel: process.env.LLM_MODEL || 'gpt-4o-mini',
  // Super Admin configuration
  superAdminEmails: (process.env.SUPER_ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
  // Stripe configuration
  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
};
