#!/usr/bin/env python3
"""Source-backed repair-path and whole-report decision support for Phase 1."""

from __future__ import annotations

import re
from typing import Any


NATIONAL = {"level": "national_fallback", "label": "United States", "match_quality": "national_fallback"}


def source(source_id: str, name: str, url: str, published: str, low: float, high: float, scope: str, unit: str = "project") -> dict[str, Any]:
    return {
        "id": source_id,
        "source_id": source_id,
        "source_name": name,
        "source_type": "repair_cost_guide",
        "source_class": "national_fallback",
        "source_reference": url,
        "source_url": url,
        "published_at": published,
        "source_geography": dict(NATIONAL),
        "price_low": low,
        "price_high": high,
        "price_unit": unit,
        "scope_basis": scope,
        "review_status": "external_source_retrieved_needs_human_review",
    }


SOURCES = {
    item["id"]: item
    for item in [
        source("homeguide-sidewalk-repair", "HomeGuide concrete sidewalk cost guide", "https://homeguide.com/costs/concrete-sidewalk-cost", "2026-02-01", 3, 8, "Moderate concrete sidewalk cracks, deterioration, or unlevel sections.", "square_foot"),
        source("homeguide-concrete-resurfacing", "HomeGuide concrete resurfacing cost guide", "https://homeguide.com/costs/concrete-resurfacing-cost", "2026-02-03", 3, 7, "Basic concrete patio or walkway resurfacing.", "square_foot"),
        source("homeguide-foundation-inspection", "HomeGuide foundation inspection cost guide", "https://homeguide.com/costs/foundation-inspection-cost", "2026-02-01", 300, 750, "Structural engineer foundation inspection."),
        source("homeguide-foundation-crack", "HomeGuide foundation crack repair cost guide", "https://homeguide.com/costs/foundation-crack-repair-cost", "2025-07-01", 250, 800, "Professional crack injection for a confirmed stable, non-structural crack."),
        source("homeguide-siding-repair", "HomeGuide siding repair cost guide", "https://homeguide.com/costs/siding-repair-cost", "2026-02-09", 200, 1200, "Typical fiber-cement siding repair up to roughly 100 square feet."),
        source("homeguide-window-seal", "HomeGuide window seal repair cost guide", "https://homeguide.com/costs/window-seal-repair-or-replacement-cost", "2025-10-01", 75, 250, "Seal repair or seal replacement for one standard window."),
        source("homeguide-window-glass", "HomeGuide window glass replacement cost guide", "https://homeguide.com/costs/window-glass-replacement-cost", "2026-02-03", 300, 650, "Average glass or insulated-glass replacement for one window."),
        source("homeguide-window-replacement", "HomeGuide window repair cost guide", "https://homeguide.com/costs/window-repair-cost", "2026-02-01", 400, 2000, "Full replacement of one window when repair is not practical."),
        source("homeguide-deck-simple", "HomeGuide deck repair cost guide", "https://homeguide.com/costs/deck-repair-cost", "2025-10-28", 100, 750, "Simple deck repair such as limited fastener, board, or localized component work."),
        source("homeguide-deck-average", "HomeGuide deck repair cost guide", "https://homeguide.com/costs/deck-repair-cost", "2025-10-28", 750, 2500, "Average deck repair involving broader deterioration or several components."),
        source("homeguide-roof-minor", "HomeGuide roof repair cost guide", "https://homeguide.com/costs/roof-repair-cost", "2026-02-01", 150, 1000, "Minor roof repair such as limited leak sealing, fastener, or shingle work."),
        source("homeguide-roof-water-damage", "HomeGuide roof repair cost guide", "https://homeguide.com/costs/roof-repair-cost", "2026-02-01", 1000, 6000, "Roof repair that includes water-damaged materials; structural restoration may exceed this range."),
        source("homeguide-roof-flashing", "HomeGuide roof repair cost guide", "https://homeguide.com/costs/roof-repair-cost", "2026-02-01", 200, 500, "Typical localized roof flashing repair."),
        source("homeguide-drip-edge", "HomeGuide roof repair cost guide", "https://homeguide.com/costs/roof-repair-cost", "2026-02-01", 150, 1800, "Drip-edge flashing repair or installation; length and access drive the range."),
        source("homeguide-roof-cleaning", "HomeGuide roof repair cost guide", "https://homeguide.com/costs/roof-repair-cost", "2026-02-01", 250, 600, "Typical roof cleaning project."),
        source("homeguide-gutter-cleaning", "HomeGuide gutter cleaning cost guide", "https://homeguide.com/costs/gutter-cleaning-cost", "2025-11-01", 100, 250, "Typical gutter cleaning for a residence."),
        source("homeguide-gutter-repair", "HomeGuide gutter repair cost guide", "https://homeguide.com/costs/gutter-repair-cost", "2025-11-07", 75, 450, "Minor gutter pitch, sag, leak, or localized section repair."),
        source("homeguide-electrical-small", "HomeGuide electrical work pricing guide", "https://homeguide.com/costs/electrical-work-pricing-guide", "2026-02-01", 141, 419, "Small electrical repair or installation visit."),
        source("homeguide-outlet-replacement", "HomeGuide electrical outlet cost guide", "https://homeguide.com/costs/cost-to-install-electrical-outlet", "2025-07-01", 80, 200, "Replacement of an existing standard receptacle."),
        source("homeguide-gfci-replacement", "HomeGuide electrical outlet cost guide", "https://homeguide.com/costs/cost-to-install-electrical-outlet", "2025-07-01", 90, 200, "Replacement of an existing standard receptacle with a GFCI receptacle."),
        source("homeguide-gfci-new", "HomeGuide electrical outlet cost guide", "https://homeguide.com/costs/cost-to-install-electrical-outlet", "2025-07-01", 150, 350, "Installation of a new GFCI receptacle where wiring conditions support it."),
        source("homeguide-afci-breaker", "HomeGuide electrical work pricing guide", "https://homeguide.com/costs/electrical-work-pricing-guide", "2026-02-01", 150, 310, "Modeled from a typical individual breaker replacement range plus the source's AFCI protection increment; panel compatibility is not established."),
        source("homeguide-pipe-repair", "HomeGuide plumber cost guide", "https://homeguide.com/costs/plumber-cost", "2026-02-01", 400, 2000, "Typical localized plumbing pipe repair."),
        source("homeguide-house-repipe", "HomeGuide plumbing replacement cost guide", "https://homeguide.com/costs/install-new-house-plumbing-pipes-cost", "2025-07-01", 2000, 15000, "Whole-house repiping; home size, access, wall repair, and material selection drive the range."),
        source("homeguide-hvac-inspect", "HomeGuide furnace tune-up cost guide", "https://homeguide.com/costs/furnace-inspection-cost", "2026-02-01", 70, 200, "Furnace inspection or tune-up."),
        source("homeguide-hvac-repair", "HomeGuide furnace repair cost guide", "https://homeguide.com/costs/furnace-repair-service-cost", "2025-07-01", 100, 600, "Typical furnace repair after diagnosis."),
        source("homeguide-furnace-clean", "HomeGuide furnace cleaning cost guide", "https://homeguide.com/costs/furnace-cleaning-cost", "2024-04-29", 70, 300, "Basic through deep furnace cleaning."),
        source("homeguide-toilet-repair", "HomeGuide toilet repair cost guide", "https://homeguide.com/costs/toilet-repair-cost", "2026-02-01", 100, 300, "Typical toilet repair or reseating work."),
        source("homeguide-toilet-flange", "HomeGuide toilet flange replacement cost guide", "https://homeguide.com/costs/cost-to-replace-toilet-flange", "2026-02-01", 85, 350, "Simple toilet flange replacement, excluding concealed water-damage repair."),
        source("homeguide-toilet-replacement", "HomeGuide plumbing estimates", "https://homeguide.com/costs/average-plumbing-estimates", "2025-12-01", 250, 750, "Typical toilet replacement/installation."),
        source("homeguide-subfloor-small", "HomeGuide subfloor replacement cost guide", "https://homeguide.com/costs/cost-to-replace-a-subfloor", "2026-02-01", 100, 300, "Localized subfloor repair; broader damage is outside this range."),
        source("homeguide-shower-repair", "HomeGuide handyman price guide", "https://homeguide.com/costs/handyman-prices", "2026-02-01", 70, 200, "Routine shower repair; glass or frame replacement is excluded."),
        source("homeguide-shower-door", "HomeGuide shower door cost guide", "https://homeguide.com/costs/glass-shower-door-cost", "2026-02-01", 580, 1650, "Replacement of an existing shower door."),
        source("homeguide-faucet", "HomeGuide bathroom faucet cost guide", "https://homeguide.com/costs/cost-to-install-bathroom-faucet", "2025-01-01", 150, 600, "Bathroom faucet replacement including fixture and labor."),
        source("homeguide-bath-caulk", "HomeGuide bathtub repair cost guide", "https://homeguide.com/costs/bathtub-repair-cost", "2025-07-01", 50, 200, "Professional bathtub or wet-area caulking/resealing."),
        source("homeguide-smoke-alarm", "HomeGuide smoke detector installation cost guide", "https://homeguide.com/costs/smoke-detector-installation-cost", "2026-02-01", 110, 410, "One smoke alarm including device and professional installation."),
        source("homeguide-co-alarm", "HomeGuide smoke and carbon monoxide detector cost guide", "https://homeguide.com/costs/smoke-detector-installation-cost", "2026-02-01", 120, 360, "One carbon-monoxide alarm including device and professional installation."),
        source("homeguide-attic-inspection", "HomeGuide attic inspection cost guide", "https://homeguide.com/costs/attic-inspection-cost", "2025-12-01", 200, 500, "Typical attic inspection; access and attic finish affect price."),
    ]
}

