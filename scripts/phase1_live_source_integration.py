#!/usr/bin/env python3
"""Phase 1 pricing/weather source ingestion and persistence contracts."""

from __future__ import annotations

import argparse
import hashlib
import json
import tempfile
from abc import ABC, abstractmethod
from datetime import datetime, timedelta, timezone
from pathlib import Path
from statistics import mean
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from phase1_pricing_contract import (
    GEOGRAPHY_LEVELS,
    PRICE_SOURCE_CLASSES,
    build_priced_finding_card,
    create_price_revision,
    geography_rank,
)


SCHEMA_VERSION = "shelter-prep-phase1-live-source-integration.v1"
OPEN_METEO_ARCHIVE_ENDPOINT = "https://archive-api.open-meteo.com/v1/archive"
OPEN_METEO_DOCUMENTATION = "https://open-meteo.com/en/docs/historical-weather-api"
WEATHER_VARIABLES = [
    "precipitation",
    "temperature_2m",
    "relative_humidity_2m",
    "dew_point_2m",
    "wind_speed_10m",
    "wind_direction_10m",
    "snowfall",
]
SOURCE_REVIEW_STATUSES = {"external_source_retrieved", "ai_draft", "needs_human_review", "rejected"}
UNTRUSTED_ACTORS = {"ai", "browser", "system"}
VERIFIED_STATUSES = {"human_verified", "contractor_verified"}

PRICE_SOURCE_ALIASES = {
    "property_specific_contractor_quote": "contractor_quote",
    "property_specific_contractor_input": "contractor_input",
    "verified_completed_job": "human_verified_completed_job",
    "local_supplier": "local_supplier_material",
    "local_material": "local_supplier_material",
    "public_labor": "government_public_labor",
    "local_benchmark": "reputable_local_benchmark",
    "city_benchmark": "reputable_local_benchmark",
    "metro_benchmark": "reputable_local_benchmark",
}

SOURCE_AUTHORITY = {
    "contractor_quote": "property_specific_professional_input",
    "contractor_input": "property_specific_professional_input",
    "human_verified_completed_job": "human_verified_shelter_prep_outcome",
    "local_supplier_material": "primary_local_material_source",
    "manufacturer_price": "primary_manufacturer_source",
    "government_public_labor": "official_public_data",
    "permit_valuation": "official_public_data",
    "reputable_local_benchmark": "local_market_reference",
    "regional_benchmark": "regional_benchmark",
    "national_fallback": "general_national_fallback",
}


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def parse_timestamp(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("timestamp must include a UTC offset")
    return parsed.astimezone(timezone.utc)


def stable_id(prefix: str, payload: Any) -> str:
    digest = hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()).hexdigest()[:20]
    return f"{prefix}-{digest}"


def validate_review_authority(review_status: str, actor_type: str) -> list[str]:
    if review_status in VERIFIED_STATUSES and actor_type in UNTRUSTED_ACTORS:
        return ["AI, browser, and system paths cannot mark sourced evidence verified"]
    return []


