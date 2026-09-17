#!/usr/bin/env python3
"""Roof-only local proof adapter for Shelter Prep Phase 1 Step 4.

This script processes a private real inspection PDF only when explicitly invoked.
It writes private output under the caller-provided output directory.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import time
import unicodedata
from collections import defaultdict
from pathlib import Path

try:
    from pypdf import PdfReader
except Exception as exc:  # pragma: no cover - exercised by CLI failure path
    print(f"pypdf is required for PDF extraction: {exc}", file=sys.stderr)
    sys.exit(2)


SCHEMA_VERSION = "shelter-prep-step4-roof-local-output.v1"
STATUS_PROVEN = "PROVEN"
STATUS_PARTIAL = "PARTIAL"
STATUS_BLOCKED = "BLOCKED"
STATUS_NOT_IMPLEMENTED = "NOT IMPLEMENTED"


def normalize_text(value: str | None) -> str:
    if not value:
        return ""
    normalized = unicodedata.normalize("NFKD", value)
    normalized = normalized.replace("\u00a0", " ")
    return normalized.replace("\r\n", "\n").replace("\r", "\n")


def clean_inline(value: str | None) -> str:
    return re.sub(r"\s+", " ", normalize_text(value)).strip()


def clean_lines(value: str | None) -> list[str]:
    return [clean_inline(line) for line in normalize_text(value).splitlines() if clean_inline(line)]


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def parse_city_state_zip(value: str) -> dict[str, str]:
    cleaned = clean_inline(value).replace(" ,", ",")
    match = re.match(r"^(?P<city>.+?),?\s+(?P<state>[A-Z]{2})\s+(?P<zip>\d{5}(?:-\d{4})?)$", cleaned)
    if not match:
        return {"city": "", "state": "", "zip": "", "raw": cleaned}
    return {
        "city": clean_inline(match.group("city")),
        "state": match.group("state"),
        "zip": match.group("zip"),
        "raw": cleaned,
    }


def extract_header_metadata(first_page_text: str) -> dict[str, object]:
    lines = clean_lines(first_page_text)
    date_index = None
    date_value = ""
    for index, line in enumerate(lines):
        match = re.search(r"\b\d{2}/\d{2}/\d{4}\b", line)
        if match:
            date_index = index
            date_value = match.group(0)
            break

    street = lines[date_index + 1] if date_index is not None and date_index + 1 < len(lines) else ""
    city_state_zip_line = lines[date_index + 2] if date_index is not None and date_index + 2 < len(lines) else ""
    city_state_zip = parse_city_state_zip(city_state_zip_line)
    inspector = lines[date_index + 3] if date_index is not None and date_index + 3 < len(lines) else ""
    client = lines[date_index + 4] if date_index is not None and date_index + 4 < len(lines) else ""

    email_match = re.search(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", first_page_text)
    phone_match = re.search(r"\b\d{3}[-.]\d{3}[-.]\d{4}\b", first_page_text)

    license_line = ""
    for line in lines:
        if "OCHI#" in line or "CCB#" in line or "WA#" in line:
            license_line = line
            break

    return {
        "property": {
            "street_address": street,
            "city": city_state_zip["city"],
            "state": city_state_zip["state"],
            "zip": city_state_zip["zip"],
            "raw_city_state_zip": city_state_zip["raw"],
        },
        "inspection": {
            "inspection_date": date_value,
            "inspection_company": lines[0] if lines else "",
            "inspector": inspector,
            "client": client,
            "company_email": email_match.group(0) if email_match else "",
            "company_phone": phone_match.group(0) if phone_match else "",
            "registration_line": license_line,
        },
    }


def extract_roof_profile(page_texts: list[str]) -> dict[str, str]:
    joined = "\n".join(page_texts)
    profile: dict[str, str] = {}

    patterns = {
        "roof_structure": r"Roof & ceiling Assemblies:\s*Trusses:\s*(?P<value>[^\n]+)",
        "roof_decking": r"Decking:\s*(?P<value>[^\n]+)",
        "roof_covering_type": r"Roof coverings:\s*Types:\s*(?P<value>[^\n]+)",
        "estimated_roof_age": r"Roof coverings:[\s\S]*?Age:\s*(?P<value>[^\n]+)",
        "roof_layers": r"Roof coverings:[\s\S]*?Layers:\s*(?P<value>[^\n]+)",
        "roof_drainage": r"Roof drainage systems:\s*(?P<value>[^\n]+)",
        "roof_flashings": r"Roof flashings:\s*(?P<value>[^\n]+)",
        "skylights": r"Skylights:\s*(?P<value>[^\n]+)",
        "roof_penetrations": r"Roof penetrations:\s*Types:\s*(?P<value>[^\n]+)",
        "roof_observation_method": r"Roof observation methods:\s*(?P<value>[^\n]+)",
    }

    for key, pattern in patterns.items():
        match = re.search(pattern, joined, flags=re.IGNORECASE)
        if match:
            profile[key] = clean_inline(match.group("value"))

    return profile


def extract_roof_narrative_from_text(page_number: int, text: str) -> dict[str, object] | None:
    normalized = normalize_text(text)
    match = re.search(r"(?:^|\n)Roof Issues(?:\n|$)", normalized, flags=re.IGNORECASE)
    if not match:
        return None

    after = normalized[match.end() :]
    end_markers = [
        marker.start()
        for marker in re.finditer(r"(?:^|\n)(Moisture Damage|Exterior Issues|HVAC Issues)(?:\n|$)", after, flags=re.IGNORECASE)
    ]
    section = after[: min(end_markers)] if end_markers else after
    lines = clean_lines(section)

    title = ""
    bullets: list[str] = []
    recommendation = ""
    original_parts: list[str] = []

    for line in lines:
        if re.match(r"^\d+\)", line):
            recommendation = clean_inline(re.sub(r"^\d+\)\s*", "", line))
            original_parts.append(line)
            continue
        if line.startswith("\u2022"):
            bullets.append(clean_inline(line.lstrip("\u2022").strip()))
            original_parts.append(line)
            continue
        if not title:
            title = line
            original_parts.append(line)
        else:
            original_parts.append(line)

    item_match = re.search(r"(?m)^(\d+)\)", normalize_text(section))
    item_number = item_match.group(1) if item_match else "1"

    return {
        "id": f"roof-finding-{item_number}",
        "property_id": "local-property-1837-sw-jo-ct",
        "inspection_report_id": "local-inspection-report-1837-sw-jo-ct",
        "source_page": page_number,
        "source_section": "Roof Issues",
        "source_item_number": item_number,
        "title": title,
        "original_text": clean_inline("Roof Issues " + " ".join(original_parts)),
        "inspector_recommendation": recommendation,
        "inspector_location": "",
        "normalized_location": "Roof",
        "building_system": "Roof System",
        "trade_category": "Roofing",
        "urgency": "needs_contractor_review",
        "safety_flag": False,
        "moisture_flag": any("leak" in item.lower() for item in [title, recommendation, *bullets]),
        "further_evaluation_flag": False,
        "maintenance_flag": any("moss" in item.lower() or "debris" in item.lower() for item in bullets),
        "fyi_flag": False,
        "reported_conditions": bullets,
        "raw_evidence_ids": ["evidence-written-roof-1"],
        "review_status": "needs_review",
    }


def extract_roof_narrative(page_texts: list[str]) -> dict[str, object]:
    for index, text in enumerate(page_texts, start=1):
        finding = extract_roof_narrative_from_text(index, text)
        if finding:
            return finding
    raise ValueError("Could not find a Roof Issues section in extracted PDF text.")


def strip_caption_footer(value: str) -> str:
    caption = value
    for marker in [
        "Hawkeye Home Inspections",
        "www.HawkeyeHomeInspections.net",
        "OCHI#",
        "Inspection date:",
        "Address:",
        "8/3/26",
        "file:///",
    ]:
        marker_index = caption.find(marker)
        if marker_index >= 0:
            caption = caption[:marker_index]
    return clean_inline(caption)


def extract_item_captions_from_text(page_number: int, text: str, major_item: str = "1") -> list[dict[str, object]]:
    normalized = normalize_text(text)
    pattern = re.compile(
        r"Item\s+(?P<item>\d+\.\d+)\s*-\s*(?P<caption>.*?)(?=\s+Item\s+\d+\.\d+\s*-|\Z)",
        flags=re.IGNORECASE | re.DOTALL,
    )
    captions: list[dict[str, object]] = []
    for match in pattern.finditer(normalized):
        item_number = match.group("item")
        if not item_number.startswith(f"{major_item}."):
            continue
        caption = strip_caption_footer(match.group("caption"))
        if not caption:
            continue
        captions.append(
            {
                "id": "caption-" + item_number.replace(".", "-"),
                "source_page": page_number,
                "source_item_number": item_number,
                "caption": caption,
                "related_written_finding_id": f"roof-finding-{major_item}",
                "review_status": "needs_review",
            }
        )
    return captions


def extract_roof_photo_captions(page_texts: list[str], major_item: str = "1") -> list[dict[str, object]]:
    captions: list[dict[str, object]] = []
    for index, text in enumerate(page_texts, start=1):
        captions.extend(extract_item_captions_from_text(index, text, major_item))
    return captions


def safe_image_suffix(name: str | None) -> str:
    suffix = Path(name or "").suffix.lower()
    return suffix if suffix in {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tiff"} else ".bin"


def extract_linked_images(
    reader: PdfReader,
    captions: list[dict[str, object]],
    output_dir: Path,
) -> tuple[list[dict[str, object]], list[str]]:
    image_dir = output_dir / "extracted-images"
    image_dir.mkdir(parents=True, exist_ok=True)

    captions_by_page: dict[int, list[dict[str, object]]] = defaultdict(list)
    for caption in captions:
        captions_by_page[int(caption["source_page"])].append(caption)

    images: list[dict[str, object]] = []
    warnings: list[str] = []

    for page_number in sorted(captions_by_page):
        page = reader.pages[page_number - 1]
        page_captions = captions_by_page[page_number]
        try:
            page_images = list(page.images)
        except Exception as exc:  # pragma: no cover - depends on PDF internals
            warnings.append(f"Page {page_number}: image extraction failed: {exc}")
            for index, caption in enumerate(page_captions, start=1):
                images.append(
                    {
                        "id": f"image-{caption['source_item_number'].replace('.', '-')}",
                        "source_page": page_number,
                        "image_index": index,
                        "item_number": caption["source_item_number"],
                        "caption": caption["caption"],
                        "related_written_finding_id": caption["related_written_finding_id"],
                        "related_photo_caption_id": caption["id"],
                        "extraction_status": "failed",
                        "extraction_error": str(exc),
                    }
                )
            continue

        if len(page_images) != len(page_captions):
            warnings.append(
                f"Page {page_number}: found {len(page_images)} images for {len(page_captions)} roof captions; linked by page order."
            )

        max_count = max(len(page_images), len(page_captions))
        for zero_index in range(max_count):
            caption = page_captions[zero_index] if zero_index < len(page_captions) else None
            image = page_images[zero_index] if zero_index < len(page_images) else None
            item_number = str(caption["source_item_number"]) if caption else f"unmatched-{page_number}-{zero_index + 1}"
            image_id = "image-" + item_number.replace(".", "-")

            if image is None:
                images.append(
                    {
                        "id": image_id,
                        "source_page": page_number,
                        "image_index": zero_index + 1,
                        "item_number": item_number,
                        "caption": caption["caption"] if caption else "",
                        "related_written_finding_id": caption["related_written_finding_id"] if caption else "",
                        "related_photo_caption_id": caption["id"] if caption else "",
                        "extraction_status": "missing_image_for_caption",
                    }
                )
                continue

            suffix = safe_image_suffix(getattr(image, "name", ""))
            filename = f"page-{page_number:03d}-image-{zero_index + 1:03d}-item-{item_number.replace('.', '-')}{suffix}"
            image_path = image_dir / filename
            try:
                data = image.data
                image_path.write_bytes(data)
                pil_image = getattr(image, "image", None)
                dimensions = {}
                if pil_image is not None:
                    dimensions = {"width": pil_image.size[0], "height": pil_image.size[1]}
                images.append(
                    {
                        "id": image_id,
                        "source_page": page_number,
                        "image_index": zero_index + 1,
                        "source_pdf_image_name": getattr(image, "name", ""),
                        "item_number": item_number,
                        "caption": caption["caption"] if caption else "",
                        "related_written_finding_id": caption["related_written_finding_id"] if caption else "",
                        "related_photo_caption_id": caption["id"] if caption else "",
                        "extracted_image_storage_path": str(image_path.relative_to(output_dir)),
                        "image_dimensions": dimensions,
                        "size_bytes": len(data),
                        "sha256": hashlib.sha256(data).hexdigest(),
                        "extraction_method": "pypdf.page.images",
                        "extraction_status": "extracted" if caption else "extracted_without_matching_caption",
                    }
                )
            except Exception as exc:  # pragma: no cover - depends on PDF internals
                warnings.append(f"Page {page_number} image {zero_index + 1}: write failed: {exc}")
                images.append(
                    {
                        "id": image_id,
                        "source_page": page_number,
                        "image_index": zero_index + 1,
                        "item_number": item_number,
                        "caption": caption["caption"] if caption else "",
                        "related_written_finding_id": caption["related_written_finding_id"] if caption else "",
                        "related_photo_caption_id": caption["id"] if caption else "",
                        "extraction_status": "failed",
                        "extraction_error": str(exc),
                    }
                )

    return images, warnings


def make_evidence_items(
    finding: dict[str, object],
    captions: list[dict[str, object]],
    images: list[dict[str, object]],
    source_file_id: str,
) -> list[dict[str, object]]:
    evidence = [
        {
            "id": "evidence-written-roof-1",
            "property_id": finding["property_id"],
            "inspection_report_id": finding["inspection_report_id"],
            "source_type": "inspection_report_text",
            "source_file_id": source_file_id,
            "source_page": finding["source_page"],
            "source_section": finding["source_section"],
            "source_item_number": finding["source_item_number"],
            "source_excerpt": finding["original_text"],
            "observation": finding["title"],
            "claim_type": "inspector_statement",
            "confidence": "source_reported",
            "requires_field_verification": True,
            "created_by_agent": "phase1_roof_vertical_slice_local_adapter",
            "review_status": "needs_review",
        }
    ]

    image_by_caption_id = {
        image.get("related_photo_caption_id"): image for image in images if image.get("related_photo_caption_id")
    }
    for caption in captions:
        linked_image = image_by_caption_id.get(caption["id"], {})
        evidence.append(
            {
                "id": "evidence-photo-" + str(caption["source_item_number"]).replace(".", "-"),
                "property_id": finding["property_id"],
                "inspection_report_id": finding["inspection_report_id"],
                "source_type": "inspection_photo_caption",
                "source_file_id": source_file_id,
                "source_page": caption["source_page"],
                "source_item_number": caption["source_item_number"],
                "source_caption": caption["caption"],
                "source_image_id": linked_image.get("id", ""),
                "source_image_path": linked_image.get("extracted_image_storage_path", ""),
                "observation": caption["caption"],
                "claim_type": "inspector_photo_caption",
                "confidence": "source_reported",
                "requires_field_verification": True,
                "created_by_agent": "phase1_roof_vertical_slice_local_adapter",
                "review_status": "needs_review",
            }
        )

    return evidence


def make_photo_interpretations(
    images: list[dict[str, object]],
    evidence_items: list[dict[str, object]],
) -> list[dict[str, object]]:
    evidence_by_item = {
        item.get("source_item_number"): item["id"]
        for item in evidence_items
        if item.get("source_type") == "inspection_photo_caption"
    }
    interpretations = []
    for image in images:
        item_number = image.get("item_number", "")
        interpretations.append(
            {
                "id": "photo-interpretation-" + str(item_number).replace(".", "-"),
                "inspection_image_id": image.get("id", ""),
                "related_finding_id": image.get("related_written_finding_id", ""),
                "evidence_item_ids": [evidence_by_item[item_number]] if item_number in evidence_by_item else [],
                "inspector_statement": image.get("caption", ""),
                "visual_observation": "",
                "visual_observation_status": "not_performed",
                "shelter_prep_interpretation": "",
                "shelter_prep_interpretation_status": "not_performed",
                "discrepancy_flag": False,
                "confidence": "not_assessed",
                "review_status": "needs_review",
                "note": "Actual image file was extracted and linked. Semantic visual analysis was not performed, so caption text is not treated as visual observation.",
            }
        )
    return interpretations


def make_roof_bundle(
    finding: dict[str, object],
    captions: list[dict[str, object]],
    images: list[dict[str, object]],
    evidence_items: list[dict[str, object]],
) -> dict[str, object]:
    reported_conditions = [str(item) for item in finding.get("reported_conditions", [])]
    recommendation = str(finding.get("inspector_recommendation", ""))
    linked_images = [image for image in images if image.get("extraction_status") == "extracted"]
    pages = sorted({int(caption["source_page"]) for caption in captions})

    known_facts = [
        f"Inspector report section '{finding['source_section']}' includes the finding '{finding['title']}'.",
        *[f"Inspector reports: {condition}." for condition in reported_conditions],
    ]
    if recommendation:
        known_facts.append(f"Inspector recommendation: {recommendation}.")
    if captions:
        known_facts.append(
            f"Extracted {len(captions)} roof item photo captions from PDF pages {pages[0]}-{pages[-1]}."
        )
    if linked_images:
        known_facts.append(f"Extracted {len(linked_images)} linked roof item images from the source PDF.")

    return {
        "id": "roof-system-bundle-1",
        "title": "Roof System",
        "building_system": "Roof System",
        "related_finding_ids": [finding["id"]],
        "related_evidence_ids": [item["id"] for item in evidence_items],
        "locations": ["Roof"],
        "known_facts": known_facts,
        "observations": {
            "inspector_narrative_conditions": reported_conditions,
            "photo_caption_count": len(captions),
            "photo_item_number_range": {
                "first": captions[0]["source_item_number"] if captions else "",
                "last": captions[-1]["source_item_number"] if captions else "",
            },
        },
        "shelter_prep_interpretation": (
            "The roof narrative, replacement recommendation, and item 1.x photo evidence series support "
            "treating the roof evidence as one Roof System repair bundle for review rather than separate isolated jobs."
        ),
        "unknowns": [
            "Exact roof square count is not established by this extraction.",
            "Exact decking or sheathing replacement quantity is not established by this extraction.",
            "Concealed framing condition is not established by this extraction.",
            "Final repair or replacement cost is not established by this extraction.",
            "Final material specification is not established by this extraction.",
            "Final permit requirements are not established by this extraction.",
        ],
        "needs_field_verification": [
            "Qualified roofing contractor review of replacement scope.",
            "Field verification of decking or sheathing condition during contractor assessment or roof work.",
            "Measurement of roof size, penetrations, flashing conditions, and material requirements.",
        ],
        "likely_trades": ["Roofer / qualified roofing contractor"],
        "next_evidence_needed": [
            "Roofer assessment of roof replacement scope and any decking/sheathing replacement allowance.",
            "Roof measurements or contractor takeoff.",
            "Material and flashing specification from reviewed contractor scope.",
        ],
        "contractor_review_needed": True,
        "consequence_level": "high",
        "review_status": "needs_review",
    }


def simulate_review_and_agent_output(bundle: dict[str, object]) -> tuple[dict[str, object], dict[str, object]]:
    event = {
        "id": "local-review-event-roof-system-1",
        "mode": "local_non_database_simulation",
        "reviewed_object_type": "repair_bundle",
        "reviewed_object_id": bundle["id"],
        "action": "approve",
        "previous_status": bundle["review_status"],
        "new_status": "human_reviewed",
        "reviewer_id": "local-step4-simulation",
        "immutable_event_simulated": True,
        "server_authority_status": "blocked_no_safe_database",
        "note": "This proves local transition shape only. It is not a real human review and not a database/RPC verification.",
    }

    agent_output = {
        "id": "agent-output-roof-system-1",
        "title": "ROOF SYSTEM",
        "human_review_status": "simulated_human_reviewed_non_database",
        "why_it_matters": (
            "The inspection source groups multiple roof-covering, flashing, penetration, drainage/debris, "
            "and roof-plane concerns with a replacement recommendation."
        ),
        "what_we_know": bundle["known_facts"],
        "what_remains_unknown": bundle["unknowns"],
        "who_may_need_to_review_it": bundle["likely_trades"],
        "recommended_next_action": "Qualified roofing contractor review of replacement scope and field conditions.",
        "source_evidence_ids": bundle["related_evidence_ids"],
        "review_event_id": event["id"],
        "validity": "local proof only; not seller-ready; not valid for unrelated properties",
    }

    return event, agent_output


def status_summary(
    page_count: int,
    finding: dict[str, object] | None,
    captions: list[dict[str, object]],
    images: list[dict[str, object]],
    evidence_items: list[dict[str, object]],
) -> dict[str, str]:
    extracted_image_count = sum(1 for image in images if image.get("extraction_status") == "extracted")
    source_linked = bool(evidence_items) and all(item.get("source_file_id") and item.get("source_page") for item in evidence_items)
    return {
        "database_verification": STATUS_BLOCKED,
        "real_pdf_processing": STATUS_PROVEN if page_count > 0 else STATUS_BLOCKED,
        "document_metadata_extraction": STATUS_PROVEN if page_count > 0 else STATUS_BLOCKED,
        "roof_finding_extraction": STATUS_PROVEN if finding else STATUS_BLOCKED,
        "roof_photo_relationships": STATUS_PROVEN if captions and extracted_image_count == len(captions) else STATUS_PARTIAL,
        "actual_image_extraction": STATUS_PROVEN if extracted_image_count > 0 else STATUS_BLOCKED,
        "visual_semantic_analysis": STATUS_NOT_IMPLEMENTED,
        "roof_bundle": STATUS_PROVEN if finding and captions and source_linked else STATUS_PARTIAL,
        "provenance": STATUS_PROVEN if source_linked else STATUS_PARTIAL,
        "human_review": STATUS_PARTIAL,
        "agent_facing_output": STATUS_PARTIAL,
    }


def process_pdf(pdf_path: Path, output_dir: Path) -> dict[str, object]:
    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF not found: {pdf_path}")
    if not pdf_path.is_file():
        raise ValueError(f"PDF path is not a file: {pdf_path}")

    output_dir.mkdir(parents=True, exist_ok=True)

    started = time.time()
    file_hash = sha256_file(pdf_path)
    source_file_id = f"sha256:{file_hash[:16]}"
    reader = PdfReader(str(pdf_path))
    page_count = len(reader.pages)
    page_texts = [normalize_text(page.extract_text() or "") for page in reader.pages]
    page_records = [
        {
            "page": index,
            "status": "extracted" if clean_inline(text) else "empty",
            "char_count": len(text),
        }
        for index, text in enumerate(page_texts, start=1)
    ]

    header = extract_header_metadata(page_texts[0] if page_texts else "")
    roof_profile = extract_roof_profile(page_texts)
    finding = extract_roof_narrative(page_texts)
    captions = extract_roof_photo_captions(page_texts, str(finding["source_item_number"]))
    images, image_warnings = extract_linked_images(reader, captions, output_dir)
    evidence_items = make_evidence_items(finding, captions, images, source_file_id)
    photo_interpretations = make_photo_interpretations(images, evidence_items)
    bundle = make_roof_bundle(finding, captions, images, evidence_items)
    review_event, agent_output = simulate_review_and_agent_output(bundle)
    completed = time.time()

    output = {
        "schemaVersion": SCHEMA_VERSION,
        "pipeline": {
            "name": "phase1-step4-roof-only-local-adapter",
            "runMode": "local_file_only_no_database",
            "startedAtUnix": started,
            "completedAtUnix": completed,
            "durationMs": round((completed - started) * 1000),
        },
        "sourceDocument": {
            "filename": pdf_path.name,
            "source_file_id": source_file_id,
            "sha256": file_hash,
            "pageCount": page_count,
            "sizeBytes": pdf_path.stat().st_size,
            "containsPrivateData": True,
            "storage": "local-fixtures only; not committed",
        },
        "database": {
            "status": STATUS_BLOCKED,
            "reason": "No explicitly verified non-production Supabase database was available for this run.",
        },
        "propertyMetadata": header["property"],
        "inspectionMetadata": header["inspection"],
        "roofProfile": roof_profile,
        "extraction": {
            "status": STATUS_PROVEN,
            "pages": page_records,
            "textCharacterCount": sum(record["char_count"] for record in page_records),
        },
        "findings": [finding],
        "photoCaptions": captions,
        "inspectionImages": images,
        "evidenceItems": evidence_items,
        "photoInterpretations": photo_interpretations,
        "repairBundles": [bundle],
        "reviewEvents": [review_event],
        "agentFacingOutputs": [agent_output],
        "warnings": image_warnings,
        "acceptanceStatus": status_summary(page_count, finding, captions, images, evidence_items),
    }

    output_path = output_dir / "step4-roof-output.json"
    output_path.write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")
    return {"output_path": str(output_path), "output": output}


def run_self_test() -> None:
    roof_sample = """Header