SOURCES.update({
    item["id"]: item
    for item in [
        source("fixr-sidewalk-repair", "Fixr sidewalk repair cost guide", "https://www.fixr.com/costs/repair-sidewalk", "2025-01-01", 8, 11, "Concrete walkway repair.", "square_foot"),
        source("angi-foundation-crack", "Angi foundation inspection cost guide", "https://www.angi.com/articles/foundation-inspection-cost.htm", "2026-04-06", 250, 800, "Common foundation crack repair."),
        source("angi-window-seal", "Angi window repair cost guide", "https://www.angi.com/articles/how-much-do-window-repairs-cost.htm", "2026-03-17", 75, 200, "Foggy-window seal or sash repair."),
        source("fixr-window-seal", "Fixr window repair cost guide", "https://www.fixr.com/costs/window-repair", "2025-01-01", 75, 250, "Window thermal-seal repair."),
        source("angi-deck-limited", "Angi deck repair cost guide", "https://www.angi.com/articles/how-much-does-it-cost-repair-deck.htm", "2026-08-03", 200, 500, "Localized non-structural mold or rot repair."),
        source("fixr-deck-patching", "Fixr deck repair cost guide", "https://www.fixr.com/costs/deck-repair", "2025-01-01", 150, 500, "Localized deck patching."),
        source("angi-deck-broader", "Angi deck repair cost guide", "https://www.angi.com/articles/how-much-does-it-cost-repair-deck.htm", "2026-08-03", 500, 4000, "Deck board replacement; extent and material drive the range."),
        source("fixr-deck-broader", "Fixr deck repair cost guide", "https://www.fixr.com/costs/deck-repair", "2025-01-01", 1000, 3000, "Deck refurbishment involving multiple components."),
        source("angi-roof-repair", "Angi roof repair cost guide", "https://www.angi.com/articles/how-much-do-roof-repairs-cost.htm", "2026-08-03", 395, 1967, "Typical roof repair; repair type and extent drive the range."),
        source("angi-roof-flashing", "Angi roof repair cost guide", "https://www.angi.com/articles/how-much-do-roof-repairs-cost.htm", "2026-08-03", 200, 500, "Localized roof flashing repair."),
        source("angi-roof-cleaning", "Angi roof cleaning cost guide", "https://www.angi.com/articles/what-does-roof-cleaning-cost.htm", "2026-07-09", 296, 626, "Professional residential roof cleaning."),
        source("angi-gutter-cleaning", "Angi gutter cleaning cost guide", "https://www.angi.com/articles/how-much-does-gutter-cleaning-cost.htm", "2026-08-05", 119, 234, "Professional single-story residential gutter cleaning."),
        source("angi-gutter-repair", "Angi gutter repair cost guide", "https://www.angi.com/articles/cost-of-gutter-repair.htm", "2026-07-08", 120, 900, "Professional gutter repair; damage and material drive the range."),
        source("angi-outlet-repair", "Angi electrical outlet repair cost guide", "https://www.angi.com/articles/electrical-outlet-repair-cost.htm", "2026-09-14", 60, 250, "Standard electrical outlet repair."),
        source("angi-outlet-replacement", "Angi outlet replacement cost guide", "https://www.angi.com/articles/cost-replace-27-electrical-outlets.htm", "2026-05-03", 150, 350, "Professional replacement of one existing outlet."),
        source("angi-gfci", "Angi GFCI outlet installation cost guide", "https://www.angi.com/articles/how-much-should-it-cost-electrician-replace-combination-gfci-switch-and-receptacle.htm", "2026-04-06", 100, 300, "Replacement or upgrade of an existing outlet with GFCI protection."),
        source("angi-hvac-inspection", "Angi furnace inspection cost guide", "https://www.angi.com/articles/furnace-inspection-cost.htm", "2026-07-01", 80, 200, "Basic through advanced furnace inspection or tune-up."),
        source("angi-hvac-repair", "Angi HVAC repair cost guide", "https://www.angi.com/articles/how-much-hvac-repair-cost.htm", "2026-09-01", 130, 500, "Typical furnace repair after diagnosis."),
        source("angi-furnace-cleaning", "Angi HVAC maintenance cost guide", "https://www.angi.com/articles/ac-service-cost.htm", "2026-07-01", 70, 400, "Professional furnace cleaning."),
        source("angi-toilet-repair", "Angi toilet repair cost guide", "https://www.angi.com/articles/how-much-should-toilet-repairs-cost.htm", "2026-07-20", 150, 391, "Typical professional toilet repair."),
        source("angi-toilet-replacement", "Angi toilet installation cost guide", "https://www.angi.com/articles/how-much-does-toilet-installation-cost.htm", "2026-05-30", 224, 533, "Professional toilet installation; concealed floor repair is excluded."),
        source("fixr-shower-repair", "Fixr shower repair cost guide", "https://www.fixr.com/costs/fix-leaky-shower-faucet", "2025-01-01", 50, 200, "Routine shower hardware, faucet, handle, tile, or grout repair."),
        source("angi-shower-door", "Angi shower door installation cost guide", "https://www.angi.com/articles/how-much-does-it-cost-install-glass-shower-door.htm", "2026-08-31", 530, 1391, "Professional shower door installation."),
        source("angi-faucet", "Angi bathroom faucet replacement cost guide", "https://www.angi.com/articles/how-much-cost-replace-bathroom-faucet.htm", "2026-09-19", 170, 360, "Professional bathroom faucet replacement."),
        source("angi-bath-caulk", "Angi caulking cost guide", "https://www.angi.com/articles/cost-to-caulk.htm", "2026-05-01", 65, 300, "Professional bathtub or shower caulking."),
        source("angi-smoke-alarm", "Angi smoke detector installation cost guide", "https://www.angi.com/articles/smoke-detector-installation-cost.htm", "2026-08-30", 70, 150, "One smoke detector with professional installation."),
        source("fixr-smoke-alarm", "Fixr smoke detector installation cost guide", "https://www.fixr.com/costs/smoke-detector-installation", "2025-01-31", 70, 150, "One smoke detector with professional installation."),
    ]
})


