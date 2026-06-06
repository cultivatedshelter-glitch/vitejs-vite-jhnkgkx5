# Shelter Prep Agent Instructions

Before changing code, read:

- /docs/SHELTER_PREP_MASTER_CODEX_PROMPT.md
- /docs/security-model.md
- /docs/schema-plan.md
- /docs/agent-architecture.md
- /docs/phase-1-build-order.md

Shelter Prep is operational infrastructure for property repair coordination.

Do not build it as:
- a chatbot
- an AI wrapper
- a contractor marketplace
- a feature-heavy dashboard
- autonomous estimating software

Build it as:
- property-centered workflow software
- inspection-to-scope coordination
- contractor-authored scope capture
- admin-verified structured summaries
- human-reviewed outputs
- secure Supabase-backed operational memory

Core principle:
Contractors author scope. AI structures it. Shelter Prep verifies it. Agents use it. Memory learns from approved outcomes.

Security rules:
- Never expose service role keys in frontend code.
- Do not use hardcoded admin PINs in production.
- Use Supabase Auth, profiles, roles, RLS, private buckets, and signed URLs.
- Browser is untrusted.
- Server controls approvals, verification, agent visibility, and memory creation.

UX rules:
- Reduce wasted motion.
- Reduce unnecessary decisions.
- Preserve workflow rhythm.
- Stage information clearly.
- Reveal the next action naturally.
- Keep one obvious next action per screen.
- Put complexity underneath the system, not on the surface.

Design philosophy:
Shelter Prep should feel useful, quiet, durable, and obvious.
Prioritize function over decoration.
Prioritize clarity over visual excitement.
Reduce visual noise.

Phase 1 focus:
Build the trust spine before adding features.

Do not build:
- full contractor portal
- marketplace logic
- predictive maintenance
- homeowner app
- LiDAR
- autonomous purchasing
- automatic memory learning