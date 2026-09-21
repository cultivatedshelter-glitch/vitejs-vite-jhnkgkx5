#!/usr/bin/env python3
"""Audit a Phase 1 artifact for issue-specific investigation quality."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


BANNED_RELEASE_PHRASES = [
    "organize it as",
    "round 1",
    "decision-blocking uncertainty",
    "uncertainty-reduction item",
    "human review has not verified this interpretation",
    "ai draft interpretation",
]


def source_catalog(artifact: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {
        str(source.get("id") or source.get("source_id")): source
        for source in artifact.get("external_sources", [])
        if source.get("id") or source.get("source_id")
    }


def audit_artifact(artifact: dict[str, Any]) -> dict[str, Any]:
    catalog = source_catalog(artifact)
    professional_groups = {
        str(group.get("trade")): group.get("professionals", [])
        for group in artifact.get("localProfessionals", {}).get("groups", [])
    }
    professional_lookups = {
        str(lookup.get("trade")): lookup
        for lookup in artifact.get("localProfessionals", {}).get("lookups", [])
    }
    findings = []
    for observation in artifact.get("atomicObservations", []):
        card = observation.get("finding_card", {})
        interpretation = str(observation.get("epistemic_states", {}).get("shelter_prep_interpretation", ""))
        next_task = str(card.get("recommended_next_step", ""))
        trade = str(card.get("next_step_owner", ""))
        research_ids = list(dict.fromkeys(card.get("research_source_refs", [])))
        paths = []
        for path in card.get("repair_paths", []):
            source_ids = path.get("price_source_refs", [])
            paths.append({
                "label": path.get("label"),
                "pricing_source_count": len(source_ids),
                "pricing_sources": [catalog.get(source_id, {"id": source_id}) for source_id in source_ids],
                "synthesized_range": {"low": path.get("price_low"), "high": path.get("price_high"), "unit": path.get("price_unit")},
                "range_status": path.get("range_status"),
            })
        joined = " ".join([interpretation, next_task, *observation.get("epistemic_states", {}).get("unknowns", [])]).lower()
        findings.append({
            "observation_id": observation.get("id"),
            "source_item": observation.get("source", {}).get("source_item_number"),
            "title": card.get("finding_title"),
            "trade": trade,
            "category": observation.get("organization", {}).get("building_system"),
            "independent_research": interpretation,
            "research_sources": [catalog.get(source_id, {"id": source_id}) for source_id in research_ids],
            "repair_paths": paths,
            "local_professional_lookup": {
                "status": professional_lookups.get(trade, {}).get("status", "pending_report_generation_or_not_configured"),
                "results": professional_groups.get(trade, []),
            },
            "key_unknown": (card.get("what_we_dont_know") or [None])[0],
            "specific_next_task": next_task,
            "paraphrase_only": not research_ids or any(phrase in joined for phrase in BANNED_RELEASE_PHRASES),
        })
    return {
        "schema_version": artifact.get("schemaVersion"),
        "finding_count": len(findings),
        "paraphrase_only_count": sum(1 for finding in findings if finding["paraphrase_only"]),
        "findings_with_research_sources": sum(1 for finding in findings if finding["research_sources"]),
        "findings_with_specific_next_task": sum(1 for finding in findings if finding["specific_next_task"] and not any(phrase in finding["specific_next_task"].lower() for phrase in BANNED_RELEASE_PHRASES)),
        "findings": findings,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("artifact")
    parser.add_argument("--output")
    args = parser.parse_args()
    payload = json.loads(Path(args.artifact).read_text(encoding="utf-8"))
    artifact = payload.get("artifact") or payload
    audit = audit_artifact(artifact)
    rendered = json.dumps(audit, indent=2)
    if args.output:
        Path(args.output).write_text(rendered + "\n", encoding="utf-8")
    else:
        print(rendered)
    if not audit["finding_count"] or audit["paraphrase_only_count"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
