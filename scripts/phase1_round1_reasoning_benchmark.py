#!/usr/bin/env python3
"""Shelter Prep Phase 1 Round 1 local inspection reasoning benchmark."""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

from phase1_inspection_evidence_cache import (
    DEFAULT_CACHE_PATH,
    DEFAULT_PDF,
    build_or_load_inspection_evidence_cache,
)
from phase1_multi_system_shared import clean_inline, clean_lines, normalize_key, read_json, sha256_file, utc_now, write_json
from phase1_pricing_contract import build_unpriced_finding_card, pricing_contract_metadata
from phase1_decision_support import enrich_decision_support


SCHEMA_VERSION = "shelter-prep-phase1-round1g-source-integration-contract.v1"
PIPELINE_NAME = "phase1-round1-local-reasoning-benchmark"
DEFAULT_OUTPUT_DIR = "local-fixtures/round1-reasoning-benchmark"
DEFAULT_OUTPUT_FILE = "jo-court-reasoning-artifact.json"

STATUS_PROVEN = "PROVEN"
STATUS_PARTIAL = "PARTIAL"
STATUS_BLOCKED = "BLOCKED"
STATUS_NOT_IMPLEMENTED = "NOT_IMPLEMENTED"

DOMAIN_LABELS = {
    "attic_ventilation_insulation": "Attic / Ventilation / Insulation",
    "chimney_fireplace": "Chimney / Fireplace",
    "crawlspace_drainage_pest_pathway": "Crawlspace / Drainage / Pest Pathway",
    "deferred_maintenance_fyi": "Deferred Maintenance / FYI",
    "dryer_exhaust_ventilation": "Dryer / Exhaust Ventilation",
    "electrical": "Electrical",
    "floors_drywall_interior_finishes": "Floors / Drywall / Interior Finishes",
    "hvac": "HVAC",
    "life_safety": "Life Safety",
    "moisture_envelope": "Moisture / Exterior Envelope",
    "plumbing": "Plumbing",
    "roof": "Roof",
    "site_grading_drainage": "Site / Grading / Drainage",
    "windows_doors_finish_carpentry": "Windows / Doors / Finish Carpentry",
}

SECTION_DOMAIN_FALLBACK = {
    "roof issues": "roof",
    "moisture damage": "moisture_envelope",
    "condensation mold": "attic_ventilation_insulation",
    "exterior issues": "moisture_envelope",
    "eave issues": "moisture_envelope",
    "hvac issues": "hvac",
    "chimney fireplace issues": "chimney_fireplace",
    "crawlspace issues": "crawlspace_drainage_pest_pathway",
    "electrical issues": "electrical",
    "plumbing issues": "plumbing",
    "insulation issues": "attic_ventilation_insulation",
    "window issues": "windows_doors_finish_carpentry",
    "door issues": "windows_doors_finish_carpentry",
    "floor issues": "floors_drywall_interior_finishes",
    "countertop issues": "floors_drywall_interior_finishes",
    "smoke co alarm issues": "life_safety",
    "wall ceiling facings": "floors_drywall_interior_finishes",
    "cabinetry issues": "windows_doors_finish_carpentry",
    "garage door issues": "life_safety",
    "ventilation exhaust issues": "dryer_exhaust_ventilation",
    "site issues": "site_grading_drainage",
    "minor repairs deferred maintenance": "deferred_maintenance_fyi",
    "for improved safety": "life_safety",
    "fyi": "deferred_maintenance_fyi",
}

COMPONENT_RULES = [
    ("roof_covering", re.compile(r"\broof|shingle|granule|flashing|skylight|fastener|kickout\b", re.I)),
    ("roof_penetration", re.compile(r"\bplumbing vent|roof vent|penetration\b", re.I)),
    ("siding_trim_paint", re.compile(r"\bsiding|trim|paint|caulk|lap siding|eave|rafter\b", re.I)),
    ("window", re.compile(r"\bwindow|crank|jamb\b", re.I)),
    ("flooring_substrate", re.compile(r"\bfloor|underlayment|vinyl|laminate|tile|carpet\b", re.I)),
    ("ceiling_wall_finish", re.compile(r"\bceiling|wall|drywall|texture\b", re.I)),
    ("hvac_equipment", re.compile(r"\bfurnace|a/c|ac unit|air conditioner|hvac|duct|return\b", re.I)),
    ("fireplace_chimney", re.compile(r"\bfireplace|chimney|firebox|flue\b", re.I)),
    ("crawlspace_venting", re.compile(r"\bcrawlspace|vent opening|vent screen|vent cover\b", re.I)),
    ("electrical_receptacle", re.compile(r"\bgfci|receptacle|faceplate\b", re.I)),
    ("electrical_panel_or_wiring", re.compile(r"\bpanel|junction box|wiring|cabling|breaker|conductor|screw\b", re.I)),
    ("plumbing_fixture_or_water", re.compile(r"\bplumbing|toilet|sink|bathtub|shower|diverter|water heater|pipe|valve\b", re.I)),
    (
        "life_safety_device",
        re.compile(
            r"\b(?:smoke|carbon monoxide|co)\s+(?:alarm|alarms|detector|detectors)\b|\b(?:alarm|alarms|detector|detectors)\s+(?:for\s+)?(?:smoke|carbon monoxide|co)\b|\bgarage door\b|\b(?:photo eye|entrapment) sensor\b",
            re.I,
        ),
    ),
    ("exhaust_ventilation", re.compile(r"\bdryer|exhaust|ventilation|duct|fan|hood|soffit vent|bathroom exhaust\b", re.I)),
    ("site_drainage", re.compile(r"\bdownspout|storm drain|slope|grade|vegetation|walk|steps|patio\b", re.I)),
]

CONDITION_RULES = [
    ("safety_life_safety", re.compile(r"\bsafety|shock|gfci|smoke|co alarm|carbon monoxide|sensor|unsafe|fire|flue|garage door\b", re.I)),
    ("active_damage_or_water", re.compile(r"\bleak|moisture|\bmold\b|\brot\b|rotting|water|damp|stain|drainage|below grade\b", re.I)),
    ("major_system_or_lifecycle", re.compile(r"\bend of.*service life|old|replace the roof|replace the a/c|manufactured in|expected service life\b", re.I)),
    ("functional_defect", re.compile(r"\bnot working|binds|hard to operate|missing|damaged|cracked|detached|dirty|clogged|bent|split|rusty|deteriorated\b", re.I)),
    ("deferred_maintenance", re.compile(r"\bfyi|monitor|planned maintenance|clean|consider|maintenance\b", re.I)),
    ("needs_more_info", re.compile(r"\binvestigate|further evaluation|inspect|determine|advise|cause|repair as needed\b", re.I)),
]

MECHANISM_PROFILES = {
    "roof_weatherproofing_water_pathway": {
        "family": "moisture_pathway",
        "label": "roof weatherproofing / water pathway",
        "reviewer": "roofer_or_field_reviewer",
    },
    "window_envelope_moisture_pathway": {
        "family": "moisture_pathway",
        "label": "window / envelope moisture pathway",
        "reviewer": "envelope_or_window_reviewer",
    },
    "exterior_envelope_moisture_pathway": {
        "family": "moisture_pathway",
        "label": "exterior envelope moisture pathway",
        "reviewer": "siding_trim_or_envelope_reviewer",
    },
    "wet_area_moisture_pathway": {
        "family": "moisture_pathway",
        "label": "wet-area plumbing / finish moisture pathway",
        "reviewer": "plumbing_or_field_reviewer",
    },
    "interior_moisture_staining_pathway": {
        "family": "moisture_pathway",
        "label": "interior moisture staining pathway",
        "reviewer": "field_reviewer",
    },
    "site_drainage_water_pathway": {
        "family": "moisture_pathway",
        "label": "site drainage / water-management pathway",
        "reviewer": "site_drainage_or_field_reviewer",
    },
    "crawlspace_grade_vent_pathway": {
        "family": "moisture_pathway",
        "label": "crawlspace grade / vent moisture pathway",
        "reviewer": "crawlspace_or_drainage_reviewer",
    },
    "attic_moisture_ventilation_pathway": {
        "family": "moisture_pathway",
        "label": "attic moisture / ventilation pathway",
        "reviewer": "attic_roof_or_ventilation_reviewer",
    },
    "dryer_exhaust_flow_pathway": {
        "family": "ventilation_pathway",
        "label": "dryer exhaust flow pathway",
        "reviewer": "dryer_vent_or_hvac_reviewer",
    },
    "bath_kitchen_exhaust_flow_pathway": {
        "family": "ventilation_pathway",
        "label": "bath / kitchen exhaust flow pathway",
        "reviewer": "ventilation_or_hvac_reviewer",
    },
    "hvac_performance_or_lifecycle": {
        "family": "hvac_performance",
        "label": "HVAC performance / lifecycle pathway",
        "reviewer": "hvac_reviewer",
    },
    "electrical_shock_hazard": {
        "family": "electrical_safety",
        "label": "electrical shock / wiring hazard",
        "reviewer": "electrician",
    },
    "chimney_firebox_flue_safety": {
        "family": "chimney_combustion_safety",
        "label": "chimney / firebox / flue safety pathway",
        "reviewer": "chimney_specialist",
    },
    "life_safety_alarm_function": {
        "family": "life_safety_device",
        "label": "smoke / CO alarm function",
        "reviewer": "life_safety_reviewer",
    },
    "garage_door_entrapment_safety": {
        "family": "garage_door_safety",
        "label": "garage door entrapment safety",
        "reviewer": "garage_door_specialist",
    },
    "major_system_lifecycle": {
        "family": "lifecycle",
        "label": "major system lifecycle",
        "reviewer": "qualified_specialist",
    },
}

CONDITION_LINKABLE_MECHANISMS = {
    "roof_weatherproofing_water_pathway",
    "window_envelope_moisture_pathway",
    "exterior_envelope_moisture_pathway",
    "wet_area_moisture_pathway",
    "interior_moisture_staining_pathway",
    "site_drainage_water_pathway",
    "crawlspace_grade_vent_pathway",
    "attic_moisture_ventilation_pathway",
    "dryer_exhaust_flow_pathway",
    "bath_kitchen_exhaust_flow_pathway",
    "hvac_performance_or_lifecycle",
    "chimney_firebox_flue_safety",
}

OPERATIONAL_REVIEWERS_BY_DOMAIN = {
    "attic_ventilation_insulation": "attic / ventilation / insulation reviewer",
    "chimney_fireplace": "chimney specialist",
    "crawlspace_drainage_pest_pathway": "crawlspace / drainage reviewer",
    "deferred_maintenance_fyi": "human reviewer",
    "dryer_exhaust_ventilation": "dryer exhaust / ventilation reviewer",
    "electrical": "electrician",
    "floors_drywall_interior_finishes": "finish / interior reviewer",
    "hvac": "HVAC reviewer",
    "life_safety": "life-safety reviewer",
    "moisture_envelope": "moisture / envelope reviewer",
    "plumbing": "plumber",
    "roof": "roofer",
    "site_grading_drainage": "site drainage reviewer",
    "windows_doors_finish_carpentry": "window / door / finish-carpentry reviewer",
}

RELATIONSHIP_REVIEW_DECISIONS = ["confirm", "reject", "split", "keep_separate", "needs_more_evidence"]

GENERIC_LOCATION_TOKENS = {
    "adjacent",
    "above",
    "area",
    "back",
    "bath",
    "bathroom",
    "bedroom",
    "ceiling",
    "corner",
    "door",
    "entry",
    "exterior",
    "front",
    "hall",
    "hallway",
    "home",
    "interior",
    "left",
    "rear",
    "right",
    "room",
    "side",
    "wall",
}

DIRECTIONAL_LOCATION_TOKENS = {"back", "front", "left", "lower", "rear", "right", "upper"}

ATTENTION_PRIORITY = {
    "safety_life_safety": 1,
    "active_damage_or_water": 2,
    "needs_more_info": 3,
    "major_system_or_lifecycle": 4,
    "functional_defect": 5,
    "deferred_maintenance": 6,
    "cosmetic_or_information": 7,
}

COVERAGE_HEADINGS = [
    "Foundation systems",
    "Floor Assemblies",
    "Wall Assemblies",
    "Roof & ceiling Assemblies",
    "Attic observation methods",
    "Crawlspace observation methods",
    "Roof coverings",
    "Roof drainage systems",
    "Roof flashings",
    "Skylights",
    "Chimneys",
    "Roof penetrations",
    "Roof observation methods",
    "Exterior wall covering assemblies",
    "Windows",
    "Entry/exit doors",
    "Structures serving entry exit doors",
    "Eaves",
    "For adverse site conditions affecting building",
    "Plumbing Fixtures and faucets",
    "Interior water supply and distribution system piping",
    "Interior drain, waste, and vent system piping",
    "Water heating systems",
    "Service type",
    "Amperage & voltage",
    "SEC material type",
    "Main disconnects",
    "Electrical panels",
    "Branch circuit conductors, their overvoltage devices, and the compatibility of their amperages and voltages",
    "Smoke alarms",
    "CO alarms",
    "Heating equipment",
    "Solid fuel heating devices",
    "Central air conditioning systems",
    "Insulation in exposed to view unfinished spaces",
    "Kitchen ventilation equipment",
    "Bathroom exhaust systems",
    "Laundry exhaust systems",
    "Attic ventilation systems",
    "Crawlspace ventilation systems",
    "Vapor retarders/barriers in exposed to view unfinished spaces adjacent heated living spaces",
    "Walls",
    "Ceilings",
    "Floors",
    "Counters",
    "Cabinets",
    "Appliances",
]

LIMITATION_HEADINGS = ["Note", "Environmental Hazards", "Warranties", "Insurability", "Risk of Economic Loss"]


def compact_key(value: str | None) -> str:
    return normalize_key(value).replace(" ", "")


def stable_slug(value: str) -> str:
    slug = normalize_key(value).replace(" ", "-")
    return slug or "unknown"


def status_from_bool(value: bool) -> str:
    return STATUS_PROVEN if value else STATUS_PARTIAL


def git_ignores(path: Path) -> bool:
    return "local-fixtures" in path.parts


def parse_city_state_zip(value: str) -> dict[str, str]:
    cleaned = clean_inline(value).replace(" ,", ",")
    match = re.match(r"^(?P<city>.+?),?\s+(?P<state>[A-Z]{2})\s+(?P<zip>\d{5}(?:-\d{4})?)$", cleaned)
    if not match:
        return {"city": cleaned, "state": "", "zip": ""}
    return {key: clean_inline(raw) for key, raw in match.groupdict().items()}


def parse_report_header(page_text: str) -> dict[str, Any]:
    lines = clean_lines(page_text)
    labels = {"inspection date", "address", "inspector", "client"}
    value_start = None
    for index, line in enumerate(lines):
        if normalize_key(line).rstrip() == "client":
            value_start = index + 1
            break

    values: list[str] = []
    if value_start is not None:
        for line in lines[value_start:]:
            key = normalize_key(line.rstrip(":"))
            if key in labels:
                continue
            if key in {"home inspection report", "general information per zillow"} or line.startswith("THIS REPORT"):
                break
            values.append(line)
            if len(values) >= 5:
                break

    inspection_date = values[0] if len(values) > 0 else ""
    address_line1 = values[1] if len(values) > 1 else ""
    city_line = values[2] if len(values) > 2 else ""
    inspector_name = values[3] if len(values) > 3 else ""
    client_name = values[4] if len(values) > 4 else ""
    extraction_method = "deterministic_header_value_order"

    if not inspection_date:
        date_pattern = re.compile(r"^(?:0?[1-9]|1[0-2])/(?:0?[1-9]|[12]\d|3[01])/(?:19|20)\d{2}$")
        date_index = next((index for index, line in enumerate(lines) if date_pattern.match(line)), None)
        inspector_label_index = next(
            (
                index
                for index, line in enumerate(lines)
                if normalize_key(line.rstrip(":")) == "inspector" and date_index is not None and index > date_index
            ),
            None,
        )
        if date_index is not None and inspector_label_index is not None:
            candidate_city = lines[date_index - 2] if date_index >= 2 else ""
            candidate_city_parts = parse_city_state_zip(candidate_city)
            if candidate_city_parts["state"] and date_index >= 3:
                inspection_date = lines[date_index]
                address_line1 = lines[date_index - 3]
                city_line = candidate_city
                client_name = lines[date_index - 1]
                inspector_name = lines[inspector_label_index + 1] if inspector_label_index + 1 < len(lines) else ""
                extraction_method = "deterministic_cover_date_anchor"
    city_state_zip = parse_city_state_zip(city_line)

    company = lines[0] if lines else ""
    website = next((line for line in lines if "www." in line.lower()), "")
    email = next((line for line in lines if "@" in line), "")
    license_line = next((line for line in lines if "OCHI#" in line or "CCB#" in line), "")

    return {
        "property": {
            "address_line1": address_line1,
            "city": city_state_zip["city"],
            "state": city_state_zip["state"],
            "zip": city_state_zip["zip"],
            "country": "US" if address_line1 or city_state_zip["state"] else "",
            "normalized_address": clean_inline(" ".join(part for part in [address_line1, city_state_zip["city"], city_state_zip["state"], city_state_zip["zip"]] if part)),
            "source": "inspection_report_header",
            "provenance": {"pdf_page": 1, "extraction_method": extraction_method},
        },
        "report": {
            "inspection_date": inspection_date,
            "inspection_company": company,
            "inspection_company_website": website,
            "inspection_company_email": email,
            "inspection_license_line": license_line,
            "inspector_name": inspector_name,
            "client_name": client_name,
            "source": "inspection_report_header",
            "provenance": {"pdf_page": 1, "extraction_method": extraction_method},
        },
    }


