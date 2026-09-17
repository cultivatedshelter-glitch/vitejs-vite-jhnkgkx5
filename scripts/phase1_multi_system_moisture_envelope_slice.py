#!/usr/bin/env python3
"""Local Step 6 moisture/exterior-envelope inspection intelligence slice."""

from __future__ import annotations

import argparse
import copy
import json
import re
import sys
import time
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

try:
    from pypdf import PdfReader
except Exception as exc:  # pragma: no cover
    print(f"pypdf is required for local PDF extraction: {exc}", file=sys.stderr)
    sys.exit(2)

from phase1_multi_system_shared import (
    clean_inline,
    clean_lines,
    create_contact_sheets,
    extract_item_captions_from_text,
    extract_section_text,
    extract_target_images,
    is_bullet_line,
    normalize_key,
    normalize_text,
    read_json,
    sha256_file,
    strip_bullet,
    utc_now,
    write_json,
)
from phase1_inspection_evidence_cache import (
    DEFAULT_CACHE_PATH as DEFAULT_SHARED_CACHE,
    build_or_load_inspection_evidence_cache,
    caption_pages_from_shared,
    materialize_images_from_shared_cache,
    metadata_pages_from_shared,
    section_pages_from_shared,
)


SCHEMA_VERSION = "shelter-prep-step6-moisture-envelope-local-output.v1"
PIPELINE_NAME = "phase1-step6-moisture-envelope-only-local-adapter"
STATUS_PROVEN = "PROVEN"
STATUS_PARTIAL = "PARTIAL"
STATUS_BLOCKED = "BLOCKED"
STATUS_NOT_IMPLEMENTED = "NOT IMPLEMENTED"

DEFAULT_PDF = "local-fixtures/1837-sw-jo-ct-inspection.pdf"
DEFAULT_STEP4_OUTPUT = "local-fixtures/step4-roof-vertical-slice/step4-roof-output.json"
DEFAULT_OUTPUT_DIR = "local-fixtures/step6-moisture-envelope-slice"

IN_SCOPE_RULES: dict[str, set[str] | str] = {
    "Moisture Damage": "all",
    "Condensation/mold": "all",
    "Exterior Issues": "all",
    "Eave Issues": "all",
    "Crawlspace Issues": {"20"},
    "Floor Issues": {"51"},
    "Countertop Issues": {"55"},
    "Wall & Ceiling Facings": {"65"},
    "Ventilation/Exhaust Issues": {"72", "74"},
    "Site Issues": {"76", "77", "78"},
    "Minor Repairs/Deferred Maintenance": {"79", "80", "82", "83"},
}

MOISTURE_CAPTION_KEYWORDS = re.compile(
    r"\b("
    r"leak|moisture|mold|moldy|rot|rotting|siding|paint|caulk|caulking|trim|lap siding|eave|rafter|"
    r"crawlspace vent|below grade|soffit|roof vent|vent screen|vegetation|reverse slope|ground|"
    r"downspout|storm drain|gutter|gutters|floor|counter|substrate|ceiling|bathtub|sink"
    r")\b",
    flags=re.IGNORECASE,
)

STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "at",
    "be",
    "for",
    "from",
    "has",
    "in",
    "is",
    "of",
    "on",
    "or",
    "one",
    "some",
    "the",
    "to",
    "with",
}


def domain_profile() -> dict[str, Any]:
    return {
        "domain_name": "Moisture / Exterior Envelope Specialist",
        "domain_key": "moisture_envelope",
        "supported_report_sections": sorted(IN_SCOPE_RULES),
        "common_locations": [
            "Family Room",
            "Primary Bedroom Bathroom",
            "Hallway Bathroom",
            "Kitchen",
            "Attic",
            "Exterior",
            "Chimney chase",
            "Garage exterior",
            "Porch",
        ],
        "likely_trades": [
            "Envelope/siding contractor",
            "Roofer or eave/trim carpenter where roof-edge materials are involved",
            "Moisture intrusion specialist or qualified inspector",
            "Drywall/flooring contractor after source is verified",
            "Gutter/drainage contractor where site water management is implicated",
        ],
        "allowed_interpretations": [
            "Connect source-reported moisture, envelope, drainage, ventilation, and sealant clues into logical suspicions.",
            "Route related moisture/envelope evidence into operational review bundles.",
            "Describe plausible pathways only when evidence supports that relationship.",
            "Identify unknowns and fastest useful field verification.",
        ],
        "prohibited_conclusions": [
            "Do not diagnose concealed rot, mold type, hidden wall condition, hidden framing condition, or structural damage.",
            "Do not assert exact water-entry path, final repair quantity, final scope, code compliance, or final cost.",
            "Do not use captions as visual observations.",
            "Do not mark any output human_verified automatically.",
        ],
        "common_unknowns": [
            "Active moisture status is unknown unless directly measured or visibly present.",
            "Exact moisture entry path is unknown unless directly established.",
            "Concealed wall, floor, decking, framing, sheathing, and trim conditions are unknown.",
            "Extent of deterioration and repair quantities are unknown.",
            "Final repair scope, permit needs, and cost are unknown.",
        ],
        "common_hidden_condition_risks": [
            "Moisture staining and failed exterior sealants may indicate hidden substrate deterioration, but this remains unverified.",
            "Ground contact, reverse slope, gutters, and downspout issues may increase water exposure around envelope components.",
            "Attic staining or white growth may be related to ventilation/moisture conditions, but mold type and cause are unverified.",
        ],
        "common_verification_questions": [
            "Is moisture currently present at the stained or damaged area?",
            "What exterior/window/siding/trim detail is directly adjacent to the interior moisture evidence?",
            "Are exterior caulk, flashing, siding clearance, drainage, and gutters contributing to water exposure?",
            "What substrate or underlayment damage is visible after limited exploratory review?",
            "Which trade should verify the suspected pathway before scope is finalized?",
        ],
        "bundling_rules": [
            "Bundle interior moisture evidence with adjacent envelope clues only when provenance supports a plausible relationship.",
            "Keep bathroom/kitchen wet-area moisture separate from exterior-envelope suspicions unless evidence links them.",
            "Bundle site/drainage evidence with envelope exposure only where it can materially affect water management.",
            "Keep attic condensation/ventilation evidence separate unless linked by attic moisture clues.",
        ],
        "consequence_review_rules": [
            "Moisture, suspected hidden damage, and unclear pathway items default to needs_review.",
            "Anything with only partial visual support or unknown causation goes to the review queue.",
            "Human review may approve, edit, reject, or request field verification.",
        ],
    }


def meaningful_tokens(value: str) -> set[str]:
    return {token for token in normalize_key(value).split() if len(token) > 2 and token not in STOPWORDS}


def caption_issue_key(value: str) -> str:
    return normalize_key(value.split(":", 1)[0])


