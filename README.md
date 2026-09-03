# AI-PCRAF v3.0 — Next.js

AI-Powered Cyber Risk Assurance Framework for Indian BFSI IT Audit.

## Stack
- Next.js 14 (App Router)
- React 18
- Tailwind CSS
- Supabase (PostgreSQL + Auth)
- Groq LLM (openai/gpt-oss-120b)
- Vercel hosting

## Setup

1. Clone repo
2. `npm install`
3. Copy `.env.local.example` to `.env.local` and fill values
4. `npm run dev`

## Deploy to Vercel

Push to GitHub. Vercel auto-deploys on push.

Add environment variables in Vercel → Settings → Environment Variables:
- `PCRAF_Key` — Groq API key
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key

## Supabase Schema

Run all schema files in order:
1. `supabase_schema.sql` (M2)
2. `supabase_schema_m3.sql` (M3)
3. `supabase_schema_m5.sql` (M5)

## Regulatory scope

RBI IT Gov MD 2023 · CERT-In Directions April 2022 · DPDP Act 2023 · NCIIPC · ReBIT · IFTAS