ALTERNATE_SOURCE_IDS = {
    "homeguide-sidewalk-repair": ["fixr-sidewalk-repair"],
    "homeguide-foundation-crack": ["angi-foundation-crack"],
    "homeguide-window-seal": ["angi-window-seal", "fixr-window-seal"],
    "homeguide-deck-simple": ["angi-deck-limited", "fixr-deck-patching"],
    "homeguide-deck-average": ["angi-deck-broader", "fixr-deck-broader"],
    "homeguide-roof-minor": ["angi-roof-repair"],
    "homeguide-roof-flashing": ["angi-roof-flashing"],
    "homeguide-roof-cleaning": ["angi-roof-cleaning"],
    "homeguide-gutter-cleaning": ["angi-gutter-cleaning"],
    "homeguide-gutter-repair": ["angi-gutter-repair"],
    "homeguide-electrical-small": ["angi-outlet-repair"],
    "homeguide-outlet-replacement": ["angi-outlet-repair", "angi-outlet-replacement"],
    "homeguide-gfci-replacement": ["angi-gfci"],
    "homeguide-hvac-inspect": ["angi-hvac-inspection"],
    "homeguide-hvac-repair": ["angi-hvac-repair"],
    "homeguide-furnace-clean": ["angi-furnace-cleaning"],
    "homeguide-toilet-repair": ["angi-toilet-repair"],
    "homeguide-toilet-replacement": ["angi-toilet-replacement"],
    "homeguide-shower-repair": ["fixr-shower-repair"],
    "homeguide-shower-door": ["angi-shower-door"],
    "homeguide-faucet": ["angi-faucet"],
    "homeguide-bath-caulk": ["angi-bath-caulk"],
    "homeguide-smoke-alarm": ["angi-smoke-alarm", "fixr-smoke-alarm"],
}


def technical_source(source_id: str, name: str, url: str, scope: str) -> dict[str, Any]:
    return {
        "id": source_id,
        "source_id": source_id,
        "source_name": name,
        "source_type": "technical_guidance",
        "source_class": "authoritative_public_or_manufacturer_guidance",
        "source_reference": url,
        "source_url": url,
        "source_geography": {"level": "national", "label": "United States", "match_quality": "national_guidance"},
        "scope_basis": scope,
        "retrieved_at": "2026-09-20",
        "review_status": "external_source_retrieved_needs_human_review",
    }


TECHNICAL_SOURCES = {
    item["id"]: item
    for item in [
        technical_source("cpsc-gfci", "U.S. Consumer Product Safety Commission GFCI Fact Sheet", "https://www.cpsc.gov/s3fs-public/099_0.pdf", "GFCI protection types and qualified-electrician installation."),
        technical_source("cpsc-fire-safety", "U.S. Consumer Product Safety Commission Fire Safety", "https://www.cpsc.gov/Safety-Education/Safety-Education-Centers/Fire-Safety-Information-Center", "Smoke-alarm placement, testing, and replacement guidance."),
        technical_source("cpsc-co-alarms", "U.S. Consumer Product Safety Commission CO Alarms", "https://www.cpsc.gov/Safety-Education/Safety-Education-Centers/Carbon-Monoxide-Information-Center/CO-Alarms", "CO-alarm placement, testing, and maintenance guidance."),
        technical_source("energy-star-hvac", "ENERGY STAR HVAC Maintenance Checklist", "https://www.energystar.gov/saveathome/heating-cooling/maintenance-checklist", "Professional heating/cooling inspection, cleaning, controls, airflow, and combustion checks."),
        technical_source("doe-furnace-venting", "U.S. Department of Energy High-Efficiency Gas Furnace Measure Guideline", "https://www1.eere.energy.gov/buildings/publications/pdfs/building_america/highefficiency_gas_furnaces.pdf", "Existing vent-system deterioration, terminal clearances, and qualified HVAC review."),
        technical_source("doe-kickout-flashing", "Building America Step and Kick-Out Flashing Guide", "https://basc.pnnl.gov/resource-guides/step-and-kick-out-flashing-roof-wall-intersections", "Roof-wall drainage-plane integration and concealed-damage inspection."),
        technical_source("doe-gutters", "Building America Gutters and Downspouts Guide", "https://basc.pnnl.gov/resource-guides/gutters-and-downspouts", "Roof runoff, gutter drainage, drip-edge relationship, and water management."),
        technical_source("doe-drip-edge", "Building Science Education Drip Edge Guide", "https://bsesc.energy.gov/energy-basics/drip-edge-roof-eaves-and-rakes", "Roof-edge moisture protection and drip-edge integration."),
        technical_source("doe-wall-flashing", "Building America Exterior Wall Flashing Guide", "https://basc.pnnl.gov/resource-guides/flashing-bottom-exterior-walls", "Drainage-plane, flashing, cladding, and concealed moisture context."),
        technical_source("epa-moisture", "U.S. EPA Mold, Moisture and Your Home", "https://www.epa.gov/mold/brief-guide-mold-moisture-and-your-home", "Moisture-source correction, drying, and limits on sealing damp or moldy materials."),
        technical_source("epa-bathroom-water", "U.S. EPA Remodeling and Indoor Air Quality", "https://www.epa.gov/indoor-air-quality-iaq/remodeling-your-home-and-indoor-air-quality", "Bathroom leak, wet-wall, and water-resistant surface guidance."),
        technical_source("hardie-fiber-cement", "James Hardie Fiber-Cement Repair Guidance", "https://www.jameshardie.com/faq/", "Small fiber-cement damage repair and failed perimeter caulk maintenance."),
    ]
}


def research_rule(pattern: str, domain: str, system: str, trade: str, interpretation: str, unknown: str, next_task: str, why: str, source_ids: list[str]) -> dict[str, Any]:
    return {"pattern": pattern, "domain": domain, "system": system, "trade": trade, "interpretation": interpretation, "unknown": unknown, "next_task": next_task, "why": why, "source_ids": source_ids}