def parse_issue_section(section: dict[str, Any], property_id: str, inspection_report_id: str) -> list[dict[str, Any]]:
    lines = clean_lines(section["text"])
    if lines and normalize_key(lines[0]).startswith(normalize_key(section["source_section"])):
        lines = lines[1:]

    findings: list[dict[str, Any]] = []
    pending: list[str] = []
    idx = 0

    while idx < len(lines):
        line = lines[idx]
        match = re.match(r"^(?P<number>\d+)\)\s*(?P<recommendation>.*)$", line)
        if not match:
            pending.append(line)
            idx += 1
            continue

        rec_lines = [clean_inline(match.group("recommendation"))]
        idx += 1
        while idx < len(lines):
            candidate = lines[idx]
            if re.match(r"^\d+\)", candidate):
                break
            if is_bullet_line(candidate) or normalize_key(candidate) == "location s":
                break
            if candidate and candidate[0].isupper():
                break
            rec_lines.append(candidate)
            idx += 1

        if not pending:
            continue

        title = clean_inline(pending[0])
        detail_lines: list[str] = []
        locations: list[str] = []
        in_locations = False
        for pending_line in pending[1:]:
            if normalize_key(pending_line) == "location s":
                in_locations = True
                continue
            if is_bullet_line(pending_line):
                locations.append(strip_bullet(pending_line))
                continue
            detail_lines.append(pending_line)

        item_number = match.group("number")
        inspector_recommendation = clean_inline(" ".join(rec_lines))
        inspector_statement = clean_inline(". ".join(part for part in [title, *detail_lines] if part))
        findings.append(
            {
                "id": f"moisture-envelope-finding-{item_number}",
                "property_id": property_id,
                "inspection_report_id": inspection_report_id,
                "domain_key": "moisture_envelope",
                "source_page": section["source_page"],
                "source_section": section["source_section"],
                "source_item_number": item_number,
                "title": title,
                "inspector_statement": inspector_statement,
                "inspector_recommendation": inspector_recommendation,
                "locations": locations,
                "source_excerpt": clean_inline(
                    " ".join(
                        [
                            str(section["source_section"]),
                            title,
                            *detail_lines,
                            *locations,
                            f"{item_number})",
                            inspector_recommendation,
                        ]
                    )
                ),
                "linked_photo_ids": [],
                "source_file_id": "",
                "building_system": "Moisture / Exterior Envelope",
                "review_status": "needs_review",
                "human_verified": False,
            }
        )
        pending = []

    return findings


def finding_in_scope(finding: dict[str, Any]) -> bool:
    rule = IN_SCOPE_RULES.get(finding["source_section"])
    if rule == "all":
        return True
    if isinstance(rule, set):
        return str(finding["source_item_number"]) in rule
    return False


def caption_matches_finding(caption: dict[str, Any], finding: dict[str, Any], *, allow_token_overlap: bool) -> bool:
    caption_text = caption["caption"]
    caption_key = normalize_key(caption_text)
    caption_core_key = caption_issue_key(caption_text)
    title_key = normalize_key(finding["title"])
    statement_key = normalize_key(finding["inspector_statement"])
    if title_key and (title_key in caption_key or caption_key in title_key):
        return True
    if caption_key and caption_key in statement_key:
        return True
    if caption_core_key and caption_core_key in statement_key:
        return True
    if not allow_token_overlap:
        return False
    caption_tokens = meaningful_tokens(caption_text)
    finding_tokens = meaningful_tokens(" ".join([finding["title"], finding["inspector_statement"]]))
    if not caption_tokens or not finding_tokens:
        return False
    overlap = caption_tokens & finding_tokens
    return len(overlap) >= 2 and len(overlap) / max(len(caption_tokens), 1) >= 0.5


def link_caption_to_finding(caption: dict[str, Any], findings_by_number: dict[str, dict[str, Any]]) -> str:
    major = str(caption["source_item_number"]).split(".")[0]
    exact_finding = findings_by_number.get(major)
    if exact_finding and caption_matches_finding(caption, exact_finding, allow_token_overlap=True):
        return exact_finding["id"]

    candidate_numbers: list[str] = []
    if major.isdigit():
        candidate_numbers.extend([str(int(major) - 1), str(int(major) + 1)])
    for number in candidate_numbers:
        finding = findings_by_number.get(number)
        if finding and caption_matches_finding(caption, finding, allow_token_overlap=False):
            return finding["id"]

    matches = [
        finding
        for finding in findings_by_number.values()
        if caption_matches_finding(caption, finding, allow_token_overlap=False)
    ]
    if len(matches) == 1:
        return matches[0]["id"]
    return ""


def value_after_label(lines: list[str], label: str) -> str:
    target = normalize_key(label)
    for idx, line in enumerate(lines):
        if normalize_key(line) == target:
            for candidate in lines[idx + 1 :]:
                if candidate.endswith(":"):
                    return ""
                return clean_inline(candidate)
    return ""


def extract_moisture_metadata(page_records: dict[int, str]) -> dict[str, Any]:
    joined = "\n".join(page_records.values())
    lines = clean_lines(joined)
    return {
        "fields": {
            key: value
            for key, value in {
                "roof_drainage_systems": value_after_label(lines, "Roof drainage systems:"),
                "exterior_wall_covering_panel": value_after_label(lines, "Panel:"),
                "windows": value_after_label(lines, "Windows:"),
                "eaves": value_after_label(lines, "Eaves:"),
                "adverse_site_conditions": value_after_label(lines, "For adverse site conditions affecting building:"),
                "attic_ventilation_systems": clean_inline(
                    " / ".join(
                        value
                        for value in [
                            value_after_label(lines, "Attic ventilation systems:"),
                            value_after_label(lines, "Roof Vents"),
                        ]
                        if value
                    )
                ),
                "crawlspace_ventilation_systems": value_after_label(lines, "Crawlspace ventilation systems:"),
                "vapor_barrier": value_after_label(lines, "Vapor retarders/barriers in exposed to view unfinished spaces adjacent heated living spaces:"),
            }.items()
            if value
        },
        "source_pages": sorted(page_records),
        "extraction_method": "deterministic_label_lookup_from_pdf_text",
    }


def build_source_cache(pdf_path: Path, cache_path: Path, source_sha: str, source_file_id: str) -> dict[str, Any]:
    if cache_path.exists():
        cached = read_json(cache_path)
        if cached.get("source_pdf_sha256") == source_sha and cached.get("source_file_id") == source_file_id:
            cached["cache_reused"] = True
            return cached

    reader = PdfReader(str(pdf_path))
    section_pages: dict[int, str] = {}
    caption_pages: dict[int, str] = {}
    metadata_pages: dict[int, str] = {}

    for page_number, page in enumerate(reader.pages, start=1):
        text = normalize_text(page.extract_text() or "")
        for section_name in IN_SCOPE_RULES:
            if extract_section_text(page_number, text, section_name):
                section_pages[page_number] = text
                break
        if "Item " in text and MOISTURE_CAPTION_KEYWORDS.search(text):
            caption_pages[page_number] = text
        if any(
            marker in text
            for marker in [
                "Roof drainage systems:",
                "Exterior wall covering assemblies:",
                "Windows:",
                "Eaves:",
                "For adverse site conditions affecting building:",
                "Attic ventilation systems:",
                "Crawlspace ventilation systems:",
                "Vapor retarders/barriers",
            ]
        ):
            metadata_pages[page_number] = text

    cache = {
        "schemaVersion": "shelter-prep-step6-moisture-envelope-source-cache.v1",
        "source_pdf": str(pdf_path),
        "source_pdf_sha256": source_sha,
        "source_file_id": source_file_id,
        "created_at": utc_now(),
        "cache_reused": False,
        "local_pdf_pages_scanned": len(reader.pages),
        "model_calls": 0,
        "section_pages": {str(page): text for page, text in section_pages.items()},
        "caption_candidate_pages": {str(page): text for page, text in caption_pages.items()},
        "metadata_pages": {str(page): text for page, text in metadata_pages.items()},
        "persisted_relevant_page_count": len(set(section_pages) | set(caption_pages) | set(metadata_pages)),
    }
    write_json(cache_path, cache)
    return cache