def normalize_pricing_source(raw: dict[str, Any], *, actor_type: str = "system") -> dict[str, Any]:
    source_type = PRICE_SOURCE_ALIASES.get(raw.get("source_type", ""), raw.get("source_type", ""))
    reference = raw.get("source_url") or raw.get("internal_reference")
    source_geography = raw.get("source_geography", {})
    low = raw.get("low_value")
    high = raw.get("high_value")
    point = raw.get("point_value")
    review_status = raw.get("review_status", "external_source_retrieved")
    field_conditions = raw.get("field_conditions", {"known": {}, "unknown": []})

    errors: list[str] = []
    for field in ["source_id", "source_name", "retrieved_at", "repair_category", "trade", "units_or_basis"]:
        if not raw.get(field):
            errors.append(f"{field} is required")
    if source_type not in PRICE_SOURCE_CLASSES:
        errors.append("source_type is unsupported")
    if not reference:
        errors.append("source_url or internal_reference is required")
    if source_geography.get("level") not in GEOGRAPHY_LEVELS or not source_geography.get("label"):
        errors.append("source_geography level and label are required")
    match_level = raw.get("geographic_match_level")
    if match_level not in GEOGRAPHY_LEVELS:
        errors.append("geographic_match_level is required")
    elif source_geography.get("level") in GEOGRAPHY_LEVELS and geography_rank(match_level) < geography_rank(source_geography["level"]):
        errors.append("geographic match cannot be more precise than source geography")
    if low is None and high is None and point is None:
        errors.append("at least one supplied price value is required")
    if (low is None) != (high is None):
        errors.append("low_value and high_value must be supplied together")
    if low is not None and (not isinstance(low, (int, float)) or not isinstance(high, (int, float)) or low <= 0 or low >= high):
        errors.append("low_value and high_value must form a positive range")
    if point is not None and (not isinstance(point, (int, float)) or point <= 0):
        errors.append("point_value must be positive")
    if review_status not in SOURCE_REVIEW_STATUSES and review_status not in VERIFIED_STATUSES:
        errors.append("review_status is unsupported")
    errors.extend(validate_review_authority(review_status, actor_type))
    if not isinstance(field_conditions.get("known"), dict) or not isinstance(field_conditions.get("unknown"), list):
        errors.append("field_conditions must preserve known values and unknown names separately")
    if errors:
        raise ValueError("; ".join(errors))

    normalized = {
        "schema_version": SCHEMA_VERSION,
        "record_type": "pricing_source_evidence",
        "source_id": raw["source_id"],
        "id": raw["source_id"],
        "source_name": raw["source_name"],
        "source_type": source_type,
        "source_class": source_type,
        "source_authority": SOURCE_AUTHORITY[source_type],
        "source_url": raw.get("source_url"),
        "internal_reference": raw.get("internal_reference"),
        "source_reference": reference,
        "retrieved_at": raw["retrieved_at"],
        "published_at": raw.get("published_at"),
        "property_geography": {
            "zip": raw.get("property_zip"),
            "city": raw.get("property_city"),
            "metro": raw.get("property_metro"),
        },
        "source_geography": source_geography,
        "geographic_match_level": match_level,
        "repair_category": raw["repair_category"],
        "trade": raw["trade"],
        "price_low": low,
        "price_high": high,
        "point_value": point,
        "units_or_basis": raw["units_or_basis"],
        "included_scope": raw.get("included_scope", []),
        "excluded_scope": raw.get("excluded_scope", []),
        "notes": raw.get("notes", ""),
        "limitations": raw.get("limitations", []),
        "field_conditions": field_conditions,
        "review_status": review_status,
        "retrieval_state": "external_source_retrieved",
        "memory_eligibility": "not_eligible_without_human_reviewed_outcome",
    }
    return normalized


def range_eligible_pricing_sources(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [record for record in records if record.get("price_low") is not None and record.get("price_high") is not None]


def contractor_quotes(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "source_id": record["source_id"],
            "amount": record.get("point_value"),
            "source_reference": record["source_reference"],
            "review_status": record["review_status"],
        }
        for record in records
        if record["source_type"] == "contractor_quote" and record.get("point_value") is not None
    ]


def build_weather_request(
    *,
    finding_id: str,
    evidence_ids: list[str],
    latitude: float,
    longitude: float,
    location_label: str,
    observation_timestamp: str,
    upload_timestamp: str | None,
    window_hours: int,
    relevance: str,
) -> dict[str, Any]:
    observed_at = parse_timestamp(observation_timestamp)
    if window_hours <= 0 or window_hours > 24 * 14:
        raise ValueError("weather window must be between 1 hour and 14 days")
    period_start = observed_at - timedelta(hours=window_hours)
    return {
        "finding_id": finding_id,
        "evidence_ids": evidence_ids,
        "latitude": latitude,
        "longitude": longitude,
        "location_label": location_label,
        "observation_timestamp": observed_at.isoformat(),
        "upload_timestamp": upload_timestamp,
        "upload_timestamp_used": False,
        "period_start": period_start.isoformat(),
        "period_end": observed_at.isoformat(),
        "window_hours": window_hours,
        "relevance": relevance,
    }


class HistoricalWeatherProvider(ABC):
    name: str

    @abstractmethod
    def fetch(self, request: dict[str, Any]) -> dict[str, Any]:
        raise NotImplementedError