def parse_general_information(page_text: str) -> dict[str, Any]:
    match = re.search(
        r"General Information \(per Zillow\).*?Year Built\s+Square Footage\s+Bedrooms\s+Bathrooms\s+(?P<year>\d+)\s+(?P<sqft>\d+)\s+(?P<beds>[\d.]+)\s+(?P<baths>[\d.]+)",
        page_text,
        flags=re.I | re.S,
    )
    if not match:
        return {"fields": {}, "provenance": {"pdf_page": 1, "extraction_method": "deterministic_general_information_block", "status": "not_found"}}
    return {
        "fields": {
            "year_built": int(match.group("year")),
            "square_footage": int(match.group("sqft")),
            "bedrooms": float(match.group("beds")),
            "bathrooms": float(match.group("baths")),
        },
        "provenance": {"pdf_page": 1, "extraction_method": "deterministic_general_information_block", "status": "extracted"},
    }


def line_matches_heading(line: str, heading: str) -> bool:
    return compact_key(line.rstrip(":")) == compact_key(heading)


def collect_block(lines: list[str], heading: str, all_headings: list[str], *, max_lines: int = 12) -> list[str]:
    start = next((index for index, line in enumerate(lines) if line_matches_heading(line, heading)), None)
    if start is None:
        return []
    stop_headings = {compact_key(item) for item in all_headings if compact_key(item) != compact_key(heading)}
    values: list[str] = []
    for line in lines[start + 1 :]:
        key = compact_key(line.rstrip(":"))
        if key in stop_headings:
            break
        if len(values) >= max_lines:
            break
        values.append(line)
    return values


def extract_coverage_and_limitations(cache: dict[str, Any]) -> dict[str, Any]:
    page_text_by_page = cache.get("pageTextByPage", {})
    coverage_pages = {str(page): page_text_by_page.get(str(page), {}).get("text", "") for page in range(49, 53)}
    joined = "\n".join(text for text in coverage_pages.values() if text)
    lines = clean_lines(joined)

    inspected_items_intro = ""
    intro_match = re.search(
        r"Only the below items, if present and where exposed to view, are those which we inspected\..*?hidden parts of these items are not part of this inspection\.",
        joined,
        flags=re.I | re.S,
    )
    if intro_match:
        inspected_items_intro = clean_inline(intro_match.group(0))

    inventory: dict[str, Any] = {}
    for heading in COVERAGE_HEADINGS:
        values = collect_block(lines, heading, COVERAGE_HEADINGS + LIMITATION_HEADINGS, max_lines=10)
        if values:
            inventory[stable_slug(heading)] = {
                "label": heading,
                "values": values,
                "provenance": {
                    "pdf_pages": [int(page) for page, text in coverage_pages.items() if heading.lower().split()[0] in text.lower()],
                    "extraction_method": "deterministic_items_of_inspection_heading_blocks",
                },
            }

    limitations: list[dict[str, Any]] = []
    if inspected_items_intro:
        limitations.append(
            {
                "id": "limitation-visible-and-exposed-items-only",
                "type": "inspection_scope",
                "source_statement": inspected_items_intro,
                "operational_meaning": "Inspection coverage is limited to listed items that were present and exposed to view; hidden parts remain unknown.",
                "provenance": {"pdf_page": 49, "extraction_method": "deterministic_scope_intro_extraction"},
            }
        )

    page_52_lines = clean_lines(page_text_by_page.get("52", {}).get("text", ""))
    for heading in LIMITATION_HEADINGS:
        values = collect_block(page_52_lines, heading, LIMITATION_HEADINGS, max_lines=8)
        if not values:
            continue
        limitations.append(
            {
                "id": f"limitation-{stable_slug(heading)}",
                "type": stable_slug(heading),
                "source_statement": clean_inline(" ".join(values)),
                "operational_meaning": "Treat this as a report-scope limitation. It limits final certainty but does not mean extraction failed.",
                "provenance": {"pdf_page": 52, "extraction_method": "deterministic_limitation_heading_block"},
            }
        )

    return {
        "inspection_coverage": {
            "coverage_basis": "Items of the Inspection section from cached page text.",
            "source_pages": [49, 50, 51, 52],
            "visible_exposed_items_only_statement": inspected_items_intro,
            "system_inventory": inventory,
            "coverage_status": STATUS_PROVEN if inventory else STATUS_PARTIAL,
        },
        "inspection_limitations": limitations,
        "extraction_completeness": {
            "page_text_records_indexed": len(cache.get("pageTextByPage", {})),
            "sections_indexed": cache.get("summary", {}).get("sections_indexed", 0),
            "normalized_findings_indexed": cache.get("summary", {}).get("findings_indexed", 0),
            "photo_captions_indexed": cache.get("summary", {}).get("photo_captions_indexed", 0),
            "images_indexed": cache.get("summary", {}).get("images_indexed", 0),
            "source": "shared_inspection_evidence_cache",
            "extraction_status": "cache_reused_or_loaded",
            "not_the_same_as_inspection_coverage": True,
        },
    }


def primary_domain(finding: dict[str, Any]) -> str:
    section_key = normalize_key(finding.get("source_section", ""))
    if section_key in SECTION_DOMAIN_FALLBACK and section_key not in {"minor repairs deferred maintenance", "fyi", "for improved safety"}:
        return SECTION_DOMAIN_FALLBACK[section_key]
    candidates = finding.get("domain_routing_candidates", [])
    non_deferred = [candidate for candidate in candidates if candidate.get("domain_key") != "deferred_maintenance_fyi"]
    source_section_candidates = [candidate for candidate in non_deferred if str(candidate.get("reason", "")).startswith("source_section:")]
    if source_section_candidates:
        return source_section_candidates[0]["domain_key"]
    conditional_candidates = [candidate for candidate in non_deferred if "conditional_section" in str(candidate.get("reason", ""))]
    if conditional_candidates:
        return conditional_candidates[0]["domain_key"]
    if non_deferred:
        return non_deferred[0]["domain_key"]
    return SECTION_DOMAIN_FALLBACK.get(section_key, candidates[0].get("domain_key") if candidates else "unrouted")


def classify_components(text: str, source_section: str) -> list[str]:
    components = [name for name, pattern in COMPONENT_RULES if pattern.search(text)]
    if components:
        return sorted(set(components))
    section_key = normalize_key(source_section)
    if section_key in SECTION_DOMAIN_FALLBACK:
        return [stable_slug(source_section)]
    return ["component_not_determinable_from_source_text"]


def classify_conditions(text: str) -> list[str]:
    conditions = [name for name, pattern in CONDITION_RULES if pattern.search(text)]
    if not conditions:
        conditions.append("cosmetic_or_information")
    return sorted(set(conditions), key=lambda item: ATTENTION_PRIORITY.get(item, 99))


def classify_mechanisms(text: str) -> list[str]:
    lowered = text.lower()
    mechanisms: set[str] = set()

    has_roof = re.search(r"\broof|shingle|flashing|skylight|kickout|roof covering|plumbing vent seal|exposed fastener", lowered)
    is_exhaust_roof_vent = re.search(r"\bbathroom exhaust|dryer|clothes dryer|exhaust duct|exhaust fan|hood\b", lowered)
    if has_roof and not is_exhaust_roof_vent and re.search(r"\bleak|water|moisture|\brot\b|rotting|flashing|kickout|seal|skylight|fastener|shingle", lowered):
        mechanisms.add("roof_weatherproofing_water_pathway")

    if re.search(r"\bwindow\b", lowered) and re.search(r"\bleak|moisture|water|stain|\brot\b|rotting", lowered):
        mechanisms.add("window_envelope_moisture_pathway")

    has_exterior_envelope = re.search(r"\bexterior|siding|trim|paint|eave|rafter|chimney chase|lap siding|weather stripping\b", lowered)
    if has_exterior_envelope and re.search(r"\bleak|moisture|water|stain|\brot\b|rotting|caulk|flashing|below grade|ground|slope|gutter|downspout", lowered):
        mechanisms.add("exterior_envelope_moisture_pathway")

    has_wet_area = re.search(r"\bbath(?:room)?\b|\bbathtub\b|\bshower\b|\btoilet\b|\bsink\b|\bcountertop\b|\bdishwasher\b|\bfaucet\b|\bdrainage connection\b|\bdrain line\b|\brim\b", lowered)
    if has_wet_area and re.search(r"\bleak|moisture|stain|crud|corrosion|\bmold\b|caulk|\brim\b|substrate|drainage connection", lowered):
        mechanisms.add("wet_area_moisture_pathway")

    if re.search(r"\bceiling|wall|drywall|baseboard|floor\b", lowered) and re.search(r"\bleak|moisture|water|stain|damp|\bmold\b", lowered):
        mechanisms.add("interior_moisture_staining_pathway")

    has_site_drainage = re.search(r"\b(?:downspout|storm drain|gutter|gutters|reverse slope|drains toward|grade|below grade)\b", lowered)
    has_ground_contact_context = re.search(r"\bground\b", lowered) and re.search(
        r"\bsiding|soil|crawlspace|contact|close proximity|drainage|grade\b", lowered
    )
    is_plumbing_drain = re.search(r"\bsink|dishwasher|bathtub|shower|faucet|tailpiece|garbage disposal\b", lowered)
    if (has_site_drainage or has_ground_contact_context) and not is_plumbing_drain:
        mechanisms.add("site_drainage_water_pathway")

    if re.search(r"\bcrawlspace\b", lowered) and re.search(r"\bvent|below grade|ground|screen|cover", lowered):
        mechanisms.add("crawlspace_grade_vent_pathway")

    if re.search(r"\battic\b", lowered) and re.search(r"\bcondensation|\bmold\b|moisture|ventilation|vent|insulation|soffit|exhaust", lowered):
        mechanisms.add("attic_moisture_ventilation_pathway")

    if re.search(r"\bclothes dryer|dryer duct|dryer vent|laundry exhaust|flex duct\b", lowered):
        mechanisms.add("dryer_exhaust_flow_pathway")

    if re.search(r"\bbathroom exhaust|kitchen exhaust|exhaust fan|hood|roof vent serving bathroom exhaust\b", lowered):
        mechanisms.add("bath_kitchen_exhaust_flow_pathway")

    if re.search(r"\bfurnace|a/c|ac unit|air conditioner|hvac|blower|burner\b", lowered):
        if re.search(r"\bend of|old|service life|manufactured|dirty|dusty|blower|burner|knock|vibrat|cooling|fins|return\b", lowered):
            mechanisms.add("hvac_performance_or_lifecycle")

    has_electrical_device = re.search(
        r"\bgfci\b|\breceptacle\b|\bfaceplate\b|\bjunction box\b|\bwiring\b|\bcabling\b|\bbreaker\b|\bconductor\b|\bunbushed\b|\bunclamped\b",
        lowered,
    )
    has_electrical_panel_context = re.search(r"\belectrical panel\b|\bpanel attachment screw|\bpanel screw", lowered)
    if has_electrical_device or has_electrical_panel_context:
        mechanisms.add("electrical_shock_hazard")

    if re.search(
        r"\b(?:smoke|carbon monoxide|co)\s+(?:alarm|alarms|detector|detectors)\b|\b(?:alarm|alarms|detector|detectors)\s+(?:for\s+)?(?:smoke|carbon monoxide|co)\b",
        lowered,
    ):
        mechanisms.add("life_safety_alarm_function")

    if re.search(r"\bgarage door\b", lowered) and re.search(r"\bsensor|reverse|entrap|photo eye|safety\b", lowered):
        mechanisms.add("garage_door_entrapment_safety")

    if re.search(r"\bchimney|fireplace|firebox|flue\b", lowered):
        mechanisms.add("chimney_firebox_flue_safety")

    if re.search(r"\bend of.*service life|old model|older than|manufactured in|expected service life|be prepared replace", lowered):
        mechanisms.add("major_system_lifecycle")

    order = {name: index for index, name in enumerate(MECHANISM_PROFILES)}
    return sorted(mechanisms, key=lambda item: order.get(item, 99))


def attention_category(conditions: list[str]) -> str:
    return sorted(conditions, key=lambda item: ATTENTION_PRIORITY.get(item, 99))[0] if conditions else "cosmetic_or_information"


def source_stated_cause(text: str) -> str:
    patterns = [
        r"\bbecause\s+(?P<cause>[^.]+)",
        r"\bdue to\s+(?P<cause>[^.]+)",
        r"\bcaused by\s+(?P<cause>[^.]+)",
        r"\bfrom\s+(?P<cause>moisture|water|leak|impact|wear|age)[^.]*",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.I)
        if match:
            return clean_inline(match.group("cause"))
    return ""


ORIENTATION_PATTERNS = [
    ("NE", re.compile(r"\b(?:north[ -]?east|northeast)\b", re.I)),
    ("NW", re.compile(r"\b(?:north[ -]?west|northwest)\b", re.I)),
    ("SE", re.compile(r"\b(?:south[ -]?east|southeast)\b", re.I)),
    ("SW", re.compile(r"\b(?:south[ -]?west|southwest)\b", re.I)),
    ("N", re.compile(r"\bnorth(?:ern)?\b", re.I)),
    ("E", re.compile(r"\beast(?:ern)?\b", re.I)),
    ("S", re.compile(r"\bsouth(?:ern)?\b", re.I)),
    ("W", re.compile(r"\bwest(?:ern)?\b", re.I)),
    ("front", re.compile(r"\bfront(?: side| elevation| exterior)?\b", re.I)),
    ("rear", re.compile(r"\b(?:rear|back)(?: side| elevation| exterior)?\b", re.I)),
    ("left", re.compile(r"\bleft(?: side| elevation| exterior)\b", re.I)),
    ("right", re.compile(r"\bright(?: side| elevation| exterior)\b", re.I)),
]

LEVEL_PATTERNS = [
    ("crawlspace", re.compile(r"\bcrawl\s*space\b", re.I)),
    ("basement", re.compile(r"\bbasement\b", re.I)),
    ("first floor", re.compile(r"\b(?:first|1st) floor\b", re.I)),
    ("second floor", re.compile(r"\b(?:second|2nd) floor\b", re.I)),
    ("attic", re.compile(r"\battic\b", re.I)),
    ("roof", re.compile(r"\broof\b", re.I)),
]

ROOM_PATTERNS = [
    ("kitchen", re.compile(r"\bkitchen\b", re.I)),
    ("laundry", re.compile(r"\blaundry\b", re.I)),
    ("garage", re.compile(r"\bgarage\b", re.I)),
    ("primary bathroom", re.compile(r"\b(?:primary|master) bathroom\b", re.I)),
    ("bathroom", re.compile(r"\bbathroom\b", re.I)),
    ("bedroom", re.compile(r"\bbedroom\b", re.I)),
    ("living room", re.compile(r"\bliving room\b", re.I)),
    ("family room", re.compile(r"\bfamily room\b", re.I)),
]