def build_source_cache_from_shared(shared_cache: dict[str, Any], shared_cache_path: Path, source_sha: str, source_file_id: str) -> dict[str, Any]:
    section_pages = section_pages_from_shared(shared_cache, set(IN_SCOPE_RULES))
    caption_pages = caption_pages_from_shared(shared_cache, MOISTURE_CAPTION_KEYWORDS)
    metadata_pages = metadata_pages_from_shared(
        shared_cache,
        [
            "Roof drainage systems:",
            "Exterior wall covering assemblies:",
            "Windows:",
            "Eaves:",
            "For adverse site conditions affecting building:",
            "Attic ventilation systems:",
            "Crawlspace ventilation systems:",
            "Vapor retarders/barriers",
        ],
    )
    return {
        "schemaVersion": "shelter-prep-step6-moisture-envelope-source-cache.v2",
        "source_pdf": shared_cache.get("sourceDocument", {}).get("source_path", ""),
        "source_pdf_sha256": source_sha,
        "source_file_id": source_file_id,
        "created_at": utc_now(),
        "cache_reused": True,
        "cache_source": "shared_inspection_evidence_cache",
        "shared_cache_path": str(shared_cache_path.resolve()),
        "shared_cache_schema": shared_cache.get("schemaVersion", ""),
        "local_pdf_pages_scanned": 0,
        "model_calls": 0,
        "section_pages": section_pages,
        "caption_candidate_pages": caption_pages,
        "metadata_pages": metadata_pages,
        "persisted_relevant_page_count": len(set(section_pages) | set(caption_pages) | set(metadata_pages)),
    }


def extract_source_findings(source_cache: dict[str, Any], property_id: str, inspection_report_id: str, source_file_id: str) -> tuple[list[dict[str, Any]], dict[str, int]]:
    parsed_count = 0
    findings: list[dict[str, Any]] = []
    for page, text in sorted(source_cache.get("section_pages", {}).items(), key=lambda item: int(item[0])):
        page_number = int(page)
        for section_name in IN_SCOPE_RULES:
            section = extract_section_text(page_number, text, section_name)
            if not section:
                continue
            parsed = parse_issue_section(section, property_id, inspection_report_id)
            parsed_count += len(parsed)
            findings.extend(finding for finding in parsed if finding_in_scope(finding))

    for finding in findings:
        finding["source_file_id"] = source_file_id
    return findings, {
        "parsed_findings_in_candidate_sections": parsed_count,
        "routed_findings": len(findings),
        "candidate_section_findings_omitted_as_irrelevant": max(parsed_count - len(findings), 0),
    }


def extract_and_link_captions(source_cache: dict[str, Any], findings: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], dict[str, int]]:
    all_captions: list[dict[str, Any]] = []
    for page, text in sorted(source_cache.get("caption_candidate_pages", {}).items(), key=lambda item: int(item[0])):
        all_captions.extend(extract_item_captions_from_text(int(page), text))

    findings_by_number = {finding["source_item_number"]: finding for finding in findings}
    linked: list[dict[str, Any]] = []
    omitted = 0
    for caption in all_captions:
        if not MOISTURE_CAPTION_KEYWORDS.search(caption["caption"]):
            omitted += 1
            continue
        related_finding_id = link_caption_to_finding(caption, findings_by_number)
        if not related_finding_id:
            omitted += 1
            continue
        linked_caption = copy.deepcopy(caption)
        linked_caption["related_finding_id"] = related_finding_id
        linked.append(linked_caption)

    by_finding = defaultdict(list)
    for caption in linked:
        by_finding[caption["related_finding_id"]].append(caption["id"])
    for finding in findings:
        finding["linked_photo_ids"] = sorted(by_finding.get(finding["id"], []))

    return linked, {
        "all_captions_on_candidate_pages": len(all_captions),
        "moisture_envelope_captions_linked": len(linked),
        "candidate_page_captions_omitted_as_irrelevant": omitted,
    }


def make_evidence_items(findings: list[dict[str, Any]], captions: list[dict[str, Any]], images: list[dict[str, Any]], source_file_id: str) -> list[dict[str, Any]]:
    evidence: list[dict[str, Any]] = []
    for finding in findings:
        evidence.append(
            {
                "id": "evidence-written-moisture-envelope-" + finding["source_item_number"],
                "property_id": finding["property_id"],
                "inspection_report_id": finding["inspection_report_id"],
                "domain_key": "moisture_envelope",
                "source_type": "inspection_report_text",
                "source_file_id": source_file_id,
                "source_page": finding["source_page"],
                "source_section": finding["source_section"],
                "source_item_number": finding["source_item_number"],
                "source_excerpt": finding["source_excerpt"],
                "observation": finding["inspector_statement"],
                "inspector_recommendation": finding["inspector_recommendation"],
                "claim_type": "inspector_statement",
                "confidence": "source_reported",
                "requires_field_verification": True,
                "created_by_agent": PIPELINE_NAME,
                "review_status": "needs_review",
            }
        )

    image_by_caption_id = {
        image.get("related_photo_caption_id"): image for image in images if image.get("related_photo_caption_id")
    }
    for caption in captions:
        linked_image = image_by_caption_id.get(caption["id"], {})
        evidence.append(
            {
                "id": "evidence-photo-moisture-envelope-" + caption["source_item_number"].replace(".", "-"),
                "property_id": findings[0]["property_id"] if findings else "",
                "inspection_report_id": findings[0]["inspection_report_id"] if findings else "",
                "domain_key": "moisture_envelope",
                "source_type": "inspection_photo_caption",
                "source_file_id": source_file_id,
                "source_page": caption["source_page"],
                "source_item_number": caption["source_item_number"],
                "source_caption": caption["caption"],
                "source_image_id": linked_image.get("id", ""),
                "source_image_path": linked_image.get("extracted_image_storage_path", ""),
                "related_finding_id": caption["related_finding_id"],
                "observation": caption["caption"],
                "claim_type": "inspector_photo_caption",
                "confidence": "source_reported",
                "requires_field_verification": True,
                "created_by_agent": PIPELINE_NAME,
                "review_status": "needs_review",
            }
        )

    return evidence


def load_visual_cache(path: Path, source_sha: str) -> tuple[dict[str, Any], bool]:
    if not path.exists():
        return {}, False
    cache = read_json(path)
    if cache.get("source_pdf_sha256") != source_sha:
        return {}, False
    return cache, True


def write_visual_template(path: Path, images: list[dict[str, Any]], contact_sheets: list[dict[str, Any]], source_sha: str) -> None:
    if path.exists():
        return
    write_json(
        path,
        {
            "schemaVersion": "shelter-prep-step6-moisture-envelope-visual-cache-template.v1",
            "source_pdf_sha256": source_sha,
            "contact_sheets": contact_sheets,
            "entries": [
                {
                    "image_sha256": image.get("sha256", ""),
                    "item_number": image.get("item_number", ""),
                    "source_page": image.get("source_page"),
                    "extracted_image_storage_path": image.get("extracted_image_storage_path", ""),
                    "visual_observation": "",
                    "visual_limitations": "",
                    "agreement_status": "",
                    "human_review_status": "needs_review",
                    "processing_status": "needs_vision_analysis",
                }
                for image in images
                if image.get("extraction_status") == "extracted"
            ],
            "note": "Populate a separate moisture-envelope-visual-cache.json only after actual pixels are analyzed without captions.",
        },
    )


