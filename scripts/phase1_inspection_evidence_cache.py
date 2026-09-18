#!/usr/bin/env python3
"""Shared deterministic inspection evidence cache for local Phase 1 slices."""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import re
import shutil
import sys
import time
from collections import defaultdict
from pathlib import Path
from typing import Any, Pattern

try:
    from pypdf import PdfReader
except Exception as exc:  # pragma: no cover
    print(f"pypdf is required for local PDF extraction: {exc}", file=sys.stderr)
    sys.exit(2)

from phase1_multi_system_shared import (
    SECTION_HEADERS,
    clean_inline,
    clean_lines,
    extract_item_captions_from_text,
    extract_section_text,
    extract_target_images,
    image_manifest_valid,
    is_bullet_line,
    normalize_key,
    normalize_text,
    read_json,
    sha256_file,
    strip_bullet,
    utc_now,
    write_json,
)


SCHEMA_VERSION = "shelter-prep-shared-inspection-evidence-cache.v2"
PIPELINE_NAME = "phase1-shared-inspection-evidence-cache"
DEFAULT_PDF = "local-fixtures/1837-sw-jo-ct-inspection.pdf"
DEFAULT_STEP4_OUTPUT = "local-fixtures/step4-roof-vertical-slice/step4-roof-output.json"
DEFAULT_CACHE_PATH = "local-fixtures/shared-inspection-evidence-cache/1837-sw-jo-ct/inspection-evidence-cache.json"