RESEARCH_RULES = [
    research_rule(r"trip hazard", "site_grading_drainage", "Site / Hardscape", "Concrete / hardscape contractor", "A walking-surface displacement is operationally a fall hazard. The realistic response is localized leveling or repair when the material and movement allow it, or section replacement when deterioration or movement is broader.", "Surface material, vertical displacement, affected area, and the cause of movement are not established.", "Measure the maximum vertical displacement, identify whether the surface is concrete, asphalt, or pavers, and photograph the full transition.", "Material, displacement, and movement cause determine whether leveling, patching, or replacement is the defensible path.", ["homeguide-sidewalk-repair", "fixr-sidewalk-repair"]),
    research_rule(r"cracks?- minor", "foundation_structure", "Foundation / Structure", "Foundation specialist or structural engineer", "A visible crack can remain a localized non-structural repair only after its width, pattern, moisture condition, and movement history support that conclusion. Movement or displacement changes the path to structural evaluation before repair.", "Crack width, orientation, displacement, moisture, and evidence of ongoing movement are unknown.", "Photograph the full crack with a ruler, record width and any displacement, and compare it with dated photos or monitoring marks before selecting repair.", "Those observations separate a stable cosmetic or injection repair from a condition needing structural evaluation.", ["homeguide-foundation-inspection", "homeguide-foundation-crack", "angi-foundation-crack"]),
    research_rule(r"fiber-cement siding|rot damaged siding", "moisture_envelope", "Exterior Envelope / Siding", "Exterior siding contractor", "Localized fiber-cement damage may be patchable or replaceable by section, but softness, staining, failed flashing, or damaged sheathing would expand the work beyond the visible face.", "Damage dimensions, material match, fastener condition, and concealed sheathing or flashing condition are unknown.", "Measure and photograph the damaged siding area, probe the visible edges for softness, and inspect the nearest flashing and wall transition for moisture evidence.", "The visible extent and substrate condition decide whether this is a surface repair, board replacement, or broader envelope investigation.", ["hardie-fiber-cement", "doe-wall-flashing", "homeguide-siding-repair"]),
    research_rule(r"minor caulking|split caulking", "moisture_envelope", "Exterior Envelope / Siding", "Exterior siding contractor", "Failed exterior sealant may be a localized joint-maintenance item, but resealing is appropriate only after the adjacent surfaces are dry, sound, and not concealing a flashing or drainage-plane defect.", "Joint length, substrate condition, moisture behind the joint, and compatibility of replacement sealant are unknown.", "Photograph the complete joint, measure its length and width, and check whether adjacent siding or trim is soft, stained, loose, or wet before resealing.", "Sound, dry adjacent materials support a localized sealant repair; deterioration or moisture changes the path to envelope repair.", ["hardie-fiber-cement", "doe-wall-flashing", "epa-moisture"]),
    research_rule(r"lost(?: window)? seals", "windows_doors_finish_carpentry", "Windows / Doors", "Window repair contractor", "Condensation or fogging between panes usually points to a failed insulated-glass seal rather than a surface-cleaning issue. The practical choice is glass-unit replacement when the frame is serviceable or full-window replacement when the frame, sash, or hardware is also deficient.", "Frame and sash condition, glass dimensions, unit compatibility, and the number of affected windows are unknown.", "Confirm that fogging is between the panes, record glass and frame dimensions, and test sash and hardware operation.", "That evidence distinguishes insulated-glass replacement from a complete window replacement.", ["homeguide-window-seal", "angi-window-seal", "fixr-window-seal"]),
    research_rule(r"decking- deterioration", "deck_carpentry", "Deck / Carpentry", "Deck contractor or carpenter", "Visible deck deterioration can be limited to replaceable decking, but softness at fasteners, joists, beams, posts, or ledger connections would expand the path into structural component repair.", "The depth and area of deterioration and the condition of supporting framing and connections are unknown.", "Photograph and probe the affected boards and visible framing, including fasteners and ledger area, to determine whether deterioration is limited to decking or extends into structural members.", "The framing check separates limited board work from a broader structural deck repair.", ["homeguide-deck-simple", "angi-deck-limited", "fixr-deck-patching"]),
    research_rule(r"hard surfaces- deterioration", "site_grading_drainage", "Site / Hardscape", "Concrete / hardscape contractor", "Deteriorated hardscape may support resurfacing when the slab remains stable, while heaving, settlement, drainage defects, or deep section loss generally require a different repair or replacement path.", "Material, measured area, depth of deterioration, movement, and drainage condition are unknown.", "Identify the surface material, measure the affected area and any height change, and document cracking, heaving, settlement, and nearby drainage.", "Substrate stability and movement determine whether resurfacing is viable or replacement/correction is needed.", ["homeguide-concrete-resurfacing", "fixr-sidewalk-repair"]),
    research_rule(r"exposed(?: roof)? fasteners", "roof", "Roof", "Roofing contractor", "Exposed roof fasteners can be a localized maintenance repair when the surrounding roofing and deck are sound; corrosion, failed seals, repeated leakage, or widespread fastener exposure would broaden the scope.", "Fastener count, corrosion, seal condition, active leakage, and surrounding roof/deck condition are unknown.", "Photograph and count the exposed fasteners, document seal and corrosion condition, and inspect the roof underside directly below for staining or dampness.", "Extent and underside evidence determine whether localized sealing/fastener work is enough.", ["doe-drip-edge", "homeguide-roof-minor", "angi-roof-repair"]),
    research_rule(r"minor moss", "roof", "Roof", "Roofing contractor", "Moss is primarily a maintenance condition, but aggressive cleaning can damage some roof coverings. The useful path depends on covering type, remaining condition, moss extent, and safe access.", "Roof material, moss coverage, surface deterioration, pitch, and access are unknown.", "Identify the roof covering, photograph moss coverage and nearby surface wear, and have a roofer select a cleaning method compatible with that material.", "Material and surface condition determine whether cleaning alone is appropriate or repairs are also needed.", ["homeguide-roof-cleaning", "angi-roof-cleaning"]),
    research_rule(r"caulking at the roof|roof jack flashing caulked", "roof", "Roof", "Roofing contractor", "Sealant at a roof penetration may be a temporary maintenance detail rather than a durable flashing repair. The repair choice depends on whether the boot/flashing is intact and integrated with the roof covering.", "Flashing type, sealant condition, roof-covering condition, and evidence of leakage below are unknown.", "Photograph the complete penetration and flashing laps, then inspect directly below it for staining or dampness before choosing reseal versus flashing replacement.", "Flashing integrity and underside evidence distinguish maintenance from a water-entry repair.", ["doe-kickout-flashing", "homeguide-roof-flashing", "angi-roof-flashing"]),
    research_rule(r"gutters restricted holding water", "site_grading_drainage", "Roof Drainage", "Gutter / roofing contractor", "Standing water in a gutter can result from debris, inadequate slope, blocked discharge, loose supports, or deformation. Cleaning is sufficient only if flow and pitch are sound afterward.", "Whether debris, pitch, supports, downspout blockage, or fascia damage is causing the standing water is unknown.", "Clean and flush the affected run, verify slope and downspout discharge, and photograph supports and fascia where water remains.", "A post-cleaning flow check separates routine cleaning from gutter realignment, hardware repair, or fascia work.", ["doe-gutters", "homeguide-gutter-cleaning", "angi-gutter-cleaning"]),
    research_rule(r"kick-out flashings missing", "moisture_envelope", "Roof / Wall Flashing", "Roofing and siding contractor", "Missing kick-out flashing can direct concentrated roof runoff behind wall cladding. A durable correction must integrate roof flashing, wall drainage plane, siding clearance, and the gutter rather than merely cover the visible joint.", "Wall-cavity moisture, sheathing condition, existing step flashing, and the amount of siding removal required are unknown.", "Open or inspect enough of the roof-wall termination to confirm step flashing and drainage-plane integration, and check the wall below for moisture or deterioration.", "The concealed integration and damage check determine whether this is flashing-only work or flashing plus wall repair.", ["doe-kickout-flashing", "doe-wall-flashing", "homeguide-roof-flashing"]),
    research_rule(r"drip edge missing", "roof", "Roof", "Roofing contractor", "Drip edge protects the roof edge and helps direct water away from sheathing and fascia. Retrofit feasibility depends on roof-covering integration and the condition of the edge, fascia, and gutter.", "Linear footage, edge condition, existing underlayment/covering integration, and access are unknown.", "Measure the missing length and photograph the roof edge, underlayment/covering interface, fascia, and gutter relationship.", "Those details determine whether drip edge can be added locally or whether adjacent roof-edge materials also need repair.", ["doe-drip-edge", "doe-gutters", "homeguide-drip-edge"]),
    research_rule(r"unprotected knockout", "electrical", "Electrical", "Licensed electrician", "An open or oversized panel knockout leaves the enclosure incomplete. The practical repair is normally a listed closure or fitting when the enclosure is otherwise serviceable; panel damage or incompatible openings can require broader work.", "Opening dimensions, panel condition, enclosure compatibility, and whether other panel defects are present are unknown.", "Have an electrician measure the opening, identify the panel/enclosure, and confirm whether a listed closure or fitting can restore the enclosure.", "Panel compatibility decides whether this is a small enclosure repair or a broader panel correction.", ["homeguide-electrical-small"]),
    research_rule(r"afci: none installed", "electrical", "Electrical", "Licensed electrician", "Absence of AFCI protection is an upgrade and applicability question, not proof that a particular retrofit method is suitable. Panel compatibility, circuit configuration, and locally applicable requirements determine the options.", "Applicable requirements, panel compatibility, shared-neutral conditions, and circuit count are unknown.", "Have an electrician identify the affected circuits, panel and breaker compatibility, and shared-neutral conditions before proposing AFCI protection.", "Those facts determine whether compatible breakers, another listed method, troubleshooting, or no retrofit is appropriate.", ["homeguide-afci-breaker", "homeguide-electrical-small"]),
    research_rule(r"cpvc plumbing issues", "plumbing", "Plumbing", "Licensed plumber", "A reported CPVC concern may support a localized repair when damage is isolated and accessible; repeated leakage, brittle material, or distributed deterioration shifts the decision toward broader replacement planning.", "The issue type, extent, leak history, pipe condition, access, and finish-restoration scope are unknown.", "Map the affected CPVC locations, photograph joints and damage, and have a plumber assess brittleness and whether the condition is isolated or systemic.", "Extent and material condition distinguish a targeted repair from broader repiping.", ["homeguide-pipe-repair", "homeguide-house-repipe"]),
    research_rule(r"corroded piping connections", "plumbing", "Plumbing", "Licensed plumber", "Corrosion at one connection may be repairable locally, but active leakage or similar corrosion at multiple connections can indicate broader material or water-condition involvement.", "Active leakage, depth and extent of corrosion, adjacent pipe condition, and access are unknown.", "Dry and photograph the connection, check for active seepage, and inspect comparable accessible connections for similar corrosion.", "Whether corrosion is isolated or repeated determines local connection repair versus broader piping evaluation.", ["homeguide-pipe-repair", "homeguide-house-repipe"]),
    research_rule(r"exhaust vent- slope", "hvac", "HVAC / Combustion Venting", "Licensed HVAC contractor", "Improper combustion-vent slope can affect condensate drainage and safe vent performance. The correction depends on equipment and fuel type, vent material, route, clearances, and manufacturer requirements.", "Equipment type, vent material, measured slope, route, deterioration, and manufacturer requirements are unknown.", "Have an HVAC technician identify the appliance and vent system, measure the horizontal slope, and document joints, supports, corrosion, and termination.", "Those measurements determine whether support adjustment, section replacement, or a larger vent redesign is appropriate.", ["doe-furnace-venting", "energy-star-hvac", "homeguide-hvac-inspect"]),
    research_rule(r"needs servicing/cleaning|dirty furnace|clean and service", "hvac", "HVAC", "Licensed HVAC contractor", "Routine cleaning and service should include operating controls, airflow components, filters, condensate drainage where applicable, and combustion-related checks rather than surface cleaning alone.", "Equipment type, service history, operating condition, filter/airflow condition, and any repair needs are unknown.", "Schedule a documented HVAC service that records equipment condition, filter and blower condition, controls, airflow, condensate drainage, and combustion findings where applicable.", "A complete service record separates maintenance from a repair or replacement decision.", ["energy-star-hvac", "homeguide-furnace-clean", "angi-furnace-cleaning"]),
    research_rule(r"gfci missing|no gfci protection", "electrical", "Electrical", "Licensed electrician", "Missing GFCI protection can sometimes be addressed at an existing receptacle or breaker, but device location, downstream protection, grounding, wiring, and panel compatibility select the method.", "Existing wiring, grounding, upstream/downstream protection, box condition, and panel compatibility are unknown.", "Have an electrician test the affected receptacle and downstream devices, identify existing protection and grounding, and confirm the appropriate listed GFCI method.", "The circuit test prevents duplicate or incompatible work and identifies whether one device can protect downstream outlets.", ["cpsc-gfci", "homeguide-gfci-replacement", "angi-gfci"]),
    research_rule(r"receptacle loose", "electrical", "Electrical", "Licensed electrician", "A loose receptacle may need only secure mounting or device replacement, but a damaged box, overheated connection, or compromised wiring changes the scope.", "Whether the device, mounting ears, box, or wiring is loose or damaged is unknown.", "De-energize and have an electrician inspect device mounting, box condition, conductor terminations, and signs of heat damage.", "The loose component and wiring condition determine securement, device replacement, or box/wiring repair.", ["homeguide-outlet-replacement", "angi-outlet-repair", "angi-outlet-replacement"]),
    research_rule(r"no catch pan", "plumbing", "Laundry / Plumbing", "Licensed plumber or appliance installer", "A washing-machine pan above finished space is a loss-mitigation measure. A pan-only installation is practical only when appliance clearance, floor support, and a lawful drain or discharge route are workable.", "Appliance dimensions, available height, floor condition, drain route, and discharge feasibility are unknown.", "Measure the washer footprint and clearances, inspect the floor, and identify whether a feasible drain or approved discharge route exists before selecting a pan-only or pan-and-drain scope.", "The drain route and clearances are the facts that control feasibility and cost.", ["epa-moisture"]),
    research_rule(r"\bloose\b.*\btoilet\b|\btoilet\b.*\bloose\b", "plumbing", "Plumbing", "Licensed plumber", "Movement at a toilet can result from loose mounting, a failed seal, flange damage, or deteriorated flooring. Resetting the fixture is reasonable only when the toilet, flange, and subfloor are serviceable.", "Fixture condition, flange condition, seal leakage, and subfloor condition are unknown.", "Remove or lift the toilet as needed to confirm whether the flange is intact and whether the subfloor around the base is sound.", "This separates a routine reset or replacement from work involving a damaged flange or concealed floor deterioration.", ["epa-bathroom-water", "homeguide-toilet-repair", "angi-toilet-repair"]),
    research_rule(r"sticking shower door", "plumbing", "Bathroom / Glazing", "Shower-door or glazing contractor", "A sticking shower door may be corrected by adjustment or hardware repair when the glass and frame are sound; distortion, corrosion, unavailable hardware, or glass damage can favor replacement.", "Glass, frame, hinge/roller, alignment, opening dimensions, and leakage condition are unknown.", "Photograph the frame and hardware, test where the door binds, and measure the opening before choosing adjustment, hardware repair, or replacement.", "The binding point and component condition identify the smallest workable path.", ["homeguide-shower-repair", "fixr-shower-repair", "angi-shower-door"]),
    research_rule(r"faucet handle issue", "plumbing", "Plumbing", "Licensed plumber", "A handle problem may be limited to a loose handle or replaceable cartridge, but corrosion, leakage, discontinued parts, or damaged valve connections can make faucet replacement more practical.", "The failed component, active leakage, faucet model/parts availability, and connection condition are unknown.", "Identify the faucet model, test for leakage and handle movement, and inspect accessible supply and mounting connections.", "Component identity and leakage determine repair versus faucet replacement.", ["homeguide-faucet", "angi-faucet"]),
    research_rule(r"backsplash- caulking|caulk at spout", "plumbing", "Bathroom / Wet Area", "Plumber or qualified finish contractor", "Failed sealant at a wet-area joint can be a localized reseal when the substrate is dry and sound. Active leakage, soft materials, or a plumbing leak would require repair before new sealant.", "Substrate moisture, hidden damage, joint dimensions, and whether plumbing is leaking are unknown.", "Remove loose sealant, inspect and moisture-check the exposed joint and adjacent wall, and test the nearby fixture for leakage before resealing.", "Dry, sound materials support resealing; moisture or fixture leakage changes the repair path.", ["epa-bathroom-water", "epa-moisture", "homeguide-bath-caulk"]),
    research_rule(r"smoke alarm is over 10 yrs old|old smoke alarm", "life_safety", "Life Safety", "Licensed electrician or alarm installer", "A smoke alarm older than ten years has reached the CPSC replacement interval. Replacement still needs to match the existing power and interconnection arrangement and should be followed by functional testing.", "Power type, interconnection, device count, compatibility, and current test status are unknown.", "Record the alarm model, manufacture date, power source, and interconnection, then replace the aged unit with a compatible alarm and test the system.", "Compatibility and interconnection determine the replacement product and whether one or several alarms require coordinated work.", ["cpsc-fire-safety", "homeguide-smoke-alarm", "angi-smoke-alarm"]),
    research_rule(r"missing carbon monoxide detector", "life_safety", "Life Safety", "Licensed electrician or alarm installer", "A missing CO alarm leaves the reported level without the warning coverage described by CPSC guidance. The installation path depends on placement, power source, interconnection, and the existing alarm system.", "Exact placement, power/interconnection method, device count, and compatibility with existing alarms are unknown.", "Map existing smoke and CO alarms by level and sleeping area, then select a compatible location and power/interconnection method for the missing CO alarm.", "The alarm map establishes the actual coverage gap and prevents an unsupported placement assumption.", ["cpsc-co-alarms", "homeguide-co-alarm"]),
    research_rule(r"previous repairs attic", "attic_ventilation_insulation", "Attic / Structure", "Roofing, attic, or structural specialist", "Evidence of a prior attic repair is not itself proof of current failure. The useful question is whether the repaired area is stable, dry, adequately connected, and documented.", "Repair purpose, date, materials, current moisture, movement, and permit or invoice history are unknown.", "Photograph the entire repaired area and connections, take moisture readings at and around it, and obtain permits, invoices, or prior photos if available.", "Current condition plus repair history determines whether documentation is enough or specialist/structural evaluation is warranted.", ["epa-moisture", "homeguide-attic-inspection"]),
]