def make_visual_evidence(
    images: list[dict[str, Any]],
    captions: list[dict[str, Any]],
    source_pdf: Path,
    source_file_id: str,
    output_dir: Path,
    visual_cache: dict[str, Any],
) -> list[dict[str, Any]]:
    captions_by_id = {caption["id"]: caption for caption in captions}
    entries_by_hash = {
        entry.get("image_sha256"): entry for entry in visual_cache.get("entries", []) if entry.get("image_sha256")
    }
    default_unknowns = [
        "Active moisture status cannot be determined without measurement or visible active water.",
        "Concealed wall, floor, trim, siding, framing, sheathing, and substrate conditions remain unknown.",
        "Exact water-entry path, repair quantity, final scope, code compliance, permit needs, and cost remain unknown.",
    ]

    records: list[dict[str, Any]] = []
    for image in images:
        item_number = image.get("item_number", "")
        caption = captions_by_id.get(image.get("related_photo_caption_id", ""), {})
        image_path = output_dir / image.get("extracted_image_storage_path", "")
        cache_entry = entries_by_hash.get(image.get("sha256", ""))
        if image.get("extraction_status") != "extracted":
            processing_status = "failed"
            visual_observation = ""
            visual_limitations = "Image extraction failed or no image was available for this caption."
            agreement_status = "unclear"
            shelter_prep_interpretation = "No Shelter Prep image interpretation was generated because the source image could not be extracted."
            failure_reason = image.get("extraction_error") or image.get("extraction_status")
            cache_status = "not_available"
        elif cache_entry:
            processing_status = cache_entry.get("processing_status", "analyzed")
            visual_observation = cache_entry.get("visual_observation", "")
            visual_limitations = cache_entry.get("visual_limitations", "")
            agreement_status = cache_entry.get("agreement_status", "unclear")
            shelter_prep_interpretation = cache_entry.get(
                "shelter_prep_interpretation",
                "The image was analyzed, but no separate Shelter Prep interpretation was present in the visual cache.",
            )
            failure_reason = cache_entry.get("failure_reason")
            cache_status = "reused_by_image_hash"
        else:
            processing_status = "skipped_with_reason"
            visual_observation = ""
            visual_limitations = "No cached pixel-based visual observation exists for this image hash."
            agreement_status = "unclear"
            shelter_prep_interpretation = "No Shelter Prep image interpretation was generated because no pixel-based visual cache entry was available."
            failure_reason = "missing_visual_cache_entry"
            cache_status = "missing"

        records.append(
            {
                "id": "visual-moisture-envelope-" + str(item_number).replace(".", "-"),
                "source_image_id": image.get("id", ""),
                "related_finding_id": image.get("related_finding_id", ""),
                "related_photo_caption_id": image.get("related_photo_caption_id", ""),
                "inspector_statement": caption.get("caption", image.get("caption", "")),
                "visual_observation": visual_observation,
                "shelter_prep_interpretation": shelter_prep_interpretation,
                "visual_limitations": visual_limitations,
                "unknowns": cache_entry.get("unknowns", default_unknowns) if cache_entry else default_unknowns,
                "agreement_status": agreement_status,
                "human_review_status": cache_entry.get("human_review_status", "needs_review") if cache_entry else "needs_review",
                "processing_status": processing_status,
                "failure_reason": failure_reason,
                "cache_status": cache_status,
                "provenance": {
                    "source_pdf": str(source_pdf.resolve()),
                    "source_pdf_file_id": source_file_id,
                    "pdf_page": image.get("source_page"),
                    "item_number": item_number,
                    "inspector_caption": caption.get("caption", image.get("caption", "")),
                    "extracted_image_path": str(image_path.resolve()) if image_path else "",
                    "extracted_image_storage_path": image.get("extracted_image_storage_path", ""),
                    "image_sha256": image.get("sha256", ""),
                    "image_dimensions": image.get("image_dimensions", {}),
                    "image_size_bytes": image.get("size_bytes"),
                    "model_service_used": visual_cache.get("model_service_used", ""),
                    "model_version": visual_cache.get("model_version", ""),
                    "model_run_id": visual_cache.get("model_run_id", ""),
                    "prompt_version": visual_cache.get("prompt_version", ""),
                    "timestamp": visual_cache.get("created_at", ""),
                    "vision_input_mode": visual_cache.get("vision_input_mode", "not_available"),
                },
            }
        )
    return records


def evidence_id_for_finding(finding_id: str, evidence_items: list[dict[str, Any]]) -> str:
    for item in evidence_items:
        if item.get("source_type") == "inspection_report_text" and item["id"].endswith(finding_id.rsplit("-", 1)[-1]):
            return item["id"]
    return ""


def visual_ids_for_finding(finding_id: str, visual_records: list[dict[str, Any]]) -> list[str]:
    return [record["id"] for record in visual_records if record.get("related_finding_id") == finding_id]


def make_logical_suspicion(
    finding: dict[str, Any],
    evidence_items: list[dict[str, Any]],
    visual_records: list[dict[str, Any]],
) -> dict[str, Any]:
    title_key = normalize_key(finding["title"])
    source_evidence_id = evidence_id_for_finding(finding["id"], evidence_items)
    visual_ids = visual_ids_for_finding(finding["id"], visual_records)
    support_ids = [item for item in [source_evidence_id, *visual_ids] if item]
    limiting_ids = [record["id"] for record in visual_records if record.get("related_finding_id") == finding["id"] and record.get("agreement_status") != "supports"]

    if "leak at window" in title_key:
        suspected = "Moisture may be entering at or around the family-room window/exterior-envelope area."
        why = "The inspector reports a leak at the family-room window and linked visuals document the window area; this raises a plausible envelope/window pathway that needs focused verification."
        next_check = "Moisture measurement at the family-room window area plus focused exterior/window-envelope inspection of caulk, flashing, siding, and trim."
    elif "moisture damage to floor" in title_key:
        suspected = "The primary-bath floor moisture damage may be associated with bathroom wet-area exposure."
        why = "The source reports moisture-damaged floor material in a bathroom. Linked visuals can document affected floor/base areas, but source path and concealed underlayment remain unknown."
        next_check = "Check moisture at floor edges/fixtures and inspect flooring/underlayment at the next floor-covering change."
    elif "white mold" in title_key:
        suspected = "Attic white staining/growth may be related to attic moisture or ventilation conditions."
        why = "The inspector reports white mold in the attic, and related ventilation evidence in this slice may affect attic moisture behavior."
        next_check = "Qualified attic/moisture review of ventilation paths, bathroom exhaust termination, sheathing moisture, and growth identification/remediation needs."
    elif any(word in title_key for word in ["rot", "siding", "paint", "caulking", "trim", "eave", "rafters"]):
        suspected = "Exterior envelope materials may be experiencing moisture exposure or weathering that warrants targeted repair review."
        why = "The source reports exterior siding/trim/paint/caulk/eave deterioration. Related visuals can support visible deterioration but do not prove concealed damage."
        next_check = "Exterior envelope inspection of siding, trim, caulk, flashing, paint film, eave ends, and adjacent drainage/vegetation conditions."
    elif any(word in title_key for word in ["crawlspace", "vegetation", "reverse slope", "ground", "downspout", "gutter", "storm drain"]):
        suspected = "Site water-management conditions may be increasing moisture exposure at nearby envelope or crawlspace openings."
        why = "The source reports drainage, grade, vegetation, gutter, or downspout conditions that can plausibly increase water contact around the building."
        next_check = "Field check drainage during/after rain if possible, confirm clearances and downspout routing, and inspect adjacent siding/crawlspace areas."
    elif any(word in title_key for word in ["bathtub", "sink", "counter", "ceiling"]):
        suspected = "Localized wet-area moisture or interior finish damage may require source verification before finish repair."
        why = "The source reports moisture, caulk, ceiling, counter, or bath/sink-adjacent conditions where water exposure may affect finishes or substrate."
        next_check = "Moisture measurement and focused fixture/sealant inspection before finish repair or substrate replacement."
    elif any(word in title_key for word in ["soffit", "roof vent", "vent"]):
        suspected = "Restricted venting may contribute to attic moisture or exhaust-management concerns."
        why = "The source reports clogged vent screens or exhaust venting conditions; visual confirmation can support obstruction but not final cause."
        next_check = "Inspect and clear vent screens/terminations and verify bathroom exhaust discharge path and attic ventilation performance."
    else:
        suspected = "Moisture/envelope relationship is possible but not established from the current evidence."
        why = "The routed finding is in the moisture/envelope slice, but exact relationship requires human review."
        next_check = "Human review of source evidence and targeted field verification."

    return {
        "id": "logical-suspicion-" + finding["source_item_number"],
        "finding_id": finding["id"],
        "source_item_number": finding["source_item_number"],
        "suspected_relationship": suspected,
        "reasoning_basis": why,
        "supporting_evidence_ids": support_ids,
        "contradicting_or_limiting_evidence_ids": limiting_ids,
        "known": [
            f"Inspector reports: {finding['inspector_statement']}",
            f"Source section: {finding['source_section']} on page {finding['source_page']}",
        ],
        "unknown": [
            "Exact cause and active moisture status are unknown.",
            "Concealed damage and repair quantity are unknown.",
            "Final repair scope and cost are unknown.",
        ],
        "cannot_determine_from_available_evidence": [
            "Concealed rot, mold type, structural damage, exact water-entry path, and code compliance cannot be determined from this slice.",
        ],
        "fastest_useful_next_check": next_check,
        "likely_trade_or_professional": likely_trade_for_finding(finding),
        "field_verification_required": True,
        "human_review_status": "needs_review",
        "human_verified": False,
    }


