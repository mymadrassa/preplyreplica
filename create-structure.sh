#!/bin/bash
# create-structure.sh
# Usage: bash create-structure.sh
# Run this inside the folder where you cloned preplyreplica (or it will create it)

set -e

ROOT="preplyreplica"

# If you already cloned the repo and are inside it, comment the next 2 lines
mkdir -p "$ROOT"
cd "$ROOT"

echo "Creating folder structure..."

# ---------- src/app ----------
mkdir -p src/app/\(public\)/teachers/\[id\]
mkdir -p src/app/\(auth\)/login
mkdir -p src/app/\(auth\)/register
mkdir -p src/app/\(student\)/dashboard
mkdir -p src/app/\(student\)/bookings
mkdir -p src/app/\(teacher\)/onboarding
mkdir -p src/app/\(teacher\)/dashboard
mkdir -p src/app/\(teacher\)/availability
mkdir -p src/app/\(admin\)/dashboard
mkdir -p src/app/session/\[bookingId\]

# ---------- api routes ----------
mkdir -p src/app/api/teacher/onboard
mkdir -p src/app/api/teacher/validate
mkdir -p src/app/api/bookings
mkdir -p src/app/api/webhooks/stripe

# ---------- lib ----------
mkdir -p src/lib/supabase

# ---------- components ----------
mkdir -p src/components

# ---------- types ----------
mkdir -p src/types

# ---------- supabase migrations ----------
mkdir -p supabase/migrations

# ---------- locales ----------
mkdir -p locales/en

echo "Creating empty files..."

# app files
touch src/app/layout.tsx
touch src/app/globals.css
touch "src/app/(public)/page.tsx"
touch "src/app/(public)/teachers/page.tsx"
touch "src/app/(public)/teachers/[id]/page.tsx"
touch "src/app/(auth)/login/page.tsx"
touch "src/app/(auth)/register/page.tsx"
touch "src/app/(student)/dashboard/page.tsx"
touch "src/app/(student)/bookings/page.tsx"
touch "src/app/(teacher)/onboarding/page.tsx"
touch "src/app/(teacher)/dashboard/page.tsx"
touch "src/app/(teacher)/availability/page.tsx"
touch "src/app/(admin)/dashboard/page.tsx"
touch "src/app/session/[bookingId]/page.tsx"

# api files
touch src/app/api/teacher/onboard/route.ts
touch src/app/api/teacher/validate/route.ts
touch src/app/api/bookings/route.ts
touch src/app/api/webhooks/stripe/route.ts

# lib files
touch src/lib/supabase/client.ts
touch src/lib/supabase/server.ts
touch src/lib/stripe.ts
touch src/lib/jitsi.ts

# types
touch src/types/database.ts

# supabase migrations
touch supabase/migrations/0001_init.sql
touch supabase/migrations/0002_rls.sql

# locales
touch locales/en/common.json

# root files
touch .env.local.example
touch .gitignore
touch tsconfig.json
touch tailwind.config.ts
touch postcss.config.js
touch package.json
touch README.md

echo "✅ Structure created successfully."
find . -not -path '*/node_modules/*' -not -path '*/.git/*' | sort