class OpenMeteoHistoricalWeatherProvider(HistoricalWeatherProvider):
    name = "Open-Meteo Historical Weather API"

    def __init__(self, endpoint: str = OPEN_METEO_ARCHIVE_ENDPOINT, timeout_seconds: int = 20):
        self.endpoint = endpoint
        self.timeout_seconds = timeout_seconds

    def build_url(self, weather_request: dict[str, Any]) -> str:
        start = parse_timestamp(weather_request["period_start"])
        end = parse_timestamp(weather_request["period_end"])
        params = {
            "latitude": weather_request["latitude"],
            "longitude": weather_request["longitude"],
            "start_date": start.date().isoformat(),
            "end_date": end.date().isoformat(),
            "hourly": ",".join(WEATHER_VARIABLES),
            "timezone": "UTC",
            "temperature_unit": "fahrenheit",
            "wind_speed_unit": "mph",
            "precipitation_unit": "inch",
        }
        return f"{self.endpoint}?{urlencode(params)}"

    def fetch(self, weather_request: dict[str, Any]) -> dict[str, Any]:
        url = self.build_url(weather_request)
        http_request = Request(url, headers={"User-Agent": "ShelterPrep-Phase1/1.0"})
        with urlopen(http_request, timeout=self.timeout_seconds) as response:
            payload = json.loads(response.read().decode("utf-8"))
        return {
            "provider": self.name,
            "source_reference": url,
            "retrieved_at": utc_now(),
            "provider_response": payload,
            "fixture_backed": False,
        }


class FixtureHistoricalWeatherProvider(HistoricalWeatherProvider):
    name = "Deterministic historical weather fixture"

    def __init__(self, provider_response: dict[str, Any], *, fixture_id: str):
        self.provider_response = provider_response
        self.fixture_id = fixture_id

    def fetch(self, weather_request: dict[str, Any]) -> dict[str, Any]:
        return {
            "provider": self.name,
            "source_reference": f"fixture://{self.fixture_id}",
            "retrieved_at": "2030-01-10T12:00:00+00:00",
            "provider_response": self.provider_response,
            "fixture_backed": True,
        }


def _values(values: list[Any]) -> list[float]:
    return [float(value) for value in values if isinstance(value, (int, float))]


def normalize_weather_response(weather_request: dict[str, Any], fetched: dict[str, Any]) -> dict[str, Any]:
    response = fetched.get("provider_response", {})
    hourly = response.get("hourly", {})
    units = response.get("hourly_units", {})
    times = hourly.get("time", [])
    start = parse_timestamp(weather_request["period_start"])
    end = parse_timestamp(weather_request["period_end"])
    indexes: list[int] = []
    for index, value in enumerate(times):
        timestamp = parse_timestamp(value + "+00:00" if "+" not in value and not value.endswith("Z") else value)
        if start <= timestamp <= end:
            indexes.append(index)
    if not indexes:
        raise ValueError("weather provider response contains no measurements in the requested observation window")

    def selected(name: str) -> list[float]:
        series = hourly.get(name, [])
        return _values([series[index] for index in indexes if index < len(series)])

    precipitation = selected("precipitation")
    temperature = selected("temperature_2m")
    humidity = selected("relative_humidity_2m")
    dew_point = selected("dew_point_2m")
    wind_speed = selected("wind_speed_10m")
    wind_direction = selected("wind_direction_10m")
    snowfall = selected("snowfall")
    measurements = {
        "precipitation_total": round(sum(precipitation), 3),
        "temperature_min": min(temperature) if temperature else None,
        "temperature_max": max(temperature) if temperature else None,
        "relative_humidity_mean": round(mean(humidity), 2) if humidity else None,
        "dew_point_mean": round(mean(dew_point), 2) if dew_point else None,
        "wind_speed_max": max(wind_speed) if wind_speed else None,
        "wind_direction_mean": round(mean(wind_direction), 2) if wind_direction else None,
        "freezing_hours": sum(1 for value in temperature if value <= 32),
        "snowfall_total": round(sum(snowfall), 3),
    }
    record = {
        "schema_version": SCHEMA_VERSION,
        "record_type": "weather_source_evidence",
        "source_id": stable_id("weather-source", {"request": weather_request, "reference": fetched["source_reference"]}),
        "provider": fetched.get("provider"),
        "source_reference": fetched.get("source_reference"),
        "provider_documentation": OPEN_METEO_DOCUMENTATION if not fetched.get("fixture_backed") else fetched.get("source_reference"),
        "location_used": {
            "label": weather_request["location_label"],
            "requested_latitude": weather_request["latitude"],
            "requested_longitude": weather_request["longitude"],
            "provider_latitude": response.get("latitude"),
            "provider_longitude": response.get("longitude"),
            "timezone": response.get("timezone", "UTC"),
        },
        "observation_period": {"start": weather_request["period_start"], "end": weather_request["period_end"]},
        "retrieved_at": fetched.get("retrieved_at"),
        "measurements": measurements,
        "measurement_units": {
            "precipitation_total": units.get("precipitation", "inch"),
            "temperature_min": units.get("temperature_2m", "°F"),
            "temperature_max": units.get("temperature_2m", "°F"),
            "relative_humidity_mean": units.get("relative_humidity_2m", "%"),
            "dew_point_mean": units.get("dew_point_2m", "°F"),
            "wind_speed_max": units.get("wind_speed_10m", "mph"),
            "wind_direction_mean": units.get("wind_direction_10m", "°"),
            "freezing_hours": "hours",
            "snowfall_total": units.get("snowfall", "inch"),
        },
        "linked_finding_id": weather_request["finding_id"],
        "linked_evidence_ids": weather_request["evidence_ids"],
        "observation_timestamp": weather_request["observation_timestamp"],
        "upload_timestamp": weather_request.get("upload_timestamp"),
        "upload_timestamp_used": False,
        "relevance": weather_request["relevance"],
        "review_status": "external_source_retrieved",
        "fixture_backed": bool(fetched.get("fixture_backed")),
        "limitations": [
            "Historical weather is gridded reanalysis/model context and is not an exact property-mounted measurement.",
            "Correlation with the finding timestamp does not establish repair causation.",
        ],
        "retrieval_state": "external_source_retrieved",
        "memory_eligibility": "not_eligible_without_human_reviewed_outcome",
    }
    errors = validate_weather_source(record)
    if errors:
        raise ValueError("; ".join(errors))
    return record