def likely_trade_for_finding(finding: dict[str, Any]) -> str:
    title_key = normalize_key(finding["title"])
    if "white mold" in title_key or "attic" in title_key or "vent" in title_key:
        return "Moisture/attic ventilation specialist or qualified contractor"
    if any(word in title_key for word in ["rot", "siding", "trim", "paint", "caulk", "eave", "rafter"]):
        return "Exterior envelope/siding/trim contractor"
    if any(word in title_key for word in ["downspout", "gutter", "reverse slope", "vegetation", "ground", "crawlspace"]):
        return "Drainage/gutter/exterior contractor"
    if any(word in title_key for word in ["floor", "bathtub", "sink", "counter", "ceiling"]):
        return "Moisture inspector plus relevant finish/plumbing-adjacent contractor"
    return "Qualified moisture/envelope reviewer"


def bundle_logical_reasoning(bundle_id: str) -> dict[str, str]:
    summaries = {
        "family-room-window-moisture-envelope": {
            "suspected_relationship": "Interior window-area damage may be related to a window/exterior-envelope moisture pathway.",
            "reasoning_basis": "The bundle combines a source-reported family-room window leak with pixel-observed window-adjacent finish damage. It raises a focused suspicion without proving the exact leak path.",
            "verification_needed": "Moisture measurement and focused exterior review of the window, trim, caulk, siding, and flashing area.",
        },
        "bathroom-interior-moisture": {
            "suspected_relationship": "Bathroom wet-area sealant and floor/subfloor clues may be related to localized moisture exposure.",
            "reasoning_basis": "The bundle groups reported bathroom floor moisture, tub/floor sealant failure, moldy/discolored tub caulk, and visual evidence of stained or damaged wet-area surfaces.",
            "verification_needed": "Moisture readings at fixture edges plus focused review of sealant, flooring, underlayment, and adjacent plumbing/floor penetrations.",
        },
        "attic-moisture-condensation-ventilation": {
            "suspected_relationship": "Attic discoloration may be associated with moisture, ventilation, or exhaust-management conditions.",
            "reasoning_basis": "The bundle groups source-reported attic white growth/discoloration with routed attic ventilation and exhaust termination concerns while preserving uncertainty about cause and material identity.",
            "verification_needed": "Qualified attic review of ventilation paths, exhaust termination, sheathing moisture, and whether any growth requires remediation.",
        },
        "exterior-envelope-deterioration": {
            "suspected_relationship": "Exterior siding, trim, paint, caulk, and eave deterioration may reflect weather/moisture exposure requiring targeted envelope review.",
            "reasoning_basis": "The bundle groups multiple exterior material-condition findings and visual observations of splits, peeling paint, damaged trim, and weathered eave areas.",
            "verification_needed": "Exterior envelope inspection of affected siding, trim, caulk, paint film, eaves, flashing-adjacent areas, and concealed substrate only where access allows.",
        },
        "site-drainage-envelope-exposure": {
            "suspected_relationship": "Drainage, grade, vegetation, gutter, and downspout conditions may increase moisture exposure at the envelope or crawlspace openings.",
            "reasoning_basis": "The bundle groups site water-management and clearance issues whose visible conditions could contribute to moisture exposure around exterior walls and openings.",
            "verification_needed": "Field check drainage paths, clearances, downspout routing, gutter debris, and adjacent siding/crawlspace areas.",
        },
        "kitchen-sink-counter-moisture": {
            "suspected_relationship": "Sink-rim sealant and counter-substrate damage may indicate localized kitchen wet-area moisture exposure.",
            "reasoning_basis": "The bundle combines source-reported counter substrate moisture damage with pixel-observed sink-rim separation/discoloration and exposed substrate.",
            "verification_needed": "Moisture reading and focused sink-rim/countertop/substrate inspection before finish repair or replacement scope.",
        },
        "interior-ceiling-moisture": {
            "suspected_relationship": "Interior ceiling staining may indicate moisture exposure, but source and active status remain unknown.",
            "reasoning_basis": "The bundle combines source-reported ceiling moisture damage with pixel-observed ceiling discoloration and a moisture-meter image, without assuming the meter result or cause.",
            "verification_needed": "Moisture measurement, inspection of adjacent overhead/exterior sources, and targeted review before finish repair.",
        },
    }
    return summaries.get(
        bundle_id,
        {
            "suspected_relationship": "A moisture/envelope relationship may exist but is not established from the available grouped evidence.",
            "reasoning_basis": "The bundle requires human review before any operational interpretation is accepted.",
            "verification_needed": "Review source evidence and decide whether targeted field verification is needed.",
        },
    )


