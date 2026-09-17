"""Shared local utilities for Shelter Prep Phase 1 multi-system slices."""

from __future__ import annotations

import hashlib
import json
import re
import unicodedata
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw
from pypdf import PdfReader


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


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


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


def starts_section(line: str, section_name: str) -> bool:
    line_key = normalize_key(line)
    section_key = normalize_key(section_name)
    return line_key == section_key or line_key == f"{section_key} cont"


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
    start_index = next((idx for idx, line in enumerate(lines) if starts_section(line, section_name)), None)
    if start_index is None:
        return None

    other_headers = {normalize_key(header) for header in SECTION_HEADERS if normalize_key(header) != normalize_key(section_name)}
    end_index = len(lines)
    for idx in range(start_index + 1, len(lines)):
        line_key = normalize_key(lines[idx])
        if line_key in other_headers or any(line_key == f"{header_key} cont" for header_key in other_headers):
            end_index = idx
            break

    section_lines = lines[start_index:end_index]
    text_value = "\n".join(section_lines)
    return {
        "source_page": page_number,
        "source_section": section_name,
        "text": text_value,
        "char_count": len(text_value),
    }


def extract_item_captions_from_text(page_number: int, text: str) -> list[dict[str, Any]]:
    normalized = normalize_text(text)
    pattern = re.compile(
        r"Item\s+(?P<item>\d+\.\d+)\s*-\s*(?P<caption>.*?)(?=\s+Item\s+\d+\.\d+\s*-|\Z)",
        flags=re.IGNORECASE | re.DOTALL,
    )
    captions = []
    for index, match in enumerate(pattern.finditer(normalized), start=1):
        caption = strip_caption_footer(match.group("caption"))
        if not caption:
            continue
        item_number = match.group("item")
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


def safe_image_suffix(name: str | None) -> str:
    suffix = Path(name or "").suffix.lower()
    return suffix if suffix in {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tiff"} else ".bin"


def image_manifest_valid(
    manifest: dict[str, Any],
    source_sha: str,
    output_dir: Path,
    expected_items: list[str],
) -> bool:
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
                item_number = caption["source_item_number"]
                images.append(
                    {
                        "id": "image-" + item_number.replace(".", "-"),
                        "source_page": page_number,
                        "image_index": caption["image_index_on_page"],
                        "item_number": item_number,
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
            item_number = caption["source_item_number"]
            image_id = "image-" + item_number.replace(".", "-")
            if image_index > len(page_images):
                images.append(
                    {
                        "id": image_id,
                        "source_page": page_number,
                        "image_index": image_index,
                        "item_number": item_number,
                        "caption": caption["caption"],
                        "related_finding_id": caption["related_finding_id"],
                        "related_photo_caption_id": caption["id"],
                        "extraction_status": "missing_image_for_caption",
                    }
                )
                continue

            image = page_images[image_index - 1]
            suffix = safe_image_suffix(getattr(image, "name", ""))
            filename = f"page-{page_number:03d}-image-{image_index:03d}-item-{item_number.replace('.', '-')}{suffix}"
            image_path = image_dir / filename
            data = image.data
            image_path.write_bytes(data)
            pil_image = getattr(image, "image", None)
            dimensions = {"width": pil_image.size[0], "height": pil_image.size[1]} if pil_image is not None else {}
            images.append(
                {
                    "id": image_id,
                    "source_page": page_number,
                    "image_index": image_index,
                    "source_pdf_image_name": getattr(image, "name", ""),
                    "item_number": item_number,
                    "caption": caption["caption"],
                    "related_finding_id": caption["related_finding_id"],
                    "related_photo_caption_id": caption["id"],
                    "extracted_image_storage_path": str(image_path.relative_to(output_dir)),
                    "image_dimensions": dimensions,
                    "size_bytes": len(data),
                    "sha256": hashlib.sha256(data).hexdigest(),
                    "extraction_method": extraction_method,
                    "extraction_status": "extracted",
                }
            )

    write_json(
        manifest_path,
        {
            "schemaVersion": schema_version,
            "source_pdf": str(pdf_path),
            "source_pdf_sha256": source_sha,
            "created_at": utc_now(),
            "images": images,
        },
    )
    return images, False, warnings


def create_contact_sheets(
    images: list[dict[str, Any]],
    output_dir: Path,
    *,
    sheet_prefix: str,
    schema_version: str,
    columns: int = 5,
    cell_width: int = 360,
    image_height: int = 270,
    label_height: int = 34,
    rows_per_sheet: int = 7,
) -> tuple[list[dict[str, Any]], list[str]]:
    extracted = [image for image in images if image.get("extraction_status") == "extracted"]
    if not extracted:
        return [], []

    sheet_dir = output_dir / "contact-sheets"
    sheet_dir.mkdir(parents=True, exist_ok=True)
    sheet_records: list[dict[str, Any]] = []
    warnings: list[str] = []
    per_sheet = columns * rows_per_sheet

    for sheet_index in range(0, len(extracted), per_sheet):
        group = extracted[sheet_index : sheet_index + per_sheet]
        rows = (len(group) + columns - 1) // columns
        sheet = Image.new("RGB", (columns * cell_width, rows * (image_height + label_height)), "white")
        draw = ImageDraw.Draw(sheet)

        for idx, image_record in enumerate(group):
            source_path = output_dir / image_record["extracted_image_storage_path"]
            x = (idx % columns) * cell_width
            y = (idx // columns) * (image_height + label_height)
            draw.rectangle([x, y, x + cell_width, y + label_height], fill=(242, 242, 242), outline=(190, 190, 190))
            label = f"Item {image_record['item_number']} Page {image_record['source_page']}"
            draw.text((x + 8, y + 8), label, fill=(0, 0, 0))
            try:
                with Image.open(source_path) as thumb:
                    thumb = thumb.convert("RGB")
                    thumb.thumbnail((cell_width, image_height))
                    paste_x = x + (cell_width - thumb.width) // 2
                    paste_y = y + label_height + (image_height - thumb.height) // 2
                    sheet.paste(thumb, (paste_x, paste_y))
            except Exception as exc:  # pragma: no cover - depends on image files
                warnings.append(f"Could not add {source_path} to contact sheet: {exc}")

        sheet_path = sheet_dir / f"{sheet_prefix}-{len(sheet_records) + 1:02d}.jpg"
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
            "schemaVersion": schema_version,
            "created_at": utc_now(),
            "contact_sheets": sheet_records,
        },
    )
    return sheet_records, warnings
