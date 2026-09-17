# Shelter Prep Phase 1 Capability Benchmark: Inspection Report Extraction

## Scope

This benchmark answers one Phase 1 question:

Can the current Shelter Prep extraction and AI organization path process real inspection reports, and how does it perform against human-reviewed truth?

Included:

- PDF/report extraction completeness
- Inspection finding extraction
- Basic finding organization
- Evidence/provenance retention
- Known vs Unknown separation where current output supports it
- Human correction burden, latency, and measured cost when available

Excluded:

- estimating
- contractor routing
- predictive maintenance
- pricing memory
- homeowner workflows
- autonomous agents
- future capability benchmarking

## Current Pipeline Discovered

Active checkout: `auto-button-from-current-main`.

The active runtime path is `src/main.tsx` -> `src/App.tsx`.

Current inspection-report handling in this checkout:

1. A user submits a lead/request in `src/App.tsx`.
2. Photos and documents are uploaded to Supabase Storage bucket `job-files`.
3. Uploaded file rows are inserted into `files` with `lead_id`, `file_url`, and `file_name` when a lead ID exists.
4. The request loader maps `leads` rows into the local `WorkRequest` shape.
5. Seller Prep organization is triggered through the external Railway endpoint `run-seller-prep-analysis`, using lead/request metadata.
6. Seller Prep review loads `seller_prep_analyses` and `seller_prep_items` rows by `lead_id` / `analysis_id`.

There is no local inspection PDF parser, OCR component, or first-class inspection-finding extraction function in this active checkout.

Invoice extraction exists as a referenced Supabase Edge Function name, `extract-invoice`, but that function implementation is not present in this checkout and it is invoice-focused, not inspection-report-focused.

## Commodity Components Currently Used

Only components visible in the active checkout are listed.

| Capability | Current implementation | Interface / contract | Input | Output | Benchmark metrics | Swappable without higher-level workflow change? |
| --- | --- | --- | --- | --- | --- | --- |
| Client database/storage access | `@supabase/supabase-js` in `src/supabase.ts` and `src/lib/supabase.ts` | Supabase client for table reads/writes, storage upload, signed URLs, and function invoke | Browser-side env URL and anon key; file/blob/table payloads | Supabase rows, storage objects, signed URLs, function responses | Evidence retention, latency where output records it | Partly. Data contract must stay stable. |
| Request document storage | Supabase Storage bucket `job-files` via `uploadRequestFiles` | Upload by storage path and optional `files` row | Uploaded photos/documents | Storage object plus thin `files` row | Evidence/provenance retention | Yes if storage path and file metadata contract remain stable. |
| Seller Prep organization | External Railway endpoint `run-seller-prep-analysis` called from `App.tsx` | HTTP POST with `leadId`, description, work type, ZIP, request | Lead/request metadata | `seller_prep_analyses` and `seller_prep_items` rows, as loaded by the app | Finding recall, unsupported claims, organization, evidence fidelity if output includes evidence | Yes if output is adapted to the benchmark/system-output contract. Current evidence linkage is weak. |
| AI estimate/material/takeoff calls | Supabase functions and Railway endpoints referenced in `App.tsx` | Button-triggered function or HTTP calls | Lead/request metadata | Draft estimate/material/takeoff rows or responses | Out of scope for this benchmark | Not assessed here. |
| Runtime PDF page-count inspection for benchmark only | `pdfinfo` binary available in the local Codex runtime | CLI page-count probe | Local benchmark PDF path | Page count and file size | Expected pages vs actual PDF pages | Yes. This is benchmark support, not production pipeline. |

Current missing commodity components for inspection reports:

- No repository-owned PDF text extraction adapter.
- No repository-owned OCR adapter.
- No document layout parser.
- No checked-in inspection multimodal model integration.

## Shelter Prep-Owned Layer

The durable Shelter Prep layer is not the parser, OCR engine, or model provider.

Shelter Prep should own:

- property-centered context
- evidence/provenance
- workflow contracts
- Known vs Unknown rules
- human review gates
- repair organization logic
- benchmark corpus
- human corrections
- verified outcomes
- future verified operational memory