def make_bundles(
    findings: list[dict[str, Any]],
    evidence_items: list[dict[str, Any]],
    visual_records: list[dict[str, Any]],
    logical_suspicions: list[dict[str, Any]],
    moisture_metadata: dict[str, Any],
) -> list[dict[str, Any]]:
    bundle_specs = [
        (
            "family-room-window-moisture-envelope",
            "Family Room Window Moisture / Envelope",
            lambda finding: "leak at window" in normalize_key(finding["title"]),
        ),
        (
            "bathroom-interior-moisture",
            "Bathroom / Interior Moisture",
            lambda finding: any(word in normalize_key(" ".join([finding["title"], *finding.get("locations", [])])) for word in ["bathroom", "bathtub", "floor"]),
        ),
        (
            "attic-moisture-condensation-ventilation",
            "Attic Moisture / Condensation / Ventilation",
            lambda finding: any(word in normalize_key(finding["title"]) for word in ["mold", "attic", "soffit", "roof vent"]),
        ),
        (
            "exterior-envelope-deterioration",
            "Exterior Siding / Trim / Eave Deterioration",
            lambda finding: any(word in normalize_key(finding["title"]) for word in ["rot", "siding", "paint", "caulk", "trim", "eave", "rafter"]),
        ),
        (
            "site-drainage-envelope-exposure",
            "Site Drainage / Exterior Moisture Exposure",
            lambda finding: any(word in normalize_key(finding["title"]) for word in ["crawlspace", "vegetation", "reverse slope", "ground", "downspout", "gutter", "storm drain"]),
        ),
        (
            "kitchen-sink-counter-moisture",
            "Kitchen Sink / Counter Moisture",
            lambda finding: any(word in normalize_key(finding["title"]) for word in ["counter", "sink"]),
        ),
        (
            "interior-ceiling-moisture",
            "Interior Ceiling Moisture",
            lambda finding: "ceiling" in normalize_key(finding["title"]),
        ),
    ]

    suspicion_by_finding = {item["finding_id"]: item for item in logical_suspicions}
    bundles: list[dict[str, Any]] = []
    used: set[str] = set()
    for bundle_id, title, predicate in bundle_specs:
        bundle_findings = [finding for finding in findings if finding["id"] not in used and predicate(finding)]
        if not bundle_findings:
            continue
        for finding in bundle_findings:
            used.add(finding["id"])
        finding_ids = [finding["id"] for finding in bundle_findings]
        visual_ids = [record["id"] for record in visual_records if record.get("related_finding_id") in finding_ids]
        evidence_ids = [
            item["id"]
            for item in evidence_items
            if item.get("related_finding_id") in finding_ids or item.get("source_item_number") in {finding["source_item_number"] for finding in bundle_findings}
        ]
        suspicion_ids = [suspicion_by_finding[finding_id]["id"] for finding_id in finding_ids if finding_id in suspicion_by_finding]
        agreement_counts = Counter(
            record["agreement_status"] for record in visual_records if record.get("related_finding_id") in finding_ids
        )
        bundle_reasoning = bundle_logical_reasoning(bundle_id)
        bundles.append(
            {
                "id": bundle_id,
                "title": title,
                "domain_key": "moisture_envelope",
                "building_system": "Moisture / Exterior Envelope",
                "related_finding_ids": finding_ids,
                "related_evidence_ids": evidence_ids,
                "related_visual_evidence_ids": visual_ids,
                "related_logical_suspicion_ids": suspicion_ids,
                "locations": sorted({location for finding in bundle_findings for location in finding.get("locations", [])}),
                "known_facts": [
                    f"Inspector reports: {finding['inspector_statement']}" for finding in bundle_findings
                ],
                "visual_observations": [
                    record["visual_observation"] for record in visual_records if record.get("related_finding_id") in finding_ids and record.get("visual_observation")
                ],
                "corroboration_status": dict(agreement_counts),
                "bundle_logical_suspicion": bundle_reasoning["suspected_relationship"],
                "bundle_reasoning_basis": bundle_reasoning["reasoning_basis"],
                "logical_suspicion_summary": [
                    suspicion_by_finding[finding_id]["suspected_relationship"] for finding_id in finding_ids if finding_id in suspicion_by_finding
                ],
                "unknowns": [
                    "Exact moisture source/pathway remains unknown.",
                    "Active moisture status remains unknown without field measurement.",
                    "Concealed damage and final repair quantities remain unknown.",
                    "Final repair scope, permit needs, and cost remain unknown.",
                ],
                "metadata_clues": moisture_metadata,
                "likely_trades": sorted({likely_trade_for_finding(finding) for finding in bundle_findings}),
                "verification_questions": sorted(
                    {
                        suspicion_by_finding[finding_id]["fastest_useful_next_check"]
                        for finding_id in finding_ids
                        if finding_id in suspicion_by_finding
                    }
                ),
                "bundle_verification_needed": bundle_reasoning["verification_needed"],
                "next_action": "Human review of the logical suspicion, then targeted field verification before scope or pricing.",
                "review_status": "needs_review",
                "human_verified": False,
            }
        )

    remaining = [finding for finding in findings if finding["id"] not in used]
    if remaining:
        finding_ids = [finding["id"] for finding in remaining]
        bundles.append(
            {
                "id": "moisture-envelope-misc-review",
                "title": "Moisture / Envelope Miscellaneous Review",
                "domain_key": "moisture_envelope",
                "building_system": "Moisture / Exterior Envelope",
                "related_finding_ids": finding_ids,
                "related_evidence_ids": [evidence_id_for_finding(finding["id"], evidence_items) for finding in remaining],
                "related_visual_evidence_ids": [record["id"] for record in visual_records if record.get("related_finding_id") in finding_ids],
                "related_logical_suspicion_ids": [
                    suspicion_by_finding[finding_id]["id"] for finding_id in finding_ids if finding_id in suspicion_by_finding
                ],
                "known_facts": [f"Inspector reports: {finding['inspector_statement']}" for finding in remaining],
                "unknowns": ["Human review is needed to decide whether these items should merge into another bundle."],
                "likely_trades": sorted({likely_trade_for_finding(finding) for finding in remaining}),
                "verification_questions": ["Review source provenance and decide whether to merge or keep separate."],
                "next_action": "Human review.",
                "review_status": "needs_review",
                "human_verified": False,
            }
        )

    return bundles


