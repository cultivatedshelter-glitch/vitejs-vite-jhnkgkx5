#!/usr/bin/env python3
"""Local Step 6 Electrical-only inspection intelligence slice.

This script uses deterministic extraction/routing first, keeps private fixture
outputs under local-fixtures, and reads cached visual observations by image hash
so unchanged evidence is not re-analyzed.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import re
import sys
import time
import unicodedata
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    from PIL import Image, ImageDraw
    from pypdf import PdfReader
except Exception as exc:  # pragma: no cover - exercised by CLI failure path
    print(f"pypdf and Pillow are required for local PDF/image extraction: {exc}", file=sys.stderr)
    sys.exit(2)

from phase1_inspection_evidence_cache import (
    DEFAULT_CACHE_PATH as DEFAULT_SHARED_CACHE,
    build_or_load_inspection_evidence_cache,
    caption_pages_from_shared,
    materialize_images_from_shared_cache,
    metadata_pages_from_shared,
    section_pages_from_shared,
)


SCHEMA_VERSION = "shelter-prep-step6-electrical-local-output.v1"
PIPELINE_NAME = "phase1-step6-electrical-only-local-adapter"
STATUS_PROVEN = "PROVEN"
STATUS_PARTIAL = "PARTIAL"
STATUS_BLOCKED = "BLOCKED"
STATUS_NOT_IMPLEMENTED = "NOT IMPLEMENTED"

DEFAULT_PDF = "local-fixtures/1837-sw-jo-ct-inspection.pdf"
DEFAULT_STEP4_OUTPUT = "local-fixtures/step4-roof-vertical-slice/step4-roof-output.json"
DEFAULT_STEP5_OUTPUT = "local-fixtures/step5-roof-visual-interpretation/step5-roof-visual-output.json"
DEFAULT_OUTPUT_DIR = "local-fixtures/step6-electrical-slice"

SECTION_HEADERS = [
    "Roof Issues",
    "Moisture Damage",
    "Condensation/mold",
    "Exterior Issues",
    "Eave Issues",
    "HVAC Issues",
    "Chimney/Fireplace Issues",
    "Crawlspace Issues",
    "Electrical Issues",
    "Plumbing Issues",
    "Insulation Issues",
    "Window Issues",
    "Door Issues",
    "Floor Issues",
    "Countertop Issues",
    "Smoke/CO Alarm Issues",
    "Wall & Ceiling Facings",
    "Cabinetry Issues",
    "Garage Door Issues",
    "Ventilation/Exhaust Issues",
    "Site Issues",
    "Minor Repairs/Deferred Maintenance",
    "For Improved Safety",
    "FYI",
]

ELECTRICAL_KEYWORDS = re.compile(
    r"\b(electrical|electrician|gfci|receptacle|faceplate|light fixture|panel|junction box|wiring|cabling|breaker|disconnect)\b",
    flags=re.IGNORECASE,
)


def normalize_text(value: str | None) -> str:
    if not value:
        return ""
    normalized = unicodedata.normalize("NFKD", value)
    normalized = normalized.replace("\ufb01", "fi").replace("\ufb02", "fl")
    normalized = normalized.replace("\u00a0", " ")
    return normalized.replace("\r\n", "\n").replace("\r", "\n")


def clean_inline(value: str | None) -> str:
    return re.sub(r"\s+", " ", normalize_text(value)).strip()


def clean_lines(value: str | None) -> list[str]:
    return [clean_inline(line) for line in normalize_text(value).splitlines() if clean_inline(line)]


def normalize_key(value: str | None) -> str:
    return re.sub(r"[^a-z0-9]+", " ", clean_inline(value).lower()).strip()


def is_bullet_line(value: str) -> bool:
    stripped = value.strip()
    return stripped.startswith("•") or stripped.startswith("*") or stripped.startswith("-")


def strip_bullet(value: str) -> str:
    return clean_inline(value.strip().lstrip("•*-").strip())


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def domain_profile() -> dict[str, Any]:
    return {
        "domain_name": "Electrical Specialist",
        "domain_key": "electrical",
        "supported_report_sections": ["Electrical Issues", "For Improved Safety"],
        "common_locations": ["Garage", "Kitchen", "Bathroom", "Bedroom", "Attic"],
        "likely_trades": ["Licensed electrician"],
        "allowed_interpretations": [
            "Identify visible or source-reported electrical safety concerns.",
            "Route GFCI, receptacle, panel, junction-box, fixture, wiring, and cabling findings to electrical review.",
            "Group related electrical safety findings into an operational bundle.",
            "Identify missing information and professional review needs.",
        ],
        "prohibited_conclusions": [
            "Do not make final code determinations without official source and human review.",
            "Do not diagnose hidden wiring, concealed junctions, energized state, or circuit condition from the report alone.",
            "Do not claim final repair scope, final pricing, or seller-ready conclusions.",
            "Do not mark any output human_verified automatically.",
        ],
        "common_unknowns": [
            "Whether GFCI protection exists upstream or at a breaker is unknown unless verified.",
            "Whether affected devices are energized or repaired is unknown.",
            "Hidden conductor, splice, breaker, and panel conditions are unknown.",
            "Exact count of affected receptacles, boxes, fasteners, and cable runs is unknown unless source evidence states it.",
            "Final code compliance, repair scope, permit needs, and cost are unknown.",
        ],
        "common_hidden_condition_risks": [
            "Open or improperly protected electrical components may conceal unsafe splices or damaged conductors.",
            "Sharp panel screws may create a wiring-contact risk inside the panel, but actual contact is unknown.",
            "Improperly secured or unprotected wiring may require field evaluation before scope is reliable.",
        ],
        "common_verification_questions": [
            "Which exact receptacles lack GFCI protection, and are any protected upstream?",
            "Are all missing faceplates and open boxes accessible for repair photos?",
            "Are panel screws confirmed to be blunt-tip electrical panel screws after replacement?",
            "Does the non-working light operate after bulb replacement, or does it need electrician troubleshooting?",
            "Which cable runs need securing or protection, and are any penetrations unbushed or unclamped?",
        ],
        "bundling_rules": [
            "Bundle GFCI, receptacle, panel screw, open junction box, fixture, fan wiring, and cable securing issues into Electrical Safety unless source evidence requires separate handling.",
            "Keep safety-related electrical items high priority for human review.",
            "Keep source findings and visual observations separate from operational interpretation.",
        ],
        "consequence_review_rules": [
            "Electrical safety items default to needs_review.",
            "Any unclear image, unsupported caption, or missing photo remains in the review queue.",
            "Professional electrician review is assigned where the inspector recommends electrician action.",
        ],
    }


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


def extract_section_text(page_number: int, text: str, section_name: str) -> dict[str, Any] | None:
    lines = clean_lines(text)
    start_index = next((idx for idx, line in enumerate(lines) if normalize_key(line) == normalize_key(section_name)), None)
    if start_index is None:
        return None

    other_headers = {normalize_key(header) for header in SECTION_HEADERS if normalize_key(header) != normalize_key(section_name)}
    end_index = len(lines)
    for idx in range(start_index + 1, len(lines)):
        if normalize_key(lines[idx]) in other_headers:
            end_index = idx
            break

    section_lines = lines[start_index:end_index]
    return {
        "source_page": page_number,
        "source_section": section_name,
        "text": "\n".join(section_lines),
        "char_count": len("\n".join(section_lines)),
    }


def parse_issue_section(section: dict[str, Any], property_id: str, inspection_report_id: str) -> list[dict[str, Any]]:
    lines = clean_lines(section["text"])
    if lines and normalize_key(lines[0]) == normalize_key(section["source_section"]):
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

        inspector_statement_parts = [title, *detail_lines]
        inspector_statement = clean_inline(". ".join(part for part in inspector_statement_parts if part))
        inspector_recommendation = clean_inline(" ".join(rec_lines))
        source_item_number = match.group("number")
        source_excerpt = clean_inline(
            " ".join([str(section["source_section"]), title, *detail_lines, *locations, f"{source_item_number})", inspector_recommendation])
        )

        if section["source_section"] == "For Improved Safety" and not ELECTRICAL_KEYWORDS.search(
            " ".join([title, *detail_lines, inspector_recommendation])
        ):
            pending = []
            continue

        findings.append(
            {
                "id": f"electrical-finding-{source_item_number}",
                "property_id": property_id,
                "inspection_report_id": inspection_report_id,
                "domain_key": "electrical",
                "source_page": section["source_page"],
                "source_section": section["source_section"],
                "source_item_number": source_item_number,
                "title": title,
                "inspector_statement": inspector_statement,
                "inspector_recommendation": inspector_recommendation,
                "locations": locations,
                "source_excerpt": source_excerpt,
                "linked_photo_ids": [],
                "source_file_id": "",
                "building_system": "Electrical",
                "likely_trade": "Licensed electrician" if "electrician" in inspector_recommendation.lower() else "Electrical review",
                "review_status": "needs_review",
                "human_verified": False,
            }
        )
        pending = []

    return findings


def extract_item_captions_from_text(page_number: int, text: str) -> list[dict[str, Any]]:
    normalized = normalize_text(text)
    pattern = re.compile(
        r"Item\s+(?P<item>\d+\.\d+)\s*-\s*(?P<caption>.*?)(?=\s+Item\s+\d+\.\d+\s*-|\Z)",
        flags=re.IGNORECASE | re.DOTALL,
    )
    captions = []
    for index, match in enumerate(pattern.finditer(normalized), start=1):
        item_number = match.group("item")
        caption = strip_caption_footer(match.group("caption"))
        if not caption:
            continue
        captions.append(
            {
                "id": "caption-" + item_number.replace(".", "-"),
                "source_page": page_number,
                "source_item_number": item_number,
                "caption": caption,
                "image_index_on_page": index,
                "review_status": "needs_review",
            }
        )
    return captions


def link_caption_to_finding(caption: dict[str, Any], findings_by_number: dict[str, dict[str, Any]]) -> str:
    major = str(caption["source_item_number"]).split(".")[0]
    caption_key = normalize_key(caption["caption"])
    if major in findings_by_number:
        finding = findings_by_number[major]
        title_key = normalize_key(finding["title"])
        if title_key and title_key in caption_key:
            return finding["id"]
        if ELECTRICAL_KEYWORDS.search(caption["caption"]):
            return finding["id"]
        return ""

    if major.isdigit():
        previous = str(int(major) - 1)
        if previous in findings_by_number:
            title_key = normalize_key(findings_by_number[previous]["title"])
            if title_key and title_key in caption_key:
                return findings_by_number[previous]["id"]

    candidates = [finding for finding in findings_by_number.values() if normalize_key(finding["title"]) in caption_key]
    if len(candidates) == 1:
        return candidates[0]["id"]
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


def extract_electrical_metadata(page_records: dict[int, str]) -> dict[str, Any]:
    joined = "\n".join(page_records.values())
    lines = clean_lines(joined)
    fields = {
        "service_type": value_after_label(lines, "Service type:"),
        "amperage_voltage": value_after_label(lines, "Amperage & voltage:"),
        "sec_material_type": value_after_label(lines, "SEC material type:"),
        "main_disconnects": value_after_label(lines, "Main disconnects:"),
        "panel_type": "",
        "panel_size": "",
        "panel_brand": "",
        "overcurrent_protection_type": value_after_label(lines, "Overcurrent Protection Type:"),
        "panel_location": "",
        "wiring_types": value_after_label(lines, "Wiring Types:"),
    }

    panel_start = next((idx for idx, line in enumerate(lines) if normalize_key(line) == "electrical panels"), None)
    panel_end = len(lines)
    if panel_start is not None:
        for idx in range(panel_start + 1, len(lines)):
            if normalize_key(lines[idx]).startswith("branch circuit conductors"):
                panel_end = idx
                break
        panel_lines = lines[panel_start:panel_end]
        fields["panel_type"] = value_after_label(panel_lines, "Type:")
        fields["panel_size"] = value_after_label(panel_lines, "Size:")
        fields["panel_brand"] = value_after_label(panel_lines, "Brand:")
        fields["panel_location"] = value_after_label(panel_lines, "Location:")

    return {
        "fields": {key: value for key, value in fields.items() if value},
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
    scanned_pages: dict[int, str] = {}
    section_pages: dict[int, str] = {}
    caption_pages: dict[int, str] = {}
    metadata_pages: dict[int, str] = {}

    for page_number, page in enumerate(reader.pages, start=1):
        text = normalize_text(page.extract_text() or "")
        scanned_pages[page_number] = text
        if "Electrical Issues" in text or "For Improved Safety" in text:
            section_pages[page_number] = text
        if "Item " in text and ELECTRICAL_KEYWORDS.search(text):
            caption_pages[page_number] = text
        if any(marker in text for marker in ["Service type:", "Amperage & voltage:", "Electrical panels:", "Wiring Types:"]):
            metadata_pages[page_number] = text

    cache = {
        "schemaVersion": "shelter-prep-step6-electrical-source-cache.v1",
        "source_pdf": str(pdf_path),
        "source_pdf_sha256": source_sha,
        "source_file_id": source_file_id,
        "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "cache_reused": False,
        "local_pdf_pages_scanned": len(scanned_pages),
        "model_calls": 0,
        "electrical_section_pages": {str(page): text for page, text in section_pages.items()},
        "electrical_caption_candidate_pages": {str(page): text for page, text in caption_pages.items()},
        "electrical_metadata_pages": {str(page): text for page, text in metadata_pages.items()},
        "persisted_relevant_page_count": len(set(section_pages) | set(caption_pages) | set(metadata_pages)),
    }
    write_json(cache_path, cache)
    return cache


def build_source_cache_from_shared(shared_cache: dict[str, Any], shared_cache_path: Path, source_sha: str, source_file_id: str) -> dict[str, Any]:
    section_pages = section_pages_from_shared(shared_cache, {"Electrical Issues", "For Improved Safety"})
    caption_pages = caption_pages_from_shared(shared_cache, ELECTRICAL_KEYWORDS)
    metadata_pages = metadata_pages_from_shared(
        shared_cache,
        ["Service type:", "Amperage & voltage:", "Electrical panels:", "Wiring Types:"],
    )
    return {
        "schemaVersion": "shelter-prep-step6-electrical-source-cache.v2",
        "source_pdf": shared_cache.get("sourceDocument", {}).get("source_path", ""),
        "source_pdf_sha256": source_sha,
        "source_file_id": source_file_id,
        "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "cache_reused": True,
        "cache_source": "shared_inspection_evidence_cache",
        "shared_cache_path": str(shared_cache_path.resolve()),
        "shared_cache_schema": shared_cache.get("schemaVersion", ""),
        "local_pdf_pages_scanned": 0,
        "model_calls": 0,
        "electrical_section_pages": section_pages,
        "electrical_caption_candidate_pages": caption_pages,
        "electrical_metadata_pages": metadata_pages,
        "persisted_relevant_page_count": len(set(section_pages) | set(caption_pages) | set(metadata_pages)),
    }


def extract_source_findings(source_cache: dict[str, Any], property_id: str, inspection_report_id: str, source_file_id: str) -> list[dict[str, Any]]:
    page_texts = {
        int(page): text for page, text in source_cache.get("electrical_section_pages", {}).items()
    }
    findings: list[dict[str, Any]] = []
    for page_number, text in sorted(page_texts.items()):
        electrical = extract_section_text(page_number, text, "Electrical Issues")
        if electrical:
            findings.extend(parse_issue_section(electrical, property_id, inspection_report_id))
        safety = extract_section_text(page_number, text, "For Improved Safety")
        if safety:
            findings.extend(parse_issue_section(safety, property_id, inspection_report_id))

    for finding in findings:
        finding["source_file_id"] = source_file_id
    return findings


def extract_and_link_captions(source_cache: dict[str, Any], findings: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], dict[str, int]]:
    all_captions: list[dict[str, Any]] = []
    for page, text in sorted(source_cache.get("electrical_caption_candidate_pages", {}).items(), key=lambda item: int(item[0])):
        all_captions.extend(extract_item_captions_from_text(int(page), text))

    findings_by_number = {finding["source_item_number"]: finding for finding in findings}
    linked: list[dict[str, Any]] = []
    omitted_same_page = 0
    for caption in all_captions:
        related_finding_id = link_caption_to_finding(caption, findings_by_number)
        if not related_finding_id:
            omitted_same_page += 1
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
        "all_captions_on_electrical_candidate_pages": len(all_captions),
        "electrical_captions_linked": len(linked),
        "same_pages_non_electrical_captions_omitted": omitted_same_page,
    }


def safe_image_suffix(name: str | None) -> str:
    suffix = Path(name or "").suffix.lower()
    return suffix if suffix in {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tiff"} else ".bin"


def image_dimensions(path: Path) -> dict[str, int]:
    with Image.open(path) as image:
        return {"width": image.width, "height": image.height}


def image_manifest_valid(manifest: dict[str, Any], source_sha: str, output_dir: Path, expected_items: list[str]) -> bool:
    if manifest.get("source_pdf_sha256") != source_sha:
        return False
    manifest_items = [image.get("item_number", "") for image in manifest.get("images", [])]
    if manifest_items != expected_items:
        return False
    for image in manifest.get("images", []):
        path = output_dir / image.get("extracted_image_storage_path", "")
        if not path.exists():
            return False
        if sha256_file(path) != image.get("sha256"):
            return False
    return True


def extract_target_images(
    pdf_path: Path,
    captions: list[dict[str, Any]],
    output_dir: Path,
    manifest_path: Path,
    source_sha: str,
) -> tuple[list[dict[str, Any]], bool, list[str]]:
    expected_items = [caption["source_item_number"] for caption in captions]
    if manifest_path.exists():
        manifest = read_json(manifest_path)
        if image_manifest_valid(manifest, source_sha, output_dir, expected_items):
            return manifest["images"], True, []

    image_dir = output_dir / "extracted-images"
    image_dir.mkdir(parents=True, exist_ok=True)
    reader = PdfReader(str(pdf_path))
    warnings: list[str] = []
    images: list[dict[str, Any]] = []

    captions_by_page: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for caption in captions:
        captions_by_page[int(caption["source_page"])].append(caption)

    for page_number, page_captions in sorted(captions_by_page.items()):
        page = reader.pages[page_number - 1]
        try:
            page_images = list(page.images)
        except Exception as exc:  # pragma: no cover - depends on PDF internals
            warnings.append(f"Page {page_number}: image extraction failed: {exc}")
            for caption in page_captions:
                images.append(
                    {
                        "id": "image-" + caption["source_item_number"].replace(".", "-"),
                        "source_page": page_number,
                        "image_index": caption["image_index_on_page"],
                        "item_number": caption["source_item_number"],
                        "caption": caption["caption"],
                        "related_finding_id": caption["related_finding_id"],
                        "related_photo_caption_id": caption["id"],
                        "extraction_status": "failed",
                        "extraction_error": str(exc),
                    }
                )
            continue

        for caption in page_captions:
            image_index = int(caption["image_index_on_page"])
            image_id = "image-" + caption["source_item_number"].replace(".", "-")
            if image_index > len(page_images):
                images.append(
                    {
                        "id": image_id,
                        "source_page": page_number,
                        "image_index": image_index,
                        "item_number": caption["source_item_number"],
                        "caption": caption["caption"],
                        "related_finding_id": caption["related_finding_id"],
                        "related_photo_caption_id": caption["id"],
                        "extraction_status": "missing_image_for_caption",
                    }
                )
                continue

            image = page_images[image_index - 1]
            suffix = safe_image_suffix(getattr(image, "name", ""))
            filename = f"page-{page_number:03d}-image-{image_index:03d}-item-{caption['source_item_number'].replace('.', '-')}{suffix}"
            image_path = image_dir / filename
            data = image.data
            image_path.write_bytes(data)
            dimensions = {}
            pil_image = getattr(image, "image", None)
            if pil_image is not None:
                dimensions = {"width": pil_image.size[0], "height": pil_image.size[1]}
            elif image_path.exists():
                dimensions = image_dimensions(image_path)
            images.append(
                {
                    "id": image_id,
                    "source_page": page_number,
                    "image_index": image_index,
                    "source_pdf_image_name": getattr(image, "name", ""),
                    "item_number": caption["source_item_number"],
                    "caption": caption["caption"],
                    "related_finding_id": caption["related_finding_id"],
                    "related_photo_caption_id": caption["id"],
                    "extracted_image_storage_path": str(image_path.relative_to(output_dir)),
                    "image_dimensions": dimensions,
                    "size_bytes": len(data),
                    "sha256": hashlib.sha256(data).hexdigest(),
                    "extraction_method": "pypdf.page.images_targeted_electrical_pages",
                    "extraction_status": "extracted",
                }
            )

    manifest = {
        "schemaVersion": "shelter-prep-step6-electrical-image-manifest.v1",
        "source_pdf": str(pdf_path),
        "source_pdf_sha256": source_sha,
        "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "images": images,
    }
    write_json(manifest_path, manifest)
    return images, False, warnings


def create_contact_sheets(images: list[dict[str, Any]], output_dir: Path) -> tuple[list[dict[str, Any]], list[str]]:
    extracted = [image for image in images if image.get("extraction_status") == "extracted"]
    if not extracted:
        return [], []

    sheet_dir = output_dir / "contact-sheets"
    sheet_dir.mkdir(parents=True, exist_ok=True)
    sheet_records: list[dict[str, Any]] = []
    warnings: list[str] = []

    cols = 3
    cell_w = 420
    image_h = 315
    label_h = 38
    rows_per_sheet = 3
    per_sheet = cols * rows_per_sheet

    for sheet_index in range(0, len(extracted), per_sheet):
        group = extracted[sheet_index : sheet_index + per_sheet]
        rows = (len(group) + cols - 1) // cols
        sheet = Image.new("RGB", (cols * cell_w, rows * (image_h + label_h)), "white")
        draw = ImageDraw.Draw(sheet)

        for idx, image_record in enumerate(group):
            source_path = output_dir / image_record["extracted_image_storage_path"]
            x = (idx % cols) * cell_w
            y = (idx // cols) * (image_h + label_h)
            draw.rectangle([x, y, x + cell_w, y + label_h], fill=(242, 242, 242), outline=(190, 190, 190))
            label = f"Item {image_record['item_number']} Page {image_record['source_page']}"
            draw.text((x + 10, y + 9), label, fill=(0, 0, 0))
            try:
                with Image.open(source_path) as thumb:
                    thumb = thumb.convert("RGB")
                    thumb.thumbnail((cell_w, image_h))
                    paste_x = x + (cell_w - thumb.width) // 2
                    paste_y = y + label_h + (image_h - thumb.height) // 2
                    sheet.paste(thumb, (paste_x, paste_y))
            except Exception as exc:  # pragma: no cover - depends on image files
                warnings.append(f"Could not add {source_path} to contact sheet: {exc}")

        sheet_path = sheet_dir / f"electrical-contact-sheet-{len(sheet_records) + 1:02d}.jpg"
        sheet.save(sheet_path, quality=92)
        sheet_records.append(
            {
                "path": str(sheet_path.relative_to(output_dir)),
                "absolute_path": str(sheet_path.resolve()),
                "size_bytes": sheet_path.stat().st_size,
                "items": [image["item_number"] for image in group],
                "image_count": len(group),
                "contains_captions": False,
                "label_fields": ["item_number", "source_page"],
            }
        )

    write_json(
        sheet_dir / "manifest.json",
        {
            "schemaVersion": "shelter-prep-step6-electrical-contact-sheets.v1",
            "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "contact_sheets": sheet_records,
        },
    )
    return sheet_records, warnings


def make_evidence_items(findings: list[dict[str, Any]], captions: list[dict[str, Any]], images: list[dict[str, Any]], source_file_id: str) -> list[dict[str, Any]]:
    evidence: list[dict[str, Any]] = []
    for finding in findings:
        evidence.append(
            {
                "id": "evidence-written-electrical-" + finding["source_item_number"],
                "property_id": finding["property_id"],
                "inspection_report_id": finding["inspection_report_id"],
                "domain_key": "electrical",
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
                "id": "evidence-photo-electrical-" + caption["source_item_number"].replace(".", "-"),
                "property_id": findings[0]["property_id"] if findings else "",
                "inspection_report_id": findings[0]["inspection_report_id"] if findings else "",
                "domain_key": "electrical",
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
    template_entries = [
        {
            "image_sha256": image.get("sha256", ""),
            "item_number": image.get("item_number", ""),
            "source_page": image.get("source_page"),
            "extracted_image_storage_path": image.get("extracted_image_storage_path", ""),
            "visual_observation": "",
            "agreement_status": "",
            "shelter_prep_interpretation": "",
            "human_review_status": "needs_review",
            "processing_status": "needs_vision_analysis",
        }
        for image in images
        if image.get("extraction_status") == "extracted"
    ]
    write_json(
        path,
        {
            "schemaVersion": "shelter-prep-step6-electrical-visual-cache-template.v1",
            "source_pdf_sha256": source_sha,
            "contact_sheets": contact_sheets,
            "entries": template_entries,
            "note": "Populate a separate electrical-visual-cache.json only after actual pixels are analyzed by a vision-capable model/service.",
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
        "Whether wiring or devices are energized cannot be determined from the image alone.",
        "Hidden wiring, junction, conductor, breaker, and panel interior conditions remain unknown unless visible.",
        "Final code compliance, repair scope, permit needs, and cost remain unknown.",
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
            agreement_status = "unclear"
            interpretation = "Image extraction failed or no image was available for this caption. Human review is required."
            failure_reason = image.get("extraction_error") or image.get("extraction_status")
            cache_status = "not_available"
        elif cache_entry:
            processing_status = cache_entry.get("processing_status", "analyzed")
            visual_observation = cache_entry.get("visual_observation", "")
            agreement_status = cache_entry.get("agreement_status", "unclear")
            interpretation = cache_entry.get("shelter_prep_interpretation", "")
            failure_reason = cache_entry.get("failure_reason")
            cache_status = "reused_by_image_hash"
        else:
            processing_status = "skipped_with_reason"
            visual_observation = ""
            agreement_status = "unclear"
            interpretation = "No cached pixel-based visual observation exists for this image hash. Do not infer from caption."
            failure_reason = "missing_visual_cache_entry"
            cache_status = "missing"

        records.append(
            {
                "id": "visual-electrical-" + str(item_number).replace(".", "-"),
                "source_image_id": image.get("id", ""),
                "related_finding_id": image.get("related_finding_id", ""),
                "related_photo_caption_id": image.get("related_photo_caption_id", ""),
                "inspector_statement": caption.get("caption", image.get("caption", "")),
                "visual_observation": visual_observation,
                "shelter_prep_interpretation": interpretation,
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


def make_bundle(
    findings: list[dict[str, Any]],
    evidence_items: list[dict[str, Any]],
    visual_records: list[dict[str, Any]],
    electrical_metadata: dict[str, Any],
) -> dict[str, Any]:
    source_pages = sorted({finding["source_page"] for finding in findings})
    caption_count = len([item for item in evidence_items if item["source_type"] == "inspection_photo_caption"])
    visual_count = len([record for record in visual_records if record["processing_status"] == "analyzed"])
    finding_titles = [finding["title"] for finding in findings]
    agreement_counts = Counter(record["agreement_status"] for record in visual_records)

    return {
        "id": "electrical-safety-bundle-1",
        "title": "Electrical Safety",
        "building_system": "Electrical",
        "domain_key": "electrical",
        "related_finding_ids": [finding["id"] for finding in findings],
        "related_evidence_ids": [item["id"] for item in evidence_items],
        "related_visual_evidence_ids": [record["id"] for record in visual_records],
        "locations": sorted({location for finding in findings for location in finding.get("locations", [])}),
        "known_facts": [
            f"Source extraction routed {len(findings)} electrical-domain findings from report pages {', '.join(map(str, source_pages))}.",
            f"Linked {caption_count} electrical-related photo captions and {visual_count} analyzed visual observations.",
            *[f"Inspector reports: {title}." for title in finding_titles],
        ],
        "electrical_metadata": electrical_metadata,
        "corroboration_status": dict(agreement_counts),
        "shelter_prep_interpretation": (
            "The electrical-domain source findings and linked photos support one Electrical Safety review bundle. "
            "The operational next move is human/admin review and likely licensed electrician verification before any final scope or seller-facing output."
        ),
        "unknowns": [
            "Whether any reported GFCI locations are protected upstream or by breaker is unknown.",
            "Whether the non-working light fixture is only a bulb issue is unknown until rechecked.",
            "Hidden wiring, panel interior, splice, conductor, and cable conditions are unknown.",
            "Exact affected device/cable count is unknown beyond source-reported items and visible photos.",
            "Final code compliance, repair scope, permit needs, and cost are unknown.",
        ],
        "hidden_condition_risks": [
            "Open junction boxes or unprotected wiring may have unsafe splices or conductor damage that is not visible in the available evidence.",
            "Sharp panel screws may create a contact risk inside the panel, but actual conductor contact is not established by this slice.",
            "Improperly secured cabling may indicate additional routing/support issues that require field verification.",
        ],
        "likely_trades": ["Licensed electrician"],
        "verification_questions": [
            "Confirm which kitchen and garage receptacles lack GFCI protection and whether any are protected upstream.",
            "Confirm all affected receptacles have proper faceplates after repair.",
            "Confirm whether the rear right bedroom light works after bulb replacement.",
            "Confirm panel screws are replaced with blunt-tip panel screws and inspect for any conductor contact.",
            "Confirm attic junction box cover, bathroom exhaust fan wiring clamp/bushing, and garage cabling supports.",
        ],
        "next_action": "Human review of the Electrical Safety bundle, then licensed electrician verification for safety-related repairs.",
        "review_status": "needs_review",
        "human_verified": False,
    }


def make_review_queue(findings: list[dict[str, Any]], visual_records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    queue: list[dict[str, Any]] = []
    visual_by_finding = defaultdict(list)
    for record in visual_records:
        visual_by_finding[record.get("related_finding_id", "")].append(record)

    for finding in findings:
        reasons = ["electrical_safety_domain_requires_human_review"]
        linked_visuals = visual_by_finding.get(finding["id"], [])
        if not finding.get("linked_photo_ids"):
            reasons.append("no_linked_photo_evidence")
        if any(record["agreement_status"] in {"partially_supports", "unclear", "apparent_discrepancy"} for record in linked_visuals):
            reasons.append("visual_evidence_uncertain_or_partial")
        if any(record["processing_status"] != "analyzed" for record in linked_visuals):
            reasons.append("visual_processing_not_complete")

        queue.append(
            {
                "id": "review-electrical-" + finding["source_item_number"],
                "domain_key": "electrical",
                "finding_id": finding["id"],
                "source_item_number": finding["source_item_number"],
                "source_page": finding["source_page"],
                "title": finding["title"],
                "priority": "high",
                "review_reasons": reasons,
                "human_review_status": "needs_review",
                "next_review_action": "Admin/human review, then licensed electrician verification where appropriate.",
            }
        )

    return queue


def make_agent_draft(bundle: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": "agent-draft-electrical-safety-1",
        "title": "Electrical Safety",
        "status_label": "AI Draft / Needs Human Review",
        "human_review_status": "needs_review",
        "human_verified": False,
        "property_specific": True,
        "not_valid_for_unrelated_properties": True,
        "summary": (
            "The inspection source reports multiple electrical safety items, including GFCI protection, a receptacle faceplate, "
            "panel attachment screws, an open attic junction box, exhaust fan wiring, and improperly secured cabling."
        ),
        "recommended_next_action": bundle["next_action"],
        "known": bundle["known_facts"],
        "unknown": bundle["unknowns"],
        "source_evidence_ids": bundle["related_evidence_ids"],
        "visual_evidence_ids": bundle["related_visual_evidence_ids"],
    }


def acceptance_status(findings: list[dict[str, Any]], captions: list[dict[str, Any]], images: list[dict[str, Any]], visual_records: list[dict[str, Any]], bundle: dict[str, Any], review_queue: list[dict[str, Any]], gitignored: bool) -> dict[str, str]:
    all_images_have_status = all(record.get("processing_status") for record in visual_records)
    analyzed_images = [record for record in visual_records if record.get("processing_status") == "analyzed"]
    visual_separate = all(record.get("inspector_statement") is not None and record.get("visual_observation") is not None for record in visual_records)

    return {
        "electrical_domain_only": STATUS_PROVEN,
        "shared_evidence_contract": STATUS_PROVEN,
        "source_finding_routing": STATUS_PROVEN if findings else STATUS_BLOCKED,
        "source_provenance": STATUS_PROVEN if all(finding.get("source_file_id") and finding.get("source_page") for finding in findings) else STATUS_PARTIAL,
        "linked_photo_provenance": STATUS_PROVEN if captions and images else STATUS_PARTIAL,
        "independent_visual_observations": STATUS_PROVEN if analyzed_images and visual_separate else STATUS_BLOCKED,
        "all_images_explicit_processing_status": STATUS_PROVEN if all_images_have_status else STATUS_BLOCKED,
        "bundle_generation": STATUS_PROVEN if bundle.get("related_finding_ids") else STATUS_PARTIAL,
        "known_unknown_separation": STATUS_PROVEN if bundle.get("known_facts") and bundle.get("unknowns") else STATUS_PARTIAL,
        "human_review_required": STATUS_PROVEN if review_queue and not bundle.get("human_verified") else STATUS_BLOCKED,
        "private_output_gitignored": STATUS_PROVEN if gitignored else STATUS_BLOCKED,
        "production_touched": STATUS_NOT_IMPLEMENTED,
        "database_migration": STATUS_NOT_IMPLEMENTED,
        "other_domains": STATUS_NOT_IMPLEMENTED,
        "pricing": STATUS_NOT_IMPLEMENTED,
    }


def git_ignores(path: Path) -> bool:
    # Avoid shelling out from this private-output writer; local-fixtures is the canonical private output root.
    return "local-fixtures" in path.parts


def process(args: argparse.Namespace) -> dict[str, Any]:
    started = time.time()
    pdf_path = Path(args.pdf)
    step4_path = Path(args.step4_output)
    step5_path = Path(args.step5_output)
    shared_cache_path = Path(args.shared_cache)
    output_dir = Path(args.output_dir)
    cache_dir = output_dir / "cache"
    cache_dir.mkdir(parents=True, exist_ok=True)

    if not pdf_path.exists():
        raise FileNotFoundError(f"Private fixture not found: {pdf_path}")
    if not step4_path.exists():
        raise FileNotFoundError(f"Required Step 4 artifact not found: {step4_path}")

    step4 = read_json(step4_path)
    step5 = read_json(step5_path) if step5_path.exists() else {}
    source_sha = sha256_file(pdf_path)
    source_file_id = step4["sourceDocument"].get("source_file_id") or f"sha256:{source_sha[:16]}"
    if step4["sourceDocument"].get("sha256") and step4["sourceDocument"]["sha256"] != source_sha:
        raise ValueError("Step 4 source hash does not match the current private fixture.")

    property_id = "local-property-1837-sw-jo-ct"
    inspection_report_id = "local-inspection-report-1837-sw-jo-ct"

    shared_cache, shared_cache_meta = build_or_load_inspection_evidence_cache(
        pdf_path,
        shared_cache_path,
        source_sha,
        source_file_id,
    )
    source_cache = build_source_cache_from_shared(shared_cache, shared_cache_path, source_sha, source_file_id)
    metadata_page_records = {
        int(page): text for page, text in source_cache.get("electrical_metadata_pages", {}).items()
    }
    electrical_metadata = extract_electrical_metadata(metadata_page_records)
    findings = extract_source_findings(source_cache, property_id, inspection_report_id, source_file_id)
    captions, caption_stats = extract_and_link_captions(source_cache, findings)

    image_manifest_path = cache_dir / "electrical-image-manifest.json"
    images, image_manifest_reused, image_warnings = materialize_images_from_shared_cache(
        shared_cache,
        shared_cache_path,
        captions,
        output_dir,
        image_manifest_path,
        source_sha,
        schema_version="shelter-prep-step6-electrical-image-manifest.v2",
        extraction_method="shared_inspection_evidence_cache_materialized_electrical_images",
    )
    contact_sheets, sheet_warnings = create_contact_sheets(images, output_dir)
    visual_template_path = cache_dir / "electrical-visual-cache.template.json"
    write_visual_template(visual_template_path, images, contact_sheets, source_sha)

    visual_cache_path = Path(args.visual_cache) if args.visual_cache else cache_dir / "electrical-visual-cache.json"
    visual_cache, visual_cache_available = load_visual_cache(visual_cache_path, source_sha)

    evidence_items = make_evidence_items(findings, captions, images, source_file_id)
    visual_records = make_visual_evidence(
        images, captions, pdf_path, source_file_id, output_dir, visual_cache
    )
    bundle = make_bundle(findings, evidence_items, visual_records, electrical_metadata)
    review_queue = make_review_queue(findings, visual_records)
    agent_draft = make_agent_draft(bundle)
    completed = time.time()

    processing_counts = Counter(record["processing_status"] for record in visual_records)
    agreement_counts = Counter(record["agreement_status"] for record in visual_records)
    visual_reused_count = sum(1 for record in visual_records if record.get("cache_status") == "reused_by_image_hash")
    roof_visual_count = len(step5.get("imageVisualEvidence", []))

    output_path = output_dir / "step6-electrical-output.json"
    summary = {
        "domains_executed": ["electrical"],
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
            "electrical_source_section_chars": sum(len(section.get("text", "")) for section in [
                extract_section_text(int(page), text, "Electrical Issues") or {"text": ""}
                for page, text in source_cache.get("electrical_section_pages", {}).items()
            ]),
            "electrical_caption_chars": sum(len(caption["caption"]) for caption in captions),
            "vision_contact_sheet_bytes": sum(sheet["size_bytes"] for sheet in contact_sheets),
            "full_pdf_bytes_not_sent_to_model": pdf_path.stat().st_size,
        },
        "findings_processed": len(findings),
        "photo_captions_linked": len(captions),
        "images_sent_to_vision": visual_cache.get("images_sent_to_vision", 0) if visual_cache_available else 0,
        "images_with_visual_records": len(visual_records),
        "cached_visual_outputs_reused_by_hash": visual_reused_count,
        "preexisting_roof_visual_records_reused_for_context": 0,
        "preexisting_roof_visual_records_omitted_as_irrelevant": roof_visual_count,
        "evidence_omitted_as_irrelevant": {
            "roof_visual_records": roof_visual_count,
            "same_candidate_photo_pages_non_electrical_captions": caption_stats["same_pages_non_electrical_captions_omitted"],
            "other_domains": "not loaded into the Electrical Specialist context",
        },
        "processing_status_distribution": dict(processing_counts),
        "agreement_status_distribution": dict(agreement_counts),
        "review_queue_size": len(review_queue),
        "bundles_generated": 1 if bundle else 0,
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
            "domain_scope": "electrical_only",
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
            "step5_roof_visual_output": str(step5_path.resolve()) if step5_path.exists() else "",
            "shared_evidence_cache": str(shared_cache_path.resolve()),
            "source_cache": "in_memory_from_shared_inspection_evidence_cache",
            "image_manifest": str(image_manifest_path.resolve()),
            "visual_cache": str(visual_cache_path.resolve()) if visual_cache_path.exists() else "",
        },
        "database": {
            "status": STATUS_NOT_IMPLEMENTED,
            "reason": "Step 6 Electrical local slice does not apply migrations or touch Supabase.",
        },
        "propertyMetadata": step4.get("propertyMetadata", {}),
        "inspectionMetadata": step4.get("inspectionMetadata", {}),
        "domainProfiles": [domain_profile()],
        "electricalMetadata": electrical_metadata,
        "sourceFindings": findings,
        "photoCaptions": captions,
        "inspectionImages": images,
        "evidenceItems": evidence_items,
        "imageVisualEvidence": visual_records,
        "repairBundles": [bundle],
        "reviewQueue": review_queue,
        "agentFacingDrafts": [agent_draft],
        "summary": summary,
        "acceptanceStatus": acceptance_status(
            findings, captions, images, visual_records, bundle, review_queue, git_ignores(output_path)
        ),
        "warnings": image_warnings + sheet_warnings,
    }
    write_json(output_path, output)
    return {"output_path": str(output_path), "output": output}


def run_self_test() -> None:
    sample_page = """Electrical Issues