def validate_weather_source(record: dict[str, Any]) -> list[str]:
    errors = []
    for field in [
        "source_id",
        "provider",
        "source_reference",
        "location_used",
        "observation_period",
        "retrieved_at",
        "measurements",
        "measurement_units",
        "linked_finding_id",
        "linked_evidence_ids",
        "review_status",
    ]:
        if record.get(field) in (None, "", [], {}):
            errors.append(f"weather provenance field {field} is required")
    if record.get("upload_timestamp_used"):
        errors.append("weather query cannot use upload time as the observation time")
    errors.extend(validate_review_authority(record.get("review_status", ""), "system"))
    return errors


def build_weather_claim(record: dict[str, Any], *, dry_threshold_inches: float = 0.01) -> dict[str, Any]:
    errors = validate_weather_source(record)
    if errors:
        raise ValueError("; ".join(errors))
    precipitation = record["measurements"].get("precipitation_total")
    if precipitation is None:
        raise ValueError("precipitation measurement is required for the moisture-context claim")
    if precipitation <= dry_threshold_inches:
        text = (
            "No meaningful precipitation was recorded during the relevant pre-observation period. "
            "Rain-driven intrusion is less supported by timing alone, but another moisture source is not ruled out."
        )
        evidence_direction = "negative_for_rain_timing_hypothesis"
    else:
        unit = record["measurement_units"].get("precipitation_total", "inch")
        text = (
            f"{precipitation:g} {unit} of precipitation was recorded during the relevant pre-observation period. "
            "Exterior water intrusion remains a relevant hypothesis, but weather correlation does not establish cause."
        )
        evidence_direction = "supports_relevance_not_causation"
    return {
        "claim_id": stable_id("weather-claim", {"source": record["source_id"], "text": text}),
        "claim_type": "environmental_context",
        "claim_text": text,
        "source_refs": [record["source_id"]],
        "geography_or_time": {
            "location_used": record["location_used"],
            "observation_period": record["observation_period"],
        },
        "linked_finding_id": record["linked_finding_id"],
        "linked_evidence_ids": record["linked_evidence_ids"],
        "evidence_direction": evidence_direction,
        "causal_status": "correlation_context_only",
        "review_status": "needs_human_review",
    }


def validate_claim_source_links(claim: dict[str, Any], source_records: list[dict[str, Any]]) -> list[str]:
    source_ids = {source.get("source_id") for source in source_records}
    errors = []
    if not claim.get("source_refs"):
        errors.append("claim must link to at least one source")
    for source_ref in claim.get("source_refs", []):
        if source_ref not in source_ids:
            errors.append(f"claim references missing source: {source_ref}")
    if claim.get("causal_status") != "correlation_context_only" and claim.get("claim_type") == "environmental_context":
        errors.append("weather claim cannot promote correlation to causation")
    lowered = claim.get("claim_text", "").lower()
    if claim.get("claim_type") == "environmental_context" and ("rain caused" in lowered or "caused the leak" in lowered):
        errors.append("weather claim contains a causal leap")
    return errors


