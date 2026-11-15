import Stripe from 'stripe';
import { env } from './env.js';

if (!env.STRIPE_SECRET_KEY) {
  console.warn('⚠️  STRIPE_SECRET_KEY is not defined in environment variables.');
}

export const stripe = new Stripe(env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
  typescript: true,
});
