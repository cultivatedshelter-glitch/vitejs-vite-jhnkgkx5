# Shelter Prep Phase 1 Executable Spec

This file points Codex to the locked Phase 1 authority document:

/docs/ShelterPrep_Phase1_CodexPrompt_v2.pdf

Execution rules:
- Run one step per Codex pass.
- Stop and report after every gate.
- Do not implement all Phase 1 steps at once.
- Do not add Phase 2+ features.
- Do not add agents beyond the allowed six.
- The app becomes reliable first, then intelligent.

Current status:
- Step 1 Job Zero: complete at commit bc9230e.
- Step 2 Build Pass: complete at commit bc9230e.
- Next approved step: Step 3, Supabase Tables migration files only.

Step 3 rule:
Generate migration files only.
Do not apply migrations.
Stop and report migration summary, down-migration, risk notes, and manual test checklist.