def to_supabase_evidence_item_payload(
    source: dict[str, Any], *, property_id: str, inspection_report_id: str, finding_id: str
) -> dict[str, Any]:
    if source["record_type"] == "pricing_source_evidence":
        excerpt = f"{source['source_name']}: {source['units_or_basis']}"
        claim_type = "pricing_evidence"
    else:
        excerpt = f"{source['provider']}: {json.dumps(source['measurements'], sort_keys=True)}"
        claim_type = "weather_evidence"
    return {
        "table": "evidence_items",
        "insert": {
            "property_id": property_id,
            "inspection_report_id": inspection_report_id,
            "source_type": "external_source",
            "source_file_id": source["source_id"],
            "source_excerpt": excerpt,
            "observation": excerpt,
            "claim_type": claim_type,
            "confidence": "low",
            "requires_field_verification": True,
            "provenance": source,
            "created_by_agent": "phase1_live_source_integration",
            "review_status": "ai_draft",
        },
        "link_after_insert": {"inspection_finding_id": finding_id, "append_to": "raw_evidence_ids"},
        "runtime_status": "prepared_not_executed",
    }


def build_persistence_bundle(
    *,
    property_id: str,
    inspection_report_id: str,
    finding_id: str,
    source_records: list[dict[str, Any]],
    claims: list[dict[str, Any]],
    price_revision: dict[str, Any],
    finding_card: dict[str, Any],
) -> dict[str, Any]:
    for claim in claims:
        errors = validate_claim_source_links(claim, source_records)
        if errors:
            raise ValueError("; ".join(errors))
    return {
        "schema_version": SCHEMA_VERSION,
        "property_id": property_id,
        "inspection_report_id": inspection_report_id,
        "finding_id": finding_id,
        "external_sources": source_records,
        "claims": claims,
        "price_revisions": [price_revision],
        "finding_card": finding_card,
        "finding_evidence_links": {
            "finding_id": finding_id,
            "source_ids": [source["source_id"] for source in source_records],
        },
        "supabase_payloads": [
            to_supabase_evidence_item_payload(
                source,
                property_id=property_id,
                inspection_report_id=inspection_report_id,
                finding_id=finding_id,
            )
            for source in source_records
        ],
        "state_separation": {
            "external_source_retrieved": True,
            "ai_interpretation": "needs_human_review",
            "human_reviewed": False,
            "verified_operational_knowledge": False,
        },
        "database_write_executed": False,
    }


class JsonEvidenceRepository:
    """Append-only local persistence for test/dev bundles; not production storage."""

    def __init__(self, path: Path):
        self.path = path

    def append(self, bundle: dict[str, Any]) -> None:
        existing = json.loads(self.path.read_text()) if self.path.exists() else {"bundles": []}
        existing.setdefault("bundles", []).append(bundle)
        temporary = self.path.with_suffix(self.path.suffix + ".tmp")
        temporary.write_text(json.dumps(existing, indent=2) + "\n")
        temporary.replace(self.path)


def deterministic_weather_payload(*, wet: bool) -> dict[str, Any]:
    start = datetime(2030, 1, 1, 12, tzinfo=timezone.utc)
    times = [(start + timedelta(hours=index)).strftime("%Y-%m-%dT%H:%M") for index in range(49)]
    precipitation = [0.1 if wet and 10 <= index < 24 else 0.0 for index in range(49)]
    return {
        "latitude": 45.5,
        "longitude": -122.6,
        "timezone": "UTC",
        "hourly_units": {
            "precipitation": "inch",
            "temperature_2m": "°F",
            "relative_humidity_2m": "%",
            "dew_point_2m": "°F",
            "wind_speed_10m": "mph",
            "wind_direction_10m": "°",
            "snowfall": "inch",
        },
        "hourly": {
            "time": times,
            "precipitation": precipitation,
            "temperature_2m": [42.0] * 49,
            "relative_humidity_2m": [88.0] * 49,
            "dew_point_2m": [39.0] * 49,
            "wind_speed_10m": [7.0] * 49,
            "wind_direction_10m": [220.0] * 49,
            "snowfall": [0.0] * 49,
        },
    }