def comparison_sources(primary_source_id: str | None) -> list[dict[str, Any]]:
    if not primary_source_id or primary_source_id not in SOURCES:
        return []
    ids = [primary_source_id, *ALTERNATE_SOURCE_IDS.get(primary_source_id, [])]
    primary_unit = SOURCES[primary_source_id]["price_unit"]
    return [SOURCES[source_id] for source_id in ids if SOURCES[source_id]["price_unit"] == primary_unit][:3]


def synthesized_range(price_sources: list[dict[str, Any]]) -> tuple[float, float, str]:
    overlap_low = max(source_record["price_low"] for source_record in price_sources)
    overlap_high = min(source_record["price_high"] for source_record in price_sources)
    if len(price_sources) > 1 and overlap_low <= overlap_high:
        return overlap_low, overlap_high, "moderate_confidence"
    return (
        min(source_record["price_low"] for source_record in price_sources),
        max(source_record["price_high"] for source_record in price_sources),
        "broad_preliminary",
    )


def path(path_id: str, label: str, source_id: str | None, assumptions: list[str], exclusions: list[str]) -> dict[str, Any]:
    return {"id": path_id, "label": label, "source_id": source_id, "assumptions": assumptions, "major_exclusions": exclusions}


RULES = [
    (r"trip hazard", [path("repair-hard-surface", "Repair or level the affected hard surface", "homeguide-sidewalk-repair", ["Concrete is the affected material", "Area is accessible"], ["Replacement beyond the measured area", "Drainage or structural correction"])], ["surface material", "affected area", "vertical displacement", "cause of movement"]),
    (r"cracks?- minor", [path("inspect-crack", "Confirm whether the crack is stable and non-structural", "homeguide-foundation-inspection", ["A focused professional assessment is appropriate"], ["Testing or engineered design"]), path("repair-stable-crack", "Repair a confirmed stable non-structural crack", "homeguide-foundation-crack", ["Crack is stable and suitable for injection"], ["Settlement stabilization", "Waterproofing", "Structural design"])], ["crack width and pattern", "movement history", "moisture", "whether structural movement is present"]),
    (r"fiber-cement siding|rot damaged siding", [path("repair-siding", "Repair the localized siding damage", "homeguide-siding-repair", ["Damage is localized", "Compatible material is available"], ["Whole-wall replacement", "Concealed sheathing or flashing damage"])], ["repair area", "material match", "concealed moisture damage", "access"]),
    (r"minor caulking|split caulking", [path("repair-envelope-joint", "Repair the affected exterior joint or adjacent siding detail", "homeguide-siding-repair", ["Condition is localized to the exterior finish/joint"], ["Window replacement", "Concealed sheathing damage"])], ["joint length", "adjacent material condition", "access", "whether water entered behind the assembly"]),
    (r"lost(?: window)? seals", [path("repair-window-seal", "Repair or replace the failed window seal", "homeguide-window-seal", ["Frame and insulated unit remain serviceable"], ["Frame repair", "Custom access"]), path("replace-insulated-glass", "Replace the insulated glass unit", "homeguide-window-glass", ["Frame is serviceable", "Compatible glass is available"], ["Full frame replacement"]), path("replace-window", "Replace the window if the frame or unit is not serviceable", "homeguide-window-replacement", ["One standard window"], ["Finish repair", "Multiple-window package pricing"])], ["frame condition", "glass-unit compatibility", "window size", "access"]),
    (r"decking- deterioration", [path("limited-deck-repair", "Complete a limited deck repair", "homeguide-deck-simple", ["Deterioration is localized"], ["Structural redesign", "Broad framing replacement"]), path("broader-deck-repair", "Repair several deteriorated deck components", "homeguide-deck-average", ["Several components require work"], ["Full deck replacement", "Engineered structural work"])], ["extent and depth of deterioration", "framing condition", "deck size", "access"]),
    (r"hard surfaces- deterioration", [path("resurface-hard-surface", "Resurface the affected concrete hard surface", "homeguide-concrete-resurfacing", ["Existing concrete remains a suitable substrate"], ["Slab replacement", "Settlement correction", "Drainage redesign"])], ["surface material", "measured area", "settlement or heaving", "drainage condition"]),
    (r"exposed(?: roof)? fasteners|caulking at the roof|roof jack flashing caulked", [path("targeted-roof-repair", "Evaluate and complete a localized roof repair", "homeguide-roof-minor", ["Work remains localized"], ["Decking or structural repair", "Whole-roof replacement"]), path("repair-flashing", "Repair or replace the affected flashing detail", "homeguide-roof-flashing", ["Flashing repair is localized"], ["Water-damaged sheathing or interior restoration"])], ["roof age and material", "detail dimensions", "active leakage", "concealed decking condition", "access and pitch"]),
    (r"minor moss", [path("clean-roof", "Clean the roof and address the moss condition", "homeguide-roof-cleaning", ["Roof covering is serviceable"], ["Shingle repair", "Replacement of damaged roof materials"])], ["roof size and pitch", "covering condition", "moss extent", "safe access"]),
    (r"gutters restricted holding water", [path("clean-gutters", "Clean and flush the gutter/downspout system", "homeguide-gutter-cleaning", ["Restriction is debris-related"], ["Fascia repair", "Gutter replacement"]), path("repair-gutter-pitch", "Repair or realign the gutter if pitch or hardware is contributing", "homeguide-gutter-repair", ["Repair is localized"], ["Full gutter replacement", "Rotted fascia or soffit repair"])], ["debris vs pitch defect", "gutter length and height", "downspout flow", "fascia condition"]),
    (r"kick-out flashings missing", [path("add-or-repair-flashing", "Evaluate and add or repair the localized flashing detail", "homeguide-roof-flashing", ["Work is localized and compatible with the existing assembly"], ["Siding removal beyond the repair area", "Concealed water damage"]), path("repair-water-affected-area", "Repair water-affected roof or wall materials if found", "homeguide-roof-water-damage", ["Concealed damage is present"], ["Major structural restoration"] )], ["wall/roof geometry", "concealed moisture damage", "siding removal needed", "roof access"]),
    (r"drip edge missing", [path("add-drip-edge", "Evaluate adding the missing drip-edge flashing", "homeguide-drip-edge", ["Existing roof edge can accept a localized flashing correction"], ["Whole-roof replacement", "Fascia or decking repair"])], ["linear footage", "roof edge and fascia condition", "roof-covering integration", "access"]),
    (r"unprotected knockout", [path("close-panel-opening", "Have an electrician evaluate and close the panel opening", "homeguide-electrical-small", ["No broader panel defect is found"], ["Panel replacement", "Circuit correction beyond the opening"])], ["panel compatibility", "opening size", "other panel defects", "service-call bundling"]),
    (r"afci: none installed", [path("evaluate-afci", "Determine applicability and panel compatibility for AFCI protection", "homeguide-electrical-small", ["Electrician evaluation is needed before selecting a method"], ["Panel replacement", "Broad rewiring"]), path("retrofit-afci-breaker", "Add AFCI protection where the existing panel and circuit support it", "homeguide-afci-breaker", ["Compatible listed breaker and wiring are available"], ["Panel replacement", "Troubleshooting shared neutrals or damaged wiring"])], ["applicable local requirements", "panel and breaker compatibility", "circuit wiring configuration", "number of circuits"]),
    (r"gfci missing", [path("replace-with-gfci", "Replace an existing receptacle with GFCI protection where appropriate", "homeguide-gfci-replacement", ["Existing box and wiring are serviceable"], ["New circuit", "Wall repair"]), path("install-new-gfci", "Install new GFCI protection if the existing layout requires a new device", "homeguide-gfci-new", ["Existing panel has capacity"], ["Panel upgrade", "Long wire runs"])], ["existing wiring and grounding", "protection location", "panel capacity", "whether one device protects downstream outlets"]),
    (r"receptacle loose", [path("secure-or-replace-outlet", "Secure or replace the affected receptacle after checking the box and wiring", "homeguide-outlet-replacement", ["Existing box and wiring are serviceable"], ["New wiring", "Wall repair", "Panel work"])], ["box condition", "wire condition", "whether the device alone is loose", "service-call bundling"]),
    (r"cpvc plumbing issues", [path("targeted-pipe-repair", "Repair a localized failed or vulnerable section if the condition is isolated", "homeguide-pipe-repair", ["Issue is isolated and accessible"], ["Wall/ceiling finish repair", "Whole-house repipe"]), path("whole-house-repipe", "Evaluate whole-house repiping if condition is systemic", "homeguide-house-repipe", ["Broad material replacement is justified after field evaluation"], ["Finish restoration", "Fixture replacement", "Hazardous-material work"])], ["whether deterioration is localized or systemic", "leak history", "pipe access", "home size", "finish restoration"]),
    (r"corroded piping connections", [path("repair-connection", "Repair the affected piping connection if corrosion is localized", "homeguide-pipe-repair", ["Connection is accessible and adjacent pipe is serviceable"], ["Finish repair", "Broad pipe replacement"]), path("broader-pipe-replacement", "Replace a broader run if corrosion is systemic", "homeguide-house-repipe", ["Field evaluation confirms broader material involvement"], ["Finish restoration", "Fixture replacement"])], ["extent of corrosion", "active leakage", "adjacent pipe condition", "access"]),
    (r"exhaust vent- slope", [path("inspect-venting", "Have the heating system and venting configuration evaluated", "homeguide-hvac-inspect", ["A standard service visit can establish the condition"], ["Engineered vent redesign", "Equipment replacement"]), path("correct-hvac-vent", "Correct the venting condition if the technician confirms repairable scope", "homeguide-hvac-repair", ["Correction is within a routine furnace repair visit"], ["Chimney work", "Equipment replacement", "Permit fees"])], ["equipment and fuel type", "vent material and route", "condensate evidence", "required clearances", "permit needs"]),
    (r"needs servicing/cleaning|dirty furnace|clean and service", [path("service-heating-system", "Service and clean the heating equipment", "homeguide-furnace-clean", ["Standard accessible furnace"], ["Parts replacement", "Duct cleaning", "Equipment replacement"])], ["equipment type", "service history", "access", "whether repairs are discovered"]),
    (r"no catch pan", [path("confirm-pan-scope", "Confirm appliance dimensions, drainage, and feasible pan arrangement before pricing", None, ["A pan is feasible at this location"], ["Plumbing relocation", "Floor repair"])], ["appliance dimensions", "drain route", "floor condition", "access"]),
    (r"\bloose\b.*\btoilet\b|\btoilet\b.*\bloose\b", [path("reset-toilet", "Reset or repair the existing toilet if the fixture and flange are serviceable", "homeguide-toilet-repair", ["Fixture is reusable"], ["Flange replacement", "Floor repair"]), path("repair-flange", "Replace the flange if it is damaged", "homeguide-toilet-flange", ["Damage is limited to the flange"], ["Subfloor or finish-floor repair"]), path("replace-toilet", "Replace the toilet if the existing fixture is not worth retaining", "homeguide-toilet-replacement", ["Existing rough-in is usable"], ["Flange or subfloor repair", "Plumbing relocation"])], ["fixture condition", "flange condition", "subfloor condition", "intended retain-vs-replace outcome"]),
    (r"sticking shower door", [path("adjust-shower-door", "Adjust or repair the existing shower door hardware if serviceable", "homeguide-shower-repair", ["Glass and frame are serviceable"], ["Glass replacement", "Frame replacement"]), path("replace-shower-door", "Replace the shower door if the frame, glass, or hardware is not serviceable", "homeguide-shower-door", ["Existing opening accepts a standard replacement"], ["Tile repair", "Custom enclosure work"])], ["glass and frame condition", "hardware availability", "opening dimensions", "leakage"]),
    (r"faucet handle issue", [path("replace-bath-faucet", "Repair components or replace the bathroom faucet after confirming the failure", "homeguide-faucet", ["Existing sink and supply connections are serviceable"], ["Valve or pipe repair behind the wall", "Sink replacement"])], ["handle/cartridge failure", "faucet age and compatibility", "leakage", "access to connections"]),
    (r"backsplash- caulking|caulk at spout", [path("reseal-wet-area", "Remove failed sealant and reseal the affected wet-area joint", "homeguide-bath-caulk", ["Condition is limited to the sealant joint"], ["Tile or wall repair", "Concealed moisture remediation", "Valve repair"])], ["joint length", "substrate condition", "concealed moisture", "whether plumbing is leaking"]),
    (r"smoke alarm is over 10 yrs old|old smoke alarm", [path("replace-smoke-alarm", "Replace the aged smoke alarm with a compatible unit", "homeguide-smoke-alarm", ["One device", "Existing location is usable"], ["New wiring", "Multiple-device package pricing"])], ["battery vs hardwired type", "interconnection", "number of devices", "existing wiring"]),
    (r"missing carbon monoxide detector", [path("install-co-alarm", "Install a carbon-monoxide alarm in an appropriate location", "homeguide-co-alarm", ["One device"], ["New wiring", "Multiple-device package pricing"])], ["device type", "power/interconnection method", "number of devices", "existing wiring"]),
    (r"previous repairs attic", [path("inspect-attic-repair", "Inspect the prior attic repair and document its present condition", "homeguide-attic-inspection", ["A focused visual attic inspection is sufficient for initial review"], ["Destructive testing", "Engineering", "Any repair discovered later"])], ["repair purpose and date", "current moisture or movement", "access", "supporting permits or invoices"]),
]