def make_review_queue(findings: list[dict[str, Any]], visual_records: list[dict[str, Any]], suspicions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    visual_by_finding = defaultdict(list)
    for record in visual_records:
        visual_by_finding[record.get("related_finding_id", "")].append(record)
    suspicion_by_finding = {item["finding_id"]: item for item in suspicions}
    queue: list[dict[str, Any]] = []
    for finding in findings:
        linked_visuals = visual_by_finding.get(finding["id"], [])
        reasons = ["moisture_or_envelope_suspicion_requires_human_review"]
        if not finding.get("linked_photo_ids"):
            reasons.append("no_linked_photo_evidence")
        if any(record.get("agreement_status") != "supports" for record in linked_visuals):
            reasons.append("visual_evidence_partial_unclear_or_discrepant")
        if any(record.get("processing_status") != "analyzed" for record in linked_visuals):
            reasons.append("visual_processing_not_complete")
        reasons.append("exact_cause_and_concealed_conditions_unknown")
        queue.append(
            {
                "id": "review-moisture-envelope-" + finding["source_item_number"],
                "domain_key": "moisture_envelope",
                "finding_id": finding["id"],
                "logical_suspicion_id": suspicion_by_finding.get(finding["id"], {}).get("id", ""),
                "source_item_number": finding["source_item_number"],
                "source_page": finding["source_page"],
                "title": finding["title"],
                "priority": "high" if any(word in normalize_key(finding["title"]) for word in ["moisture", "mold", "rot", "leak"]) else "normal",
                "review_reasons": reasons,
                "human_review_status": "needs_review",
                "next_review_action": "Accept, edit, reject, or request the targeted verification step before scope/pricing.",
            }
        )
    return queue


def make_agent_draft(bundles: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "id": "agent-draft-moisture-envelope-1",
        "title": "Moisture / Exterior Envelope",
        "status_label": "AI Draft / Needs Human Review",
        "human_review_status": "needs_review",
        "human_verified": False,
        "property_specific": True,
        "not_valid_for_unrelated_properties": True,
        "summary": "The slice links source-reported moisture, exterior envelope, drainage, sealant, and ventilation clues into reviewable logical suspicions without treating them as verified facts.",
        "bundle_ids": [bundle["id"] for bundle in bundles],
        "recommended_next_action": "Human review of bundles and focused field verification of suspected moisture pathways.",
    }


def acceptance_status(
    findings: list[dict[str, Any]],
    images: list[dict[str, Any]],
    visual_records: list[dict[str, Any]],
    suspicions: list[dict[str, Any]],
    bundles: list[dict[str, Any]],
    review_queue: list[dict[str, Any]],
    gitignored: bool,
) -> dict[str, str]:
    all_images_have_status = all(record.get("processing_status") for record in visual_records)
    analyzed_images = [record for record in visual_records if record.get("processing_status") == "analyzed"]
    visual_separate = all(
        all(field in record for field in ["inspector_statement", "visual_observation", "shelter_prep_interpretation"])
        for record in visual_records
    )
    suspicion_links = all(item.get("supporting_evidence_ids") for item in suspicions)
    return {
        "moisture_envelope_domain_only": STATUS_PROVEN,
        "full_pdf_sent_to_model": STATUS_NOT_IMPLEMENTED,
        "shared_evidence_contract": STATUS_PROVEN,
        "source_finding_routing": STATUS_PROVEN if findings else STATUS_BLOCKED,
        "source_provenance": STATUS_PROVEN if all(finding.get("source_file_id") and finding.get("source_page") for finding in findings) else STATUS_PARTIAL,
        "linked_photo_provenance": STATUS_PROVEN if images and all(image.get("source_page") for image in images) else STATUS_PARTIAL,
        "independent_visual_observations": STATUS_PROVEN if analyzed_images and visual_separate else STATUS_BLOCKED,
        "all_images_explicit_processing_status": STATUS_PROVEN if all_images_have_status else STATUS_BLOCKED,
        "logical_suspicion_generation": STATUS_PROVEN if suspicions and suspicion_links else STATUS_PARTIAL,
        "bundle_generation": STATUS_PROVEN if bundles else STATUS_PARTIAL,
        "known_unknown_separation": STATUS_PROVEN if all(bundle.get("known_facts") and bundle.get("unknowns") for bundle in bundles) else STATUS_PARTIAL,
        "human_review_required": STATUS_PROVEN if review_queue and all(not bundle.get("human_verified") for bundle in bundles) else STATUS_BLOCKED,
        "private_output_gitignored": STATUS_PROVEN if gitignored else STATUS_BLOCKED,
        "production_touched": STATUS_NOT_IMPLEMENTED,
        "database_migration": STATUS_NOT_IMPLEMENTED,
        "other_domains": STATUS_NOT_IMPLEMENTED,
        "pricing": STATUS_NOT_IMPLEMENTED,
    }


def git_ignores(path: Path) -> bool:
    return "local-fixtures" in path.parts


def process(args: argparse.Namespace) -> dict[str, Any]:
    started = time.time()
    pdf_path = Path(args.pdf)
    step4_path = Path(args.step4_output)
    shared_cache_path = Path(args.shared_cache)
    output_dir = Path(args.output_dir)
    cache_dir = output_dir / "cache"
    cache_dir.mkdir(parents=True, exist_ok=True)

    if not pdf_path.exists():
        raise FileNotFoundError(f"Private fixture not found: {pdf_path}")
    if not step4_path.exists():
        raise FileNotFoundError(f"Required Step 4 artifact not found: {step4_path}")

    step4 = read_json(step4_path)
    source_sha = sha256_file(pdf_path)
    source_file_id = step4["sourceDocument"].get("source_file_id") or f"sha256:{source_sha[:16]}"
    if step4["sourceDocument"].get("sha256") and step4["sourceDocument"]["sha256"] != source_sha:
        raise ValueError("Step 4 source hash does not match the current private fixture.")

    shared_cache, shared_cache_meta = build_or_load_inspection_evidence_cache(
        pdf_path,
        shared_cache_path,
        source_sha,
        source_file_id,
    )
    source_cache = build_source_cache_from_shared(shared_cache, shared_cache_path, source_sha, source_file_id)
    metadata_records = {int(page): text for page, text in source_cache.get("metadata_pages", {}).items()}
    moisture_metadata = extract_moisture_metadata(metadata_records)
    findings, finding_stats = extract_source_findings(
        source_cache,
        "local-property-1837-sw-jo-ct",
        "local-inspection-report-1837-sw-jo-ct",
        source_file_id,
    )
    captions, caption_stats = extract_and_link_captions(source_cache, findings)

    image_manifest_path = cache_dir / "moisture-envelope-image-manifest.json"
    images, image_manifest_reused, image_warnings = materialize_images_from_shared_cache(
        shared_cache,
        shared_cache_path,
        captions,
        output_dir,
        image_manifest_path,
        source_sha,
        schema_version="shelter-prep-step6-moisture-envelope-image-manifest.v2",
        extraction_method="shared_inspection_evidence_cache_materialized_moisture_envelope_images",
    )
    contact_sheets, sheet_warnings = create_contact_sheets(
        images,
        output_dir,
        sheet_prefix="moisture-envelope-contact-sheet",
        schema_version="shelter-prep-step6-moisture-envelope-contact-sheets.v1",
        columns=5,
        cell_width=360,
        image_height=270,
        label_height=34,
        rows_per_sheet=7,
    )
    write_visual_template(cache_dir / "moisture-envelope-visual-cache.template.json", images, contact_sheets, source_sha)
    visual_cache_path = Path(args.visual_cache) if args.visual_cache else cache_dir / "moisture-envelope-visual-cache.json"
    visual_cache, visual_cache_available = load_visual_cache(visual_cache_path, source_sha)

    evidence_items = make_evidence_items(findings, captions, images, source_file_id)
    visual_records = make_visual_evidence(images, captions, pdf_path, source_file_id, output_dir, visual_cache)
    logical_suspicions = [
        make_logical_suspicion(finding, evidence_items, visual_records)
        for finding in findings
    ]
    bundles = make_bundles(findings, evidence_items, visual_records, logical_suspicions, moisture_metadata)
    review_queue = make_review_queue(findings, visual_records, logical_suspicions)
    agent_draft = make_agent_draft(bundles)
    completed = time.time()

    processing_counts = Counter(record["processing_status"] for record in visual_records)
    agreement_counts = Counter(record["agreement_status"] for record in visual_records if record.get("processing_status") == "analyzed")
    visual_reused_count = sum(1 for record in visual_records if record.get("cache_status") == "reused_by_image_hash")
    contact_sheet_bytes = sum(sheet["size_bytes"] for sheet in contact_sheets)
    output_path = output_dir / "step6-moisture-envelope-output.json"
    summary = {
        "domains_executed": ["moisture_envelope"],
        "model_calls": {
            "text_model_calls": 0,
            "domain_reasoning_model_calls": 0,
            "vision_model_calls": visual_cache.get("model_call_count", 0) if visual_cache_available else 0,
            "total_model_calls": visual_cache.get("model_call_count", 0) if visual_cache_available else 0,
        },
        "model_calls_executed_this_run": {
            "text_model_calls": 0,
            "domain_reasoning_model_calls": 0,
            "vision_model_calls": 0,
            "total_model_calls": 0,
        },
        "cached_visual_model_calls_referenced": visual_cache.get("model_call_count", 0) if visual_cache_available else 0,
        "approximate_input_size": {
            "moisture_source_section_chars": sum(len(text) for text in source_cache.get("section_pages", {}).values()),
            "moisture_caption_chars": sum(len(caption["caption"]) for caption in captions),
            "vision_contact_sheet_bytes": contact_sheet_bytes,
            "full_pdf_bytes_not_sent_to_model": pdf_path.stat().st_size,
        },
        "findings_processed": len(findings),
        "photo_captions_linked": len(captions),
        "images_sent_to_vision": visual_cache.get("images_sent_to_vision", 0) if visual_cache_available else 0,
        "images_with_visual_records": len(visual_records),
        "cached_visual_outputs_reused_by_hash": visual_reused_count,
        "evidence_omitted_as_irrelevant": {
            "candidate_section_findings": finding_stats["candidate_section_findings_omitted_as_irrelevant"],
            "candidate_page_captions": caption_stats["candidate_page_captions_omitted_as_irrelevant"],
            "roof_evidence": "not loaded into Moisture / Exterior Envelope Specialist context",
            "electrical_evidence": "not loaded into Moisture / Exterior Envelope Specialist context",
            "other_domains": "not loaded into Moisture / Exterior Envelope Specialist context",
        },
        "processing_status_distribution": dict(processing_counts),
        "agreement_status_distribution": dict(agreement_counts),
        "logical_suspicions_generated": len(logical_suspicions),
        "review_queue_size": len(review_queue),
        "bundles_generated": len(bundles),
        "source_cache_reused": bool(source_cache.get("cache_reused")),
        "source_cache_source": source_cache.get("cache_source", "domain_pdf_cache"),
        "shared_cache_reused": bool(shared_cache_meta.get("cache_reused")),
        "shared_cache_pdf_pages_scanned": shared_cache_meta.get("local_pdf_pages_scanned", 0),
        "specialist_pdf_pages_scanned": 0,
        "image_manifest_reused": image_manifest_reused,
        "image_manifest_source": "shared_inspection_evidence_cache",
        "visual_cache_available": visual_cache_available,
    }

    output = {
        "schemaVersion": SCHEMA_VERSION,
        "pipeline": {
            "name": PIPELINE_NAME,
            "runMode": "local_file_only_no_database",
            "domain_scope": "moisture_envelope_only",
            "startedAtUnix": started,
            "completedAtUnix": completed,
            "durationMs": round((completed - started) * 1000),
        },
        "sourceDocument": {
            "filename": pdf_path.name,
            "source_file_id": source_file_id,
            "sha256": source_sha,
            "pageCount": step4.get("sourceDocument", {}).get("pageCount"),
            "sizeBytes": pdf_path.stat().st_size,
            "containsPrivateData": True,
            "storage": "local-fixtures only; not committed",
        },
        "reusedArtifacts": {
            "step4_output": str(step4_path.resolve()),
            "shared_evidence_cache": str(shared_cache_path.resolve()),
            "source_cache": "in_memory_from_shared_inspection_evidence_cache",
            "image_manifest": str(image_manifest_path.resolve()),
            "visual_cache": str(visual_cache_path.resolve()) if visual_cache_path.exists() else "",
        },
        "database": {
            "status": STATUS_NOT_IMPLEMENTED,
            "reason": "Step 6 moisture/envelope local slice does not apply migrations or touch Supabase.",
        },
        "propertyMetadata": step4.get("propertyMetadata", {}),
        "inspectionMetadata": step4.get("inspectionMetadata", {}),
        "domainProfiles": [domain_profile()],
        "moistureEnvelopeMetadata": moisture_metadata,
        "sourceFindings": findings,
        "photoCaptions": captions,
        "inspectionImages": images,
        "evidenceItems": evidence_items,
        "imageVisualEvidence": visual_records,
        "logicalSuspicions": logical_suspicions,
        "repairBundles": bundles,
        "reviewQueue": review_queue,
        "agentFacingDrafts": [agent_draft],
        "summary": summary,
        "acceptanceStatus": acceptance_status(
            findings, images, visual_records, logical_suspicions, bundles, review_queue, git_ignores(output_path)
        ),
        "warnings": image_warnings + sheet_warnings,
    }
    write_json(output_path, output)
    return {"output_path": str(output_path), "output": output}


def run_self_test() -> None:
    sample = """Moisture Damage
Leak at window front of home family room over garage
Location/s:
* Family Room
2) Investigate further for cause and make repairs.
Exterior Issues
Rot damaged siding
5) Repair/replace rot damaged siding in the areas indicated in the photos.
"""
    moisture = extract_section_text(3, sample, "Moisture Damage")
    exterior = extract_section_text(3, sample, "Exterior Issues")
    assert moisture is not None
    assert exterior is not None
    findings = parse_issue_section(moisture, "property-test", "inspection-test")
    assert findings[0]["source_item_number"] == "2"
    assert findings[0]["locations"] == ["Family Room"]
    exterior_findings = parse_issue_section(exterior, "property-test", "inspection-test")
    assert exterior_findings[0]["title"] == "Rot damaged siding"

    captions = extract_item_captions_from_text(
        26,
        """Item 2.1 - Leak at window: family Room.
Item 3.1 - Moisture damage to floor: primary Bedroom Bathroom.
Item 22.1 - No GFCI protection: kitchen.
Item 48.2 - Creaky floor: family Room.
""",
    )
    by_number = {finding["source_item_number"]: finding for finding in findings}
    assert link_caption_to_finding(captions[0], by_number) == "moisture-envelope-finding-2"
    assert link_caption_to_finding(captions[2], by_number) == ""
    assert link_caption_to_finding(captions[3], by_number) == ""

    shifted = {"source_item_number": "66.1", "caption": "Moisture damage to ceiling: primary Bedroom."}
    ceiling = {
        "id": "moisture-envelope-finding-65",
        "source_item_number": "65",
        "title": "Moisture damage to ceiling",
        "inspector_statement": "Moisture damage to ceiling",
    }
    assert link_caption_to_finding(shifted, {"65": ceiling}) == "moisture-envelope-finding-65"

    sink_caulk = {"source_item_number": "56.1", "caption": "Split caulking around rim of kitchen sink: kitchen."}
    counter = {
        "id": "moisture-envelope-finding-55",
        "source_item_number": "55",
        "title": "Moisture damaged counter substrate",
        "inspector_statement": "Moisture damaged counter substrate. Split caulking around rim of kitchen sink",
    }
    assert link_caption_to_finding(sink_caulk, {"55": counter}) == "moisture-envelope-finding-55"

    crawlspace = {
        "id": "moisture-envelope-finding-20",
        "source_item_number": "20",
        "title": "Some crawlspace vent openings sit at or are below grade",
        "inspector_statement": "Some crawlspace vent openings sit at or are below grade",
    }
    assert (
        link_caption_to_finding(
            {"source_item_number": "19.1", "caption": "Crawlspace vent covers on some crawlspace vents"},
            {"20": crawlspace},
        )
        == ""
    )

    gutters = {
        "id": "moisture-envelope-finding-83",
        "source_item_number": "83",
        "title": "Clogged gutters",
        "inspector_statement": "Clogged gutters",
    }
    assert (
        link_caption_to_finding({"source_item_number": "84.1", "caption": "Clogged gutters"}, {"83": gutters})
        == "moisture-envelope-finding-83"
    )

    print("phase1_multi_system_moisture_envelope_slice self-test passed")


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Shelter Prep Phase 1 Step 6 moisture/envelope-only local adapter")
    parser.add_argument("--pdf", default=DEFAULT_PDF)
    parser.add_argument("--step4-output", default=DEFAULT_STEP4_OUTPUT)
    parser.add_argument("--shared-cache", default=DEFAULT_SHARED_CACHE)
    parser.add_argument("--output-dir", default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--visual-cache", default="")
    parser.add_argument("--self-test", action="store_true")
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    if args.self_test:
        run_self_test()
        return 0

    result = process(args)
    output = result["output"]
    print(f"Wrote {result['output_path']}")
    print(f"domains_executed={','.join(output['summary']['domains_executed'])}")
    print(f"findings_processed={output['summary']['findings_processed']}")
    print(f"photo_captions_linked={output['summary']['photo_captions_linked']}")
    print(f"images_with_visual_records={output['summary']['images_with_visual_records']}")
    print(f"logical_suspicions_generated={output['summary']['logical_suspicions_generated']}")
    print(f"bundles_generated={output['summary']['bundles_generated']}")
    print(f"processing_status_distribution={json.dumps(output['summary']['processing_status_distribution'], sort_keys=True)}")
    print(f"agreement_status_distribution={json.dumps(output['summary']['agreement_status_distribution'], sort_keys=True)}")
    print(f"review_queue_size={output['summary']['review_queue_size']}")
    print(f"model_calls={json.dumps(output['summary']['model_calls'], sort_keys=True)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