def build_end_to_end_fixture() -> dict[str, Any]:
    finding_id = "fixture-moisture-finding-1"
    pricing = normalize_pricing_source(
        {
            "source_id": "fixture-city-repair-benchmark",
            "source_name": "Fixture city repair benchmark",
            "source_type": "city_benchmark",
            "internal_reference": "fixture://pricing/city-moisture-repair",
            "retrieved_at": "2030-01-10T12:00:00+00:00",
            "published_at": "2030-01-01",
            "property_zip": "97000",
            "property_city": "Exampletown",
            "property_metro": "Example metro",
            "source_geography": {"level": "city", "label": "Exampletown"},
            "geographic_match_level": "city",
            "repair_category": "localized moisture-damaged finish repair",
            "trade": "general_contractor",
            "low_value": 900,
            "high_value": 3000,
            "units_or_basis": "fixture repair-cost envelope",
            "included_scope": ["localized access", "finish removal", "localized repair"],
            "excluded_scope": ["structural repair", "mold remediation", "permit fees"],
            "limitations": ["Fixture data used only to prove the contract", "Concealed scope remains unknown"],
            "field_conditions": {
                "known": {"occupancy": "vacant"},
                "unknown": ["wall access", "concealed damage", "equipment needs", "permit requirements"],
            },
            "review_status": "external_source_retrieved",
        }
    )
    contractor_quote = normalize_pricing_source(
        {
            "source_id": "fixture-contractor-quote",
            "source_name": "Fixture contractor quote",
            "source_type": "property_specific_contractor_quote",
            "internal_reference": "fixture://contractor/quote-1",
            "retrieved_at": "2030-01-10T12:00:00+00:00",
            "property_zip": "97000",
            "property_city": "Exampletown",
            "property_metro": "Example metro",
            "source_geography": {"level": "exact_zip", "label": "97000"},
            "geographic_match_level": "exact_zip",
            "repair_category": "localized moisture-damaged finish repair",
            "trade": "general_contractor",
            "point_value": 1475,
            "units_or_basis": "fixture contractor quote",
            "included_scope": ["quoted repair scope"],
            "excluded_scope": ["concealed damage"],
            "limitations": ["Contractor upload is source material, not contractor verification of Shelter Prep interpretation"],
            "field_conditions": {"known": {}, "unknown": ["quote inclusion parity"]},
            "review_status": "external_source_retrieved",
        }
    )
    weather_request = build_weather_request(
        finding_id=finding_id,
        evidence_ids=["fixture-inspection-evidence-1"],
        latitude=45.5,
        longitude=-122.6,
        location_label="Exampletown synthetic coordinate",
        observation_timestamp="2030-01-03T12:00:00+00:00",
        upload_timestamp="2030-01-10T12:00:00+00:00",
        window_hours=48,
        relevance="moisture observation",
    )
    provider = FixtureHistoricalWeatherProvider(deterministic_weather_payload(wet=True), fixture_id="wet-48-hour-window")
    weather = normalize_weather_response(weather_request, provider.fetch(weather_request))
    weather_claim = build_weather_claim(weather)
    revision = create_price_revision(
        revision_id="fixture-price-revision-1",
        price_low=900,
        price_high=3000,
        price_stage="fixture_evidence_informed",
        property_geography={"level": "exact_zip", "label": "97000"},
        price_geography={"level": "city", "label": "Exampletown", "match_quality": "city"},
        price_sources=[pricing],
        price_range_explanation=(
            "Fixture city evidence supports a planning range, while concealed damage, access, equipment, and permit needs remain unknown."
        ),
        evidence_causing_change=["fixture city source supplied", "repair category matched"],
        assumptions=["localized repair only"],
        unresolved_unknowns=pricing["field_conditions"]["unknown"],
        author={"type": "ai", "id": "phase1-source-integration-fixture"},
        review_status="needs_human_review",
        timestamp="2030-01-10T12:00:00+00:00",
        contractor_quote=contractor_quotes([contractor_quote])[0],
    )
    finding = {
        "source": {
            "inspector_statement": "Water staining is documented on ceiling drywall.",
            "source_file_id": "fixture-inspection-report",
            "source_page": 12,
            "source_section": "Moisture Damage",
            "source_item_number": "M.1",
        },
        "known_facts": ["Water staining is documented.", "The observation date is 2030-01-03."],
        "epistemic_states": {
            "unknowns": ["Whether the area is currently wet.", "The exact water-entry point is not established."]
        },
        "environmental_context": {"weather_source_id": weather["source_id"], "weather_claim_id": weather_claim["claim_id"]},
        "recommended_next_step": {
            "move": "Obtain an attic-side photo and moisture reading above the stain.",
            "owner": "field reviewer",
            "why_this_next_step": "These checks most directly distinguish active moisture from an older stain and localize the pathway.",
        },
        "evidence_links": {"source_evidence_ids": ["fixture-inspection-evidence-1", weather["source_id"]]},
    }
    card = build_priced_finding_card(finding, revision)
    card["weather_context"] = {"source": weather, "claim": weather_claim}
    card["relevant_context"] = {"environmental": card["weather_context"], "field_conditions": pricing["field_conditions"]}
    price_claim = {
        "claim_id": "fixture-price-claim-1",
        "claim_type": "repair_cost_range",
        "claim_text": "Fixture-backed Shelter Prep range: $900-$3,000.",
        "source_refs": [pricing["source_id"]],
        "linked_finding_id": finding_id,
        "linked_evidence_ids": ["fixture-inspection-evidence-1"],
        "review_status": "needs_human_review",
    }
    return build_persistence_bundle(
        property_id="fixture-property-1",
        inspection_report_id="fixture-report-1",
        finding_id=finding_id,
        source_records=[pricing, contractor_quote, weather],
        claims=[price_claim, weather_claim],
        price_revision=revision,
        finding_card=card,
    )