def _matching_rule(record: dict[str, Any]):
    source_record = record.get("source", {})
    card = record.get("finding_card", {})
    text = " ".join(str(value or "") for value in [card.get("finding_title"), source_record.get("source_section"), source_record.get("inspector_statement"), source_record.get("inspector_recommendation")]).lower()
    for pattern, paths, decision_factors in RULES:
        if re.search(pattern, text, re.IGNORECASE):
            return paths, decision_factors
    return [], []


def _record_text(record: dict[str, Any]) -> str:
    source_record = record.get("source", {})
    card = record.get("finding_card", {})
    return " ".join(str(value or "") for value in [card.get("finding_title"), source_record.get("source_section"), source_record.get("inspector_statement"), source_record.get("inspector_recommendation")]).lower()


def _matching_research_rule(record: dict[str, Any]) -> dict[str, Any] | None:
    text = _record_text(record)
    return next((rule for rule in RESEARCH_RULES if re.search(rule["pattern"], text, re.IGNORECASE)), None)


def apply_research_profile(record: dict[str, Any], retrieved_at: str) -> list[dict[str, Any]]:
    profile = _matching_research_rule(record)
    if not profile:
        return []
    organization = record["organization"]
    organization["domain_key"] = profile["domain"]
    organization["building_system"] = profile["system"]
    organization["semantic_classification_basis"] = "issue_specific_research_profile_needs_human_review"
    epistemic = record["epistemic_states"]
    epistemic["shelter_prep_interpretation"] = profile["interpretation"]
    epistemic["unknowns"] = [profile["unknown"], *[
        value for value in epistemic.get("unknowns", [])
        if "human review has not verified" not in value.lower()
        and "round 1" not in value.lower()
        and value != profile["unknown"]
    ]]
    next_evidence = record["smallest_useful_next_evidence"]
    next_evidence.update({
        "uncertainty": profile["unknown"],
        "smallest_fact_or_check": profile["next_task"],
        "next_evidence_needed": profile["next_task"],
        "owner": profile["trade"],
        "why_it_matters": profile["why"],
        "reason": "issue_specific_decision_evidence",
    })
    record["recommended_next_step"].update({"move": profile["next_task"], "owner": profile["trade"], "why_this_next_step": profile["why"]})
    card = record["finding_card"]
    card["next_step_owner"] = profile["trade"]
    card["recommended_next_step"] = profile["next_task"]
    card["why_next_step"] = profile["why"]
    card["what_we_dont_know"] = epistemic["unknowns"]
    card["research_source_refs"] = list(dict.fromkeys(profile["source_ids"]))
    card["research_status"] = "bounded_independent_research_needs_human_review"
    record["review_workflow"]["reasons"] = list(dict.fromkeys([*record["review_workflow"].get("reasons", []), "independent_research_needs_review"]))
    sources = []
    for source_id in profile["source_ids"]:
        source_record = TECHNICAL_SOURCES.get(source_id) or SOURCES.get(source_id)
        if source_record:
            sources.append({**source_record, "retrieved_at": retrieved_at})
    return sources