The benchmark contract protects this boundary by keeping:

- raw report file reference in `manifest.json`
- system output in `system-output.json`
- human-reviewed expected truth in `expected-truth.json`
- computed benchmark result in `runs/<run-id>/<report-id>.result.json`

AI output is never promoted into truth automatically.

## Benchmark Data Format

Each real report gets one case folder:

```text
benchmarks/inspection-reports/cases/<report-id>/
  manifest.json
  expected-truth.json
  system-output.json
```

The private PDF is referenced from:

```text
benchmarks/inspection-reports/private-reports/<report-id>/inspection-report.pdf
```

`manifest.json` records report characteristics such as:

- real report
- short report
- long report
- photo-heavy
- text-heavy
- scanned report
- table-heavy
- unusual layout
- inspector/vendor
- PDF generator if known

`expected-truth.json` is the human-reviewed record. It captures expected page count, meaningful findings, critical findings, evidence expectations, system matches, missed findings, unsupported claims, duplicate findings, classification errors, evidence linkage errors, Known/Unknown errors, organization score, correction burden, review time, and reviewer notes.

`system-output.json` stores the current system result. It may be exported from the app, Railway response, Supabase rows, or a local adapter. It remains separate from truth.

## Metrics

The CLI computes or reports:

- expected pages
- actual PDF page count when `pdfinfo` is available
- pages successfully extracted
- failed pages
- empty pages where content was expected
- text character count when supplied
- extraction completeness: Pass / Partial / Fail / NOT MEASURED
- expected meaningful findings
- captured meaningful findings
- missed findings
- finding recall when human match/correction data exists
- unsupported claims
- duplicate findings
- evidence fidelity: Pass / Partial / Fail / Not Reviewed
- Known/Unknown fidelity: Pass / Partial / Fail / Not Supported / Not Reviewed
- organization usefulness: 1-5 when reviewed
- human correction burden: Low / Medium / High
- review time and correction count when recorded
- extraction, organization, and total latency when supplied
- cost only when supplied; otherwise `NOT MEASURED`
- final acceptance: Pass / Needs Work / Fail

If human match data has not been recorded, finding recall is `NOT MEASURED`.

## Future Agent Contract

Do not implement new agents for this benchmark. A future agent may plug into Shelter Prep rails only if it defines:

- agent name
- purpose
- allowed inputs
- allowed evidence/source types
- allowed tools/services
- output schema
- provenance requirements
- required human review gate
- storage destination
- downstream consumers
- memory eligibility

Minimum contract:

```json
{
  "agentName": "",
  "purpose": "",
  "allowedInputs": [],
  "allowedEvidenceSourceTypes": [],
  "allowedToolsOrServices": [],
  "outputSchema": "",
  "provenanceRequirements": [
    "source document",
    "page or evidence object when supported",
    "excerpt or text span when supported",
    "prompt/model/provider version when AI is used"
  ],
  "requiredHumanReviewGate": "needs_review",
  "storageDestination": "",
  "downstreamConsumers": [],
  "memoryEligibility": "not eligible until human-reviewed outcome exists"
}
```

New agents must reuse existing evidence, provenance, review, and workflow rails. They must not create a parallel truth, memory, or approval system.

## Current Weaknesses

- No local inspection extraction pipeline is present in this checkout.
- Current file metadata is too thin for claim-level provenance.
- Seller Prep items can be loaded, but they are not strongly typed in `App.tsx`.
- Current benchmark can evaluate system output, but it cannot prove real-report success until a real report, human truth, and system output are supplied.
- Cost is not measured unless the current system output includes it.

## Commands

Create a case:

```bash
npm run benchmark:inspection:init -- --report-id first-real-report --report-path benchmarks/inspection-reports/private-reports/first-real-report/inspection-report.pdf --characteristics real_report,photo_heavy
```

Run all cases:

```bash
npm run benchmark:inspection
```

Run one case:

```bash
node scripts/inspection-report-benchmark.mjs run --case first-real-report
```
