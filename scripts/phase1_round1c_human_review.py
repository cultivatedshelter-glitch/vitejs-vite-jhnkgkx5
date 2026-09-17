#!/usr/bin/env python3
"""Build a local/private Round 1C human-review worksheet from Round 1B output."""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = ROOT / "local-fixtures/round1-reasoning-benchmark/jo-court-reasoning-artifact.json"
DEFAULT_OUTPUT_DIR = ROOT / "local-fixtures/round1c-human-review"
DEFAULT_JSON_FILE = "jo-court-human-review.json"
DEFAULT_MARKDOWN_FILE = "jo-court-human-review.md"

SCHEMA_VERSION = "shelter-prep-phase1-round1c-border-crossing.v1"
STATUS_PARTIAL = "PARTIAL"
STATUS_PROVEN = "PROVEN"
STATUS_NOT_IMPLEMENTED = "NOT_IMPLEMENTED"

DECISIONS = ["approve", "edit", "reject", "split", "keep_separate", "needs_more_evidence"]
HUMAN_REVIEWED_STATE = "human_reviewed_interpretation"

ATTENTION_PRIORITY = {
    "safety_life_safety": 1,
    "active_damage_or_water": 2,
    "major_system_or_lifecycle": 3,
    "functional_defect": 4,
    "needs_more_info": 5,
    "deferred_maintenance": 7,
    "cosmetic_or_information": 7,
}

REVIEW_TYPE_PRIORITY = {
    "potential_condition_relationship": 1,
    "unresolved_condition": 2,
    "operational_review_bundle": 3,
}

MATERIAL_UNRESOLVED_CATEGORIES = {
    "safety_life_safety",
    "active_damage_or_water",
    "major_system_or_lifecycle",
    "needs_more_info",
}

HUMAN_CORRECTION_FIELDS = [
    "reviewer_decision",
    "reviewer_corrected_interpretation",
    "reviewer_corrected_relationship",
    "reviewer_corrected_known",
    "reviewer_corrected_unknowns",
    "reviewer_corrected_next_evidence",
    "reviewer_reason",
    "reviewer_notes",
]