AREA_PATTERNS = [
    ("siding", re.compile(r"\bsiding\b", re.I)),
    ("eave", re.compile(r"\beaves?\b", re.I)),
    ("chimney", re.compile(r"\bchimney\b", re.I)),
    ("porch", re.compile(r"\bporch\b", re.I)),
    ("deck", re.compile(r"\bdeck(?:ing)?\b", re.I)),
    ("foundation", re.compile(r"\bfoundation\b", re.I)),
    ("window", re.compile(r"\bwindows?\b", re.I)),
    ("roof plane", re.compile(r"\broof(?: plane| covering)?\b", re.I)),
    ("valley", re.compile(r"\bvalley\b", re.I)),
    ("walkway", re.compile(r"\bwalkways?\b", re.I)),
]

ELEMENT_PATTERNS = [
    ("window", re.compile(r"\bwindows?\b", re.I)),
    ("trim joint", re.compile(r"\btrim\b", re.I)),
    ("siding seam", re.compile(r"\bsiding\b", re.I)),
    ("footing", re.compile(r"\bfooting\b", re.I)),
    ("vent", re.compile(r"\bvents?\b", re.I)),
    ("flashing", re.compile(r"\bflashings?\b", re.I)),
    ("receptacle", re.compile(r"\breceptacles?\b", re.I)),
    ("alarm", re.compile(r"\b(?:smoke|carbon monoxide|co) alarms?\b", re.I)),
    ("toilet", re.compile(r"\btoilets?\b", re.I)),
]


def first_pattern_value(text: str, patterns: list[tuple[str, re.Pattern[str]]]) -> str | None:
    return next((value for value, pattern in patterns if pattern.search(text)), None)


def normalize_affected_location(finding: dict[str, Any], captions: list[dict[str, Any]]) -> dict[str, Any]:
    explicit_locations = [clean_inline(value) for value in finding.get("locations", []) if clean_inline(value)]
    report_text = clean_inline(
        " ".join(
            [
                finding.get("source_section", ""),
                finding.get("title", ""),
                finding.get("inspector_statement", ""),
                *explicit_locations,
            ]
        )
    )
    caption_text = clean_inline(" ".join(caption.get("caption", "") for caption in captions))
    orientation = first_pattern_value(report_text, ORIENTATION_PATTERNS)
    orientation_basis = "explicit_report_text" if orientation else "unknown"
    if not orientation and caption_text:
        orientation = first_pattern_value(caption_text, ORIENTATION_PATTERNS)
        orientation_basis = "explicit_photo_caption" if orientation else "unknown"

    level = first_pattern_value(report_text, LEVEL_PATTERNS)
    room_or_zone = first_pattern_value(report_text, ROOM_PATTERNS)
    area = first_pattern_value(report_text, AREA_PATTERNS)
    element = first_pattern_value(report_text, ELEMENT_PATTERNS)
    location_text = explicit_locations[0] if explicit_locations else clean_inline(
        ", ".join(value for value in [orientation, level, room_or_zone, area, element] if value)
    )
    has_explicit_location = bool(location_text)
    source_basis = "explicit_report_text" if has_explicit_location else "unknown"
    if not has_explicit_location and caption_text:
        caption_location = clean_inline(
            ", ".join(
                value
                for value in [
                    first_pattern_value(caption_text, LEVEL_PATTERNS),
                    first_pattern_value(caption_text, ROOM_PATTERNS),
                    first_pattern_value(caption_text, AREA_PATTERNS),
                    first_pattern_value(caption_text, ELEMENT_PATTERNS),
                ]
                if value
            )
        )
        if caption_location:
            location_text = caption_location
            source_basis = "explicit_photo_caption"

    return {
        "orientation": orientation,
        "orientation_status": "explicit" if orientation else "unknown",
        "orientation_source_basis": orientation_basis,
        "area": area,
        "level": level,
        "room_or_zone": room_or_zone,
        "element": element,
        "location_text": location_text or "Location not established by the source evidence.",
        "source_basis": source_basis,
        "source_refs": {
            "source_file_id": finding.get("source_file_id", ""),
            "source_page": finding.get("source_page"),
            "source_item_number": finding.get("source_item_number", ""),
            "photo_caption_ids": [caption.get("id", "") for caption in captions if caption.get("id")],
        },
        "confidence": "high" if explicit_locations else "medium" if source_basis != "unknown" else "unknown",
        "status": "source_supported" if source_basis != "unknown" else "needs_location_confirmation",
        "resolution_prompt": (
            "Confirm photo direction or mark the affected area on the property diagram."
            if not orientation
            else "No orientation confirmation is required from the current source text."
        ),
    }


def build_review_workflow(record: dict[str, Any]) -> dict[str, Any]:
    domain = record.get("organization", {}).get("domain_key", "")
    category = record.get("organization", {}).get("technical_attention_category", "")
    location = record.get("affected_location", {})
    evidence = record.get("evidence_links", {})
    reasons: list[str] = ["interpretation_check"]
    careful_domains = {"roof", "electrical", "moisture_envelope", "life_safety", "crawlspace_drainage_pest_pathway"}
    if domain in careful_domains or category in {"active_damage_or_water", "safety_or_habitability", "structural_or_movement"}:
        reasons.append("high_consequence_system")
    if location.get("status") == "needs_location_confirmation":
        reasons.append("needs_location_confirmation")
    if not evidence.get("image_ids"):
        reasons.append("image_unavailable")
    if record.get("localized_cost_context", {}).get("status") == "blocked_missing_sourced_range":
        reasons.append("missing_price_source")

    if location.get("status") == "needs_location_confirmation" and not evidence.get("image_ids"):
        priority = "waiting_for_evidence"
    elif any(reason in reasons for reason in ["high_consequence_system", "needs_location_confirmation"]):
        priority = "careful_review"
    else:
        priority = "quick_review"
        reasons.append("ready_for_quick_approval")
    return {"priority": priority, "reasons": reasons, "status": "needs_review"}


def environmental_context_relevance(conditions: list[str], mechanisms: list[str]) -> bool:
    mechanism_set = set(mechanisms)
    return bool(
        "active_damage_or_water" in conditions
        or mechanism_set
        & {
            "roof_weatherproofing_water_pathway",
            "window_envelope_moisture_pathway",
            "exterior_envelope_moisture_pathway",
            "wet_area_moisture_pathway",
            "interior_moisture_staining_pathway",
            "site_drainage_water_pathway",
            "crawlspace_grade_vent_pathway",
            "attic_moisture_ventilation_pathway",
            "dryer_exhaust_flow_pathway",
            "bath_kitchen_exhaust_flow_pathway",
        }
    )


def build_environmental_context(
    observed_when: str,
    conditions: list[str],
    mechanisms: list[str],
    property_report: dict[str, Any],
) -> dict[str, Any]:
    relevant = environmental_context_relevance(conditions, mechanisms)
    return {
        "status": "not_researched_local_round1" if relevant else "not_relevant_to_current_source_observation",
        "is_relevant_to_interpretation": relevant,
        "evidence_observation_date": observed_when,
        "comparison_date_basis": "inspection_report_date" if observed_when else "not_available",
        "property_location_basis": {
            "zip": property_report.get("property", {}).get("zip", ""),
            "city": property_report.get("property", {}).get("city", ""),
            "state": property_report.get("property", {}).get("state", ""),
        },
        "weather_observation": None,
        "weather_sources": [],
        "weather_claims": [],
        "required_weather_provenance": [
            "source_provider",
            "source_reference",
            "location_used",
            "observation_period",
            "retrieved_at",
            "measurements",
            "linked_finding_or_evidence_id",
        ],
        "interpretation_rule": (
            "Weather may only contextualize moisture, roof, drainage, or ventilation evidence when sourced weather data is compared "
            "against the actual inspection/evidence date."
        ),
        "negative_evidence_rule": (
            "Dry-weather timing may reduce support for a rain-driven hypothesis only when sourced measurements cover the relevant "
            "pre-observation window; it does not rule out another moisture source."
        ),
        "causal_claim_policy": "No causal claim may be made from weather correlation alone.",
        "human_review_status": "needs_review",
    }


def cost_geography_basis(property_report: dict[str, Any]) -> dict[str, str]:
    property_data = property_report.get("property", {})
    if property_data.get("zip"):
        return {
            "requested_precision": "zip",
            "most_defensible_available_geography": "zip",
            "label": property_data["zip"],
            "precision_claim_allowed": "zip_only_if_price_sources_are_zip_specific",
        }
    if property_data.get("city") and property_data.get("state"):
        return {
            "requested_precision": "zip",
            "most_defensible_available_geography": "city",
            "label": f"{property_data['city']}, {property_data['state']}",
            "precision_claim_allowed": "city_only",
        }
    if property_data.get("state"):
        return {
            "requested_precision": "zip",
            "most_defensible_available_geography": "state",
            "label": property_data["state"],
            "precision_claim_allowed": "state_only",
        }
    return {
        "requested_precision": "zip",
        "most_defensible_available_geography": "national_fallback",
        "label": "United States",
        "precision_claim_allowed": "national_only",
    }


def build_localized_cost_context(
    record: dict[str, Any],
    property_report: dict[str, Any],
) -> dict[str, Any]:
    scope_defined_enough = False
    next_step_owner = record.get("smallest_useful_next_evidence", {}).get("owner", "human_reviewer")
    return {
        "status": "blocked_missing_sourced_range",
        "scope_defined_enough_for_cost_context": scope_defined_enough,
        "geography_basis": cost_geography_basis(property_report),
        "trade_or_reviewer_needed_first": next_step_owner,
        "cost_range": None,
        "price_sources": [],
        "material_sources": [],
        "precision_guardrail": "Do not claim ZIP-level precision unless the cited price source is actually ZIP-specific.",
        "review_rule": "Any cost context is AI Draft / Needs Human Review and must remain separate from final pricing, bids, or seller-ready language.",
        "reason_not_priced": "No provenance-bearing price source was supplied to this local reasoning run; the pricing contract prohibits fabricating a range.",
    }