Roof Issues
Old roof, leaks
\u2022 Severe granule loss
\u2022 Lifted flashings
1) Replace the roof.
Moisture Damage
Other text
"""
    finding = extract_roof_narrative_from_text(3, roof_sample)
    assert finding is not None
    assert finding["title"] == "Old roof, leaks"
    assert finding["reported_conditions"] == ["Severe granule loss", "Lifted flashings"]
    assert finding["inspector_recommendation"] == "Replace the roof."

    caption_sample = """Item 1.7 - Split shingle, protruding and exposed
fasteners.
Item 1.8 - Split hip shingles
Item 2.1 - Another system
8/3/26, 12:53 PM PhotoPage
"""
    captions = extract_item_captions_from_text(16, caption_sample, "1")
    assert [item["source_item_number"] for item in captions] == ["1.7", "1.8"]
    assert captions[0]["caption"] == "Split shingle, protruding and exposed fasteners."
    assert captions[1]["caption"] == "Split hip shingles"

    print("phase1_roof_vertical_slice self-test passed")


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Shelter Prep Phase 1 Step 4 roof-only local extraction adapter")
    parser.add_argument("--pdf", help="Path to the private inspection PDF")
    parser.add_argument("--output-dir", default="local-fixtures/step4-roof-vertical-slice")
    parser.add_argument("--self-test", action="store_true")
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    if args.self_test:
        run_self_test()
        return 0

    if not args.pdf:
        print("--pdf is required unless --self-test is used", file=sys.stderr)
        return 2

    result = process_pdf(Path(args.pdf), Path(args.output_dir))
    output = result["output"]
    statuses = output["acceptanceStatus"]
    extracted_images = sum(1 for image in output["inspectionImages"] if image.get("extraction_status") == "extracted")

    print(f"Wrote {result['output_path']}")
    print(f"database_verification={statuses['database_verification']}")
    print(f"real_pdf_processing={statuses['real_pdf_processing']}")
    print(f"page_count={output['sourceDocument']['pageCount']}")
    print(f"roof_finding_extraction={statuses['roof_finding_extraction']}")
    print(f"roof_photo_captions={len(output['photoCaptions'])}")
    print(f"roof_images_extracted={extracted_images}")
    print(f"roof_bundle={statuses['roof_bundle']}")
    print(f"human_review={statuses['human_review']}")
    print(f"agent_facing_output={statuses['agent_facing_output']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