ELECTRICAL_KEYWORDS = re.compile(
    r"\b(electrical|electrician|gfci|receptacle|faceplate|light fixture|panel|junction box|wiring|cabling|breaker|disconnect)\b",
    flags=re.IGNORECASE,
)
MOISTURE_ENVELOPE_KEYWORDS = re.compile(
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


def caption_issue_key(value: str) -> str:
    return normalize_key(value.split(":", 1)[0])


def meaningful_tokens(value: str) -> set[str]:
    return {token for token in normalize_key(value).split() if len(token) > 2 and token not in STOPWORDS}


def generic_finding_id(source_item_number: str) -> str:
    return f"finding-{source_item_number}"


def generic_caption_id(source_item_number: str) -> str:
    return "caption-" + source_item_number.replace(".", "-")


def domain_rules() -> dict[str, dict[str, Any]]:
    return {
        "roof": {"sections": {"Roof Issues"}, "keywords": re.compile(r"\broof|shingle|flashing|vent|moss|gutter\b", re.I)},
        "electrical": {"sections": {"Electrical Issues"}, "conditional": {"For Improved Safety"}, "keywords": ELECTRICAL_KEYWORDS},
        "moisture_envelope": {
            "sections": {"Moisture Damage", "Condensation/mold", "Exterior Issues", "Eave Issues"},
            "conditional": {
                "Crawlspace Issues",
                "Floor Issues",
                "Countertop Issues",
                "Wall & Ceiling Facings",
                "Ventilation/Exhaust Issues",
                "Site Issues",
                "Minor Repairs/Deferred Maintenance",
            },
            "keywords": MOISTURE_ENVELOPE_KEYWORDS,
        },
        "hvac": {"sections": {"HVAC Issues"}, "keywords": re.compile(r"\bfurnace|hvac|air conditioner|heat pump|filter|duct\b", re.I)},
        "plumbing": {"sections": {"Plumbing Issues"}, "keywords": re.compile(r"\bplumbing|toilet|sink|tub|shower|drain|pipe|valve|leak\b", re.I)},
        "attic_ventilation_insulation": {
            "sections": {"Condensation/mold", "Insulation Issues", "Ventilation/Exhaust Issues"},
            "keywords": re.compile(r"\battic|insulation|ventilation|soffit|exhaust|mold\b", re.I),
        },
        "chimney_fireplace": {"sections": {"Chimney/Fireplace Issues"}, "keywords": re.compile(r"\bchimney|fireplace|firebox|flue\b", re.I)},
        "crawlspace_drainage_pest_pathway": {
            "sections": {"Crawlspace Issues", "Site Issues"},
            "keywords": re.compile(r"\bcrawlspace|drainage|grade|downspout|vegetation|pest|ant\b", re.I),
        },
        "windows_doors_finish_carpentry": {
            "sections": {"Window Issues", "Door Issues", "Cabinetry Issues"},
            "keywords": re.compile(r"\bwindow|door|cabinet|trim|crank|latch\b", re.I),
        },
        "floors_drywall_interior_finishes": {
            "sections": {"Floor Issues", "Wall & Ceiling Facings", "Countertop Issues"},
            "keywords": re.compile(r"\bfloor|drywall|ceiling|wall|texture|counter|laminate\b", re.I),
        },
        "life_safety": {
            "sections": {"Smoke/CO Alarm Issues", "Garage Door Issues", "For Improved Safety"},
            "keywords": re.compile(r"\bsmoke|carbon monoxide|co alarm|garage door|safety|gfci\b", re.I),
        },
        "dryer_exhaust_ventilation": {
            "sections": {"Ventilation/Exhaust Issues"},
            "keywords": re.compile(r"\bdryer|exhaust|vent|duct|screen\b", re.I),
        },
        "site_grading_drainage": {
            "sections": {"Site Issues"},
            "keywords": re.compile(r"\bsite|grade|slope|drain|downspout|vegetation|ground\b", re.I),
        },
        "deferred_maintenance_fyi": {
            "sections": {"Minor Repairs/Deferred Maintenance", "FYI"},
            "keywords": re.compile(r"\bmaintenance|fyi|monitor|repair|replace|caulk|gutter\b", re.I),
        },
    }


def parse_generic_issue_section(section: dict[str, Any], property_id: str, inspection_report_id: str, source_file_id: str) -> list[dict[str, Any]]:
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
            if in_locations:
                detail_lines.append(pending_line)
            else:
                detail_lines.append(pending_line)

        source_item_number = match.group("number")
        inspector_statement = clean_inline(". ".join(part for part in [title, *detail_lines] if part))
        inspector_recommendation = clean_inline(" ".join(rec_lines))
        excerpt = clean_inline(
            " ".join([str(section["source_section"]), title, *detail_lines, *locations, f"{source_item_number})", inspector_recommendation])
        )
        finding = {
            "id": generic_finding_id(source_item_number),
            "property_id": property_id,
            "inspection_report_id": inspection_report_id,
            "source_file_id": source_file_id,
            "source_page": section["source_page"],
            "source_section": section["source_section"],
            "source_section_key": normalize_key(section["source_section"]),
            "source_item_number": source_item_number,
            "title": title,
            "normalized_title": normalize_key(title),
            "inspector_statement": inspector_statement,
            "normalized_statement": normalize_key(inspector_statement),
            "inspector_recommendation": inspector_recommendation,
            "locations": locations,
            "source_excerpt": excerpt,
            "linked_photo_ids": [],
            "domain_routing_candidates": [],
            "provenance": {
                "source_pdf_file_id": source_file_id,
                "pdf_page": section["source_page"],
                "section": section["source_section"],
                "item_number": source_item_number,
                "extraction_method": "pypdf_text_deterministic_generic_issue_parser",
            },
            "review_status": "needs_review",
            "human_verified": False,
        }
        findings.append(finding)
        pending = []

    return findings


NUMBERED_FINDING_PATTERN = re.compile(
    r"^(?P<item>\d+(?:\.\d+){2})\s+(?P<label>.+)$"
)
NUMBERED_SUMMARY_PATTERN = re.compile(
    r"^(?P<item>\d+(?:\.\d+){2})\s+(?P<section>.+?)\s+-\s+(?P<component>.+?)\s*:\s*(?P<title>.+)$"
)


def is_finding_severity(value: str) -> bool:
    compact = re.sub(r"\s+", "", normalize_key(value))
    return compact in {"minordefect", "majordefect", "materialsafetyhazard"}


def is_uppercase_heading(value: str) -> bool:
    letters = [character for character in value if character.isalpha()]
    return bool(letters) and all(character.isupper() for character in letters)


def numbered_summary_index(page_text_by_page: dict[int, str]) -> dict[str, dict[str, Any]]:
    summaries: dict[str, dict[str, Any]] = {}
    for page_number, text in sorted(page_text_by_page.items()):
        for line in clean_lines(text):
            match = NUMBERED_SUMMARY_PATTERN.match(line)
            if not match:
                continue
            summaries.setdefault(
                match.group("item"),
                {
                    "source_page": page_number,
                    "source_section": clean_inline(match.group("section")),
                    "component": clean_inline(match.group("component")),
                    "title": clean_inline(match.group("title")),
                },
            )
    return summaries


def parse_numbered_observation_pages(
    page_text_by_page: dict[int, str],
    property_id: str,
    inspection_report_id: str,
    source_file_id: str,
) -> list[dict[str, Any]]:
    summaries = numbered_summary_index(page_text_by_page)
    findings_by_item: dict[str, dict[str, Any]] = {}

    document_lines: list[tuple[int, str]] = []
    for page_number, text in sorted(page_text_by_page.items()):
        lines = clean_lines(text)
        if lines and re.search(r"\bpage\s+\d+\s+of\s+\d+\b", lines[-1], flags=re.IGNORECASE):
            lines = lines[:-2]
        document_lines.extend((page_number, line) for line in lines)

    idx = 0
    while idx < len(document_lines):
        page_number, header_line = document_lines[idx]
        header = NUMBERED_FINDING_PATTERN.match(header_line)
        if not header or NUMBERED_SUMMARY_PATTERN.match(header_line):
            idx += 1
            continue

        item_number = header.group("item")
        block_end = idx + 1
        while block_end < len(document_lines) and not NUMBERED_FINDING_PATTERN.match(document_lines[block_end][1]):
            block_end += 1
        block_entries = document_lines[idx + 1:block_end]
        block = [line for _, line in block_entries]
        recommendation_index = next(
            (offset for offset, line in enumerate(block) if normalize_key(line) == "recommendation"),
            None,
        )
        severity = next((clean_inline(line) for line in block if is_finding_severity(line)), "")
        narrative_end = recommendation_index if recommendation_index is not None else len(block)
        before_recommendation = [line for line in block[:narrative_end] if not is_finding_severity(line)]
        title_lines: list[str] = []
        while before_recommendation and is_uppercase_heading(before_recommendation[0]):
            title_lines.append(before_recommendation.pop(0))
        statement = clean_inline(" ".join(before_recommendation))

        recommendation_lines: list[str] = []
        if recommendation_index is not None:
            for line in block[recommendation_index + 1:]:
                if is_finding_severity(line):
                    break
                recommendation_lines.append(line)

        summary = summaries.get(item_number, {})
        component = clean_inline(header.group("label"))
        title = clean_inline(" ".join(title_lines)) or summary.get("title", "") or component
        if not statement:
            statement = summary.get("title", "")
        recommendation = clean_inline(" ".join(recommendation_lines))
        if not statement or (not recommendation and not severity) or item_number not in summaries:
            idx = block_end
            continue

        source_section = summary.get("source_section", "") or component
        source_pages = sorted({page for page, _ in block_entries} | {page_number})
        excerpt = clean_inline(" ".join([source_section, component, title, statement, recommendation]))
        finding = {
            "id": generic_finding_id(item_number),
            "property_id": property_id,
            "inspection_report_id": inspection_report_id,
            "source_file_id": source_file_id,
            "source_page": page_number,
            "source_section": source_section,
            "source_section_key": normalize_key(source_section),
            "source_item_number": item_number,
            "title": title,
            "normalized_title": normalize_key(title),
            "inspector_statement": statement,
            "normalized_statement": normalize_key(statement),
            "inspector_recommendation": recommendation,
            "locations": [],
            "source_excerpt": excerpt,
            "linked_photo_ids": [],
            "domain_routing_candidates": [],
            "severity": severity,
            "provenance": {
                "source_pdf_file_id": source_file_id,
                "pdf_page": page_number,
                "source_pages": source_pages,
                "summary_pdf_page": summary.get("source_page"),
                "section": source_section,
                "component": component,
                "item_number": item_number,
                "extraction_method": "pypdf_text_numbered_observation_parser",
            },
            "review_status": "needs_review",
            "human_verified": False,
        }
        existing = findings_by_item.get(item_number)
        if not existing or len(finding["source_excerpt"]) > len(existing["source_excerpt"]):
            findings_by_item[item_number] = finding
        idx = block_end

    return list(findings_by_item.values())


def caption_matches_finding(caption: dict[str, Any], finding: dict[str, Any], *, allow_token_overlap: bool) -> bool:
    caption_text = caption.get("caption", "")
    caption_key = normalize_key(caption_text)
    caption_core_key = caption_issue_key(caption_text)
    title_key = normalize_key(finding.get("title", ""))
    statement_key = normalize_key(finding.get("inspector_statement", ""))
    if title_key and (title_key in caption_key or caption_key in title_key):
        return True
    if caption_key and caption_key in statement_key:
        return True
    if caption_core_key and caption_core_key in statement_key:
        return True
    if not allow_token_overlap:
        return False
    caption_tokens = meaningful_tokens(caption_text)
    finding_tokens = meaningful_tokens(" ".join([finding.get("title", ""), finding.get("inspector_statement", "")]))
    if not caption_tokens or not finding_tokens:
        return False
    overlap = caption_tokens & finding_tokens
    return len(overlap) >= 2 and len(overlap) / max(len(caption_tokens), 1) >= 0.5


def relation_candidate_numbers(major: str) -> list[tuple[str, str]]:
    candidates = [(major, "exact_item_number")]
    if major.isdigit():
        candidates.extend(
            [
                (str(int(major) - 1), "shifted_previous_item_number"),
                (str(int(major) + 1), "shifted_next_item_number"),
            ]
        )
    return candidates


def relate_captions_to_findings(captions: list[dict[str, Any]], findings: list[dict[str, Any]]) -> list[dict[str, Any]]:
    findings_by_number = {finding["source_item_number"]: finding for finding in findings}
    relationships: list[dict[str, Any]] = []
    by_finding: dict[str, list[str]] = defaultdict(list)

    for caption in captions:
        major = str(caption["source_item_number"]).split(".")[0]
        matched_finding: dict[str, Any] | None = None
        matched_relation_type = ""
        for number, relation_type in relation_candidate_numbers(major):
            finding = findings_by_number.get(number)
            if not finding:
                continue
            allow_token_overlap = relation_type == "exact_item_number"
            if caption_matches_finding(caption, finding, allow_token_overlap=allow_token_overlap):
                matched_finding = finding
                matched_relation_type = relation_type
                break
        if not matched_finding:
            caption["related_finding_id"] = ""
            continue

        caption["related_finding_id"] = matched_finding["id"]
        by_finding[matched_finding["id"]].append(caption["id"])
        relationships.append(
            {
                "id": f"relationship-{matched_finding['id']}-{caption['id']}",
                "finding_id": matched_finding["id"],
                "caption_id": caption["id"],
                "source_item_number": matched_finding["source_item_number"],
                "photo_item_number": caption["source_item_number"],
                "relation_type": matched_relation_type,
                "matching_basis": "deterministic_item_number_and_issue_text_match",
                "provenance": {
                    "source_pdf_file_id": matched_finding["source_file_id"],
                    "finding_page": matched_finding["source_page"],
                    "caption_page": caption["source_page"],
                    "extraction_method": "deterministic_caption_finding_linker",
                },
            }
        )

    for finding in findings:
        finding["linked_photo_ids"] = sorted(by_finding.get(finding["id"], []))
    return relationships


def route_finding_candidates(finding: dict[str, Any]) -> list[dict[str, str]]:
    candidates: list[dict[str, str]] = []
    text = " ".join(
        [
            finding.get("source_section", ""),
            finding.get("title", ""),
            finding.get("inspector_statement", ""),
            finding.get("inspector_recommendation", ""),
        ]
    )
    section = finding.get("source_section", "")
    for domain_key, rule in domain_rules().items():
        sections = rule.get("sections", set())
        conditional = rule.get("conditional", set())
        keywords: Pattern[str] = rule["keywords"]
        if section in sections:
            candidates.append({"domain_key": domain_key, "reason": f"source_section:{section}"})
            continue
        if section in conditional and keywords.search(text):
            candidates.append({"domain_key": domain_key, "reason": f"keyword_match_in_conditional_section:{section}"})
            continue
        if keywords.search(text):
            candidates.append({"domain_key": domain_key, "reason": "keyword_match"})
    return candidates


def build_section_index(page_text_by_page: dict[int, str]) -> list[dict[str, Any]]:
    sections: list[dict[str, Any]] = []
    for page_number, text in sorted(page_text_by_page.items()):
        for section_name in SECTION_HEADERS:
            section = extract_section_text(page_number, text, section_name)
            if not section:
                continue
            section_id = f"section-{normalize_key(section_name).replace(' ', '-')}-page-{page_number:03d}"
            section.update(
                {
                    "id": section_id,
                    "source_section_key": normalize_key(section_name),
                    "finding_ids": [],
                    "provenance": {
                        "pdf_page": page_number,
                        "section": section_name,
                        "extraction_method": "pypdf_text_section_header_index",
                    },
                }
            )
            sections.append(section)
    return sections


def build_domain_routing_index(findings: list[dict[str, Any]], captions: list[dict[str, Any]]) -> dict[str, Any]:
    routing: dict[str, dict[str, Any]] = {}
    captions_by_finding: dict[str, list[str]] = defaultdict(list)
    for caption in captions:
        if caption.get("related_finding_id"):
            captions_by_finding[caption["related_finding_id"]].append(caption["id"])

    for finding in findings:
        candidates = route_finding_candidates(finding)
        finding["domain_routing_candidates"] = candidates
        for candidate in candidates:
            domain_key = candidate["domain_key"]
            routing.setdefault(domain_key, {"finding_ids": [], "caption_ids": [], "reasons": []})
            routing[domain_key]["finding_ids"].append(finding["id"])
            routing[domain_key]["caption_ids"].extend(captions_by_finding.get(finding["id"], []))
            routing[domain_key]["reasons"].append(
                {
                    "finding_id": finding["id"],
                    "source_item_number": finding["source_item_number"],
                    "reason": candidate["reason"],
                }
            )

    return {
        domain_key: {
            "finding_ids": sorted(set(value["finding_ids"])),
            "caption_ids": sorted(set(value["caption_ids"])),
            "reasons": value["reasons"],
        }
        for domain_key, value in sorted(routing.items())
    }


def collect_visual_cache_indexes(source_sha: str) -> list[dict[str, Any]]:
    indexes = []
    candidates = [
        ("step5_roof_visual_output", Path("local-fixtures/step5-roof-visual-interpretation/step5-roof-visual-output.json")),
        ("step6_electrical_visual_cache", Path("local-fixtures/step6-electrical-slice/cache/electrical-visual-cache.json")),
        ("step6_moisture_envelope_visual_cache", Path("local-fixtures/step6-moisture-envelope-slice/cache/moisture-envelope-visual-cache.json")),
    ]
    for cache_type, path in candidates:
        if not path.exists():
            continue
        try:
            data = read_json(path)
        except Exception:
            continue
        entries = data.get("entries") or data.get("imageVisualEvidence") or []
        declared_source_hash = data.get("source_pdf_sha256")
        if not declared_source_hash and data.get("source_pdf"):
            source_path = Path(data["source_pdf"])
            if source_path.exists():
                declared_source_hash = sha256_file(source_path)
        hashes = []
        for entry in entries:
            image_hash = (
                entry.get("image_sha256")
                or entry.get("provenance", {}).get("image_sha256")
                or entry.get("extracted_image_sha256")
                or ""
            )
            if image_hash:
                hashes.append(image_hash)
        indexes.append(
            {
                "cache_type": cache_type,
                "path": str(path.resolve()),
                "compatible_with_source_hash": declared_source_hash == source_sha,
                "source_pdf_sha256": declared_source_hash or "",
                "entries": len(entries),
                "image_hashes": sorted(set(hashes)),
            }
        )
    return indexes


def shared_cache_usable(cache: dict[str, Any], source_sha: str) -> bool:
    return cache.get("schemaVersion") == SCHEMA_VERSION and cache.get("sourceDocument", {}).get("sha256") == source_sha


def build_or_load_inspection_evidence_cache(
    pdf_path: Path,
    cache_path: Path,
    source_sha: str,
    source_file_id: str,
    *,
    force_rebuild: bool = False,
) -> tuple[dict[str, Any], dict[str, Any]]:
    if cache_path.exists() and not force_rebuild:
        cache = read_json(cache_path)
        if shared_cache_usable(cache, source_sha):
            return cache, {
                "cache_reused": True,
                "source_hash_matched": True,
                "local_pdf_pages_scanned": 0,
                "reason": "source_hash_unchanged",
            }

    started = time.time()
    cache_dir = cache_path.parent
    cache_dir.mkdir(parents=True, exist_ok=True)
    reader = PdfReader(str(pdf_path))
    page_text_by_page: dict[int, str] = {}
    page_records: list[dict[str, Any]] = []

    for page_number, page in enumerate(reader.pages, start=1):
        text = normalize_text(page.extract_text() or "")
        page_text_by_page[page_number] = text
        page_records.append(
            {
                "page_number": page_number,
                "text": text,
                "char_count": len(text),
                "provenance": {
                    "source_pdf_file_id": source_file_id,
                    "pdf_page": page_number,
                    "extraction_method": "pypdf_page_text",
                },
            }
        )

    section_index = build_section_index(page_text_by_page)
    property_id = "local-property-1837-sw-jo-ct"
    inspection_report_id = "local-inspection-report-1837-sw-jo-ct"
    source_findings: list[dict[str, Any]] = []
    section_by_id = {section["id"]: section for section in section_index}
    for section in section_index:
        parsed = parse_generic_issue_section(section, property_id, inspection_report_id, source_file_id)
        for finding in parsed:
            finding["source_section_id"] = section["id"]
            source_findings.append(finding)
            section_by_id[section["id"]]["finding_ids"].append(finding["id"])

    numbered_findings = parse_numbered_observation_pages(
        page_text_by_page,
        property_id,
        inspection_report_id,
        source_file_id,
    )
    existing_finding_ids = {finding["id"] for finding in source_findings}
    source_findings.extend(finding for finding in numbered_findings if finding["id"] not in existing_finding_ids)

    photo_captions: list[dict[str, Any]] = []
    for page_number, text in sorted(page_text_by_page.items()):
        if "Item " not in text:
            continue
        for caption in extract_item_captions_from_text(page_number, text):
            caption["major_item_number"] = caption["source_item_number"].split(".", 1)[0]
            caption["provenance"] = {
                "source_pdf_file_id": source_file_id,
                "pdf_page": page_number,
                "photo_item_number": caption["source_item_number"],
                "extraction_method": "pypdf_text_photo_caption_parser",
            }
            photo_captions.append(caption)

    finding_photo_relationships = relate_captions_to_findings(photo_captions, source_findings)
    image_manifest_path = cache_dir / "image-manifest.json"
    extracted_images, image_manifest_reused, image_warnings = extract_target_images(
        pdf_path,
        photo_captions,
        cache_dir,
        image_manifest_path,
        source_sha,
        schema_version="shelter-prep-shared-inspection-image-manifest.v1",
        extraction_method="pypdf.page.images_all_captioned_photo_pages",
    )
    images_by_caption = {image.get("related_photo_caption_id"): image for image in extracted_images}
    for relationship in finding_photo_relationships:
        image = images_by_caption.get(relationship["caption_id"])
        relationship["image_id"] = image.get("id", "") if image else ""
        relationship["image_sha256"] = image.get("sha256", "") if image else ""

    section_finding_relationships = [
        {
            "section_id": section["id"],
            "source_section": section["source_section"],
            "source_page": section["source_page"],
            "finding_ids": section.get("finding_ids", []),
        }
        for section in section_index
        if section.get("finding_ids")
    ]
    domain_routing_candidates = build_domain_routing_index(source_findings, photo_captions)
    image_hash_index: dict[str, list[dict[str, str]]] = defaultdict(list)
    for image in extracted_images:
        image_hash = image.get("sha256", "")
        if not image_hash:
            continue
        image_hash_index[image_hash].append(
            {
                "image_id": image.get("id", ""),
                "caption_id": image.get("related_photo_caption_id", ""),
                "extracted_image_storage_path": image.get("extracted_image_storage_path", ""),
            }
        )

    completed = time.time()
    cache = {
        "schemaVersion": SCHEMA_VERSION,
        "pipeline": {
            "name": PIPELINE_NAME,
            "runMode": "local_file_only_no_database",
            "created_at": utc_now(),
            "durationMs": round((completed - started) * 1000),
            "model_calls": 0,
        },
        "sourceDocument": {
            "filename": pdf_path.name,
            "source_file_id": source_file_id,
            "sha256": source_sha,
            "pageCount": len(reader.pages),
            "sizeBytes": pdf_path.stat().st_size,
            "containsPrivateData": True,
            "source_path": str(pdf_path.resolve()),
            "storage": "local-fixtures only; not committed",
        },
        "cacheBehavior": {
            "invalidate_on": "sourceDocument.sha256 change",
            "rebuild_only_when_source_hash_changes": True,
            "local_pdf_pages_scanned_to_build": len(reader.pages),
            "image_manifest_reused_during_build": image_manifest_reused,
        },
        "pageTextByPage": {str(record["page_number"]): record for record in page_records},
        "reportSectionIndex": list(section_by_id.values()),
        "normalizedFindings": source_findings,
        "photoCaptionIndex": photo_captions,
        "extractedImageManifest": {
            "path": str(image_manifest_path.resolve()),
            "image_count": len(extracted_images),
            "images": extracted_images,
        },
        "imageHashIndex": dict(image_hash_index),
        "findingPhotoRelationships": finding_photo_relationships,
        "sectionFindingRelationships": section_finding_relationships,
        "domainRoutingCandidates": domain_routing_candidates,
        "compatibleVisualCacheIndexes": collect_visual_cache_indexes(source_sha),
        "summary": {
            "pages_indexed": len(page_records),
            "sections_indexed": len(section_index),
            "findings_indexed": len(source_findings),
            "numbered_observation_findings_indexed": len(numbered_findings),
            "photo_captions_indexed": len(photo_captions),
            "finding_photo_relationships": len(finding_photo_relationships),
            "images_indexed": len(extracted_images),
            "image_hashes_indexed": len(image_hash_index),
            "domains_routable": sorted(domain_routing_candidates),
            "model_calls": 0,
        },
        "warnings": image_warnings,
    }
    write_json(cache_path, cache)
    return cache, {
        "cache_reused": False,
        "source_hash_matched": True,
        "local_pdf_pages_scanned": len(reader.pages),
        "reason": "cache_missing_or_source_hash_changed",
    }


def page_text_map(shared_cache: dict[str, Any]) -> dict[int, str]:
    return {int(page): record.get("text", "") for page, record in shared_cache.get("pageTextByPage", {}).items()}


def section_pages_from_shared(shared_cache: dict[str, Any], section_names: set[str]) -> dict[str, str]:
    pages = {
        int(section["source_page"])
        for section in shared_cache.get("reportSectionIndex", [])
        if section.get("source_section") in section_names
    }
    texts = page_text_map(shared_cache)
    return {str(page): texts[page] for page in sorted(pages) if page in texts}


def caption_pages_from_shared(shared_cache: dict[str, Any], keyword_pattern: Pattern[str]) -> dict[str, str]:
    pages = {
        int(caption["source_page"])
        for caption in shared_cache.get("photoCaptionIndex", [])
        if keyword_pattern.search(caption.get("caption", ""))
    }
    texts = page_text_map(shared_cache)
    return {str(page): texts[page] for page in sorted(pages) if page in texts}


def metadata_pages_from_shared(shared_cache: dict[str, Any], markers: list[str]) -> dict[str, str]:
    texts = page_text_map(shared_cache)
    pages = []
    for page, text in sorted(texts.items()):
        if any(marker in text for marker in markers):
            pages.append(page)
    return {str(page): texts[page] for page in pages}


def shared_cache_dir(shared_cache: dict[str, Any], shared_cache_path: Path) -> Path:
    return shared_cache_path.parent


def materialize_images_from_shared_cache(
    shared_cache: dict[str, Any],
    shared_cache_path: Path,
    captions: list[dict[str, Any]],
    output_dir: Path,
    manifest_path: Path,
    source_sha: str,
    *,
    schema_version: str,
    extraction_method: str,
) -> tuple[list[dict[str, Any]], bool, list[str]]:
    expected_items = [caption["source_item_number"] for caption in captions]
    if manifest_path.exists():
        manifest = read_json(manifest_path)
        if image_manifest_valid(manifest, source_sha, output_dir, expected_items):
            return manifest["images"], True, []

    image_dir = output_dir / "extracted-images"
    image_dir.mkdir(parents=True, exist_ok=True)
    shared_dir = shared_cache_dir(shared_cache, shared_cache_path)
    shared_images_by_caption = {
        image.get("related_photo_caption_id"): image for image in shared_cache.get("extractedImageManifest", {}).get("images", [])
    }
    warnings: list[str] = []
    images: list[dict[str, Any]] = []

    for caption in captions:
        shared_image = shared_images_by_caption.get(caption["id"])
        image_id = "image-" + caption["source_item_number"].replace(".", "-")
        if not shared_image:
            images.append(
                {
                    "id": image_id,
                    "source_page": caption["source_page"],
                    "image_index": caption["image_index_on_page"],
                    "item_number": caption["source_item_number"],
                    "caption": caption["caption"],
                    "related_finding_id": caption["related_finding_id"],
                    "related_photo_caption_id": caption["id"],
                    "extraction_status": "missing_from_shared_cache",
                }
            )
            continue
        if shared_image.get("extraction_status") != "extracted":
            copied = copy.deepcopy(shared_image)
            copied.update(
                {
                    "id": image_id,
                    "caption": caption["caption"],
                    "related_finding_id": caption["related_finding_id"],
                    "related_photo_caption_id": caption["id"],
                    "materialized_from_shared_cache": False,
                }
            )
            images.append(copied)
            continue

        source_path = shared_dir / shared_image.get("extracted_image_storage_path", "")
        target_path = image_dir / Path(shared_image.get("extracted_image_storage_path", "")).name
        if not source_path.exists():
            warnings.append(f"Shared image missing for {caption['source_item_number']}: {source_path}")
            images.append(
                {
                    "id": image_id,
                    "source_page": caption["source_page"],
                    "image_index": caption["image_index_on_page"],
                    "item_number": caption["source_item_number"],
                    "caption": caption["caption"],
                    "related_finding_id": caption["related_finding_id"],
                    "related_photo_caption_id": caption["id"],
                    "extraction_status": "missing_shared_image_file",
                }
            )
            continue
        if not target_path.exists() or sha256_file(target_path) != shared_image.get("sha256"):
            shutil.copy2(source_path, target_path)
        if sha256_file(target_path) != shared_image.get("sha256"):
            warnings.append(f"Materialized image hash mismatch for {caption['source_item_number']}: {target_path}")
            status = "hash_mismatch"
        else:
            status = "extracted"

        image_record = copy.deepcopy(shared_image)
        image_record.update(
            {
                "id": image_id,
                "source_page": caption["source_page"],
                "image_index": caption["image_index_on_page"],
                "item_number": caption["source_item_number"],
                "caption": caption["caption"],
                "related_finding_id": caption["related_finding_id"],
                "related_photo_caption_id": caption["id"],
                "extracted_image_storage_path": str(target_path.relative_to(output_dir)),
                "extraction_method": extraction_method,
                "extraction_status": status,
                "materialized_from_shared_cache": True,
                "source_shared_cache_image_id": shared_image.get("id", ""),
                "source_shared_cache_path": str(shared_cache_path.resolve()),
            }
        )
        images.append(image_record)

    write_json(
        manifest_path,
        {
            "schemaVersion": schema_version,
            "source_pdf": shared_cache.get("sourceDocument", {}).get("source_path", ""),
            "source_pdf_sha256": source_sha,
            "created_at": utc_now(),
            "materialized_from_shared_cache": True,
            "source_shared_cache": str(shared_cache_path.resolve()),
            "images": images,
        },
    )
    return images, False, warnings


def git_ignores(path: Path) -> bool:
    return "local-fixtures" in path.parts


def run_self_test() -> None:
    section = {
        "source_page": 4,
        "source_section": "Exterior Issues",
        "text": """Exterior Issues
Rot damaged siding
5) Repair/replace rot damaged siding.
Split caulking on exterior
7) Repair split caulking.
""",
    }
    findings = parse_generic_issue_section(section, "property-test", "inspection-test", "source-test")
    assert [finding["source_item_number"] for finding in findings] == ["5", "7"]
    captions = extract_item_captions_from_text(28, "Item 5.1 - Rot damaged siding\nItem 48.2 - Creaky floor: family Room.")
    relationships = relate_captions_to_findings(captions, findings)
    assert len(relationships) == 1
    assert relationships[0]["finding_id"] == "finding-5"
    assert captions[1]["related_finding_id"] == ""
    routing = build_domain_routing_index(findings, captions)
    assert "moisture_envelope" in routing
    assert "finding-5" in routing["moisture_envelope"]["finding_ids"]
    numbered_pages = {
        2: """SUMMARY
2.3.1 Site - Walkways: Uneven walking surface
4.3.1 Roof - Covering: Exposed fastener
""",
        8: """2.3.1 Walkways
UNEVEN WALKING SURFACE
The inspector observed a raised edge at the walkway.
Recommendation
Contact a qualified professional.
Major Defect
""",
        12: """4.3.1 Covering
EXPOSED FASTENER
An exposed fastener was observed at the roof covering.
Recommendation
Have a qualified roofing professional evaluate and repair.
Minor Defect
""",
    }
    numbered = parse_numbered_observation_pages(numbered_pages, "property-test", "inspection-test", "source-test")
    assert [finding["source_item_number"] for finding in numbered] == ["2.3.1", "4.3.1"]
    assert numbered[0]["source_page"] == 8
    assert numbered[0]["source_section"] == "Site"
    assert numbered[0]["provenance"]["summary_pdf_page"] == 2
    assert numbered[1]["inspector_recommendation"] == "Have a qualified roofing professional evaluate and repair."
    cross_page = parse_numbered_observation_pages(
        {
            2: "SUMMARY\n8.2.1 Plumbing - Water Supply: Aging supply piping",
            5: "8.2.1 Water Supply\nAGING SUPPLY PIPING\nMajor Defect\nExample footer\nReport Page 5 of 6",
            6: "The inspector observed aging supply piping.\nRecommendation\nContact a qualified plumbing professional.",
        },
        "property-test",
        "inspection-test",
        "source-test",
    )
    assert len(cross_page) == 1
    assert cross_page[0]["provenance"]["source_pages"] == [5, 6]
    assert cross_page[0]["inspector_statement"] == "The inspector observed aging supply piping."
    print("phase1_inspection_evidence_cache self-test passed")


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build/reuse the shared Shelter Prep local inspection evidence cache")
    parser.add_argument("--pdf", default=DEFAULT_PDF)
    parser.add_argument("--step4-output", default=DEFAULT_STEP4_OUTPUT)
    parser.add_argument("--cache-path", default=DEFAULT_CACHE_PATH)
    parser.add_argument("--force-rebuild", action="store_true")
    parser.add_argument("--self-test", action="store_true")
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    if args.self_test:
        run_self_test()
        return 0

    pdf_path = Path(args.pdf)
    step4_path = Path(args.step4_output)
    cache_path = Path(args.cache_path)
    if not pdf_path.exists():
        raise FileNotFoundError(f"Private fixture not found: {pdf_path}")
    step4 = read_json(step4_path) if step4_path.exists() else {}
    source_sha = sha256_file(pdf_path)
    source_file_id = step4.get("sourceDocument", {}).get("source_file_id") or f"sha256:{source_sha[:16]}"
    if step4.get("sourceDocument", {}).get("sha256") and step4["sourceDocument"]["sha256"] != source_sha:
        raise ValueError("Step 4 source hash does not match the current private fixture.")
    cache, meta = build_or_load_inspection_evidence_cache(
        pdf_path,
        cache_path,
        source_sha,
        source_file_id,
        force_rebuild=args.force_rebuild,
    )
    action = "Reused" if meta["cache_reused"] else "Wrote"
    print(f"{action} {cache_path}")
    print(f"cache_reused={str(meta['cache_reused']).lower()}")
    print(f"source_hash_matched={str(meta['source_hash_matched']).lower()}")
    print(f"local_pdf_pages_scanned={meta['local_pdf_pages_scanned']}")
    print(f"findings_indexed={cache['summary']['findings_indexed']}")
    print(f"photo_captions_indexed={cache['summary']['photo_captions_indexed']}")
    print(f"images_indexed={cache['summary']['images_indexed']}")
    print(f"domains_routable={','.join(cache['summary']['domains_routable'])}")
    print(f"private_output_gitignored={str(git_ignores(cache_path)).lower()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
