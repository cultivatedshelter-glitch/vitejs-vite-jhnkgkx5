# Shelter Prep Inspection Report Capability Benchmark

Purpose: measure whether the current Shelter Prep extraction and AI organization path can process real inspection reports against human-reviewed truth.

This benchmark is intentionally not a generic AI benchmark platform. It is a local, repeatable contract around:

- PDF/report extraction completeness
- Inspection finding extraction
- Basic finding organization
- Evidence/provenance retention
- Known vs Unknown separation where current output supports it
- Human correction burden

## Folder Layout

```text
benchmarks/inspection-reports/
  cases/<report-id>/
    manifest.json
    expected-truth.json
    system-output.json
  private-reports/<report-id>/
    inspection-report.pdf
  runs/<run-id>/
    <report-id>.result.json
    aggregate.result.json
```

`private-reports/` and `runs/` are ignored by Git. Real reports often contain addresses, names, photos, and transaction details, so keep them local unless you intentionally create sanitized artifacts.

## Case Files

`manifest.json` identifies the report and points to the private PDF and related truth/output files.

`expected-truth.json` is human-reviewed truth. AI output alone is not ground truth. A founder/admin fills this in after reading the report and reviewing system output.

`system-output.json` is the current Shelter Prep pipeline output for that report. It can be exported from the current app, Railway agent output, Supabase rows, or a local extraction adapter, but it must stay separate from expected truth.

## Commands

Create a new real-report case skeleton:

```bash
npm run benchmark:inspection:init -- --report-id first-real-report --report-path benchmarks/inspection-reports/private-reports/first-real-report/inspection-report.pdf --characteristics real_report,photo_heavy
```

Run all benchmark cases:

```bash
npm run benchmark:inspection
```

Run one case:

```bash
node scripts/inspection-report-benchmark.mjs run --case first-real-report
```

The benchmark writes JSON result artifacts under `benchmarks/inspection-reports/runs/<run-id>/`.

## Human Review Rules

Do not promote AI output into expected truth. For each report, the human reviewer should record:

- expected page count
- meaningful findings expected
- critical findings expected
- findings missed by the system
- unsupported findings invented by the system
- duplicate or fragmented findings
- incorrect trade/system classification
- evidence linkage errors
- organization errors
- Known/Unknown errors
- correction burden, review time, and notes

If match/correction data has not been reviewed yet, leave it as `not_reviewed`. The benchmark will report finding recall as `NOT MEASURED` instead of inventing a score.

## Acceptance Boundary

Real-report benchmark success must be reported separately from synthetic unit tests. Synthetic data is acceptable for testing the benchmark code, but it is not evidence that Shelter Prep can process real inspection reports.
