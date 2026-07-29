# Preply Clone

This repository contains a Next.js 14 App Router MVP for an online tutoring marketplace built with Supabase and Stripe Connect.

## Features

- Student / Teacher / Admin roles
- Supabase Auth and profile onboarding
- Teacher onboarding with documents and Stripe Connect Express account creation
- Teacher availability and booking flow
- Stripe Checkout payment with platform commission and transfer to teacher account
- Jitsi Meet session room per booking
- Reviews and teacher rating aggregation
- Row Level Security policies for Supabase

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Copy environment sample:

```bash
cp .env.local.example .env.local
```

3. Fill in environment values for Supabase and Stripe.

4. Run the app:

```bash
npm run dev
```

## Supabase migrations

Use the Supabase CLI to apply migrations:

```bash
supabase db push
```

If you need to initialize your project from scratch:

```bash
supabase db reset
```

## Required environment variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_BUCKET_TEACHER_DOCS`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PLATFORM_FEE_PERCENT`

## Stripe Connect

1. Create a Stripe account and enable Connect.
2. Add the webhook endpoint to Stripe:
   - `https://<your-domain>/api/webhooks/stripe`
3. Use the `STRIPE_WEBHOOK_SECRET` from the Stripe dashboard.
4. Onboarding links are generated for teachers during onboarding.

## Deploying on Vercel

- Add environment variables in the Vercel dashboard.
- Make sure `NEXT_PUBLIC_APP_URL` points to your production domain.
- Deploy the project from the GitHub repository.
salam