def apply_decision_support(record: dict[str, Any], retrieved_at: str) -> list[dict[str, Any]]:
    card = record["finding_card"]
    research_sources = apply_research_profile(record, retrieved_at)
    configured_paths, decision_factors = _matching_rule(record)
    rendered_paths = []
    used_sources = []
    for configured in configured_paths[:3]:
        price_sources = comparison_sources(configured["source_id"])
        price_source = price_sources[0] if price_sources else None
        if price_sources:
            used_sources.extend(price_sources)
            price_low, price_high, range_status = synthesized_range(price_sources)
        else:
            price_low, price_high, range_status = None, None, "blocked"
        rendered_paths.append({
            "id": configured["id"],
            "label": configured["label"],
            "status": "sourced_planning_range" if price_source else "blocked_missing_sourced_range",
            "price_low": price_low,
            "price_high": price_high,
            "price_unit": price_source.get("price_unit") if price_source else None,
            "price_geography": dict(NATIONAL) if price_source else {},
            "price_source_refs": [source_record["id"] for source_record in price_sources],
            "scope_basis": price_source.get("scope_basis") if price_source else "No defensible source is attached for this path.",
            "assumptions": configured["assumptions"],
            "major_exclusions": configured["major_exclusions"],
            "confidence": "moderate" if range_status == "moderate_confidence" else "low",
            "range_status": range_status,
            "confidence_reason": (
                "Independent sources overlap for this stated scope; field conditions, quantities, and access remain unverified."
                if range_status == "moderate_confidence"
                else "The source set is limited or does not overlap; field scope, quantities, access, and hidden conditions remain unverified."
            ),
            "retrieved_at": retrieved_at if price_source else None,
            "review_status": "needs_human_review",
            "range_history": ([{
                "revision_id": f"{record['id']}-{configured['id']}-initial",
                "prior_low": None,
                "prior_high": None,
                "new_low": price_low,
                "new_high": price_high,
                "movement": "initial",
                "evidence_causing_change": ["inspection finding", *[source_record["scope_basis"] for source_record in price_sources]],
                "assumptions": configured["assumptions"],
                "unresolved_unknowns": decision_factors,
                "source_refs": [source_record["id"] for source_record in price_sources],
                "geography": dict(NATIONAL),
                "author": {"type": "system", "id": "phase1-decision-support"},
                "timestamp": retrieved_at,
                "review_status": "needs_human_review",
            }] if price_source else []),
        })

    priced_project_paths = [item for item in rendered_paths if item["price_low"] is not None and item["price_unit"] == "project"]
    card["repair_paths"] = rendered_paths
    card["what_changes_the_decision"] = decision_factors
    card["decision_support_status"] = "sourced_paths_available" if used_sources else "no_sourced_path_available"
    card["research_source_refs"] = list(dict.fromkeys([
        *card.get("research_source_refs", []),
        *[source_record["id"] for source_record in used_sources],
    ]))
    card["transaction_considerations"] = [
        "Repair, replacement, and information-gathering paths can have different timing and ownership implications.",
        "The recipient should choose among supported paths after the listed decision-changing facts are confirmed.",
    ]
    if used_sources:
        workflow = card.get("review_workflow", {})
        reasons = [reason for reason in workflow.get("reasons", []) if reason != "missing_price_source"]
        if "sourced_path_range_needs_review" not in reasons:
            reasons.append("sourced_path_range_needs_review")
        workflow["reasons"] = reasons
        card["review_workflow"] = workflow
        card["what_we_dont_know"] = [
            "Final field scope, measured quantities, access, hidden conditions, permits, and contractor pricing remain unverified."
            if "Final repair scope, contractor means/methods, permits, and cost are outside this Round 1 benchmark." in unknown
            else unknown
            for unknown in card.get("what_we_dont_know", [])
        ]
    if priced_project_paths:
        card["price_low"] = min(item["price_low"] for item in priced_project_paths)
        card["price_high"] = max(item["price_high"] for item in priced_project_paths)
        card["price_stage"] = "early_multi_path_planning"
        card["price_geography"] = dict(NATIONAL)
        card["price_source_refs"] = list(dict.fromkeys(source["id"] for source in used_sources))
        card["price_range_explanation"] = "Non-additive planning envelope across the listed realistic paths. Do not sum mutually exclusive options; field evidence should narrow or change the applicable path."
        card["pricing_contract_status"] = "READY_FOR_UI_CONTRACT"
        card["range_history"] = [{
            "revision_id": f"{record['id']}-planning-envelope-initial",
            "prior_low": None,
            "prior_high": None,
            "new_low": card["price_low"],
            "new_high": card["price_high"],
            "movement": "initial",
            "evidence_causing_change": ["source-backed repair paths matched to the inspection finding"],
            "assumptions": ["Only one applicable path should normally be selected; ranges are not additive."],
            "unresolved_unknowns": decision_factors,
            "source_refs": card["price_source_refs"],
            "geography": dict(NATIONAL),
            "author": {"type": "system", "id": "phase1-decision-support"},
            "timestamp": retrieved_at,
            "review_status": "needs_human_review",
        }]
    elif used_sources:
        card["price_stage"] = "sourced_unit_pricing_only"
        card["price_source_refs"] = list(dict.fromkeys(source["id"] for source in used_sources))
        card["price_range_explanation"] = "Sourced unit pricing is available, but measured quantity is missing, so no project total is claimed."
        card["pricing_contract_status"] = "BLOCKED_MISSING_SOURCED_RANGE"
        card["path_pricing_status"] = "PATH_PRICING_AVAILABLE_QUANTITY_REQUIRED"
    record["localized_cost_context"] = {
        **record.get("localized_cost_context", {}),
        "status": card.get("path_pricing_status", card["pricing_contract_status"]).lower(),
        "scope_defined_enough_for_cost_context": bool(used_sources),
        "cost_range": ({"low": card["price_low"], "high": card["price_high"]} if card.get("price_low") is not None else None),
        "price_sources": [source["id"] for source in used_sources],
        "reason_not_priced": (
            "Measured quantity is required before the sourced unit range can become a project range."
            if used_sources and not priced_project_paths
            else None if used_sources
            else "No defensible source in the current supported geography catalog matched this finding."
        ),
    }
    unique_sources = {source["id"]: source for source in research_sources}
    unique_sources.update({source["id"]: {**source, "retrieved_at": retrieved_at} for source in used_sources})
    return list(unique_sources.values())


