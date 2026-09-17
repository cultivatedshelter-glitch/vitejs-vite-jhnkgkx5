#!/usr/bin/env python3
"""Phase 1 sourced repair-cost range and finding-card contract."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from typing import Any


SCHEMA_VERSION = "shelter-prep-phase1-pricing-contract.v1"

GEOGRAPHY_LEVELS = [
    "exact_zip",
    "neighborhood",
    "city",
    "metro",
    "county",
    "state",
    "regional",
    "national_fallback",
]

PRICE_SOURCE_CLASSES = {
    "contractor_quote",
    "contractor_input",
    "human_verified_completed_job",
    "local_supplier_material",
    "manufacturer_price",
    "government_public_labor",
    "permit_valuation",
    "reputable_local_benchmark",
    "regional_benchmark",
    "national_fallback",
}

PRICE_REVIEW_STATUSES = {
    "ai_draft",
    "needs_human_review",
    "human_verified",
    "contractor_informed",
    "contractor_verified",
    "rejected",
}

VERIFIED_STATUSES = {"human_verified", "contractor_verified"}
UNTRUSTED_AUTHOR_TYPES = {"ai", "browser", "system"}


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def geography_rank(level: str) -> int:
    try:
        return GEOGRAPHY_LEVELS.index(level)
    except ValueError:
        return len(GEOGRAPHY_LEVELS)


def validate_price_source(source: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if not source.get("id"):
        errors.append("price source id is required")
    if source.get("source_class") not in PRICE_SOURCE_CLASSES:
        errors.append("price source class is unsupported")
    if not source.get("source_reference"):
        errors.append("price source reference is required")

    geography = source.get("source_geography", {})
    if geography.get("level") not in GEOGRAPHY_LEVELS:
        errors.append("price source geography level is required")
    if not geography.get("label"):
        errors.append("price source geography label is required")

    low = source.get("price_low")
    high = source.get("price_high")
    if not isinstance(low, (int, float)) or not isinstance(high, (int, float)):
        errors.append("price source low and high values are required")
    elif low <= 0 or high <= 0 or low >= high:
        errors.append("price source must provide a positive non-single-point range")
    return errors


def detect_source_conflicts(sources: list[dict[str, Any]]) -> list[dict[str, Any]]:
    conflicts: list[dict[str, Any]] = []
    for index, left in enumerate(sources):
        for right in sources[index + 1 :]:
            if left["price_high"] < right["price_low"] or right["price_high"] < left["price_low"]:
                conflicts.append(
                    {
                        "source_ref_a": left["id"],
                        "source_ref_b": right["id"],
                        "range_a": {"low": left["price_low"], "high": left["price_high"]},
                        "range_b": {"low": right["price_low"], "high": right["price_high"]},
                        "status": "visible_unresolved_disagreement",
                        "explanation": (
                            "The source ranges do not overlap. Preserve both; scope, inclusions, geography, labor, or field "
                            "conditions may differ. Human review or additional evidence is required."
                        ),
                    }
                )
    return conflicts


def range_movement(previous: dict[str, Any] | None, low: float, high: float) -> str:
    if previous is None:
        return "initial"
    previous_width = previous["price_high"] - previous["price_low"]
    new_width = high - low
    if new_width < previous_width:
        return "tightened"
    if new_width > previous_width:
        return "widened"
    if low != previous["price_low"] or high != previous["price_high"]:
        return "shifted_same_width"
    return "unchanged"


def validate_price_revision(revision: dict[str, Any], source_catalog: list[dict[str, Any]]) -> list[str]:
    errors: list[str] = []
    low = revision.get("price_low")
    high = revision.get("price_high")
    if not isinstance(low, (int, float)) or not isinstance(high, (int, float)):
        errors.append("material finding price_low and price_high are required")
    elif low <= 0 or high <= 0 or low >= high:
        errors.append("repair-cost range must be positive and cannot be a single-point price")
    if not revision.get("price_stage"):
        errors.append("price stage is required")

    property_geography = revision.get("property_geography", {})
    if property_geography.get("level") not in GEOGRAPHY_LEVELS or not property_geography.get("label"):
        errors.append("property geography level and label are required")

    source_by_id = {source.get("id"): source for source in source_catalog}
    source_refs = revision.get("price_source_refs", [])
    if not source_refs:
        errors.append("unsourced price range is prohibited")
    selected_sources: list[dict[str, Any]] = []
    for source_ref in source_refs:
        source = source_by_id.get(source_ref)
        if not source:
            errors.append(f"unknown price source reference: {source_ref}")
            continue
        selected_sources.append(source)
        errors.extend(f"{source_ref}: {error}" for error in validate_price_source(source))

    claim_geography = revision.get("price_geography", {})
    claim_level = claim_geography.get("level", "")
    if claim_level not in GEOGRAPHY_LEVELS:
        errors.append("price claim geography level is required")
    if not claim_geography.get("label"):
        errors.append("price claim geography label is required")
    if not claim_geography.get("match_quality"):
        errors.append("price geography match quality is required")
    if claim_level in GEOGRAPHY_LEVELS:
        for source in selected_sources:
            source_level = source.get("source_geography", {}).get("level", "")
            if source_level in GEOGRAPHY_LEVELS and geography_rank(claim_level) < geography_rank(source_level):
                errors.append(
                    f"price geography overstates source {source['id']}: {claim_level} claim from {source_level} source"
                )

    if revision.get("review_status") not in PRICE_REVIEW_STATUSES:
        errors.append("price review status is unsupported")
    author_type = revision.get("author", {}).get("type", "")
    if revision.get("review_status") in VERIFIED_STATUSES and author_type in UNTRUSTED_AUTHOR_TYPES:
        errors.append("AI, browser, and system paths cannot set verified price status")
    if not revision.get("price_range_explanation"):
        errors.append("price range explanation is required")
    if not revision.get("evidence_causing_change"):
        errors.append("evidence causing the range state or change is required")
    if not revision.get("timestamp"):
        errors.append("price revision timestamp is required")

    detected_conflicts = detect_source_conflicts(selected_sources)
    recorded_pairs = {
        frozenset((item.get("source_ref_a"), item.get("source_ref_b")))
        for item in revision.get("source_conflicts", [])
    }
    for conflict in detected_conflicts:
        pair = frozenset((conflict["source_ref_a"], conflict["source_ref_b"]))
        if pair not in recorded_pairs:
            errors.append("conflicting price sources must remain visible")
    return errors


def create_price_revision(
    *,
    revision_id: str,
    price_low: float,
    price_high: float,
    price_stage: str,
    property_geography: dict[str, str],
    price_geography: dict[str, str],
    price_sources: list[dict[str, Any]],
    price_range_explanation: str,
    evidence_causing_change: list[str],
    assumptions: list[str],
    unresolved_unknowns: list[str],
    author: dict[str, str],
    review_status: str = "needs_human_review",
    timestamp: str | None = None,
    previous_revision: dict[str, Any] | None = None,
    contractor_quote: dict[str, Any] | None = None,
) -> dict[str, Any]:
    movement = range_movement(previous_revision, price_low, price_high)
    event = {
        "revision_id": revision_id,
        "prior_low": previous_revision.get("price_low") if previous_revision else None,
        "prior_high": previous_revision.get("price_high") if previous_revision else None,
        "new_low": price_low,
        "new_high": price_high,
        "movement": movement,
        "evidence_causing_change": evidence_causing_change,
        "assumptions": assumptions,
        "unresolved_unknowns": unresolved_unknowns,
        "source_refs": [source["id"] for source in price_sources],
        "property_geography": property_geography,
        "geography": price_geography,
        "author": author,
        "timestamp": timestamp or utc_now(),
        "review_status": review_status,
    }
    revision = {
        "schema_version": SCHEMA_VERSION,
        "revision_id": revision_id,
        "price_low": price_low,
        "price_high": price_high,
        "price_stage": price_stage,
        "property_geography": property_geography,
        "price_geography": price_geography,
        "price_source_refs": [source["id"] for source in price_sources],
        "price_sources": price_sources,
        "price_range_explanation": price_range_explanation,
        "evidence_causing_change": evidence_causing_change,
        "assumptions": assumptions,
        "unresolved_unknowns": unresolved_unknowns,
        "source_conflicts": detect_source_conflicts(price_sources),
        "contractor_quote": contractor_quote,
        "movement": movement,
        "author": author,
        "timestamp": event["timestamp"],
        "review_status": review_status,
        "range_history": [*(previous_revision or {}).get("range_history", []), event],
    }
    errors = validate_price_revision(revision, price_sources)
    if errors:
        raise ValueError("; ".join(errors))
    return revision


def build_unpriced_finding_card(record: dict[str, Any]) -> dict[str, Any]:
    source = record.get("source", {})
    return {
        "finding_title": source.get("inspector_statement") or source.get("source_section") or "Inspection finding",
        "price_low": None,
        "price_high": None,
        "price_stage": "blocked_missing_sourced_range",
        "price_geography": record.get("localized_cost_context", {}).get("geography_basis", {}),
        "price_source_refs": [],
        "price_range_explanation": "No sourced repair-cost range has been supplied; live price retrieval is not part of this gate.",
        "range_history": [],
        "what_we_know": record.get("known_facts", []),
        "what_we_dont_know": record.get("epistemic_states", {}).get("unknowns", []),
        "relevant_context": {"environmental": record.get("environmental_context", {})},
        "weather_context": record.get("environmental_context", {}),
        "recommended_next_step": record.get("recommended_next_step", {}).get("move", ""),
        "next_step_owner": record.get("recommended_next_step", {}).get("owner", ""),
        "why_next_step": record.get("recommended_next_step", {}).get("why_this_next_step", ""),
        "review_status": "needs_human_review",
        "evidence_refs": record.get("evidence_links", {}),
        "source_refs": {
            "source_file_id": source.get("source_file_id", ""),
            "source_page": source.get("source_page"),
            "source_section": source.get("source_section", ""),
            "source_item_number": source.get("source_item_number", ""),
        },
        "pricing_contract_status": "BLOCKED_MISSING_SOURCED_RANGE",
    }


def build_priced_finding_card(record: dict[str, Any], revision: dict[str, Any]) -> dict[str, Any]:
    errors = validate_price_revision(revision, revision.get("price_sources", []))
    if errors:
        raise ValueError("; ".join(errors))
    card = build_unpriced_finding_card(record)
    card.update(
        {
            "price_low": revision["price_low"],
            "price_high": revision["price_high"],
            "price_stage": revision["price_stage"],
            "price_geography": revision["price_geography"],
            "price_source_refs": revision["price_source_refs"],
            "price_range_explanation": revision["price_range_explanation"],
            "range_history": revision["range_history"],
            "review_status": revision["review_status"],
            "pricing_contract_status": "READY_FOR_UI_CONTRACT",
            "contractor_quote": revision.get("contractor_quote"),
            "source_conflicts": revision.get("source_conflicts", []),
        }
    )
    return card


def pricing_contract_metadata() -> dict[str, Any]:
    return {
        "schema_version": SCHEMA_VERSION,
        "range_required_for_material_findings": True,
        "no_source_no_price_claim": True,
        "live_price_retrieval_implemented": False,
        "ui_wiring_implemented": False,
        "geography_hierarchy": GEOGRAPHY_LEVELS,
        "allowed_source_classes": sorted(PRICE_SOURCE_CLASSES),
        "allowed_review_statuses": sorted(PRICE_REVIEW_STATUSES),
        "missing_source_behavior": "block_range_instead_of_fabricating_price",
        "contractor_quote_rule": "Contractor quotes remain separate from Shelter Prep ranges.",
        "history_rule": "Append immutable revision events; never silently overwrite prior ranges.",
    }


def run_self_test() -> None:
    metro_source = {
        "id": "source-metro-benchmark",
        "source_class": "reputable_local_benchmark",
        "source_reference": "synthetic://metro-benchmark",
        "source_geography": {"level": "metro", "label": "Example metro"},
        "price_low": 500,
        "price_high": 5000,
        "published_at": "2030-01-01",
        "retrieved_at": "2030-01-02T00:00:00Z",
    }
    local_source = {
        "id": "source-local-comparable",
        "source_class": "human_verified_completed_job",
        "source_reference": "synthetic://reviewed-job",
        "source_geography": {"level": "city", "label": "Exampletown"},
        "price_low": 900,
        "price_high": 3000,
        "published_at": "2030-01-03",
        "retrieved_at": "2030-01-04T00:00:00Z",
    }
    high_source = {
        "id": "source-regional-high",
        "source_class": "regional_benchmark",
        "source_reference": "synthetic://regional-high",
        "source_geography": {"level": "regional", "label": "Example region"},
        "price_low": 6000,
        "price_high": 9000,
        "published_at": "2030-01-01",
        "retrieved_at": "2030-01-04T00:00:00Z",
    }
    author = {"type": "ai", "id": "synthetic-pricing-draft"}
    initial = create_price_revision(
        revision_id="range-1",
        price_low=500,
        price_high=5000,
        price_stage="early_sparse_evidence",
        property_geography={"level": "exact_zip", "label": "97000"},
        price_geography={"level": "metro", "label": "Example metro", "match_quality": "metro"},
        price_sources=[metro_source],
        price_range_explanation="Wide planning envelope because repair location and concealed scope are unresolved.",
        evidence_causing_change=["initial inspection observation"],
        assumptions=["accessible repair area"],
        unresolved_unknowns=["exact repair area", "concealed damage"],
        author=author,
        timestamp="2030-01-02T00:00:00Z",
    )
    tightened = create_price_revision(
        revision_id="range-2",
        price_low=900,
        price_high=3000,
        price_stage="evidence_informed",
        property_geography={"level": "exact_zip", "label": "97000"},
        price_geography={"level": "city", "label": "Exampletown", "match_quality": "city"},
        price_sources=[local_source],
        price_range_explanation="Range narrowed after photos localized the likely repair area.",
        evidence_causing_change=["attic photos localized the affected area"],
        assumptions=["standard access"],
        unresolved_unknowns=["concealed material condition"],
        author=author,
        timestamp="2030-01-04T00:00:00Z",
        previous_revision=initial,
    )
    widened = create_price_revision(
        revision_id="range-3",
        price_low=700,
        price_high=6500,
        price_stage="risk_expanded",
        property_geography={"level": "exact_zip", "label": "97000"},
        price_geography={"level": "city", "label": "Exampletown", "match_quality": "city"},
        price_sources=[local_source],
        price_range_explanation="Range widened after difficult access and possible added trade dependency were documented.",
        evidence_causing_change=["difficult access documented", "possible electrical dependency added"],
        assumptions=["special access equipment may be needed"],
        unresolved_unknowns=["equipment selection", "trade sequencing"],
        author=author,
        timestamp="2030-01-05T00:00:00Z",
        previous_revision=tightened,
    )

    assert initial["movement"] == "initial"
    assert initial["price_high"] - initial["price_low"] > tightened["price_high"] - tightened["price_low"]
    assert tightened["movement"] == "tightened"
    assert widened["movement"] == "widened"
    assert len(widened["range_history"]) == 3
    assert widened["range_history"][1]["prior_low"] == 500
    assert widened["range_history"][1]["new_low"] == 900

    overprecise = dict(initial)
    overprecise["price_geography"] = {"level": "exact_zip", "label": "97000", "match_quality": "exact_zip"}
    assert any("overstates" in error for error in validate_price_revision(overprecise, [metro_source]))

    unsourced = dict(initial)
    unsourced["price_source_refs"] = []
    unsourced["price_sources"] = []
    assert "unsourced price range is prohibited" in validate_price_revision(unsourced, [])

    conflict_revision = create_price_revision(
        revision_id="range-conflict",
        price_low=500,
        price_high=9000,
        price_stage="conflicting_sources",
        property_geography={"level": "exact_zip", "label": "97000"},
        price_geography={"level": "regional", "label": "Example region", "match_quality": "regional"},
        price_sources=[metro_source, high_source],
        price_range_explanation="Both non-overlapping source envelopes remain visible pending scope reconciliation.",
        evidence_causing_change=["second credible benchmark added"],
        assumptions=["sources may include different scope"],
        unresolved_unknowns=["scope and inclusion differences"],
        author=author,
        timestamp="2030-01-06T00:00:00Z",
    )
    assert conflict_revision["source_conflicts"]

    contractor_quote = {"amount": 1475, "source_ref": "contractor-upload-1", "status": "contractor_uploaded_source"}
    contractor_revision = create_price_revision(
        revision_id="range-contractor-informed",
        price_low=1200,
        price_high=1800,
        price_stage="contractor_informed",
        property_geography={"level": "exact_zip", "label": "97000"},
        price_geography={"level": "city", "label": "Exampletown", "match_quality": "city"},
        price_sources=[local_source],
        price_range_explanation="Shelter Prep range informed by reviewed local comparable evidence.",
        evidence_causing_change=["contractor quote uploaded as a separate source object"],
        assumptions=["quote scope is comparable but not identical"],
        unresolved_unknowns=["quote inclusions need review"],
        author=author,
        timestamp="2030-01-07T00:00:00Z",
        contractor_quote=contractor_quote,
    )
    assert contractor_revision["contractor_quote"]["amount"] == 1475
    assert contractor_revision["price_low"] != contractor_revision["contractor_quote"]["amount"]

    ai_verified = dict(initial)
    ai_verified["review_status"] = "human_verified"
    assert any("cannot set verified" in error for error in validate_price_revision(ai_verified, [metro_source]))
    browser_verified = dict(initial)
    browser_verified["author"] = {"type": "browser", "id": "synthetic-browser-path"}
    browser_verified["review_status"] = "human_verified"
    assert any("cannot set verified" in error for error in validate_price_revision(browser_verified, [metro_source]))

    synthetic_record = {
        "source": {
            "inspector_statement": "Synthetic material repair finding",
            "source_file_id": "synthetic-source",
            "source_page": 1,
            "source_section": "Synthetic section",
            "source_item_number": "1",
        },
        "known_facts": ["A synthetic condition is documented."],
        "epistemic_states": {"unknowns": ["Exact repair extent is unknown."]},
        "environmental_context": {"status": "not_relevant"},
        "recommended_next_step": {"move": "Verify dimensions.", "owner": "field reviewer", "why_this_next_step": "Dimensions reduce scope uncertainty."},
        "evidence_links": {"photo_caption_ids": []},
    }
    card = build_priced_finding_card(synthetic_record, tightened)
    required_card_fields = {
        "finding_title",
        "price_low",
        "price_high",
        "price_stage",
        "price_geography",
        "price_source_refs",
        "price_range_explanation",
        "range_history",
        "what_we_know",
        "what_we_dont_know",
        "relevant_context",
        "weather_context",
        "recommended_next_step",
        "next_step_owner",
        "why_next_step",
        "review_status",
        "evidence_refs",
        "source_refs",
    }
    assert required_card_fields <= card.keys()
    assert card["price_low"] is not None and card["price_high"] is not None
    assert build_unpriced_finding_card(synthetic_record)["pricing_contract_status"] == "BLOCKED_MISSING_SOURCED_RANGE"
    print("phase1_pricing_contract self-test passed")


def main() -> int:
    parser = argparse.ArgumentParser(description="Shelter Prep Phase 1 pricing contract")
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--print-contract", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        run_self_test()
        return 0
    if args.print_contract:
        print(json.dumps(pricing_contract_metadata(), indent=2))
        return 0
    parser.print_help()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