def run_self_test() -> None:
    fixture = build_end_to_end_fixture()
    card = fixture["finding_card"]
    weather = next(source for source in fixture["external_sources"] if source["record_type"] == "weather_source_evidence")
    pricing = next(source for source in fixture["external_sources"] if source.get("source_id") == "fixture-city-repair-benchmark")
    quote = next(source for source in fixture["external_sources"] if source.get("source_type") == "contractor_quote")

    assert pricing["source_geography"]["level"] == "city"
    assert pricing["geographic_match_level"] == "city"
    assert card["price_geography"]["level"] == "city"
    assert card["price_low"] == 900 and card["price_high"] == 3000
    assert card["contractor_quote"]["amount"] == quote["point_value"] == 1475
    assert quote["source_id"] not in card["price_source_refs"]
    assert "wall access" in card["relevant_context"]["field_conditions"]["unknown"]
    assert weather["observation_timestamp"] == "2030-01-03T12:00:00+00:00"
    assert weather["upload_timestamp"] == "2030-01-10T12:00:00+00:00"
    assert weather["upload_timestamp_used"] is False
    assert weather["measurements"]["precipitation_total"] == 1.4
    assert weather["fixture_backed"] is True
    assert "does not establish cause" in card["weather_context"]["claim"]["claim_text"]
    assert not validate_claim_source_links(card["weather_context"]["claim"], fixture["external_sources"])
    assert all(payload["runtime_status"] == "prepared_not_executed" for payload in fixture["supabase_payloads"])
    assert fixture["state_separation"]["external_source_retrieved"] is True
    assert fixture["state_separation"]["human_reviewed"] is False
    assert fixture["state_separation"]["verified_operational_knowledge"] is False

    dry_request = build_weather_request(
        finding_id="dry-finding",
        evidence_ids=["dry-evidence"],
        latitude=45.5,
        longitude=-122.6,
        location_label="Dry fixture coordinate",
        observation_timestamp="2030-01-03T12:00:00+00:00",
        upload_timestamp="2030-01-08T12:00:00+00:00",
        window_hours=48,
        relevance="moisture observation",
    )
    dry_provider = FixtureHistoricalWeatherProvider(deterministic_weather_payload(wet=False), fixture_id="dry-48-hour-window")
    dry_weather = normalize_weather_response(dry_request, dry_provider.fetch(dry_request))
    dry_claim = build_weather_claim(dry_weather)
    assert dry_weather["measurements"]["precipitation_total"] == 0
    assert dry_claim["evidence_direction"] == "negative_for_rain_timing_hypothesis"
    assert "does not rule" not in dry_claim["claim_text"].lower()
    assert "not ruled out" in dry_claim["claim_text"].lower()

    invalid_weather_claim = dict(dry_claim)
    invalid_weather_claim["source_refs"] = []
    assert "claim must link to at least one source" in validate_claim_source_links(invalid_weather_claim, [dry_weather])
    causal_claim = dict(dry_claim)
    causal_claim["causal_status"] = "cause_established"
    causal_claim["claim_text"] = "The rain caused the leak."
    assert validate_claim_source_links(causal_claim, [dry_weather])

    source_types_by_level = {
        "exact_zip": "contractor_input",
        "metro": "reputable_local_benchmark",
        "regional": "regional_benchmark",
        "national_fallback": "national_fallback",
    }
    for level, source_type in source_types_by_level.items():
        normalized = normalize_pricing_source(
            {
                "source_id": f"fixture-{level}",
                "source_name": f"Fixture {level}",
                "source_type": source_type,
                "internal_reference": f"fixture://pricing/{level}",
                "retrieved_at": "2030-01-10T12:00:00+00:00",
                "property_zip": "97000",
                "property_city": "Exampletown",
                "property_metro": "Example metro",
                "source_geography": {"level": level, "label": level},
                "geographic_match_level": level,
                "repair_category": "synthetic repair",
                "trade": "general_contractor",
                "low_value": 100,
                "high_value": 200,
                "units_or_basis": "fixture range",
                "field_conditions": {"known": {}, "unknown": ["access"]},
                "review_status": "external_source_retrieved",
            }
        )
        assert normalized["source_geography"]["level"] == level
        assert normalized["geographic_match_level"] == level

    overprecise = {
        "source_id": "fixture-overprecise",
        "source_name": "Fixture overprecise",
        "source_type": "metro_benchmark",
        "internal_reference": "fixture://pricing/overprecise",
        "retrieved_at": "2030-01-10T12:00:00+00:00",
        "repair_category": "synthetic repair",
        "trade": "general_contractor",
        "source_geography": {"level": "metro", "label": "Example metro"},
        "geographic_match_level": "exact_zip",
        "low_value": 100,
        "high_value": 200,
        "units_or_basis": "fixture range",
        "field_conditions": {"known": {}, "unknown": []},
    }
    try:
        normalize_pricing_source(overprecise)
        raise AssertionError("metro source was allowed to claim ZIP precision")
    except ValueError as error:
        assert "more precise" in str(error)

    try:
        normalize_pricing_source({**overprecise, "geographic_match_level": "metro", "review_status": "human_verified"})
        raise AssertionError("system path was allowed to mark evidence verified")
    except ValueError as error:
        assert "cannot mark" in str(error)

    for actor_type in ["ai", "browser"]:
        try:
            normalize_pricing_source(
                {**overprecise, "geographic_match_level": "metro", "review_status": "human_verified"},
                actor_type=actor_type,
            )
            raise AssertionError(f"{actor_type} path was allowed to mark evidence verified")
        except ValueError as error:
            assert "cannot mark" in str(error)

    with tempfile.TemporaryDirectory(prefix="shelter-prep-source-integration-") as directory:
        path = Path(directory) / "evidence-store.json"
        repository = JsonEvidenceRepository(path)
        repository.append(fixture)
        repository.append(fixture)
        persisted = json.loads(path.read_text())
        assert len(persisted["bundles"]) == 2
        assert persisted["bundles"][0]["database_write_executed"] is False
        assert persisted["bundles"][0]["state_separation"]["verified_operational_knowledge"] is False

    print("phase1_live_source_integration self-test passed")