TELEMETRY_FIELDS = [
    "review_started_at",
    "review_completed_at",
    "review_seconds",
    "decision",
    "source_evidence_opened",
    "photos_opened",
    "provenance_opened",
    "interpretation_edited",
    "unknowns_edited",
    "next_evidence_edited",
    "relationship_changed",
    "reviewer_notes_added",
]


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def canonical_json_bytes(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def sha256_value(value: Any) -> str:
    return hashlib.sha256(canonical_json_bytes(value)).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def stable_slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-") or "item"


def clean_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def truncate(value: str, limit: int = 92) -> str:
    value = clean_text(value)
    if len(value) <= limit:
        return value
    return value[: limit - 1].rstrip() + "…"


def unique_strings(values: list[Any]) -> list[str]:
    result: list[str] = []
    for value in values:
        text = clean_text(value)
        if text and text not in result:
            result.append(text)
    return result


def git_ignores(path: Path) -> bool:
    result = subprocess.run(
        ["git", "check-ignore", "-q", str(path)],
        cwd=ROOT,
        check=False,
        capture_output=True,
        text=True,
    )
    return result.returncode == 0


def empty_human_review() -> dict[str, Any]:
    correction = {field: None for field in HUMAN_CORRECTION_FIELDS}
    telemetry = {field: None for field in TELEMETRY_FIELDS}
    return {
        "current_status": "ai_draft_pending_review",
        "allowed_decisions": list(DECISIONS),
        "correction": correction,
        "telemetry": telemetry,
        "border_crossing_result": None,
    }


def source_reference(record: dict[str, Any]) -> dict[str, Any]:
    source = record.get("source", {})
    return {
        "atomic_observation_id": record.get("id"),
        "source_finding_id": record.get("source_finding_id"),
        "source_page": source.get("source_page"),
        "source_section": source.get("source_section"),
        "source_item_number": source.get("source_item_number"),
        "source_file_id": source.get("source_file_id"),
        "provenance": copy.deepcopy(source.get("provenance")),
    }


def source_observation(record: dict[str, Any]) -> dict[str, Any]:
    source = record.get("source", {})
    evidence = record.get("evidence_links", {})
    return {
        "atomic_observation_id": record.get("id"),
        "inspector_statement": source.get("inspector_statement"),
        "inspector_recommendation": source.get("inspector_recommendation"),
        "source_reference": source_reference(record),
        "image_and_evidence_references": {
            "photo_caption_ids": copy.deepcopy(evidence.get("photo_caption_ids", [])),
            "image_ids": copy.deepcopy(evidence.get("image_ids", [])),
            "image_hashes": copy.deepcopy(evidence.get("image_hashes", [])),
            "cached_visual_evidence_ids": copy.deepcopy(evidence.get("cached_visual_evidence_ids", [])),
        },
    }


def source_backed_known(records: list[dict[str, Any]]) -> list[str]:
    known: list[str] = []
    for record in records:
        source = record.get("source", {})
        statement = clean_text(source.get("inspector_statement"))
        recommendation = clean_text(source.get("inspector_recommendation"))
        cause = clean_text(record.get("epistemic_states", {}).get("source_stated_cause"))
        if statement:
            known.append(f"Inspector reports: {statement}")
        if recommendation:
            known.append(f"Inspector recommends: {recommendation}")
        if cause:
            known.append(f"Inspector-stated cause: {cause}")
    return unique_strings(known)


def unresolved_unknowns(records: list[dict[str, Any]]) -> list[str]:
    unknowns: list[str] = []
    for record in records:
        unknowns.extend(record.get("epistemic_states", {}).get("unknowns", []))
    return unique_strings(unknowns)


def card_context(records: list[dict[str, Any]]) -> dict[str, Any]:
    categories = unique_strings(
        [record.get("organization", {}).get("technical_attention_category") for record in records]
    )
    category = min(categories, key=lambda item: ATTENTION_PRIORITY.get(item, 99)) if categories else "needs_more_info"
    return {
        "technical_attention_category": category,
        "system": " / ".join(
            unique_strings([record.get("organization", {}).get("building_system") for record in records])
        ),
        "components": unique_strings(
            [
                component
                for record in records
                for component in record.get("organization", {}).get("components", [])
            ]
        ),
        "locations": unique_strings(
            [location for record in records for location in record.get("organization", {}).get("locations", [])]
        ),
    }


def normalized_next_evidence(value: dict[str, Any]) -> dict[str, Any]:
    return {
        "blocking_uncertainty": value.get("uncertainty"),
        "smallest_useful_evidence": value.get("smallest_fact_or_check") or value.get("next_evidence_needed"),
        "evidence_owner": value.get("owner"),
        "why_it_materially_changes_the_decision": value.get("why_it_matters"),
        "materiality": copy.deepcopy(value.get("materiality", [])),
        "new_evidence_requested": value.get("new_evidence_requested"),
    }


def relationship_card(
    candidate: dict[str, Any],
    records_by_id: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    related_ids = candidate.get("related_atomic_observation_ids", [])
    records = [records_by_id[item_id] for item_id in related_ids if item_id in records_by_id]
    context = card_context(records)
    title = clean_text(candidate.get("label")) or "Relationship review"
    return {
        "review_item_id": "review-" + stable_slug(str(candidate.get("id", title))),
        "concise_title": title,
        "review_type": candidate.get("type"),
        **context,
        "source": {
            "source_backed_observations": [source_observation(record) for record in records],
            "source_references": [source_reference(record) for record in records],
        },
        "shelter_prep_draft": {
            "interpretation": candidate.get("cautious_hypothesis"),
            "relationship_hypothesis": candidate.get("label")
            if candidate.get("type") == "potential_condition_relationship"
            else None,
            "relationship_confidence": candidate.get("confidence"),
            "why_shelter_prep_surfaced_it": candidate.get("basis"),
            "machine_relationship_id": candidate.get("id"),
            "machine_output_path": f"relationshipCandidates/{candidate.get('id')}",
        },
        "known": source_backed_known(records),
        "unknown": unique_strings(candidate.get("what_is_unknown", [])) or unresolved_unknowns(records),
        "why_this_matters": candidate.get("why_relationship_matters"),
        "next_evidence": normalized_next_evidence(candidate.get("smallest_useful_next_evidence", {})),
        "human_review": empty_human_review(),
    }


def unresolved_condition_card(record: dict[str, Any]) -> dict[str, Any]:
    source = record.get("source", {})
    context = card_context([record])
    title = "Unresolved: " + truncate(source.get("inspector_statement", "condition review"), 82)
    return {
        "review_item_id": "review-unresolved-" + stable_slug(str(record.get("id", title))),
        "concise_title": title,
        "review_type": "unresolved_condition",
        **context,
        "source": {
            "source_backed_observations": [source_observation(record)],
            "source_references": [source_reference(record)],
        },
        "shelter_prep_draft": {
            "interpretation": record.get("epistemic_states", {}).get("shelter_prep_interpretation"),
            "relationship_hypothesis": None,
            "relationship_confidence": None,
            "why_shelter_prep_surfaced_it": (
                "This unresolved source condition has technical importance and a decision-specific evidence request, "
                "but it is not represented as a condition relationship."
            ),
            "machine_atomic_observation_id": record.get("id"),
            "machine_output_path": f"atomicObservations/{record.get('id')}",
        },
        "known": source_backed_known([record]),
        "unknown": unresolved_unknowns([record]),
        "why_this_matters": (
            "Human confirmation determines whether this interpretation is operationally useful and whether the proposed "
            "next evidence is proportionate."
        ),
        "next_evidence": normalized_next_evidence(record.get("smallest_useful_next_evidence", {})),
        "human_review": empty_human_review(),
    }


def sort_cards(cards: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(
        cards,
        key=lambda card: (
            ATTENTION_PRIORITY.get(card.get("technical_attention_category", ""), 99),
            REVIEW_TYPE_PRIORITY.get(card.get("review_type", ""), 99),
            clean_text(card.get("concise_title")).lower(),
        ),
    )


def build_primary_review_cards(round1b: dict[str, Any]) -> list[dict[str, Any]]:
    records = round1b.get("atomicObservations", [])
    records_by_id = {record.get("id"): record for record in records}
    relationships = round1b.get("relationshipCandidates", [])
    condition_candidates = [
        candidate for candidate in relationships if candidate.get("type") == "potential_condition_relationship"
    ]
    operational_bundles = [
        candidate for candidate in relationships if candidate.get("type") == "operational_review_bundle"
    ]
    condition_related_ids = {
        item_id for candidate in condition_candidates for item_id in candidate.get("related_atomic_observation_ids", [])
    }
    unresolved_records = [
        record
        for record in records
        if record.get("id") not in condition_related_ids
        and record.get("organization", {}).get("technical_attention_category") in MATERIAL_UNRESOLVED_CATEGORIES
        and record.get("smallest_useful_next_evidence", {}).get("new_evidence_requested") is True
    ]
    cards = [relationship_card(candidate, records_by_id) for candidate in condition_candidates]
    cards.extend(unresolved_condition_card(record) for record in unresolved_records)
    cards.extend(relationship_card(candidate, records_by_id) for candidate in operational_bundles)
    return sort_cards(cards)


def supporting_context(round1b: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
    relationships = round1b.get("relationshipCandidates", [])
    return {
        "shared_location_context": [
            copy.deepcopy(candidate) for candidate in relationships if candidate.get("type") == "shared_location_context"
        ],
        "shared_system_context": [
            copy.deepcopy(candidate) for candidate in relationships if candidate.get("type") == "shared_system_context"
        ],
    }


def transition_result(decision: str, correction: dict[str, Any] | None = None) -> str:
    if decision not in DECISIONS:
        raise ValueError(f"Unsupported reviewer decision: {decision}")
    if decision == "approve":
        return HUMAN_REVIEWED_STATE
    if decision == "edit":
        correction = correction or {}
        meaningful = any(
            correction.get(field) not in (None, "", [])
            for field in HUMAN_CORRECTION_FIELDS
            if field not in {"reviewer_decision", "reviewer_notes"}
        )
        if not meaningful:
            raise ValueError("Edit requires a completed reviewer correction before border crossing")
        return HUMAN_REVIEWED_STATE
    if decision == "reject":
        return "rejected_ai_draft"
    if decision == "split":
        return "split_required"
    if decision == "keep_separate":
        return "relationship_rejected_observations_preserved"
    return "unresolved_waiting_for_evidence"


def apply_review_decision(
    card: dict[str, Any],
    decision: str,
    correction: dict[str, Any] | None = None,
) -> dict[str, Any]:
    reviewed = copy.deepcopy(card)
    correction_payload = {field: None for field in HUMAN_CORRECTION_FIELDS}
    correction_payload.update(copy.deepcopy(correction or {}))
    correction_payload["reviewer_decision"] = decision
    reviewed["human_review"]["correction"] = correction_payload
    reviewed["human_review"]["telemetry"]["decision"] = decision
    reviewed["human_review"]["border_crossing_result"] = transition_result(decision, correction_payload)
    reviewed["human_review"]["current_status"] = reviewed["human_review"]["border_crossing_result"]
    return reviewed


def source_findings_represented(cards: list[dict[str, Any]]) -> set[str]:
    return {
        str(reference.get("source_finding_id"))
        for card in cards
        for reference in card.get("source", {}).get("source_references", [])
        if reference.get("source_finding_id")
    }


def provenance_coverage(cards: list[dict[str, Any]]) -> float:
    references = [
        reference
        for card in cards
        for reference in card.get("source", {}).get("source_references", [])
    ]
    if not references:
        return 0.0
    covered = sum(1 for reference in references if reference.get("provenance") and reference.get("source_page"))
    return round(100 * covered / len(references), 2)


def no_human_fields_prefilled(cards: list[dict[str, Any]]) -> bool:
    for card in cards:
        review = card.get("human_review", {})
        if any(value is not None for value in review.get("correction", {}).values()):
            return False
        if any(value is not None for value in review.get("telemetry", {}).values()):
            return False
        if review.get("border_crossing_result") is not None:
            return False
    return True


def build_artifact(round1b: dict[str, Any], input_path: Path) -> dict[str, Any]:
    original_hash = sha256_value(round1b)
    machine_snapshot = copy.deepcopy(round1b)
    cards = build_primary_review_cards(round1b)
    contexts = supporting_context(round1b)
    represented = source_findings_represented(cards)
    atomic_count = len(round1b.get("atomicObservations", []))
    condition_count = sum(1 for card in cards if card.get("review_type") == "potential_condition_relationship")
    unresolved_count = sum(1 for card in cards if card.get("review_type") == "unresolved_condition")
    bundle_count = sum(1 for card in cards if card.get("review_type") == "operational_review_bundle")
    artifact = {
        "schema_version": SCHEMA_VERSION,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "benchmark_status": STATUS_PARTIAL,
        "border_crossing_definition": {
            "states": [
                "source_evidence",
                "ai_draft_interpretation",
                "human_review",
                HUMAN_REVIEWED_STATE,
            ],
            "human_reviewed_interpretation_does_not_mean": [
                "final_repair_scope",
                "final_price",
                "contractor_approval",
                "completed_work",
                "verified_outcome",
            ],
            "transition_rules": {
                "approve": HUMAN_REVIEWED_STATE,
                "edit_with_completed_correction": HUMAN_REVIEWED_STATE,
                "reject": "rejected_ai_draft",
                "split": "split_required",
                "keep_separate": "relationship_rejected_observations_preserved",
                "needs_more_evidence": "unresolved_waiting_for_evidence",
            },
        },
        "pipeline": {
            "name": "phase1-round1c-local-human-review-prototype",
            "run_mode": "local_private_artifact_only",
            "round1b_artifact_path": str(input_path),
            "round1b_artifact_file_sha256": sha256_file(input_path),
            "round1b_machine_output_canonical_sha256": original_hash,
            "machine_snapshot_canonical_sha256": sha256_value(machine_snapshot),
            "source_cache_reused": round1b.get("pipeline", {}).get("source_cache_reused"),
            "source_hash_matched": round1b.get("pipeline", {}).get("source_hash_matched"),
            "pdf_pages_scanned_this_run": 0,
            "model_calls": 0,
            "production_touched": False,
            "supabase_runtime_touched": False,
            "railway_touched": False,
            "app_ui_touched": False,
        },
        "review_compression": {
            "atomic_observation_count": atomic_count,
            "primary_review_item_count": len(cards),
            "condition_relationship_review_count": condition_count,
            "operational_bundle_review_count": bundle_count,
            "unresolved_issue_count": unresolved_count,
            "source_findings_represented": len(represented),
            "provenance_coverage_percent": provenance_coverage(cards),
            "primary_cards_per_atomic_observation_percent": round(100 * len(cards) / atomic_count, 2)
            if atomic_count
            else None,
            "round1b_json_bytes": input_path.stat().st_size,
            "markdown_worksheet_bytes": None,
            "markdown_vs_round1b_size_percent": None,
        },
        "primary_review_cards": cards,
        "supporting_context": contexts,
        "missing_relationships": [],
        "missing_relationship_template": {
            "missing_relationship_id": None,
            "related_atomic_observation_ids": None,
            "reviewer_description": None,
            "proposed_relationship_type": None,
            "why_it_matters": None,
            "evidence_needed": None,
            "reviewer_confidence": None,
        },
        "global_review_notes": None,
        "post_review_metrics": {
            "approved_count": None,
            "edited_count": None,
            "rejected_count": None,
            "split_count": None,
            "keep_separate_count": None,
            "needs_evidence_count": None,
            "missing_relationship_count": None,
            "reviewer_added_issue_count": None,
        },
        "final_human_review_summary": None,
        "machine_output_snapshot": machine_snapshot,
        "acceptance_status": {
            "every_review_item_traces_to_source_evidence": STATUS_PROVEN
            if all(card.get("source", {}).get("source_references") for card in cards)
            else "FAILED",
            "no_human_fields_prefilled": STATUS_PROVEN if no_human_fields_prefilled(cards) else "FAILED",
            "original_ai_output_preserved_immutably": STATUS_PROVEN
            if original_hash == sha256_value(machine_snapshot)
            else "FAILED",
            "human_correction_separate": STATUS_PROVEN,
            "unresolved_cannot_cross_border": STATUS_PROVEN,
            "shared_context_not_primary_review_task": STATUS_PROVEN
            if all(card.get("review_type") not in {"shared_location_context", "shared_system_context"} for card in cards)
            else "FAILED",
            "operational_bundles_distinct_from_condition_relationships": STATUS_PROVEN,
            "provenance_preserved": STATUS_PROVEN if provenance_coverage(cards) == 100.0 else "PARTIAL",
            "review_cards_materially_compressed": STATUS_PROVEN if len(cards) < atomic_count else "FAILED",
            "no_pdf_rescan": STATUS_PROVEN,
            "no_production_interaction": STATUS_PROVEN,
            "pricing_estimating_routing_scopes_marketplace_memory": STATUS_NOT_IMPLEMENTED,
            "human_review_completed": "NOT_COMPLETED",
            "round1c_success": STATUS_PARTIAL,
        },
    }
    assert sha256_value(round1b) == original_hash
    return artifact


def md_escape(value: Any) -> str:
    return clean_text(value).replace("|", "\\|")


def md_list(values: list[Any], *, limit: int = 3, empty: str = "None recorded.") -> str:
    cleaned = [clean_text(value) for value in values if clean_text(value)]
    if not cleaned:
        return empty
    shown = cleaned[:limit]
    suffix = f"\n- _{len(cleaned) - limit} more available in details._" if len(cleaned) > limit else ""
    return "\n".join(f"- {value}" for value in shown) + suffix


def card_source_lines(card: dict[str, Any]) -> list[str]:
    lines: list[str] = []
    for observation in card.get("source", {}).get("source_backed_observations", []):
        statement = clean_text(observation.get("inspector_statement"))
        if statement:
            lines.append(statement)
    return unique_strings(lines)


def render_markdown(artifact: dict[str, Any]) -> str:
    snapshot = artifact.get("machine_output_snapshot", {})
    reconstruction = snapshot.get("propertyReportReconstruction", {})
    property_data = reconstruction.get("property", {})
    report_data = reconstruction.get("report", {})
    compression = artifact.get("review_compression", {})
    lines = [
        "# PROPERTY",
        "",
        f"- Address: {md_escape(property_data.get('full_address') or property_data.get('address_line1') or 'See private source artifact')}",
        "",
        "# REPORT",
        "",
        f"- Report: {md_escape(report_data.get('report_title') or report_data.get('inspection_company') or 'Inspection report')}",
        f"- Inspection date: {md_escape(report_data.get('inspection_date') or 'See source')}",
        f"- Round 1B source hash: `{artifact.get('pipeline', {}).get('round1b_artifact_file_sha256')}`",
        "",
        "# ROUND 1C BENCHMARK SUMMARY",
        "",
        f"- Atomic observations: {compression.get('atomic_observation_count')}",
        f"- Primary review cards: {compression.get('primary_review_item_count')}",
        f"- Condition relationship cards: {compression.get('condition_relationship_review_count')}",
        f"- Unresolved condition cards: {compression.get('unresolved_issue_count')}",
        f"- Operational bundle cards: {compression.get('operational_bundle_review_count')}",
        f"- Source findings represented: {compression.get('source_findings_represented')}",
        f"- Provenance coverage: {compression.get('provenance_coverage_percent')}%",
        "- Human review status: **NOT STARTED**",
        "- Benchmark success: **PARTIAL until a real human completes review**",
        "",
        "# REVIEW INSTRUCTIONS",
        "",
        "1. Start a timer when you begin the first card.",
        "2. Decide from the concise card first. Open source, photos, or provenance only when needed.",
        "3. Choose exactly one action: Approve, Edit, Split, Keep Separate, Need Evidence, or Reject.",
        "4. Approve only when the AI draft is operationally useful unchanged. Edit only after completing the correction.",
        "5. Split, Keep Separate, Need Evidence, and Reject do not cross into human-reviewed operational understanding.",
        "6. Record which evidence layers you opened and stop the timer when the decision is complete.",
        "",
        "---",
        "",
    ]
    for index, card in enumerate(artifact.get("primary_review_cards", []), start=1):
        source_lines = card_source_lines(card)
        draft = card.get("shelter_prep_draft", {})
        next_evidence = card.get("next_evidence", {})
        lines.extend(
            [
                f"## {index:02d}. {md_escape(card.get('concise_title'))}",
                "",
                f"`{card.get('review_type')}` · `{card.get('technical_attention_category')}` · {md_escape(card.get('system'))}",
                "",
                "**Source says:**",
                "",
                md_list(source_lines, limit=2),
                "",
                "**Shelter Prep thinks:**",
                "",
                clean_text(draft.get("interpretation")) or "No interpretation recorded.",
                "",
                "**Known:**",
                "",
                md_list(card.get("known", []), limit=2),
                "",
                "**Unknown:**",
                "",
                md_list(card.get("unknown", []), limit=3),
                "",
                "**Why it matters:**",
                "",
                clean_text(card.get("why_this_matters")) or "Human operational judgment is required.",
                "",
                "**Next evidence:**",
                "",
                f"- Blocking uncertainty: {clean_text(next_evidence.get('blocking_uncertainty'))}",
                f"- Smallest useful evidence: {clean_text(next_evidence.get('smallest_useful_evidence'))}",
                f"- Owner: {clean_text(next_evidence.get('evidence_owner'))}",
                f"- Why material: {clean_text(next_evidence.get('why_it_materially_changes_the_decision'))}",
                "",
                "**Human review:**",
                "",
                "- [ ] Approve",
                "- [ ] Edit",
                "- [ ] Split",
                "- [ ] Keep Separate",
                "- [ ] Need Evidence",
                "- [ ] Reject",
                "",
                "<details>",
                "<summary>Detailed source, evidence, and provenance</summary>",
                "",
                f"- Components: {', '.join(card.get('components', [])) or 'Not determinable'}",
                f"- Locations: {', '.join(card.get('locations', [])) or 'Not stated'}",
                f"- AI relationship confidence: {draft.get('relationship_confidence') or 'Not applicable'}",
                f"- Why surfaced: {clean_text(draft.get('why_shelter_prep_surfaced_it'))}",
                "",
            ]
        )
        for observation in card.get("source", {}).get("source_backed_observations", []):
            reference = observation.get("source_reference", {})
            evidence = observation.get("image_and_evidence_references", {})
            lines.extend(
                [
                    f"- Observation `{observation.get('atomic_observation_id')}` — page {reference.get('source_page')}, section {md_escape(reference.get('source_section'))}, item {md_escape(reference.get('source_item_number'))}",
                    f"  - Inspector: {clean_text(observation.get('inspector_statement'))}",
                    f"  - Recommendation: {clean_text(observation.get('inspector_recommendation')) or 'None stated'}",
                    f"  - Images: {', '.join(evidence.get('image_ids', [])) or 'None linked'}",
                ]
            )
        lines.extend(
            [
                "",
                "**Additive human correction (do not replace source or AI draft):**",
                "",
                "- Reviewer decision: ____________________",
                "- Corrected interpretation: _________________________________________________",
                "- Corrected relationship: ___________________________________________________",
                "- Corrected known: __________________________________________________________",
                "- Corrected unknowns: _______________________________________________________",
                "- Corrected next evidence: __________________________________________________",
                "- Reviewer reason: __________________________________________________________",
                "- Reviewer notes: ___________________________________________________________",
                "",
                "**Interaction telemetry:**",
                "",
                "- Review started at: ____________________",
                "- Review completed at: __________________",
                "- Review seconds: _______________________",
                "- Source evidence opened (yes/no): ______",
                "- Photos opened (yes/no): _______________",
                "- Provenance opened (yes/no): ___________",
                "- Interpretation edited (yes/no): _______",
                "- Unknowns edited (yes/no): _____________",
                "- Next evidence edited (yes/no): ________",
                "- Relationship changed (yes/no): ________",
                "- Reviewer notes added (yes/no): ________",
            ]
        )
        lines.extend(["", "</details>", "", "---", ""])

    lines.extend(
        [
            "# MISSING RELATIONSHIPS",
            "",
            "Add relationships Shelter Prep failed to surface. Start empty; do not force an entry.",
            "",
            "- Missing relationship ID: ____________________",
            "- Related atomic observation IDs: ____________________________________________",
            "- Reviewer description: _____________________________________________________",
            "- Proposed relationship type: _______________________________________________",
            "- Why it matters: ___________________________________________________________",
            "- Evidence needed: __________________________________________________________",
            "- Reviewer confidence: ______________________________________________________",
            "",
            "# GLOBAL REVIEW NOTES",
            "",
            "______________________________________________________________________________",
            "",
            "# REVIEW METRICS",
            "",
            "- Review started at: ____________________",
            "- Review completed at: __________________",
            "- Total review seconds: _________________",
            "- Approved: ____  Edited: ____  Rejected: ____  Split: ____",
            "- Kept separate: ____  Needs evidence: ____",
            "- Missing relationships added: ____  Reviewer-added issues: ____",
            "",
            "# FINAL HUMAN-REVIEW SUMMARY",
            "",
            "Round 1C remains incomplete until a real reviewer records decisions, corrections, interaction telemetry, missing relationships, and a final summary.",
            "",
        ]
    )
    return "\n".join(lines)


def finalize_markdown_metrics(artifact: dict[str, Any]) -> str:
    markdown = render_markdown(artifact)
    markdown_bytes = len(markdown.encode("utf-8"))
    raw_bytes = artifact.get("review_compression", {}).get("round1b_json_bytes") or 0
    artifact["review_compression"]["markdown_worksheet_bytes"] = markdown_bytes
    artifact["review_compression"]["markdown_vs_round1b_size_percent"] = (
        round(100 * markdown_bytes / raw_bytes, 2) if raw_bytes else None
    )
    markdown = render_markdown(artifact)
    artifact["review_compression"]["markdown_worksheet_bytes"] = len(markdown.encode("utf-8"))
    return markdown


def run_self_test() -> None:
    def atomic(item_id: str, category: str, system: str, statement: str, *, evidence: bool = True) -> dict[str, Any]:
        return {
            "id": item_id,
            "source_finding_id": "finding-" + item_id,
            "source": {
                "source_page": int(item_id.rsplit("-", 1)[-1]),
                "source_section": system,
                "source_item_number": item_id.rsplit("-", 1)[-1],
                "source_file_id": "synthetic-source",
                "inspector_statement": statement,
                "inspector_recommendation": "Qualified review recommended.",
                "provenance": {"method": "synthetic", "source": "sanitized"},
            },
            "organization": {
                "technical_attention_category": category,
                "building_system": system,
                "domain_key": stable_slug(system),
                "components": [stable_slug(system) + "-component"],
                "locations": ["Test Area"],
            },
            "epistemic_states": {
                "source_stated_cause": "",
                "shelter_prep_interpretation": "Synthetic AI draft interpretation.",
                "unknowns": ["Exact cause remains unknown."],
            },
            "smallest_useful_next_evidence": {
                "uncertainty": "Whether the condition is active.",
                "smallest_fact_or_check": "Take one targeted measurement.",
                "owner": "field_reviewer",
                "why_it_matters": "The measurement changes the next review decision.",
                "materiality": ["next_human_decision"],
                "new_evidence_requested": evidence,
            },
            "evidence_links": {
                "photo_caption_ids": [],
                "image_ids": [],
                "image_hashes": [],
                "cached_visual_evidence_ids": [],
            },
        }

    atoms = [
        atomic("atomic-1", "active_damage_or_water", "Roof", "Localized roof opening noted."),
        atomic("atomic-2", "active_damage_or_water", "Attic", "Localized attic staining noted."),
        atomic("atomic-3", "safety_life_safety", "Electrical", "Open junction box noted."),
        atomic("atomic-4", "functional_defect", "Electrical", "Loose receptacle noted."),
    ]
    condition = {
        "id": "relationship-condition-synthetic",
        "type": "potential_condition_relationship",
        "label": "Potential roof-to-attic condition relationship",
        "confidence": "moderate",
        "basis": "compatible pathway and adjacent systems",
        "cautious_hypothesis": "The two observations may share a physical pathway; cause is not established.",
        "what_is_unknown": ["Whether the pathway is active."],
        "why_relationship_matters": "Confirmation changes technical review sequencing.",
        "related_atomic_observation_ids": ["atomic-1", "atomic-2"],
        "smallest_useful_next_evidence": atoms[0]["smallest_useful_next_evidence"],
    }
    bundle = {
        "id": "relationship-operational-electrical",
        "type": "operational_review_bundle",
        "label": "Electrical operational review bundle",
        "confidence": "not_applicable",
        "basis": "same qualified reviewer; unrelated causes may be present",
        "cautious_hypothesis": "Review together operationally without inferring shared cause.",
        "what_is_unknown": ["Whether the findings need separate actions."],
        "why_relationship_matters": "One qualified review may reduce handoff friction.",
        "related_atomic_observation_ids": ["atomic-3", "atomic-4"],
        "smallest_useful_next_evidence": {
            "uncertainty": "Whether one reviewer should handle both.",
            "smallest_fact_or_check": "No new evidence solely for grouping.",
            "owner": "electrician",
            "why_it_matters": "Preserves separation while coordinating review.",
            "materiality": ["review_efficiency"],
            "new_evidence_requested": False,
        },
    }
    location_context = {
        "id": "relationship-location-test-area",
        "type": "shared_location_context",
        "label": "Shared location context",
        "related_atomic_observation_ids": ["atomic-3", "atomic-4"],
    }
    system_context = {
        "id": "relationship-system-electrical",
        "type": "shared_system_context",
        "label": "Shared system context",
        "related_atomic_observation_ids": ["atomic-3", "atomic-4"],
    }
    synthetic = {
        "schemaVersion": "synthetic-round1b",
        "pipeline": {"source_cache_reused": True, "source_hash_matched": True, "pdf_pages_scanned_this_run": 0},
        "propertyReportReconstruction": {
            "property": {"full_address": "10 Example Ave"},
            "report": {"report_title": "Synthetic inspection", "inspection_date": "2026-01-01"},
        },
        "atomicObservations": atoms,
        "relationshipCandidates": [condition, bundle, location_context, system_context],
        "potentialOverlapRelationshipCandidates": [condition],
    }
    temp_path = Path("/private/tmp/round1c-synthetic-round1b.json")
    write_text(temp_path, json.dumps(synthetic))
    original_hash = sha256_value(synthetic)
    artifact = build_artifact(synthetic, temp_path)
    cards = artifact["primary_review_cards"]
    assert len(cards) == 3
    assert {card["review_type"] for card in cards} == {
        "potential_condition_relationship",
        "unresolved_condition",
        "operational_review_bundle",
    }
    assert artifact["supporting_context"]["shared_location_context"]
    assert artifact["supporting_context"]["shared_system_context"]
    assert all(card["source"]["source_references"] for card in cards)
    assert no_human_fields_prefilled(cards)
    assert sha256_value(synthetic) == original_hash
    assert sha256_value(artifact["machine_output_snapshot"]) == original_hash
    approved = apply_review_decision(cards[0], "approve")
    assert approved["human_review"]["border_crossing_result"] == HUMAN_REVIEWED_STATE
    edited = apply_review_decision(
        cards[0],
        "edit",
        {"reviewer_corrected_interpretation": "Corrected operational interpretation."},
    )
    assert edited["human_review"]["border_crossing_result"] == HUMAN_REVIEWED_STATE
    try:
        apply_review_decision(cards[0], "edit", {})
        raise AssertionError("Edit without correction should fail")
    except ValueError:
        pass
    for decision, expected in {
        "reject": "rejected_ai_draft",
        "split": "split_required",
        "keep_separate": "relationship_rejected_observations_preserved",
        "needs_more_evidence": "unresolved_waiting_for_evidence",
    }.items():
        reviewed = apply_review_decision(cards[0], decision)
        assert reviewed["human_review"]["border_crossing_result"] == expected
        assert reviewed["human_review"]["border_crossing_result"] != HUMAN_REVIEWED_STATE
    markdown = render_markdown(artifact)
    assert "# PROPERTY" in markdown
    assert "# MISSING RELATIONSHIPS" in markdown
    assert "**Additive human correction (do not replace source or AI draft):**" in markdown
    assert "Source evidence opened (yes/no)" in markdown
    assert "Reviewer notes added (yes/no)" in markdown
    assert "atomic-1" not in markdown.split("<details>", 1)[0]
    assert "1837" not in json.dumps(artifact)
    assert artifact["pipeline"]["pdf_pages_scanned_this_run"] == 0
    assert artifact["pipeline"]["production_touched"] is False
    assert artifact["post_review_metrics"]["approved_count"] is None
    assert artifact["missing_relationships"] == []
    assert artifact["acceptance_status"]["round1c_success"] == STATUS_PARTIAL
    print("phase1_round1c_human_review self-test passed")


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Shelter Prep Phase 1 Round 1C local human-review prototype")
    parser.add_argument("--input", default=str(DEFAULT_INPUT))
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR))
    parser.add_argument("--json-file", default=DEFAULT_JSON_FILE)
    parser.add_argument("--markdown-file", default=DEFAULT_MARKDOWN_FILE)
    parser.add_argument("--self-test", action="store_true")
    return parser.parse_args(argv)


def process(args: argparse.Namespace) -> dict[str, Any]:
    input_path = Path(args.input)
    if not input_path.exists():
        raise FileNotFoundError(f"Round 1B artifact not found: {input_path}")
    round1b = load_json(input_path)
    if round1b.get("pipeline", {}).get("pdf_pages_scanned_this_run") != 0:
        raise ValueError("Round 1C requires a Round 1B artifact produced with zero PDF page rescans")
    artifact = build_artifact(round1b, input_path)
    markdown = finalize_markdown_metrics(artifact)
    output_dir = Path(args.output_dir)
    json_path = output_dir / args.json_file
    markdown_path = output_dir / args.markdown_file
    artifact["pipeline"]["private_outputs_gitignored"] = git_ignores(json_path) and git_ignores(markdown_path)
    artifact["acceptance_status"]["artifacts_private_gitignored"] = (
        STATUS_PROVEN if artifact["pipeline"]["private_outputs_gitignored"] else "FAILED"
    )
    write_text(json_path, json.dumps(artifact, indent=2, sort_keys=True, ensure_ascii=False) + "\n")
    write_text(markdown_path, markdown)
    return {"artifact": artifact, "json_path": json_path, "markdown_path": markdown_path}


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    if args.self_test:
        run_self_test()
        return 0
    result = process(args)
    artifact = result["artifact"]
    compression = artifact["review_compression"]
    print(f"Wrote {result['json_path']}")
    print(f"Wrote {result['markdown_path']}")
    print(f"primary_review_cards={compression['primary_review_item_count']}")
    print(f"condition_relationship_cards={compression['condition_relationship_review_count']}")
    print(f"unresolved_condition_cards={compression['unresolved_issue_count']}")
    print(f"operational_bundle_cards={compression['operational_bundle_review_count']}")
    print(f"source_findings_represented={compression['source_findings_represented']}")
    print(f"provenance_coverage_percent={compression['provenance_coverage_percent']}")
    print(f"pdf_pages_scanned_this_run={artifact['pipeline']['pdf_pages_scanned_this_run']}")
    print(f"private_outputs_gitignored={str(artifact['pipeline']['private_outputs_gitignored']).lower()}")
    print(f"human_review_completed=false")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
