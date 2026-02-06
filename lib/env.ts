// lib/env.ts
import { z } from "zod";

const envSchema = z.object({
  // Stripe
  STRIPE_SECRET_KEY: z.string().min(1),

  // URL site
  NEXT_PUBLIC_SITE_URL: z.string().url(),

  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

export const env = envSchema.parse(process.env);