def main() -> int:
    parser = argparse.ArgumentParser(description="Shelter Prep Phase 1 live source integration")
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--print-fixture", action="store_true")
    parser.add_argument("--live-weather-request", help="JSON file containing a weather request")
    parser.add_argument("--live-weather-smoke-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        run_self_test()
        return 0
    if args.print_fixture:
        print(json.dumps(build_end_to_end_fixture(), indent=2))
        return 0
    if args.live_weather_request:
        weather_request = json.loads(Path(args.live_weather_request).read_text())
        provider = OpenMeteoHistoricalWeatherProvider()
        print(json.dumps(normalize_weather_response(weather_request, provider.fetch(weather_request)), indent=2))
        return 0
    if args.live_weather_smoke_test:
        weather_request = build_weather_request(
            finding_id="public-provider-smoke-test",
            evidence_ids=["public-provider-smoke-test-evidence"],
            latitude=45.5152,
            longitude=-122.6784,
            location_label="Portland, Oregon public city-center coordinate",
            observation_timestamp="2026-01-03T12:00:00+00:00",
            upload_timestamp=None,
            window_hours=48,
            relevance="provider connectivity smoke test",
        )
        record = normalize_weather_response(weather_request, OpenMeteoHistoricalWeatherProvider().fetch(weather_request))
        print(
            json.dumps(
                {
                    "status": "live_provider_retrieval_succeeded",
                    "provider": record["provider"],
                    "source_reference": record["source_reference"],
                    "observation_period": record["observation_period"],
                    "measurements": record["measurements"],
                    "fixture_backed": record["fixture_backed"],
                },
                indent=2,
            )
        )
        return 0
    parser.print_help()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