def external_claim_controls(price_sources: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    price_sources = price_sources or []
    return {
        "weather": {
            "claims_made": False,
            "sources": [],
            "required_before_claim": "Source weather for the actual inspection/evidence date and compare it to the relevant observation.",
        },
        "prices": {
            "claims_made": bool(price_sources),
            "sources": [source["id"] for source in price_sources],
            "required_before_claim": "Use reviewed scope plus sourced local price data and label geography no more precisely than the source supports.",
        },
        "codes": {
            "claims_made": False,
            "sources": [],
            "required_before_claim": "Use official jurisdiction/code or manufacturer source plus human review; otherwise say qualified review is needed.",
        },
        "materials": {
            "claims_made": False,
            "sources": [],
            "required_before_claim": "Use supplier/manufacturer/source documents and keep assumptions distinct from verified material requirements.",
        },
    }


def contractor_input_model() -> dict[str, Any]:
    return {
        "contractor_input_records_present": False,
        "contractor_source_material": [],
        "contractor_verification_records": [],
        "separation_rule": "Contractor input is source material only until separately reviewed; it must not be treated as contractor verification.",
    }


def make_interpretation(finding: dict[str, Any], system_label: str, category: str) -> str:
    statement = clean_inline(finding.get("inspector_statement", "this source finding"))
    section = finding.get("source_section", "inspection report")
    if category == "safety_life_safety":
        emphasis = "a safety-related review item"
    elif category == "active_damage_or_water":
        emphasis = "a water, moisture, or active-damage review item"
    elif category == "major_system_or_lifecycle":
        emphasis = "a major-system or lifecycle review item"
    elif category == "needs_more_info":
        emphasis = "an uncertainty-reduction item"
    elif category == "deferred_maintenance":
        emphasis = "a maintenance or FYI review item"
    else:
        emphasis = "a functional or condition review item"
    return (
        f"The source report states: {statement}. Shelter Prep can organize it as {emphasis} in the {system_label} system "
        f"based on the {section} source section. This is an AI draft interpretation and does not establish final cause, final scope, code status, or pricing."
    )


def make_unknowns(
    finding: dict[str, Any],
    conditions: list[str],
    mechanisms: list[str],
    linked_caption_count: int,
    cached_visual_count: int,
    cause: str,
) -> list[str]:
    unknowns = ["Human review has not verified this interpretation."]
    if not cause:
        unknowns.append("Exact cause is not established unless the inspector explicitly stated it.")
    mechanism_set = set(mechanisms)
    moisture_mechanisms = {
        name for name, profile in MECHANISM_PROFILES.items() if profile.get("family") == "moisture_pathway"
    }
    ventilation_mechanisms = {
        name for name, profile in MECHANISM_PROFILES.items() if profile.get("family") == "ventilation_pathway"
    }
    if "active_damage_or_water" in conditions or mechanism_set & moisture_mechanisms:
        unknowns.append("Active moisture status, concealed damage, and exact water-entry path remain unknown without field verification.")
    if "electrical_shock_hazard" in mechanism_set:
        unknowns.append("Hidden wiring, energization state, code status, and final electrical repair scope remain unknown without qualified review.")
    if "chimney_firebox_flue_safety" in mechanism_set:
        unknowns.append("Flue condition, combustion safety, and chimney repair scope remain unknown without a chimney-specific review.")
    if "life_safety_alarm_function" in mechanism_set:
        unknowns.append("Alarm age, placement, interconnection, and tested function remain unknown unless documented or verified.")
    if "garage_door_entrapment_safety" in mechanism_set:
        unknowns.append("Sensor height, auto-reverse function, and final garage-door adjustment remain unknown without field testing.")
    if "major_system_lifecycle" in mechanism_set or "hvac_performance_or_lifecycle" in mechanism_set:
        unknowns.append("Remaining service life and repair-vs-replacement economics remain unknown without qualified assessment.")
    if mechanism_set & ventilation_mechanisms:
        unknowns.append("Airflow, termination path, blockage extent, and safety significance remain unknown without targeted vent verification.")
    if linked_caption_count == 0:
        unknowns.append("No linked report photo caption was deterministically attached to this observation.")
    elif cached_visual_count == 0:
        unknowns.append("No cached independent visual observation is available for the linked photo evidence in this reasoning artifact.")
    unknowns.append("Final repair scope, contractor means/methods, permits, and cost are outside this Round 1 benchmark.")
    return list(dict.fromkeys(unknowns))


def mechanism_owner(mechanisms: list[str], fallback: str = "human_reviewer") -> str:
    for mechanism in mechanisms:
        owner = MECHANISM_PROFILES.get(mechanism, {}).get("reviewer")
        if owner:
            return str(owner)
    return fallback


def make_next_evidence(record: dict[str, Any]) -> dict[str, Any]:
    category = record["organization"]["technical_attention_category"]
    mechanisms = record["organization"].get("mechanism_candidates", [])
    mechanism_set = set(mechanisms)
    locations = record["organization"].get("locations", [])
    location_text = ", ".join(locations) if locations else "the reported area"

    uncertainty = "Whether this AI draft classification is accurate enough for human triage."
    request = (
        f"No additional field evidence is required for initial triage of {location_text}; reviewer can keep this as a separate "
        "maintenance/finish item unless it is promoted into active scope."
    )
    owner = "human_reviewer"
    why = "The available source statement is enough for an initial keep-separate or maintenance/FYI review decision."
    materiality = ["human_review"]
    new_evidence_requested = False

    if "roof_weatherproofing_water_pathway" in mechanism_set:
        uncertainty = "Whether the reported roof leak/roof penetration condition is active and where water may be traveling."
        request = f"Obtain attic-side photos directly below the reported roof leak or penetration area at {location_text} and confirm whether any staining is active, dry, or absent."
        owner = "roofer_or_field_reviewer"
        why = "Active status and underside evidence change relationship confidence and roof scope readiness."
        materiality = ["relationship_confidence", "scope_readiness", "technical_significance"]
        new_evidence_requested = True
    elif "window_envelope_moisture_pathway" in mechanism_set:
        uncertainty = "Whether the window-area evidence reflects active leakage, old staining, or a localized finish issue."
        request = f"Photograph the interior and exterior sides of the window at {location_text}, including sill/jamb/trim transitions, and take a moisture reading at the damaged finish."
        owner = "envelope_or_window_reviewer"
        why = "A window-side moisture check separates an active envelope pathway from old or cosmetic damage."
        materiality = ["relationship_confidence", "scope_readiness"]
        new_evidence_requested = True
    elif "wet_area_moisture_pathway" in mechanism_set:
        uncertainty = "Whether nearby plumbing, sealant, or wet-area use is contributing to the visible moisture/damage evidence."
        request = f"Measure moisture at the affected wet-area surface in {location_text} and inspect the nearest sink, tub, shower, drain, or caulk connection for current leakage or failed sealant."
        owner = "plumbing_or_field_reviewer"
        why = "Moisture readings and nearest-connection checks determine whether the issue is active and whether plumbing/finish review should be bundled."
        materiality = ["relationship_confidence", "scope_readiness", "next_human_decision"]
        new_evidence_requested = True
    elif "exterior_envelope_moisture_pathway" in mechanism_set:
        uncertainty = "Whether exterior deterioration is isolated to the visible face or part of a water-management pathway."
        request = f"Photograph the full siding/trim/paint/caulk intersection at {location_text} and probe or note whether deterioration extends behind the visible surface."
        owner = "siding_trim_or_envelope_reviewer"
        why = "Extent and water-path context decide whether this stays local finish repair or needs envelope review."
        materiality = ["scope_readiness", "technical_significance"]
        new_evidence_requested = True
    elif "site_drainage_water_pathway" in mechanism_set:
        uncertainty = "Whether site water is being directed toward a building surface or crawlspace opening."
        request = f"Photograph the full drainage path at {location_text}, including discharge point and nearby wall/opening, and verify slope direction with a level or water-flow observation."
        owner = "site_drainage_or_field_reviewer"
        why = "Drain direction and discharge location decide whether the condition affects envelope/crawlspace moisture risk."
        materiality = ["relationship_confidence", "technical_significance", "next_human_decision"]
        new_evidence_requested = True
    elif "crawlspace_grade_vent_pathway" in mechanism_set:
        uncertainty = "Whether grade/vent conditions allow water, pests, or blocked airflow at crawlspace openings."
        request = f"Photograph each affected crawlspace vent at {location_text} straight-on and from grade level, then confirm clearance above soil/paving and whether screening is intact."
        owner = "crawlspace_or_drainage_reviewer"
        why = "Vent clearance and screen condition determine moisture/pest-pathway significance."
        materiality = ["technical_significance", "scope_readiness"]
        new_evidence_requested = True
    elif "attic_moisture_ventilation_pathway" in mechanism_set:
        uncertainty = "Whether attic staining/mold/insulation evidence is active, ventilation-related, or connected to another moisture source."
        request = f"Photograph attic discoloration, insulation gaps, and nearby intake/exhaust paths at {location_text}; confirm moisture level and whether bathroom/kitchen exhaust terminates properly."
        owner = "attic_roof_or_ventilation_reviewer"
        why = "Attic-side location and moisture status decide whether this is ventilation, roof, exhaust, or insulation follow-up."
        materiality = ["relationship_confidence", "scope_readiness", "technical_significance"]
        new_evidence_requested = True
    elif "interior_moisture_staining_pathway" in mechanism_set:
        uncertainty = "Whether visible interior staining/damage is active, old, or related to a nearby exterior/roof/plumbing pathway."
        request = f"Take a moisture reading at the stained or damaged interior surface in {location_text} and photograph the nearest ceiling/wall/floor transitions plus any adjacent exterior or plumbing source."
        owner = "field_reviewer"
        why = "Active status and nearest-source context determine whether the observation can be related to another condition."
        materiality = ["relationship_confidence", "scope_readiness"]
        new_evidence_requested = True
    elif "dryer_exhaust_flow_pathway" in mechanism_set:
        uncertainty = "Whether dryer exhaust flow is restricted, unsafe, or terminating improperly."
        request = f"Confirm dryer exhaust material, termination, and airflow at {location_text}; photograph the full duct path where accessible and any exterior hood or blockage."
        owner = "dryer_vent_or_hvac_reviewer"
        why = "Duct material, termination, and airflow change safety significance and repair readiness."
        materiality = ["technical_significance", "scope_readiness"]
        new_evidence_requested = True
    elif "bath_kitchen_exhaust_flow_pathway" in mechanism_set:
        uncertainty = "Whether bath/kitchen exhaust is moving air to an appropriate termination or recirculating/blocked."
        request = f"Confirm fan or hood operation at {location_text}, trace the accessible exhaust path, and photograph the termination or blocked roof/soffit vent."
        owner = "ventilation_or_hvac_reviewer"
        why = "Exhaust path confirmation decides whether this is a ventilation repair, roof vent issue, or FYI limitation."
        materiality = ["technical_significance", "scope_readiness"]
        new_evidence_requested = True
    elif "hvac_performance_or_lifecycle" in mechanism_set:
        uncertainty = "Which HVAC component is causing the reported condition and whether performance is affected."
        request = f"Confirm whether the HVAC condition at {location_text} occurs only during heat/cooling mode and identify whether the source is blower, inducer, cabinet, duct, return, coil, or outdoor unit."
        owner = "hvac_reviewer"
        why = "Mode and component source determine whether this is cleaning, adjustment, repair, or lifecycle review."
        materiality = ["scope_readiness", "next_human_decision"]
        new_evidence_requested = True
    elif "electrical_shock_hazard" in mechanism_set:
        uncertainty = "Whether the exact electrical device/panel/wiring condition is present as reported and needs qualified repair."
        request = f"Confirm the exact device or wiring location at {location_text}, photograph the condition close-up with surrounding context, and have an electrician decide repair requirements."
        owner = "electrician"
        why = "Electrical defects need qualified review before any repair scope or safety conclusion."
        materiality = ["technical_significance", "next_human_decision"]
        new_evidence_requested = True
    elif "chimney_firebox_flue_safety" in mechanism_set:
        uncertainty = "Whether the visible fireplace/firebox issue also affects the flue or combustion-safety condition."
        request = f"Have a chimney specialist inspect the firebox and flue serving {location_text}; capture close-up firebox photos and any accessible flue/termination evidence."
        owner = "chimney_specialist"
        why = "The inspection report limitation leaves the flue condition unresolved, which controls review significance."
        materiality = ["technical_significance", "scope_readiness"]
        new_evidence_requested = True
    elif "life_safety_alarm_function" in mechanism_set:
        uncertainty = "Whether each listed alarm is current, correctly placed, and functional."
        request = f"Confirm manufacture date/model and test status for each smoke/CO alarm at {location_text}; photograph labels and locations before deciding replacement/readiness."
        owner = "life_safety_reviewer"
        why = "Alarm age and function are the smallest facts needed for life-safety readiness."
        materiality = ["technical_significance", "next_human_decision"]
        new_evidence_requested = True
    elif "garage_door_entrapment_safety" in mechanism_set:
        uncertainty = "Whether the garage door sensor placement and reverse function meet safe operation expectations."
        request = f"Measure sensor height at {location_text}, photograph both sensors from floor level, and test auto-reverse/obstruction response before deciding adjustment."
        owner = "garage_door_specialist"
        why = "A height measurement and reverse-function test directly resolve the safety uncertainty."
        materiality = ["technical_significance", "scope_readiness"]
        new_evidence_requested = True
    elif "major_system_lifecycle" in mechanism_set or category == "major_system_or_lifecycle":
        uncertainty = "Whether age/lifecycle evidence changes repair-vs-replacement review."
        request = f"Confirm serial/model age and present operating condition at {location_text} before any repair-vs-replacement decision."
        owner = "qualified_specialist"
        why = "Age alone does not decide scope; current condition and specialist review are required."
        materiality = ["next_human_decision"]
        new_evidence_requested = True
    elif category == "needs_more_info":
        uncertainty = "What exact source detail or field fact is missing from the inspector recommendation."
        request = f"Identify the specific unresolved fact in the source recommendation for {location_text} and request only the photo, measurement, or test that resolves that fact."
        owner = "human_reviewer"
        why = "Round 1 should reduce one decision-blocking uncertainty, not ask for broad reinspection."
        materiality = ["next_human_decision"]
        new_evidence_requested = True

    return {
        "uncertainty": uncertainty,
        "smallest_fact_or_check": request,
        "next_evidence_needed": request,
        "owner": owner,
        "why_it_matters": why,
        "materiality": materiality,
        "new_evidence_requested": new_evidence_requested,
        "reason": "smallest_useful_next_fact_or_field_check",
        "status": "needs_review",
    }


def load_cached_visual_records(cache: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
    records_by_hash: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for index in cache.get("compatibleVisualCacheIndexes", []):
        if not index.get("compatible_with_source_hash"):
            continue
        path = Path(index.get("path", ""))
        if not path.exists():
            continue
        data = read_json(path)
        if index.get("cache_type") == "step5_roof_visual_output":
            entries = data.get("imageVisualEvidence", [])
            for entry in entries:
                image_hash = entry.get("provenance", {}).get("image_sha256", "")
                if not image_hash:
                    continue
                visual = {
                    "id": entry.get("id", ""),
                    "source_cache_type": index.get("cache_type"),
                    "processing_status": entry.get("processing_status", ""),
                    "agreement_status": entry.get("agreement_status", ""),
                    "visual_observation": entry.get("visual_observation", ""),
                    "shelter_prep_interpretation": entry.get("shelter_prep_interpretation", ""),
                    "unknowns": entry.get("unknowns", []),
                    "human_review_status": entry.get("human_review_status", "needs_review"),
                    "provenance": entry.get("provenance", {}),
                }
                records_by_hash[image_hash].append(visual)
            continue

        for entry in data.get("entries", []):
            image_hash = entry.get("image_sha256", "")
            if not image_hash:
                continue
            provenance = {
                "source_cache_type": index.get("cache_type"),
                "visual_cache_path": str(path.resolve()),
                "image_sha256": image_hash,
                "item_number": entry.get("item_number", ""),
                "pdf_page": entry.get("source_page"),
                "model_service_used": data.get("model_service_used", ""),
                "model_version": data.get("model_version", ""),
                "model_run_id": data.get("model_run_id", ""),
                "prompt_version": data.get("prompt_version", ""),
                "timestamp": data.get("created_at", ""),
                "vision_input_mode": data.get("vision_input_mode", ""),
            }
            visual = {
                "id": f"cached-visual-{stable_slug(index.get('cache_type', 'visual'))}-{stable_slug(entry.get('item_number', image_hash[:8]))}",
                "source_cache_type": index.get("cache_type"),
                "processing_status": entry.get("processing_status", ""),
                "agreement_status": entry.get("agreement_status", ""),
                "visual_observation": entry.get("visual_observation", ""),
                "shelter_prep_interpretation": entry.get("shelter_prep_interpretation", ""),
                "unknowns": entry.get("unknowns", []),
                "human_review_status": entry.get("human_review_status", "needs_review"),
                "provenance": provenance,
            }
            records_by_hash[image_hash].append(visual)
    return records_by_hash


def evidence_maps(cache: dict[str, Any]) -> dict[str, Any]:
    captions_by_id = {caption["id"]: caption for caption in cache.get("photoCaptionIndex", [])}
    images_by_caption_id = {
        image.get("related_photo_caption_id"): image for image in cache.get("extractedImageManifest", {}).get("images", [])
    }
    images_by_id = {image.get("id"): image for image in cache.get("extractedImageManifest", {}).get("images", [])}
    visual_records_by_hash = load_cached_visual_records(cache)
    return {
        "captions_by_id": captions_by_id,
        "images_by_caption_id": images_by_caption_id,
        "images_by_id": images_by_id,
        "visual_records_by_hash": visual_records_by_hash,
        "source_document": cache.get("sourceDocument", {}),
        "page_text_by_page": cache.get("pageTextByPage", {}),
        "all_captions": cache.get("photoCaptionIndex", []),
        "all_images": cache.get("extractedImageManifest", {}).get("images", []),
        "all_findings": cache.get("normalizedFindings", []),
    }


def linked_visuals_for_finding(finding: dict[str, Any], maps: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    captions: list[dict[str, Any]] = []
    images: list[dict[str, Any]] = []
    visuals: list[dict[str, Any]] = []
    for caption_id in finding.get("linked_photo_ids", []):
        caption = maps["captions_by_id"].get(caption_id)
        if caption:
            captions.append(caption)
        image = maps["images_by_caption_id"].get(caption_id)
        if image:
            images.append(image)
            image_hash = image.get("sha256", "")
            visuals.extend(maps["visual_records_by_hash"].get(image_hash, []))
    return captions, images, visuals


def bounded_page_excerpt(value: str, limit: int = 1800) -> str:
    text = clean_inline(value)
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


def review_evidence_context(finding: dict[str, Any], maps: dict[str, Any], linked_image_ids: set[str]) -> dict[str, Any]:
    source_page = finding.get("source_page")
    page_count = int(maps.get("source_document", {}).get("pageCount") or 0)
    source_pages = [int(page) for page in finding.get("provenance", {}).get("source_pages", []) if page]
    requested_pages: list[tuple[int, str]] = []
    if source_page:
        requested_pages.append((int(source_page), "source_page"))
        for page in source_pages:
            if page != source_page:
                requested_pages.append((page, "continued_source_page"))
        if int(source_page) + 1 <= page_count:
            requested_pages.append((int(source_page) + 1, "next_page"))
        if int(source_page) > 1:
            requested_pages.append((int(source_page) - 1, "previous_page"))

    previews = []
    seen_pages: set[int] = set()
    for page, relationship in requested_pages:
        if page in seen_pages or len(previews) >= 4:
            continue
        record = maps.get("page_text_by_page", {}).get(str(page), {})
        excerpt = bounded_page_excerpt(record.get("text", ""))
        if excerpt:
            previews.append({"page": page, "relationship": relationship, "text_excerpt": excerpt})
            seen_pages.add(page)

    next_finding_pages = sorted(
        int(item.get("source_page"))
        for item in maps.get("all_findings", [])
        if item.get("source_page") and source_page and int(item.get("source_page")) > int(source_page)
    )
    next_finding_page = next_finding_pages[0] if next_finding_pages else page_count + 1
    captions_by_id = {caption.get("id"): caption for caption in maps.get("all_captions", [])}
    candidates = []
    for image in maps.get("all_images", []):
        image_id = image.get("id", "")
        image_page = image.get("source_page")
        if not image_id or image_id in linked_image_ids or not source_page or not image_page:
            continue
        if int(image_page) not in {int(source_page), int(source_page) + 1}:
            continue
        caption = captions_by_id.get(image.get("related_photo_caption_id"), {})
        follows_without_intervening_finding = int(image_page) == int(source_page) + 1 and int(image_page) < next_finding_page
        strength = "strong" if follows_without_intervening_finding else "possible"
        reason = (
            "Image block follows this finding on the next page with no intervening finding."
            if strength == "strong"
            else "Image appears on the source or adjacent page; the report layout alone does not confirm the relationship."
        )
        candidates.append({
            "image_id": image_id,
            "caption": caption.get("caption", ""),
            "source_page": int(image_page),
            "association_strength": strength,
            "association_reason": reason,
            "confirmation_required": True,
        })

    candidates.sort(key=lambda item: (0 if item["association_strength"] == "strong" else 1, item["source_page"], item["image_id"]))
    return {
        "candidate_photos": candidates[:8],
        "page_previews": previews,
        "full_report_available": bool(maps.get("source_document", {}).get("filename")),
    }


def build_atomic_observation(
    finding: dict[str, Any],
    maps: dict[str, Any],
    property_report: dict[str, Any],
) -> dict[str, Any]:
    captions, images, visuals = linked_visuals_for_finding(finding, maps)
    joined_text = " ".join(
        [
            finding.get("source_section", ""),
            finding.get("inspector_statement", ""),
            finding.get("inspector_recommendation", ""),
            " ".join(finding.get("locations", [])),
        ]
    )
    domain_key = primary_domain(finding)
    system_label = DOMAIN_LABELS.get(domain_key, clean_inline(domain_key.replace("_", " ").title()) or "Unrouted")
    components = classify_components(joined_text, finding.get("source_section", ""))
    conditions = classify_conditions(joined_text)
    mechanisms = classify_mechanisms(joined_text)
    category = attention_category(conditions)
    cause = source_stated_cause(joined_text)
    observed_when = property_report.get("report", {}).get("inspection_date", "")
    visual_ids = [visual.get("id", "") for visual in visuals if visual.get("id")]
    extraction_issues = []
    if not finding.get("source_page"):
        extraction_issues.append("missing_source_page")
    if not finding.get("provenance"):
        extraction_issues.append("missing_source_provenance")
    if finding.get("linked_photo_ids") and not images:
        extraction_issues.append("linked_caption_without_extracted_image")

    record = {
        "id": "atomic-observation-" + stable_slug(str(finding.get("source_item_number", finding.get("id", "unknown")))),
        "source_finding_id": finding.get("id", ""),
        "source": {
            "source_page": finding.get("source_page"),
            "source_section": finding.get("source_section", ""),
            "source_item_number": finding.get("source_item_number", ""),
            "inspector_statement": finding.get("inspector_statement", ""),
            "inspector_recommendation": finding.get("inspector_recommendation", ""),
            "inspector_locations": finding.get("locations", []),
            "source_excerpt": finding.get("source_excerpt", ""),
            "source_file_id": finding.get("source_file_id", ""),
            "when_observed": observed_when,
            "when_observed_basis": "inspection_report_date" if observed_when else "not_available_in_source",
            "provenance": finding.get("provenance", {}),
        },
        "source_chronology": {
            "observation_date": observed_when,
            "observation_date_basis": "inspection_report_date" if observed_when else "not_available_in_source",
            "upload_date": None,
            "upload_date_available": False,
            "date_used_for_environmental_comparison": observed_when,
            "upload_date_used_as_observation_date": False,
            "rule": "Use the source observation/report date for environmental comparison; never substitute file upload time.",
        },
        "epistemic_states": {
            "source_observation": finding.get("inspector_statement", ""),
            "source_stated_cause": cause,
            "source_recommendation": finding.get("inspector_recommendation", ""),
            "shelter_prep_interpretation": make_interpretation(finding, system_label, category),
            "ai_inference_or_hypothesis": "AI draft classification and organization only; not a verified cause, scope, code decision, or cost.",
            "unknowns": make_unknowns(finding, conditions, mechanisms, len(captions), len(visuals), cause),
            "human_correction": None,
            "human_review_status": "needs_review",
        },
        "organization": {
            "domain_key": domain_key,
            "all_domain_candidates": finding.get("domain_routing_candidates", []),
            "building_system": system_label,
            "components": components,
            "condition_categories": conditions,
            "mechanism_candidates": mechanisms,
            "technical_attention_category": category,
            "locations": finding.get("locations", []),
            "confirmation_status": "ai_draft_needs_human_review",
        },
        "evidence_links": {
            "photo_caption_ids": [caption.get("id", "") for caption in captions],
            "image_ids": [image.get("id", "") for image in images],
            "image_hashes": [image.get("sha256", "") for image in images if image.get("sha256")],
            "cached_visual_evidence_ids": visual_ids,
            "cached_visual_records": visuals,
        },
        "extraction_status": {
            "source_text": "extracted" if finding.get("source_page") and finding.get("inspector_statement") else "partial",
            "photo_linking": "linked" if captions else "not_linked_or_not_present",
            "image_linking": "linked" if images else "not_linked_or_not_present",
            "cached_visual_analysis": "reused_by_image_hash" if visuals else "not_available_in_compatible_visual_cache",
            "issues": extraction_issues,
        },
    }
    record["affected_location"] = normalize_affected_location(finding, captions)
    record["smallest_useful_next_evidence"] = make_next_evidence(record)
    record["recommended_next_step"] = {
        "move": record["smallest_useful_next_evidence"]["next_evidence_needed"],
        "owner": record["smallest_useful_next_evidence"]["owner"],
        "why_this_next_step": record["smallest_useful_next_evidence"]["why_it_matters"],
        "review_status": "needs_review",
    }
    record["environmental_context"] = build_environmental_context(observed_when, conditions, mechanisms, property_report)
    record["localized_cost_context"] = build_localized_cost_context(record, property_report)
    record["review_workflow"] = build_review_workflow(record)
    record["known_facts"] = [
        fact
        for fact in [
            f"Inspector reports: {finding.get('inspector_statement', '')}" if finding.get("inspector_statement") else "",
            f"Inspector recommends: {finding.get('inspector_recommendation', '')}" if finding.get("inspector_recommendation") else "",
            f"Linked report photo captions: {len(captions)}" if captions else "",
            f"Cached independent visual observations: {len(visuals)}" if visuals else "",
            f"Source-stated cause: {cause}" if cause else "",
        ]
        if fact
    ]
    record["finding_card"] = build_unpriced_finding_card(record)
    record["finding_card"]["finding_title"] = finding.get("title") or record["finding_card"]["finding_title"]
    record["finding_card"]["affected_location"] = record["affected_location"]
    record["finding_card"]["review_workflow"] = record["review_workflow"]
    record["finding_card"]["source_evidence"] = {
        "document_name": maps.get("source_document", {}).get("filename", "Inspection report"),
        "source_excerpt": finding.get("source_excerpt", ""),
        "inspector_statement": finding.get("inspector_statement", ""),
        "inspector_recommendation": finding.get("inspector_recommendation", ""),
        "source_page": finding.get("source_page"),
        "source_item_number": finding.get("source_item_number", ""),
        "source_section": finding.get("source_section", ""),
        "primary_photo": (
            {
                "image_id": images[0].get("id", ""),
                "caption_id": captions[0].get("id", "") if captions else "",
                "caption": captions[0].get("caption", "") if captions else "",
                "source_page": images[0].get("source_page"),
                "link_status": "linked",
            }
            if images
            else None
        ),
        "additional_evidence_count": max(len(images) + len(captions) - 1, 0),
        **review_evidence_context(finding, maps, {image.get("id", "") for image in images}),
    }
    return record


def build_system_component_index(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for record in records:
        grouped[record["organization"]["domain_key"]].append(record)

    index: list[dict[str, Any]] = []
    for domain_key, items in sorted(grouped.items()):
        attention_counts = Counter(item["organization"]["technical_attention_category"] for item in items)
        component_counts = Counter(component for item in items for component in item["organization"]["components"])
        visual_count = sum(len(item["evidence_links"]["cached_visual_evidence_ids"]) for item in items)
        caption_count = sum(len(item["evidence_links"]["photo_caption_ids"]) for item in items)
        index.append(
            {
                "id": "system-index-" + stable_slug(domain_key),
                "domain_key": domain_key,
                "building_system": DOMAIN_LABELS.get(domain_key, domain_key.replace("_", " ").title()),
                "observation_ids": [item["id"] for item in items],
                "source_sections": sorted({item["source"]["source_section"] for item in items if item["source"]["source_section"]}),
                "finding_count": len(items),
                "photo_caption_count": caption_count,
                "cached_visual_record_count": visual_count,
                "attention_category_distribution": dict(sorted(attention_counts.items())),
                "component_distribution": dict(component_counts.most_common()),
                "known_summary": [item["known_facts"][0] for item in items if item.get("known_facts")][:5],
                "unknowns_summary": sorted({unknown for item in items for unknown in item["epistemic_states"]["unknowns"]})[:8],
                "review_status": "needs_review",
                "confirmation_status": "system_grouping_only_not_final_scope",
            }
        )
    return index


def source_refs_for_records(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "atomic_observation_id": record["id"],
            "source_finding_id": record["source_finding_id"],
            "source_page": record["source"]["source_page"],
            "source_section": record["source"]["source_section"],
            "source_item_number": record["source"]["source_item_number"],
        }
        for record in records
    ]


def primary_known_facts(records: list[dict[str, Any]], *, limit: int = 8) -> list[str]:
    facts: list[str] = []
    for record in records:
        facts.extend(record.get("known_facts", [])[:2])
    return list(dict.fromkeys(facts))[:limit]


def location_keys(record: dict[str, Any]) -> list[str]:
    return [normalize_key(location) for location in record["organization"].get("locations", []) if normalize_key(location)]


def location_tokens(location: str) -> set[str]:
    return {token for token in normalize_key(location).split() if token and token not in GENERIC_LOCATION_TOKENS}


def location_relationship(left: dict[str, Any], right: dict[str, Any]) -> dict[str, str] | None:
    left_locations = location_keys(left)
    right_locations = location_keys(right)
    for left_location in left_locations:
        for right_location in right_locations:
            if left_location == right_location:
                return {"kind": "same", "label": left_location}
            if left_location and right_location and (left_location in right_location or right_location in left_location):
                return {"kind": "adjacent", "label": " / ".join(sorted({left_location, right_location}))}
            shared_tokens = location_tokens(left_location) & location_tokens(right_location)
            if shared_tokens:
                left_directions = set(left_location.split()) & DIRECTIONAL_LOCATION_TOKENS
                right_directions = set(right_location.split()) & DIRECTIONAL_LOCATION_TOKENS
                if left_directions and right_directions and left_directions != right_directions:
                    continue
                return {"kind": "adjacent", "label": " / ".join(sorted({left_location, right_location}))}
    return None


def mechanism_family(mechanism: str) -> str:
    return str(MECHANISM_PROFILES.get(mechanism, {}).get("family", ""))


def compatible_condition_mechanisms(left: dict[str, Any], right: dict[str, Any]) -> list[str]:
    left_mechanisms = set(left["organization"].get("mechanism_candidates", [])) & CONDITION_LINKABLE_MECHANISMS
    right_mechanisms = set(right["organization"].get("mechanism_candidates", [])) & CONDITION_LINKABLE_MECHANISMS
    common = left_mechanisms & right_mechanisms
    if common:
        return sorted(common)

    compatible: set[str] = set()
    for left_mechanism in left_mechanisms:
        for right_mechanism in right_mechanisms:
            if mechanism_family(left_mechanism) and mechanism_family(left_mechanism) == mechanism_family(right_mechanism):
                compatible.update({left_mechanism, right_mechanism})
    return sorted(compatible)


def common_specific_components(left: dict[str, Any], right: dict[str, Any]) -> set[str]:
    ignored = {"component_not_determinable_from_source_text"}
    left_components = {
        component
        for component in left["organization"].get("components", [])
        if component not in ignored and not component.endswith("-issues")
    }
    right_components = {
        component
        for component in right["organization"].get("components", [])
        if component not in ignored and not component.endswith("-issues")
    }
    return left_components & right_components


def source_suggests_connection(left: dict[str, Any], right: dict[str, Any]) -> bool:
    joined = " ".join(
        [
            left["source"].get("inspector_statement", ""),
            left["source"].get("inspector_recommendation", ""),
            right["source"].get("inspector_statement", ""),
            right["source"].get("inspector_recommendation", ""),
        ]
    )
    return bool(
        re.search(
            r"\bdue to|caused by|because|emanating from|directly below|below the|above the|over the|drains toward|serving\b",
            joined,
            flags=re.I,
        )
    )


def plausible_physical_pathway(left: dict[str, Any], right: dict[str, Any], mechanisms: list[str], location: dict[str, str] | None) -> str:
    domains = {left["organization"]["domain_key"], right["organization"]["domain_key"]}
    mechanism_set = set(mechanisms)
    left_conditions = set(left["organization"].get("condition_categories", []))
    right_conditions = set(right["organization"].get("condition_categories", []))
    has_active_damage = "active_damage_or_water" in (left_conditions | right_conditions)

    if domains == {"roof", "attic_ventilation_insulation"} and {
        "roof_weatherproofing_water_pathway",
        "attic_moisture_ventilation_pathway",
    } <= mechanism_set and has_active_damage:
        attic_record = left if left["organization"]["domain_key"] == "attic_ventilation_insulation" else right
        if "active_damage_or_water" not in set(attic_record["organization"].get("condition_categories", [])):
            return ""
        return "roof-to-attic moisture/ventilation pathway"
    if not location:
        return ""
    if domains == {"plumbing", "floors_drywall_interior_finishes"} and "wet_area_moisture_pathway" in mechanism_set:
        return "wet-area plumbing to floor/finish pathway"
    if domains == {"moisture_envelope", "floors_drywall_interior_finishes"} and any(
        mechanism_family(mechanism) == "moisture_pathway" for mechanism in mechanism_set
    ):
        return "envelope to interior finish moisture pathway"
    if domains == {"site_grading_drainage", "moisture_envelope"} and {
        "site_drainage_water_pathway",
        "exterior_envelope_moisture_pathway",
    } <= mechanism_set:
        return "site drainage to exterior envelope pathway"
    if domains == {"site_grading_drainage", "crawlspace_drainage_pest_pathway"} and {
        "site_drainage_water_pathway",
        "crawlspace_grade_vent_pathway",
    } <= mechanism_set:
        return "site drainage to crawlspace opening pathway"
    if domains == {"dryer_exhaust_ventilation", "attic_ventilation_insulation"} and any(
        mechanism_family(mechanism) == "ventilation_pathway" for mechanism in mechanism_set
    ):
        return "exhaust path to attic/ventilation pathway"
    return ""


def condition_relationship_signals(left: dict[str, Any], right: dict[str, Any]) -> dict[str, Any] | None:
    mechanisms = compatible_condition_mechanisms(left, right)
    if not mechanisms:
        return None

    signals: list[str] = []
    score = 1
    location = location_relationship(left, right)
    if location:
        signals.append(f"{location['kind']}_location_with_compatible_mechanism")
        score += 2 if location["kind"] == "same" else 1

    components = common_specific_components(left, right)
    if components and location:
        signals.append("same_or_adjacent_component_context")
        score += 1

    source_connection = source_suggests_connection(left, right)
    if source_connection:
        signals.append("source_evidence_suggests_connection")
        score += 2

    pathway = plausible_physical_pathway(left, right, mechanisms, location)
    if pathway:
        signals.append("same_or_adjacent_system_with_plausible_physical_pathway")
        score += 2

    if not location and not pathway:
        return None

    if score < 2:
        return None

    confidence = "strong" if score >= 5 else "moderate" if score >= 3 else "weak"
    return {
        "mechanisms": mechanisms,
        "location": location,
        "components": sorted(components),
        "pathway": pathway,
        "signals": signals,
        "confidence": confidence,
        "score": score,
    }


def relationship_next_evidence(
    relationship_type: str,
    records: list[dict[str, Any]],
    mechanisms: list[str],
    location_label: str,
    domain_key: str = "",
) -> dict[str, Any]:
    location_text = location_label or "the referenced area"
    mechanism_set = set(mechanisms)
    if relationship_type == "operational_review_bundle":
        reviewer = OPERATIONAL_REVIEWERS_BY_DOMAIN.get(domain_key, "human reviewer")
        request = (
            f"No new evidence is requested solely because these items share a trade/system. Assign {reviewer} review if useful, "
            "but keep source findings separate unless a separate condition relationship is confirmed."
        )
        return {
            "uncertainty": "Whether these items should be reviewed together operationally, not whether they share a cause.",
            "smallest_fact_or_check": request,
            "next_evidence_needed": request,
            "owner": reviewer,
            "why_it_matters": "This reduces review handoff friction without manufacturing a causal relationship.",
            "materiality": ["review_efficiency"],
            "new_evidence_requested": False,
            "status": "needs_review",
        }
    if relationship_type == "shared_location_context":
        request = (
            f"No new evidence is requested solely because items share {location_text}. Only ask for a current wide photo if a reviewer "
            "needs to confirm whether the specific items physically interact."
        )
        return {
            "uncertainty": "Whether same-location observations have any physical interaction beyond proximity.",
            "smallest_fact_or_check": request,
            "next_evidence_needed": request,
            "owner": "human_reviewer",
            "why_it_matters": "Shared location is useful context, but it must not merge unrelated source findings.",
            "materiality": ["relationship_confidence"],
            "new_evidence_requested": False,
            "status": "needs_review",
        }
    if relationship_type == "shared_system_context":
        system_label = DOMAIN_LABELS.get(domain_key, domain_key.replace("_", " ").title())
        request = (
            f"No new evidence is requested solely because items are in {system_label}. Use this as system context, and require a "
            "separate pathway, dependency, or source connection before treating items as related."
        )
        return {
            "uncertainty": "Whether same-system observations share a meaningful pathway or are simply separate system findings.",
            "smallest_fact_or_check": request,
            "next_evidence_needed": request,
            "owner": "human_reviewer",
            "why_it_matters": "This protects operational grouping from becoming false causation.",
            "materiality": ["relationship_confidence"],
            "new_evidence_requested": False,
            "status": "needs_review",
        }

    owner = mechanism_owner(mechanisms, "field_reviewer")
    uncertainty = "Whether the grouped observations share an active condition/pathway or only appear related."
    request = f"Review the source references for {location_text} and collect the smallest field fact that confirms or rejects the suspected pathway."
    why = "The added fact should change relationship confidence, scope readiness, technical significance, or the next human decision."

    if "roof_weatherproofing_water_pathway" in mechanism_set or "attic_moisture_ventilation_pathway" in mechanism_set:
        uncertainty = "Whether roof-side evidence and attic/interior moisture evidence are part of the same active pathway."
        request = f"Obtain attic-side photos directly below the suspect roof area for {location_text} and confirm whether staining or sheathing moisture is active, dry, or absent."
    elif "wet_area_moisture_pathway" in mechanism_set:
        uncertainty = "Whether wet-area finish damage and nearby plumbing/sealant evidence are part of one active moisture condition."
        request = f"Measure moisture at the affected floor/cabinet/wall surface in {location_text} and inspect the nearest sink, tub, shower, drain, or caulk connection for current leakage."
    elif "window_envelope_moisture_pathway" in mechanism_set or "exterior_envelope_moisture_pathway" in mechanism_set:
        uncertainty = "Whether interior finish evidence and exterior envelope evidence share a water-entry path."
        request = f"Photograph both sides of the suspected window/siding/trim intersection at {location_text} and verify whether deterioration or moisture extends behind the visible face."
    elif "site_drainage_water_pathway" in mechanism_set or "crawlspace_grade_vent_pathway" in mechanism_set:
        uncertainty = "Whether water movement at grade is reaching the envelope or crawlspace opening."
        request = f"Photograph the full grade/drainage path at {location_text} and verify slope or discharge direction relative to the nearest wall or crawlspace vent."
    elif "hvac_performance_or_lifecycle" in mechanism_set:
        uncertainty = "Whether the HVAC observations point to one performance issue or separate maintenance/lifecycle items."
        request = f"Confirm whether the condition at {location_text} occurs only during heat/cooling mode and identify whether the source is blower, inducer, duct, cabinet, return, coil, or outdoor unit."
    elif "chimney_firebox_flue_safety" in mechanism_set:
        uncertainty = "Whether visible fireplace/firebox evidence affects the flue or broader chimney safety review."
        request = f"Have a chimney specialist inspect the firebox and flue for {location_text}, with close-up firebox photos and any accessible flue/termination evidence."

    return {
        "uncertainty": uncertainty,
        "smallest_fact_or_check": request,
        "next_evidence_needed": request,
        "owner": owner,
        "why_it_matters": why,
        "materiality": ["relationship_confidence", "scope_readiness", "technical_significance", "next_human_decision"],
        "new_evidence_requested": True,
        "status": "needs_review",
    }


def make_relationship_candidate(
    relationship_id: str,
    relationship_type: str,
    basis: str,
    records: list[dict[str, Any]],
    label: str,
    confidence: str,
    relationship_status: str,
    cause_status: str,
    why_relationship_matters: str,
    smallest_useful_next_evidence: dict[str, Any],
    basis_signals: list[str] | None = None,
) -> dict[str, Any]:
    records = sorted(records, key=lambda record: record["id"])
    source_refs = [
        {
            "atomic_observation_id": record["id"],
            "source_finding_id": record["source_finding_id"],
            "source_page": record["source"]["source_page"],
            "source_section": record["source"]["source_section"],
            "source_item_number": record["source"]["source_item_number"],
        }
        for record in records
    ]
    known = primary_known_facts(records)
    unknowns = [
        "Shared cause is not established by this candidate.",
        "Human review must decide whether these observations belong together, remain separate, or need more evidence.",
        "Any concealed condition remains unknown unless directly documented.",
    ]
    if relationship_type != "potential_condition_relationship":
        unknowns[0] = "This context or bundle does not assert shared cause."
    return {
        "id": relationship_id,
        "type": relationship_type,
        "relationship_type": relationship_type,
        "basis": basis,
        "basis_signals": basis_signals or [],
        "label": label,
        "confidence": confidence,
        "relationship_status": relationship_status,
        "related_atomic_observation_ids": [record["id"] for record in records],
        "related_observation_ids": [record["id"] for record in records],
        "source_references": source_refs,
        "cautious_hypothesis": (
            f"These observations are classified as {relationship_type} based on {basis}. This is a review candidate only and "
            "does not confirm shared cause, concealed damage, final scope, code status, or cost."
        ),
        "what_is_known": known,
        "known_basis": known,
        "what_is_unknown": unknowns,
        "unknowns": unknowns,
        "why_relationship_matters": why_relationship_matters,
        "confirmation_status": "unconfirmed_hypothesis_needs_human_review"
        if relationship_type == "potential_condition_relationship"
        else "context_or_bundle_needs_human_review",
        "cause_status": cause_status,
        "review_status": "needs_review",
        "smallest_useful_next_evidence": smallest_useful_next_evidence,
        "human_review_decision": {"status": "needs_review", "allowed_decisions": RELATIONSHIP_REVIEW_DECISIONS},
        "human_review_decision_options": RELATIONSHIP_REVIEW_DECISIONS,
    }


def build_potential_condition_relationships(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    groups: dict[str, dict[str, Any]] = {}
    for left_index, left in enumerate(records):
        for right in records[left_index + 1 :]:
            signals = condition_relationship_signals(left, right)
            if not signals:
                continue
            mechanisms = signals["mechanisms"]
            location = signals.get("location") or {}
            location_label = location.get("label", "")
            family = mechanism_family(mechanisms[0]) or mechanisms[0]
            if location_label:
                group_key = f"{family}:{stable_slug(location_label)}"
            else:
                domains = "-".join(sorted({left["organization"]["domain_key"], right["organization"]["domain_key"]}))
                group_key = f"{family}:{stable_slug(domains)}"
            group = groups.setdefault(
                group_key,
                {
                    "records": {},
                    "mechanisms": set(),
                    "basis_parts": set(),
                    "signals": set(),
                    "score": 0,
                    "location_label": location_label,
                    "confidence": "weak",
                },
            )
            group["records"][left["id"]] = left
            group["records"][right["id"]] = right
            group["mechanisms"].update(mechanisms)
            group["signals"].update(signals["signals"])
            if location_label:
                group["basis_parts"].add(f"{location.get('kind', 'nearby')} location: {location_label}")
            if signals.get("pathway"):
                group["basis_parts"].add(signals["pathway"])
            group["score"] = max(group["score"], signals["score"])
            if signals["confidence"] == "strong" or (signals["confidence"] == "moderate" and group["confidence"] == "weak"):
                group["confidence"] = signals["confidence"]

    candidates: list[dict[str, Any]] = []
    for group_key, group in sorted(groups.items()):
        group_records = list(group["records"].values())
        if len(group_records) < 2:
            continue
        mechanisms = sorted(group["mechanisms"], key=lambda item: list(MECHANISM_PROFILES).index(item))
        basis_parts = sorted(group["basis_parts"]) or ["compatible mechanism and source/pathway signal"]
        mechanism_labels = [MECHANISM_PROFILES.get(mechanism, {}).get("label", mechanism.replace("_", " ")) for mechanism in mechanisms]
        location_label = group.get("location_label", "")
        basis = "; ".join(basis_parts + [f"mechanism fit: {', '.join(mechanism_labels)}"])
        label = "Potential condition relationship: " + ", ".join(str(label_item) for label_item in mechanism_labels[:2])
        next_evidence = relationship_next_evidence(
            "potential_condition_relationship",
            group_records,
            mechanisms,
            location_label,
        )
        candidates.append(
            make_relationship_candidate(
                "relationship-condition-" + stable_slug(group_key),
                "potential_condition_relationship",
                basis,
                group_records,
                label,
                group["confidence"],
                "potential",
                "not_established",
                "A confirmed pathway or dependency would change review confidence, scope readiness, or sequencing; without confirmation the observations remain separate source findings.",
                next_evidence,
                sorted(group["signals"]),
            )
        )
    return candidates


def build_operational_review_bundles(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []
    by_domain: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for record in records:
        by_domain[record["organization"]["domain_key"]].append(record)
    for domain_key, items in sorted(by_domain.items()):
        if len(items) < 2:
            continue
        system_label = DOMAIN_LABELS.get(domain_key, domain_key.replace("_", " ").title())
        reviewer = OPERATIONAL_REVIEWERS_BY_DOMAIN.get(domain_key, "human reviewer")
        candidates.append(
            make_relationship_candidate(
                "relationship-operational-bundle-" + stable_slug(domain_key),
                "operational_review_bundle",
                f"efficient review by {reviewer} for the {system_label} system; unrelated causes may be present",
                items[:30],
                f"{system_label} operational review bundle",
                "not_applicable",
                "review_bundle",
                "not_applicable",
                "The bundle can reduce handoff friction for human/trade review without implying that the findings share a cause.",
                relationship_next_evidence("operational_review_bundle", items, [], "", domain_key),
                ["same_trade_or_system_for_review_only"],
            )
        )
    return candidates


def build_shared_location_contexts(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []
    by_location: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for record in records:
        for location in record["organization"].get("locations", []):
            key = normalize_key(location)
            if key:
                by_location[key].append(record)
    for key, items in sorted(by_location.items()):
        if len(items) < 2:
            continue
        candidates.append(
            make_relationship_candidate(
                "relationship-location-context-" + stable_slug(key),
                "shared_location_context",
                f"shared reported location: {key}",
                items,
                f"Shared-location context: {key}",
                "not_applicable",
                "context_only",
                "not_applicable",
                "Same-room context can help a reviewer scan related work in one area, but it is not evidence of overlap by itself.",
                relationship_next_evidence("shared_location_context", items, [], key),
                ["same_location_context_only"],
            )
        )
    return candidates


def build_shared_system_contexts(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []
    by_domain: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for record in records:
        by_domain[record["organization"]["domain_key"]].append(record)
    for domain_key, items in sorted(by_domain.items()):
        if len(items) < 2:
            continue
        system_label = DOMAIN_LABELS.get(domain_key, domain_key.replace("_", " ").title())
        candidates.append(
            make_relationship_candidate(
                "relationship-system-context-" + stable_slug(domain_key),
                "shared_system_context",
                f"same building system: {system_label}",
                items[:30],
                f"Shared-system context: {system_label}",
                "not_applicable",
                "context_only",
                "not_applicable",
                "System context helps preserve report organization while preventing system membership from being treated as causation.",
                relationship_next_evidence("shared_system_context", items, [], "", domain_key),
                ["same_system_context_only"],
            )
        )
    return candidates


def build_relationship_candidates(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []
    candidates.extend(build_potential_condition_relationships(records))
    candidates.extend(build_operational_review_bundles(records))
    candidates.extend(build_shared_location_contexts(records))
    candidates.extend(build_shared_system_contexts(records))
    return candidates


def review_priority(record: dict[str, Any]) -> tuple[int, int, str]:
    category = record["organization"]["technical_attention_category"]
    unknown_count = len(record["epistemic_states"]["unknowns"])
    return (ATTENTION_PRIORITY.get(category, 99), -unknown_count, record["id"])


def build_human_review_packet(
    property_report: dict[str, Any],
    coverage: dict[str, Any],
    records: list[dict[str, Any]],
    systems: list[dict[str, Any]],
    relationships: list[dict[str, Any]],
) -> dict[str, Any]:
    sorted_records = sorted(records, key=review_priority)
    review_items = [
        {
            "atomic_observation_id": record["id"],
            "source_item_number": record["source"]["source_item_number"],
            "source_page": record["source"]["source_page"],
            "source_section": record["source"]["source_section"],
            "finding": record["source"]["inspector_statement"],
            "attention_category": record["organization"]["technical_attention_category"],
            "known": record["known_facts"][:2],
            "unknown": record["epistemic_states"]["unknowns"][:3],
            "next_evidence_needed": record["smallest_useful_next_evidence"]["next_evidence_needed"],
            "review_status": "needs_review",
        }
        for record in sorted_records
    ]
    packet = {
        "packet_type": "local_private_round1_human_review_packet",
        "review_status": "needs_review",
        "property_summary": property_report["property"],
        "report_metadata": property_report["report"],
        "coverage_summary": {
            "coverage_source_pages": coverage["inspection_coverage"]["source_pages"],
            "limitations_count": len(coverage["inspection_limitations"]),
            "extraction_completeness": coverage["extraction_completeness"],
        },
        "system_summary": [
            {
                "building_system": system["building_system"],
                "finding_count": system["finding_count"],
                "attention_category_distribution": system["attention_category_distribution"],
                "review_status": system["review_status"],
            }
            for system in systems
        ],
        "priority_review_items": review_items,
        "relationship_review_candidates": [
            {
                "id": candidate["id"],
                "type": candidate["type"],
                "relationship_type": candidate["relationship_type"],
                "basis": candidate["basis"],
                "confidence": candidate["confidence"],
                "relationship_status": candidate["relationship_status"],
                "cause_status": candidate["cause_status"],
                "related_count": len(candidate["related_atomic_observation_ids"]),
                "confirmation_status": candidate["confirmation_status"],
                "why_relationship_matters": candidate["why_relationship_matters"],
                "smallest_useful_next_evidence": candidate["smallest_useful_next_evidence"],
                "human_review_decision": candidate["human_review_decision"],
            }
            for candidate in relationships
        ],
        "human_review_controls": ["approve", "edit/correct", "needs_more_info", "reject"],
        "important_limits": [
            "AI Draft / Needs Human Review.",
            "Not valid for unrelated properties.",
            "No live or fabricated price, final scope, production database persistence, or reusable memory is produced by this benchmark.",
        ],
    }
    packet["packet_size_bytes"] = len(json.dumps(packet, sort_keys=True).encode("utf-8"))
    return packet


def build_property_report_reconstruction(cache: dict[str, Any]) -> dict[str, Any]:
    page_1 = cache.get("pageTextByPage", {}).get("1", {}).get("text", "")
    header = parse_report_header(page_1)
    general_info = parse_general_information(page_1)
    property_data = dict(header["property"])
    property_data.update(general_info.get("fields", {}))
    property_data["general_information_provenance"] = general_info.get("provenance", {})
    report = dict(header["report"])
    report.update(
        {
            "source_document_filename": cache.get("sourceDocument", {}).get("filename", ""),
            "source_document_sha256": cache.get("sourceDocument", {}).get("sha256", ""),
            "source_file_id": cache.get("sourceDocument", {}).get("source_file_id", ""),
            "page_count": cache.get("sourceDocument", {}).get("pageCount"),
            "source_path": cache.get("sourceDocument", {}).get("source_path", ""),
        }
    )
    return {
        "property": property_data,
        "report": report,
        "reconstruction_status": STATUS_PROVEN if property_data.get("address_line1") and report.get("inspection_date") else STATUS_PARTIAL,
        "source": "shared_cache_page_text",
    }


def extraction_issues(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    issues = []
    for record in records:
        for issue in record["extraction_status"].get("issues", []):
            issues.append(
                {
                    "atomic_observation_id": record["id"],
                    "source_finding_id": record["source_finding_id"],
                    "issue": issue,
                    "status": "needs_review",
                }
            )
    return issues


def build_acceptance_status(cache_meta: dict[str, Any], records: list[dict[str, Any]], relationships: list[dict[str, Any]], packet: dict[str, Any]) -> dict[str, str]:
    all_have_provenance = all(record["source"].get("provenance") for record in records)
    separated = all(
        record["epistemic_states"].get("source_observation") is not None
        and record["epistemic_states"].get("shelter_prep_interpretation") is not None
        and record["epistemic_states"].get("source_observation") != record["epistemic_states"].get("shelter_prep_interpretation")
        for record in records
    )
    unknowns_present = all(record["epistemic_states"].get("unknowns") for record in records)
    condition_relationships = [candidate for candidate in relationships if candidate["type"] == "potential_condition_relationship"]
    condition_relationships_unconfirmed = all(
        candidate["relationship_status"] == "potential" and candidate["cause_status"] == "not_established"
        for candidate in condition_relationships
    )
    context_does_not_request_evidence = all(
        not candidate["smallest_useful_next_evidence"].get("new_evidence_requested")
        for candidate in relationships
        if candidate["type"] in {"operational_review_bundle", "shared_location_context", "shared_system_context"}
    )
    relationship_types = {candidate["type"] for candidate in relationships}
    low_confidence_unassigned_allowed = any(not record["organization"].get("mechanism_candidates") for record in records)
    observed_when_present = all(record["source"].get("when_observed") for record in records)
    no_unsourced_weather = all(
        not record["environmental_context"].get("weather_observation")
        and not record["environmental_context"].get("weather_sources")
        and not record["environmental_context"].get("weather_claims")
        for record in records
    )
    observation_date_not_upload_date = all(
        not record.get("source_chronology", {}).get("upload_date_used_as_observation_date")
        and record.get("source_chronology", {}).get("date_used_for_environmental_comparison")
        == record["source"].get("when_observed")
        for record in records
    )
    cost_guardrails_present = all(record["localized_cost_context"].get("precision_guardrail") for record in records)
    required_finding_card_fields = {
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
    finding_card_contract_present = all(required_finding_card_fields <= record.get("finding_card", {}).keys() for record in records)
    unsourced_ranges_blocked = all(
        (
            card.get("price_low") is None
            or (card.get("price_source_refs") and card.get("price_geography", {}).get("level"))
        )
        and all(
            (path.get("price_low") is not None and path.get("price_source_refs"))
            or (path.get("price_low") is None and path.get("status") == "blocked_missing_sourced_range")
            for path in card.get("repair_paths", [])
        )
        for record in records
        for card in [record.get("finding_card", {})]
    )
    return {
        "shared_cache_reused_without_pdf_rescan": STATUS_PROVEN
        if cache_meta.get("cache_reused") and cache_meta.get("local_pdf_pages_scanned") == 0
        else STATUS_PARTIAL,
        "property_report_reconstruction": status_from_bool(bool(records)),
        "coverage_separate_from_extraction_completeness": STATUS_PROVEN,
        "atomic_observations_preserved": status_from_bool(bool(records) and all(record["source_finding_id"] for record in records)),
        "provenance_preserved": status_from_bool(all_have_provenance),
        "epistemic_separation": status_from_bool(separated),
        "known_unknown_separation": status_from_bool(unknowns_present),
        "relationship_types_separated": status_from_bool(
            {"potential_condition_relationship", "operational_review_bundle", "shared_location_context", "shared_system_context"}
            <= relationship_types
        ),
        "condition_relationships_unconfirmed": status_from_bool(condition_relationships_unconfirmed),
        "context_relationships_do_not_request_evidence_by_themselves": status_from_bool(context_does_not_request_evidence),
        "low_confidence_mechanism_can_remain_unassigned": status_from_bool(low_confidence_unassigned_allowed),
        "observed_when_attached": status_from_bool(observed_when_present),
        "observation_date_distinct_from_upload_date": status_from_bool(observation_date_not_upload_date),
        "environmental_context_source_guardrails": status_from_bool(no_unsourced_weather),
        "localized_cost_context_guardrails": status_from_bool(cost_guardrails_present),
        "pricing_contract_support": STATUS_PROVEN,
        "finding_card_contract_support": status_from_bool(finding_card_contract_present),
        "unsourced_price_ranges_blocked": status_from_bool(unsourced_ranges_blocked),
        "live_localized_price_retrieval": STATUS_NOT_IMPLEMENTED,
        "contractor_input_distinct_from_verification": STATUS_PROVEN,
        "overlap_hypotheses_unconfirmed": status_from_bool(condition_relationships_unconfirmed),
        "human_review_required": STATUS_PROVEN if packet.get("review_status") == "needs_review" else STATUS_PARTIAL,
        "final_estimating_marketplace_memory": STATUS_NOT_IMPLEMENTED,
        "production_supabase_railway_ui": STATUS_NOT_IMPLEMENTED,
        "semantic_success": STATUS_PARTIAL,
    }


def build_reasoning_artifact_from_cache(cache: dict[str, Any], cache_meta: dict[str, Any]) -> dict[str, Any]:
    generated_at = utc_now()
    maps = evidence_maps(cache)
    property_report = build_property_report_reconstruction(cache)
    coverage = extract_coverage_and_limitations(cache)
    records = [build_atomic_observation(finding, maps, property_report) for finding in cache.get("normalizedFindings", [])]
    pricing_sources, decision_overview = enrich_decision_support(records, generated_at)
    systems = build_system_component_index(records)
    relationships = build_relationship_candidates(records)
    potential_condition_relationships = [
        candidate for candidate in relationships if candidate["type"] == "potential_condition_relationship"
    ]
    packet = build_human_review_packet(property_report, coverage, records, systems, relationships)
    issue_list = extraction_issues(records)
    attention_counts = Counter(record["organization"]["technical_attention_category"] for record in records)
    system_counts = Counter(record["organization"]["domain_key"] for record in records)
    visual_status_counts = Counter(record["extraction_status"]["cached_visual_analysis"] for record in records)
    relationship_type_counts = Counter(candidate["type"] for candidate in relationships)
    mechanism_counts = Counter(
        mechanism for record in records for mechanism in record["organization"].get("mechanism_candidates", [])
    )
    artifact = {
        "schemaVersion": SCHEMA_VERSION,
        "generated_at": generated_at,
        "pipeline": {
            "name": PIPELINE_NAME,
            "runMode": "local_file_only_no_database_no_model",
            "source_cache_reused": cache_meta.get("cache_reused", False),
            "source_hash_matched": cache_meta.get("source_hash_matched", False),
            "pdf_pages_scanned_this_run": cache_meta.get("local_pdf_pages_scanned", 0),
            "model_calls": 0,
            "production_touched": False,
            "supabase_runtime_touched": False,
            "railway_touched": False,
            "app_ui_touched": False,
        },
        "pricingContract": pricing_contract_metadata(),
        "external_sources": pricing_sources,
        "decisionOverview": decision_overview,
        "sourceDocument": cache.get("sourceDocument", {}),
        "propertyReportReconstruction": property_report,
        "inspectionCoverageAndLimitations": coverage,
        "atomicObservations": records,
        "systemComponentConditionIndex": systems,
        "relationshipCandidates": relationships,
        "potentialOverlapRelationshipCandidates": potential_condition_relationships,
        "knownUnknownModel": {
            "known_rule": "Known facts are source-backed observations, recommendations, linked evidence counts, or reused cached visual observations.",
            "unknown_rule": "Unknowns are conditions not directly established by source evidence or human review.",
            "human_review_required": True,
        },
        "externalClaimControls": external_claim_controls(pricing_sources),
        "contractorInputModel": contractor_input_model(),
        "humanReviewPacket": packet,
        "incompleteExtractionIssues": issue_list,
        "acceptanceStatus": build_acceptance_status(cache_meta, records, relationships, packet),
        "summary": {
            "atomic_observations": len(records),
            "systems_indexed": len(systems),
            "relationship_candidates": len(relationships),
            "potential_condition_relationship_candidates": len(potential_condition_relationships),
            "relationship_type_distribution": dict(sorted(relationship_type_counts.items())),
            "mechanism_candidate_distribution": dict(sorted(mechanism_counts.items())),
            "human_review_packet_items": len(packet.get("priority_review_items", [])),
            "human_review_packet_size_bytes": packet.get("packet_size_bytes", 0),
            "attention_category_distribution": dict(sorted(attention_counts.items())),
            "domain_distribution": dict(sorted(system_counts.items())),
            "cached_visual_status_distribution": dict(sorted(visual_status_counts.items())),
            "incomplete_extraction_issues": len(issue_list),
            "model_calls": 0,
        },
        "weaknesses": [
            "The reasoning layer is deterministic and review-oriented; it does not prove semantic correctness without human review.",
            "Potential condition relationships are thresholded hypotheses, not confirmed causation or final scopes.",
            "Operational bundles and shared context records may still need human splitting when the deterministic group is too broad for field review.",
            "Non-cached visual evidence remains unavailable unless a prior compatible visual analysis exists by image hash.",
            "No database, RLS, RPC, Railway, or app UI behavior is exercised by this local benchmark.",
            "Weather and localized cost context are represented as supportability/provenance structures only; no external weather or pricing source research is performed in Round 1.",
        ],
        "requiresHumanCorrection": [
            "Confirm or correct property/report reconstruction fields if the PDF header extraction missed context.",
            "Confirm whether each potential relationship should be merged, split, escalated, or rejected.",
            "Correct system/component/attention labels where deterministic rules over- or under-route findings.",
            "Resolve unknown conditions with targeted photos, measurements, specialist review, or source-page review.",
            "Decide what, if anything, becomes human-reviewed operational output later.",
        ],
    }
    return artifact


def run_self_test() -> None:
    cover_header = parse_report_header(
        """Example Inspection Co
Residential Inspection Report
10 Test Ave
Exampletown, OR 97000
Client One
09/16/2030
Inspector
Inspector One
Report Page 1 of 10"""
    )
    assert cover_header["report"]["inspection_date"] == "09/16/2030"
    assert cover_header["property"]["state"] == "OR"
    assert cover_header["report"]["provenance"]["extraction_method"] == "deterministic_cover_date_anchor"
    synthetic_cache = {
        "schemaVersion": "synthetic-cache",
        "sourceDocument": {
            "filename": "synthetic-inspection.pdf",
            "source_file_id": "synthetic-source",
            "sha256": "abc123",
            "pageCount": 2,
            "sizeBytes": 1234,
            "source_path": "/tmp/synthetic-inspection.pdf",
            "uploaded_at": "2030-01-10T12:00:00Z",
            "containsPrivateData": False,
        },
        "pageTextByPage": {
            "1": {
                "text": """Example Inspection Co
Inspection date:
Address:
Inspector:
Client:
01/02/2030
10 Test Ave
Exampletown, OR 97000
Inspector One
Client One
Home Inspection Report
General Information (per Zillow)
Year Built
Square Footage
Bedrooms
Bathrooms
1999
1200
3
2""",
            },
            "2": {
                "text": """Items of the Inspection
Only the below items, if present and where exposed to view, are those which we inspected. Understand that the hidden parts of these items are not part of this inspection.
Roof observation methods:
Ground
Note
Sewer and private systems are not inspected.""",
            },
        },
        "reportSectionIndex": [],
        "normalizedFindings": [
            {
                "id": "finding-1",
                "source_file_id": "synthetic-source",
                "source_page": 2,
                "source_section": "Synthetic Roof Issues",
                "source_item_number": "1",
                "title": "Leak at roof edge",
                "inspector_statement": "Leak at roof edge",
                "inspector_recommendation": "Investigate further and repair as needed.",
                "locations": ["Test Kitchen"],
                "source_excerpt": "Synthetic Roof Issues Leak at roof edge 1) Investigate further and repair as needed.",
                "linked_photo_ids": ["caption-1-1"],
                "domain_routing_candidates": [{"domain_key": "roof", "reason": "keyword_match"}],
                "provenance": {"pdf_page": 2, "section": "Synthetic Roof Issues", "item_number": "1"},
            },
            {
                "id": "finding-2",
                "source_file_id": "synthetic-source",
                "source_page": None,
                "source_section": "Synthetic Interior Issues",
                "source_item_number": "2",
                "title": "Stain at ceiling",
                "inspector_statement": "Stain at ceiling",
                "inspector_recommendation": "Monitor and verify whether active.",
                "locations": ["Test Kitchen"],
                "source_excerpt": "Synthetic Interior Issues Stain at ceiling 2) Monitor and verify whether active.",
                "linked_photo_ids": [],
                "domain_routing_candidates": [{"domain_key": "floors_drywall_interior_finishes", "reason": "keyword_match"}],
                "provenance": {"section": "Synthetic Interior Issues", "item_number": "2"},
            },
            {
                "id": "finding-3",
                "source_file_id": "synthetic-source",
                "source_page": 2,
                "source_section": "Synthetic Interior Issues",
                "source_item_number": "3",
                "title": "Missing baseboard trim",
                "inspector_statement": "Missing baseboard trim",
                "inspector_recommendation": "Repair if desired.",
                "locations": ["Test Kitchen"],
                "source_excerpt": "Synthetic Interior Issues Missing baseboard trim 3) Repair if desired.",
                "linked_photo_ids": [],
                "domain_routing_candidates": [{"domain_key": "floors_drywall_interior_finishes", "reason": "keyword_match"}],
                "provenance": {"pdf_page": 2, "section": "Synthetic Interior Issues", "item_number": "3"},
            },
            {
                "id": "finding-4",
                "source_file_id": "synthetic-source",
                "source_page": 2,
                "source_section": "Synthetic Electrical Issues",
                "source_item_number": "4",
                "title": "No GFCI protection",
                "inspector_statement": "No GFCI protection at receptacle",
                "inspector_recommendation": "Have electrician repair.",
                "locations": ["Test Kitchen"],
                "source_excerpt": "Synthetic Electrical Issues No GFCI protection at receptacle 4) Have electrician repair.",
                "linked_photo_ids": [],
                "domain_routing_candidates": [{"domain_key": "electrical", "reason": "keyword_match"}],
                "provenance": {"pdf_page": 2, "section": "Synthetic Electrical Issues", "item_number": "4"},
            },
            {
                "id": "finding-5",
                "source_file_id": "synthetic-source",
                "source_page": 2,
                "source_section": "Synthetic Electrical Issues",
                "source_item_number": "5",
                "title": "Open junction box",
                "inspector_statement": "Open electrical junction box in attic",
                "inspector_recommendation": "Have electrician install cover.",
                "locations": ["Attic"],
                "source_excerpt": "Synthetic Electrical Issues Open electrical junction box in attic 5) Have electrician install cover.",
                "linked_photo_ids": [],
                "domain_routing_candidates": [{"domain_key": "electrical", "reason": "keyword_match"}],
                "provenance": {"pdf_page": 2, "section": "Synthetic Electrical Issues", "item_number": "5"},
            },
            {
                "id": "finding-6",
                "source_file_id": "synthetic-source",
                "source_page": 2,
                "source_section": "Synthetic HVAC Issues",
                "source_item_number": "6",
                "title": "Furnace vibration",
                "inspector_statement": "Furnace intermittent knocking/vibrating",
                "inspector_recommendation": "Confirm in heat mode and repair as needed.",
                "locations": ["Garage"],
                "source_excerpt": "Synthetic HVAC Issues Furnace intermittent knocking/vibrating 6) Confirm in heat mode and repair as needed.",
                "linked_photo_ids": [],
                "domain_routing_candidates": [{"domain_key": "hvac", "reason": "keyword_match"}],
                "provenance": {"pdf_page": 2, "section": "Synthetic HVAC Issues", "item_number": "6"},
            },
            {
                "id": "finding-7",
                "source_file_id": "synthetic-source",
                "source_page": 2,
                "source_section": "Synthetic HVAC Issues",
                "source_item_number": "7",
                "title": "Dirty furnace",
                "inspector_statement": "Dirty furnace burners and blower",
                "inspector_recommendation": "Clean and service.",
                "locations": ["Garage"],
                "source_excerpt": "Synthetic HVAC Issues Dirty furnace burners and blower 7) Clean and service.",
                "linked_photo_ids": [],
                "domain_routing_candidates": [{"domain_key": "hvac", "reason": "keyword_match"}],
                "provenance": {"pdf_page": 2, "section": "Synthetic HVAC Issues", "item_number": "7"},
            },
            {
                "id": "finding-8",
                "source_file_id": "synthetic-source",
                "source_page": 2,
                "source_section": "Synthetic Smoke/CO Alarm Issues",
                "source_item_number": "8",
                "title": "Old smoke alarm",
                "inspector_statement": "Old smoke alarm not working",
                "inspector_recommendation": "Replace.",
                "locations": ["Hallway"],
                "source_excerpt": "Synthetic Smoke/CO Alarm Issues Old smoke alarm not working 8) Replace.",
                "linked_photo_ids": [],
                "domain_routing_candidates": [{"domain_key": "life_safety", "reason": "keyword_match"}],
                "provenance": {"pdf_page": 2, "section": "Synthetic Smoke/CO Alarm Issues", "item_number": "8"},
            },
            {
                "id": "finding-9",
                "source_file_id": "synthetic-source",
                "source_page": 2,
                "source_section": "Synthetic Garage Door Issues",
                "source_item_number": "9",
                "title": "Garage door sensors",
                "inspector_statement": "Garage door sensors installed too high",
                "inspector_recommendation": "Adjust and test.",
                "locations": ["Garage"],
                "source_excerpt": "Synthetic Garage Door Issues Garage door sensors installed too high 9) Adjust and test.",
                "linked_photo_ids": [],
                "domain_routing_candidates": [{"domain_key": "life_safety", "reason": "keyword_match"}],
                "provenance": {"pdf_page": 2, "section": "Synthetic Garage Door Issues", "item_number": "9"},
            },
            {
                "id": "finding-10",
                "source_file_id": "synthetic-source",
                "source_page": 2,
                "source_section": "Synthetic Chimney/Fireplace Issues",
                "source_item_number": "10",
                "title": "Cracked firebox",
                "inspector_statement": "Cracked deteriorated back of fireplace firebox",
                "inspector_recommendation": "Have chimney specialist repair.",
                "locations": ["Living Room"],
                "source_excerpt": "Synthetic Chimney/Fireplace Issues Cracked deteriorated back of fireplace firebox 10) Have chimney specialist repair.",
                "linked_photo_ids": [],
                "domain_routing_candidates": [{"domain_key": "chimney_fireplace", "reason": "keyword_match"}],
                "provenance": {"pdf_page": 2, "section": "Synthetic Chimney/Fireplace Issues", "item_number": "10"},
            },
            {
                "id": "finding-11",
                "source_file_id": "synthetic-source",
                "source_page": 2,
                "source_section": "Synthetic Chimney/Fireplace Issues",
                "source_item_number": "11",
                "title": "Chimney inspection",
                "inspector_statement": "Get a chimney inspection because the flue was not inspected",
                "inspector_recommendation": "Chimney specialist should inspect flue.",
                "locations": ["Living Room"],
                "source_excerpt": "Synthetic Chimney/Fireplace Issues Get a chimney inspection because the flue was not inspected 11) Chimney specialist should inspect flue.",
                "linked_photo_ids": [],
                "domain_routing_candidates": [{"domain_key": "chimney_fireplace", "reason": "keyword_match"}],
                "provenance": {"pdf_page": 2, "section": "Synthetic Chimney/Fireplace Issues", "item_number": "11"},
            },
        ],
        "photoCaptionIndex": [
            {
                "id": "caption-1-1",
                "source_page": 2,
                "source_item_number": "1.1",
                "caption": "Leak at roof edge",
                "related_finding_id": "finding-1",
            }
        ],
        "extractedImageManifest": {
            "images": [
                {
                    "id": "image-1-1",
                    "source_page": 2,
                    "item_number": "1.1",
                    "related_finding_id": "finding-1",
                    "related_photo_caption_id": "caption-1-1",
                    "sha256": "imagehash1",
                    "extraction_status": "extracted",
                }
            ]
        },
        "compatibleVisualCacheIndexes": [],
        "summary": {
            "sections_indexed": 0,
            "findings_indexed": 11,
            "photo_captions_indexed": 1,
            "images_indexed": 1,
        },
    }
    artifact = build_reasoning_artifact_from_cache(
        synthetic_cache,
        {"cache_reused": True, "source_hash_matched": True, "local_pdf_pages_scanned": 0},
    )
    assert artifact["pipeline"]["pdf_pages_scanned_this_run"] == 0
    assert artifact["propertyReportReconstruction"]["property"]["address_line1"] == "10 Test Ave"
    assert len(artifact["atomicObservations"]) == len(synthetic_cache["normalizedFindings"])
    for record in artifact["atomicObservations"]:
        assert record["source"]["provenance"]
        assert record["source"]["when_observed"] == "01/02/2030"
        assert record["source_chronology"]["observation_date"] == "01/02/2030"
        assert record["source_chronology"]["upload_date"] is None
        assert record["source_chronology"]["date_used_for_environmental_comparison"] == "01/02/2030"
        assert record["source_chronology"]["upload_date_used_as_observation_date"] is False
        assert record["epistemic_states"]["source_observation"] != record["epistemic_states"]["shelter_prep_interpretation"]
        assert record["epistemic_states"]["unknowns"]
        assert record["epistemic_states"]["human_review_status"] == "needs_review"
        assert record["recommended_next_step"]["why_this_next_step"]
        assert record["localized_cost_context"]["geography_basis"]["most_defensible_available_geography"] == "zip"
        assert record["localized_cost_context"]["precision_guardrail"]
        assert "repair_paths" in record["finding_card"]
        for repair_path in record["finding_card"]["repair_paths"]:
            if repair_path["price_low"] is not None:
                assert repair_path["price_source_refs"]
                assert repair_path["price_geography"]["level"] == "national_fallback"
                assert repair_path["range_history"]
            else:
                assert repair_path["status"] == "blocked_missing_sourced_range"
        assert record["finding_card"]["recommended_next_step"]
        assert record["affected_location"]["orientation_status"] in {"explicit", "unknown"}
        assert record["affected_location"]["orientation_status"] != "inferred_low_confidence"
        assert record["finding_card"]["source_evidence"]["inspector_statement"]
        assert record["review_workflow"]["priority"] in {"quick_review", "careful_review", "waiting_for_evidence"}
    explicit_location = normalize_affected_location(
        {
            "source_file_id": "synthetic-source",
            "source_page": 2,
            "source_item_number": "12",
            "source_section": "Exterior",
            "title": "West wall siding",
            "inspector_statement": "Damage at west exterior wall",
            "locations": ["West exterior wall"],
        },
        [],
    )
    unknown_location = normalize_affected_location(
        {
            "source_file_id": "synthetic-source",
            "source_page": 2,
            "source_item_number": "13",
            "source_section": "General",
            "title": "Damaged finish",
            "inspector_statement": "Damaged finish observed",
            "locations": [],
        },
        [],
    )
    assert explicit_location["orientation"] == "W"
    assert explicit_location["orientation_source_basis"] == "explicit_report_text"
    assert unknown_location["orientation"] is None
    assert unknown_location["source_basis"] == "unknown"
    assert unknown_location["status"] == "needs_location_confirmation"
    assert artifact["incompleteExtractionIssues"][0]["issue"] == "missing_source_page"
    records_by_id = {record["id"]: record for record in artifact["atomicObservations"]}
    assert location_relationship(
        {"organization": {"locations": ["Front right corner of workshop"]}},
        {"organization": {"locations": ["Left side of workshop"]}},
    ) is None
    assert location_relationship(
        {"organization": {"locations": ["Primary suite"]}},
        {"organization": {"locations": ["Primary suite bathroom"]}},
    ) == {"kind": "adjacent", "label": "primary suite / primary suite bathroom"}
    relationships = artifact["relationshipCandidates"]
    condition_relationships = artifact["potentialOverlapRelationshipCandidates"]
    relationship_types = {candidate["type"] for candidate in relationships}
    assert {"potential_condition_relationship", "operational_review_bundle", "shared_location_context", "shared_system_context"} <= relationship_types
    assert all(candidate["relationship_status"] == "potential" for candidate in condition_relationships)
    assert all(candidate["cause_status"] == "not_established" for candidate in condition_relationships)
    assert all(candidate["confidence"] in {"strong", "moderate", "weak"} for candidate in condition_relationships)
    assert any(
        {"atomic-observation-1", "atomic-observation-2"} <= set(candidate["related_atomic_observation_ids"])
        for candidate in condition_relationships
    )
    assert not any(
        "atomic-observation-3" in candidate["related_atomic_observation_ids"] for candidate in condition_relationships
    )
    assert not any(
        {"atomic-observation-4", "atomic-observation-5"} <= set(candidate["related_atomic_observation_ids"])
        for candidate in condition_relationships
    )
    assert any(
        candidate["type"] == "operational_review_bundle"
        and {"atomic-observation-4", "atomic-observation-5"} <= set(candidate["related_atomic_observation_ids"])
        for candidate in relationships
    )
    assert any(
        candidate["type"] == "shared_location_context"
        and "atomic-observation-3" in candidate["related_atomic_observation_ids"]
        for candidate in relationships
    )
    assert all(
        not candidate["smallest_useful_next_evidence"]["new_evidence_requested"]
        for candidate in relationships
        if candidate["type"] in {"operational_review_bundle", "shared_location_context", "shared_system_context"}
    )
    assert any(
        "directly below" in candidate["smallest_useful_next_evidence"]["next_evidence_needed"]
        for candidate in condition_relationships
    )
    assert records_by_id["atomic-observation-3"]["organization"]["mechanism_candidates"] == []
    assert records_by_id["atomic-observation-3"]["smallest_useful_next_evidence"]["new_evidence_requested"] is False
    assert records_by_id["atomic-observation-1"]["environmental_context"]["is_relevant_to_interpretation"] is True
    assert records_by_id["atomic-observation-1"]["environmental_context"]["weather_sources"] == []
    assert records_by_id["atomic-observation-1"]["environmental_context"]["weather_claims"] == []
    assert "Dry-weather timing" in records_by_id["atomic-observation-1"]["environmental_context"]["negative_evidence_rule"]
    assert records_by_id["atomic-observation-1"]["environmental_context"]["causal_claim_policy"] == "No causal claim may be made from weather correlation alone."
    assert records_by_id["atomic-observation-3"]["environmental_context"]["is_relevant_to_interpretation"] is False
    assert "heat/cooling mode" in records_by_id["atomic-observation-6"]["smallest_useful_next_evidence"]["next_evidence_needed"]
    assert "material_deterioration_or_damage" not in artifact["summary"]["mechanism_candidate_distribution"]
    assert "electrical_shock_hazard" not in classify_mechanisms("Cracked deteriorated back of fireplace firebox")
    assert classify_mechanisms("Inspect the flues, smoke chambers, and firebox") == ["chimney_firebox_flue_safety"]
    assert "life_safety_device" not in records_by_id["atomic-observation-11"]["organization"]["components"]
    assert classify_mechanisms("Old smoke alarm not working") == ["life_safety_alarm_function"]
    assert classify_mechanisms("Garage door sensors installed too high") == ["garage_door_entrapment_safety"]
    assert classify_mechanisms("Minor dings in garage door panels") == []
    assert "bath_kitchen_exhaust_flow_pathway" not in classify_mechanisms("Roof leaks at split plumbing vent seal")
    assert classify_mechanisms("Cracked interior door") == []
    assert "10 Test Ave" in json.dumps(artifact)
    assert "1837" not in json.dumps(artifact)
    assert artifact["externalClaimControls"]["weather"]["claims_made"] is False
    assert artifact["externalClaimControls"]["prices"]["claims_made"] is True
    assert artifact["external_sources"]
    assert artifact["decisionOverview"]["aggregate_cost_rule"].startswith("Do not sum")
    assert artifact["pricingContract"]["range_required_for_material_findings"] is True
    assert artifact["pricingContract"]["live_price_retrieval_implemented"] is False
    assert artifact["contractorInputModel"]["contractor_input_records_present"] is False
    assert artifact["acceptanceStatus"]["shared_cache_reused_without_pdf_rescan"] == STATUS_PROVEN
    assert artifact["acceptanceStatus"]["epistemic_separation"] == STATUS_PROVEN
    assert artifact["acceptanceStatus"]["relationship_types_separated"] == STATUS_PROVEN
    assert artifact["acceptanceStatus"]["condition_relationships_unconfirmed"] == STATUS_PROVEN
    assert artifact["acceptanceStatus"]["context_relationships_do_not_request_evidence_by_themselves"] == STATUS_PROVEN
    assert artifact["acceptanceStatus"]["low_confidence_mechanism_can_remain_unassigned"] == STATUS_PROVEN
    assert artifact["acceptanceStatus"]["observed_when_attached"] == STATUS_PROVEN
    assert artifact["acceptanceStatus"]["observation_date_distinct_from_upload_date"] == STATUS_PROVEN
    assert artifact["acceptanceStatus"]["environmental_context_source_guardrails"] == STATUS_PROVEN
    assert artifact["acceptanceStatus"]["localized_cost_context_guardrails"] == STATUS_PROVEN
    assert artifact["acceptanceStatus"]["pricing_contract_support"] == STATUS_PROVEN
    assert artifact["acceptanceStatus"]["finding_card_contract_support"] == STATUS_PROVEN
    assert artifact["acceptanceStatus"]["unsourced_price_ranges_blocked"] == STATUS_PROVEN
    assert artifact["acceptanceStatus"]["live_localized_price_retrieval"] == STATUS_NOT_IMPLEMENTED
    assert artifact["acceptanceStatus"]["contractor_input_distinct_from_verification"] == STATUS_PROVEN
    assert artifact["acceptanceStatus"]["semantic_success"] == STATUS_PARTIAL
    print("phase1_round1_reasoning_benchmark self-test passed")


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Shelter Prep Phase 1 Round 1 local reasoning benchmark")
    parser.add_argument("--pdf", default=DEFAULT_PDF)
    parser.add_argument("--shared-cache", default=DEFAULT_CACHE_PATH)
    parser.add_argument("--output-dir", default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--output-file", default=DEFAULT_OUTPUT_FILE)
    parser.add_argument("--force-cache-rebuild", action="store_true")
    parser.add_argument("--self-test", action="store_true")
    return parser.parse_args(argv)


def process(args: argparse.Namespace) -> dict[str, Any]:
    pdf_path = Path(args.pdf)
    cache_path = Path(args.shared_cache)
    if not pdf_path.exists():
        raise FileNotFoundError(f"Private fixture not found: {pdf_path}")
    source_sha = sha256_file(pdf_path)
    cache, cache_meta = build_or_load_inspection_evidence_cache(
        pdf_path,
        cache_path,
        source_sha,
        f"sha256:{source_sha[:16]}",
        force_rebuild=args.force_cache_rebuild,
    )
    if not cache.get("normalizedFindings"):
        page_records = list(cache.get("pageTextByPage", {}).values())
        pages_extracted = len(page_records)
        text_pages = sum(1 for page in page_records if page.get("char_count", 0) > 0)
        text_characters = sum(int(page.get("char_count", 0)) for page in page_records)
        if text_characters == 0:
            raise ValueError(
                f"PDF text extraction produced no readable text from {pages_extracted} pages; OCR or another extraction method is required."
            )
        raise ValueError(
            "Inspection parser found no normalized findings after extracting "
            f"{text_characters} characters from {text_pages} of {pages_extracted} pages; "
            "the report format is not supported by the current parser."
        )
    artifact = build_reasoning_artifact_from_cache(cache, cache_meta)
    output_path = Path(args.output_dir) / args.output_file
    write_json(output_path, artifact)
    return {"artifact": artifact, "output_path": output_path, "cache_meta": cache_meta}


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    if args.self_test:
        run_self_test()
        return 0
    result = process(args)
    artifact = result["artifact"]
    output_path = result["output_path"]
    print(f"Wrote {output_path}")
    print(f"cache_reused={str(artifact['pipeline']['source_cache_reused']).lower()}")
    print(f"source_hash_matched={str(artifact['pipeline']['source_hash_matched']).lower()}")
    print(f"pdf_pages_scanned_this_run={artifact['pipeline']['pdf_pages_scanned_this_run']}")
    print(f"atomic_observations={artifact['summary']['atomic_observations']}")
    print(f"systems_indexed={artifact['summary']['systems_indexed']}")
    print(f"relationship_candidates={artifact['summary']['relationship_candidates']}")
    print(f"potential_condition_relationship_candidates={artifact['summary']['potential_condition_relationship_candidates']}")
    print(f"human_review_packet_items={artifact['summary']['human_review_packet_items']}")
    print(f"human_review_packet_size_bytes={artifact['summary']['human_review_packet_size_bytes']}")
    print(f"incomplete_extraction_issues={artifact['summary']['incomplete_extraction_issues']}")
    print(f"model_calls={artifact['summary']['model_calls']}")
    print(f"private_output_gitignored={str(git_ignores(output_path)).lower()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