def enrich_decision_support(records: list[dict[str, Any]], retrieved_at: str) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    catalog: dict[str, dict[str, Any]] = {}
    for record in records:
        for price_source in apply_decision_support(record, retrieved_at):
            catalog[price_source["id"]] = price_source

    categories: dict[str, int] = {}
    priced_findings = 0
    blocked_findings = 0
    decisions: list[str] = []
    tasks: list[str] = []
    for record in records:
        system = record.get("organization", {}).get("building_system", "Inspection findings")
        categories[system] = categories.get(system, 0) + 1
        card = record["finding_card"]
        if any(path.get("price_low") is not None for path in card.get("repair_paths", [])):
            priced_findings += 1
        else:
            blocked_findings += 1
        decisions.extend(card.get("what_changes_the_decision", []))
        if card.get("recommended_next_step"):
            tasks.append(card["recommended_next_step"])
    overview = {
        "total_findings": len(records),
        "major_categories": [{"label": label, "finding_count": count} for label, count in sorted(categories.items(), key=lambda item: (-item[1], item[0]))],
        "findings_with_sourced_paths": priced_findings,
        "findings_without_sourced_paths": blocked_findings,
        "decision_factors": list(dict.fromkeys(decisions))[:10],
        "immediate_next_tasks": list(dict.fromkeys(tasks))[:8],
        "aggregate_cost_rule": "Do not sum finding or path ranges. Options may be mutually exclusive, scopes may overlap, mobilization may bundle, and hidden conditions remain unresolved.",
        "review_status": "needs_human_review",
    }
    return list(catalog.values()), overview