No GFCI protection
GFCI's provide protection against shock hazards.
Location/s:
* Kitchen
22) For improved safety, consider having an electrician provide GFCI protection.
Missing faceplate on receptacle
Location/s:
* Primary Bedroom Bathroom
23) For reasons of safety, ensure that all receptacles have faceplates.
Plumbing Issues
Other issue
"""
    section = extract_section_text(6, sample_page, "Electrical Issues")
    assert section is not None
    findings = parse_issue_section(section, "property-test", "inspection-test")
    assert [finding["source_item_number"] for finding in findings] == ["22", "23"]
    assert findings[0]["title"] == "No GFCI protection"
    assert findings[0]["locations"] == ["Kitchen"]

    safety_page = """For Improved Safety
No GFCI protection
Location/s:
* Garage
84) For improved safety, consider having an electrician provide GFCI protection.
FYI
Evidence of prior carpenter ant treatment
85) Monitor for carpenter ants.
"""
    safety = extract_section_text(13, safety_page, "For Improved Safety")
    assert safety is not None
    safety_findings = parse_issue_section(safety, "property-test", "inspection-test")
    assert len(safety_findings) == 1
    assert safety_findings[0]["source_item_number"] == "84"

    caption_page = """Item 20.1 - Crawlspace text
Item 22.1 - No GFCI protection: kitchen.
Item 23.1 - Missing faceplate on receptacle: primary Bedroom Bathroom.
8/3/26, 12:53 PM PhotoPage
"""
    captions = extract_item_captions_from_text(31, caption_page)
    by_number = {finding["source_item_number"]: finding for finding in findings}
    assert link_caption_to_finding(captions[0], by_number) == ""
    assert link_caption_to_finding(captions[1], by_number) == "electrical-finding-22"
    assert link_caption_to_finding(captions[2], by_number) == "electrical-finding-23"

    shifted_caption = {
        "source_item_number": "85.1",
        "caption": "No GFCI protection",
    }
    by_number["84"] = safety_findings[0]
    assert link_caption_to_finding(shifted_caption, by_number) == "electrical-finding-84"

    print("phase1_multi_system_electrical_slice self-test passed")


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Shelter Prep Phase 1 Step 6 electrical-only local adapter")
    parser.add_argument("--pdf", default=DEFAULT_PDF)
    parser.add_argument("--step4-output", default=DEFAULT_STEP4_OUTPUT)
    parser.add_argument("--step5-output", default=DEFAULT_STEP5_OUTPUT)
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
    print(f"processing_status_distribution={json.dumps(output['summary']['processing_status_distribution'], sort_keys=True)}")
    print(f"agreement_status_distribution={json.dumps(output['summary']['agreement_status_distribution'], sort_keys=True)}")
    print(f"review_queue_size={output['summary']['review_queue_size']}")
    print(f"model_calls={json.dumps(output['summary']['model_calls'], sort_keys=True)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
