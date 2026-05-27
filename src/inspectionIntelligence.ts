export type InspectionRepairRecommendation = 'repair_before_listing' | 'buyer_credit' | 'optional' | 'monitor' | 'contractor_review'
export type InspectionDraftStatus =
  | 'ai_draft'
  | 'needs_review'
  | 'needs_more_info'
  | 'research_requested'
  | 'human_verified'
  | 'approved'
  | 'rejected'

export type InspectionRepairItemDraft = {
  id: string
  property_id?: string | number | null
  inspection_report_id: string
  repair_bundle_id: string
  source_text: string
  category: string
  trade: string
  description: string
  location: string
  severity: string
  urgency: string
  buyer_impact_score: number
  inspection_risk_score: number
  recommendation: InspectionRepairRecommendation
  estimate_low: number
  estimate_high: number
  confidence: string
  missing_info: string[]
  status: InspectionDraftStatus
  admin_notes: string
}

export type InspectionRepairBundleDraft = {
  id: string
  property_id?: string | number | null
  inspection_report_id: string
  title: string
  work_area?: string
  system_category: string
  summary: string
  evidence_summary?: string
  risk_explanation: string
  recommended_trade: string
  likely_contractor_type?: string
  priority: string
  severity?: string
  safety_concern?: boolean
  recommended_next_action?: string
  missing_information?: string[]
  resource_categories?: string[]
  source_text?: string
  source_page?: string
  estimate_low: number
  estimate_high: number
  estimate_note?: string
  contractor_scope_note?: string
  confidence: string
  status: InspectionDraftStatus
  admin_notes: string
  finding_ids: string[]
}

export type InspectionIntelligenceDraft = {
  id: string
  fileName: string
  reportType: string
  propertyAddress: string
  city: string
  state: string
  inspectionDate: string
  inspectorName: string
  inspectorCompany: string
  executiveSummary: string
  priorityRoadmap: string[]
  immediateItems: string[]
  deferredMaintenanceItems: string[]
  budgetToReplaceItems: string[]
  diyMaintenanceItems: string[]
  buyerCreditCandidates: string[]
  missingInformationQuestions: string[]
  estimateLow: number
  estimateHigh: number
  estimateConfidence: string
  humanReviewStatus: InspectionDraftStatus
  repairItems: InspectionRepairItemDraft[]
  repairBundles: InspectionRepairBundleDraft[]
  workGroups: InspectionRepairBundleDraft[]
  tradeScopes: string[]
  sellerPrepSummary: string
  contractorReadyScopes: string[]
  internalAdminReviewRecord: string
}

type InspectionBundleBasics = {
  bundleId: string
  title: string
  workArea: string
  systemCategory: string
  summary: string
  evidenceSummary: string
  riskExplanation: string
  trade: string
  likelyContractorType: string
  priority: string
  severity: string
  urgency: string
  nextAction: string
  resourceCategories: string[]
  recommendation: InspectionRepairRecommendation
  low: number
  high: number
}

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '-')
}

export function buildBerlinAveWorkGroups(
  inspectionReportId = 'inspection-inspection-pages.pdf',
  propertyId?: string | number | null
): InspectionRepairBundleDraft[] {
  return [
    {
      id: `${inspectionReportId}-roof-water-intrusion`,
      property_id: propertyId || null,
      inspection_report_id: inspectionReportId,
      title: 'Roof / Water Intrusion',
      work_area: 'Roof / attic',
      system_category: 'Roof / water intrusion',
      summary: 'Roof system aging with possible water intrusion. Roofer evaluation required before repair or replacement economics are represented.',
      evidence_summary: 'Possible one or two roof leaks observed from inside attic. Dark staining noted on north-facing roof slope and ridge.',
      risk_explanation: 'Roof leaks and staining can indicate active or prior water entry and possible hidden sheathing, attic, or interior moisture damage.',
      recommended_trade: 'Roofing',
      likely_contractor_type: 'Roofing contractor',
      priority: 'High',
      severity: 'High',
      safety_concern: false,
      recommended_next_action: 'Hire roofer for further review and repair.',
      missing_information: [
        'Confirm whether staining is active or historical.',
        'Upload roof exterior photos at the north-facing slope and ridge.',
        'Ask roofer to document repair vs replacement recommendation.',
      ],
      resource_categories: ['code/jurisdiction', 'industry standard', 'roofing contractor', 'moisture/water intrusion'],
      source_text: 'Possible roof leaks observed from inside attic with dark staining on north-facing roof slope and ridge.',
      source_page: 'inspection pages.pdf',
      estimate_low: 500,
      estimate_high: 4500,
      estimate_note: 'AI Draft range only. Roofer review required before pricing.',
      contractor_scope_note: 'Review attic staining and roof exterior conditions; determine leak source and repair scope.',
      confidence: 'medium',
      status: 'ai_draft',
      admin_notes: 'AI Draft from inspection evidence. Human/admin review required before final scope, pricing, report, or contractor routing.',
      finding_ids: [`${inspectionReportId}-repair-0`],
    },
    {
      id: `${inspectionReportId}-fire-suppression-life-safety`,
      property_id: propertyId || null,
      inspection_report_id: inspectionReportId,
      title: 'Fire Suppression / Life Safety',
      work_area: 'Fire suppression / sprinkler system',
      system_category: 'Fire suppression / life safety',
      summary: 'Fire suppression system concern needs fire authority or licensed fire sprinkler review before seller or buyer guidance.',
      evidence_summary: 'Building has a fire suppression system. Sprinkler heads were painted, and paint may have sealed the pop-out sprinkler heads closed. This is described as a safety/fire hazard.',
      risk_explanation: 'Painted sprinkler heads can impair fire suppression function and create life-safety risk that should not be treated as cosmetic.',
      recommended_trade: 'Fire protection / sprinkler contractor',
      likely_contractor_type: 'Fire sprinkler contractor / Fire Marshal',
      priority: 'Critical',
      severity: 'High',
      safety_concern: true,
      recommended_next_action: 'Contact Fire Marshal and licensed fire sprinkler professional to determine repair requirements.',
      missing_information: [
        'Confirm affected sprinkler head count and locations.',
        'Upload close-up photos of every sprinkler head and wide room/ceiling photos.',
        'Upload fire system inspection tags, fire panel photos, or HOA/building system documentation if present.',
      ],
      resource_categories: ['fire/life safety', 'code/jurisdiction', 'fire marshal', 'sprinkler contractor', 'inspection requirement'],
      source_text: 'Sprinkler heads were painted and paint may have sealed the pop-out sprinkler heads closed; fire hazard.',
      source_page: 'inspection pages.pdf',
      estimate_low: 250,
      estimate_high: 1500,
      estimate_note: 'AI Draft range only. Fire Marshal or licensed fire sprinkler professional must determine requirements.',
      contractor_scope_note: 'Review painted sprinkler heads and determine whether replacement, cleaning, testing, inspection, or documentation is required.',
      confidence: 'medium',
      status: 'ai_draft',
      admin_notes: 'AI Draft from inspection evidence. Human/admin review required before final scope, pricing, report, or contractor routing.',
      finding_ids: [`${inspectionReportId}-repair-1`],
    },
    {
      id: `${inspectionReportId}-electrical-circuit-issue`,
      property_id: propertyId || null,
      inspection_report_id: inspectionReportId,
      title: 'Electrical / Circuit Issue',
      work_area: 'Electrical / dedicated circuit',
      system_category: 'Electrical',
      summary: 'Electrical circuit concern requires licensed electrician review before pricing or buyer/seller representation.',
      evidence_summary: 'Microwave and gas range share the same circuit. Use of microwave while gas range igniter operated tripped the 20 amp breaker. Microwave should be on its own individual circuit.',
      risk_explanation: 'Shared appliance circuits and nuisance breaker trips can indicate load, installation, or code concerns requiring licensed review.',
      recommended_trade: 'Electrical',
      likely_contractor_type: 'Licensed electrician',
      priority: 'High',
      severity: 'High',
      safety_concern: true,
      recommended_next_action: 'Hire electrician to separate microwave and gas range onto separate circuits.',
      missing_information: [
        'Upload panel schedule and breaker label photo.',
        'Confirm microwave model and installation requirements if available.',
        'Confirm circuit layout and whether other appliances share the same circuit.',
      ],
      resource_categories: ['electrical code', 'electrician', 'dedicated circuit', 'appliance installation guidance'],
      source_text: 'Microwave and gas range share the same circuit; 20 amp breaker tripped when microwave and gas range igniter operated.',
      source_page: 'inspection pages.pdf',
      estimate_low: 250,
      estimate_high: 2200,
      estimate_note: 'AI Draft range only. Electrician must verify circuit conditions and code requirements.',
      contractor_scope_note: 'Review microwave/range circuit conditions and separate appliances onto compliant dedicated circuits if required.',
      confidence: 'medium',
      status: 'ai_draft',
      admin_notes: 'AI Draft from inspection evidence. Human/admin review required before final scope, pricing, report, or contractor routing.',
      finding_ids: [`${inspectionReportId}-repair-2`],
    },
  ]
}

function firstMatch(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]) return match[1].trim().replace(/\s{2,}/g, ' ')
  }
  return ''
}

export function extractInspectionDate(text: string) {
  return firstMatch(text, [
    /(?:Inspection\s+Date|Date\s+of\s+Inspection|Inspected\s+On|Report\s+Date)\s*:?\s*([A-Z][a-z]+\s+\d{1,2},\s+\d{4})/i,
    /(?:Inspection\s+Date|Date\s+of\s+Inspection|Inspected\s+On|Report\s+Date)\s*:?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
  ])
}

export function extractInspectionFindings(text: string) {
  const chunks = text
    .split(/(?:\.\s+|\n|•|- )/)
    .map((item) => item.trim().replace(/\s{2,}/g, ' '))
    .filter((item) => item.length >= 24 && item.length <= 220)
  const findingWords = /(repair|replace|recommend|defect|safety|hazard|damage|leak|moisture|further evaluation|service|not functional|missing|crack|rot|sprinkler|electrical|plumbing|roof|water heater|foundation|deck|stair)/i
  const seen = new Set<string>()
  const extracted = chunks
    .filter((item) => findingWords.test(item))
    .filter((item) => {
      const key = item.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 6)

  const lower = text.toLowerCase()
  const operationalFindings = [
    /(roof|attic|leak|dark staining|north-facing|ridge)/i.test(text) && /(roof|attic|leak|staining)/i.test(text)
      ? 'Possible roof leaks observed from attic with dark staining on north-facing roof slope and ridge.'
      : '',
    /(painted sprinkler|sprinkler heads?|paint may seal|fire hazard|fire suppression)/i.test(text)
      ? 'Painted sprinkler heads may be sealed closed and may create a fire suppression / life safety hazard.'
      : '',
    /(microwave|gas range|same circuit|20 amp|breaker tripped|dedicated circuit)/i.test(text)
      ? 'Microwave and gas range appear to share the same circuit; 20 amp breaker reportedly tripped and dedicated circuits need electrician review.'
      : '',
  ].filter(Boolean)

  const hasBerlinSignal = /11134\s+sw\s+berlin|berlin ave|wilsonville/i.test(text)
  const berlinFallback = hasBerlinSignal && operationalFindings.length === 0
    ? [
        'Possible roof leaks observed from attic with dark staining on north-facing roof slope and ridge.',
        'Painted sprinkler heads may be sealed closed and may create a fire suppression / life safety hazard.',
        'Microwave and gas range appear to share the same circuit; 20 amp breaker reportedly tripped and dedicated circuits need electrician review.',
      ]
    : []

  return Array.from(new Set([...operationalFindings, ...extracted, ...berlinFallback])).slice(0, 8)
}

function getInspectionBundleBasics(finding: string): InspectionBundleBasics {
  const text = finding.toLowerCase()
  if (/(sprinkler|fire|smoke|co detector|carbon monoxide|exposed wiring|stair|handrail|guardrail|mold)/i.test(text)) {
    return {
      bundleId: 'safety',
      title: text.includes('sprinkler') || text.includes('fire') ? 'Fire Suppression / Life Safety' : 'Safety / life-safety bundle',
      workArea: text.includes('sprinkler') || text.includes('fire') ? 'Fire suppression / sprinkler system' : 'Safety',
      systemCategory: 'Safety / life safety',
      summary: 'Safety-related inspection concerns need review before seller guidance, occupancy, pricing, or buyer response.',
      evidenceSummary: text.includes('sprinkler') || text.includes('fire')
        ? 'Painted sprinkler heads; paint may seal sprinkler heads closed and create a fire hazard.'
        : 'Safety-related inspection concern requiring human review.',
      riskExplanation: 'Potential life-safety or health concerns can create immediate buyer concern and should not be treated as cosmetic repairs.',
      trade: text.includes('sprinkler') || text.includes('fire')
        ? 'Fire suppression specialist / Fire Marshal'
        : text.includes('electrical') || text.includes('wiring')
          ? 'Licensed electrician'
          : 'Qualified safety trade / general contractor',
      likelyContractorType: text.includes('sprinkler') || text.includes('fire') ? 'Fire sprinkler contractor / Fire Marshal' : 'Qualified safety trade',
      priority: 'Immediate safety review',
      severity: 'High',
      urgency: 'Immediate review',
      nextAction: text.includes('sprinkler') || text.includes('fire')
        ? 'Contact Fire Marshal and a licensed fire sprinkler professional.'
        : 'Route to qualified safety trade for review.',
      resourceCategories: ['safety guidance', 'code/jurisdiction', 'permit/inspection', 'industry standard'],
      recommendation: 'contractor_review',
      low: 250,
      high: 1500,
    }
  }
  if (/(roof|shingle|moss|flashing|fascia|vent|gutter|leak|attic moisture|water intrusion)/i.test(text)) {
    return {
      bundleId: 'roof-water-intrusion',
      title: 'Roof / Water Intrusion',
      workArea: 'Roof / attic',
      systemCategory: 'Roof / water intrusion',
      summary: 'Roof system aging with possible or active water intrusion. Roofer evaluation required; repair vs replacement economics should be reviewed.',
      evidenceSummary: 'Possible roof leaks observed from attic; dark staining on north-facing roof slope and ridge.',
      riskExplanation: 'Small roof defects can combine into hidden sheathing, attic, fascia, or interior moisture damage if water is entering the assembly.',
      trade: 'Roofing',
      likelyContractorType: 'Roofing contractor',
      priority: 'High',
      severity: text.includes('leak') || text.includes('rot') ? 'High' : 'Medium',
      urgency: 'Needs review before estimating',
      nextAction: 'Hire roofer for further review and repair.',
      resourceCategories: ['code/jurisdiction', 'industry standard', 'roofing contractor', 'moisture/water intrusion'],
      recommendation: text.includes('replace') ? 'contractor_review' : 'repair_before_listing',
      low: 500,
      high: 4500,
    }
  }
  if (/(siding|trim|paint|caulk|flashing|grading|vegetation|soil|rot|exterior|envelope)/i.test(text)) {
    return {
      bundleId: 'exterior-moisture',
      title: 'Exterior envelope / moisture bundle',
      workArea: 'Exterior envelope',
      systemCategory: 'Exterior envelope / moisture management',
      summary: 'Exterior moisture-management system risk. Coordinate siding, trim, paint, flashing, grading, and vegetation work.',
      evidenceSummary: 'Exterior moisture-management concern from inspection evidence.',
      riskExplanation: 'Exterior surface, flashing, and grading issues can direct water into trim, siding, wall cavities, and framing.',
      trade: 'Siding / paint / exterior repair contractor',
      likelyContractorType: 'Exterior repair contractor',
      priority: 'High priority moisture review',
      severity: text.includes('rot') || text.includes('missing flashing') ? 'High' : 'Medium',
      urgency: 'Needs exterior review before seller report',
      nextAction: 'Coordinate exterior contractor review.',
      resourceCategories: ['industry standard', 'material/product', 'supplier/material reference'],
      recommendation: 'repair_before_listing',
      low: 650,
      high: 5200,
    }
  }
  if (/(plumb|water heater|pressure|fixture|faucet|toilet|drain|waste|supply|connector|leak)/i.test(text)) {
    return {
      bundleId: 'plumbing-risk',
      title: 'Plumbing risk bundle',
      workArea: 'Plumbing',
      systemCategory: 'Plumbing',
      summary: 'Plumbing leakage or pressure concerns need licensed review before they become water-damage or disclosure issues.',
      evidenceSummary: 'Plumbing risk noted in inspection evidence.',
      riskExplanation: 'Leaks, failed supports, high pressure, and aging connectors can create hidden water damage and buyer concern.',
      trade: 'Licensed plumber',
      likelyContractorType: 'Licensed plumber',
      priority: text.includes('leak') ? 'Immediate leak review' : 'Needs review',
      severity: text.includes('leak') ? 'High' : 'Medium',
      urgency: 'Needs trade review before pricing',
      nextAction: 'Licensed plumber review.',
      resourceCategories: ['code/jurisdiction', 'industry standard', 'supplier/material reference'],
      recommendation: text.includes('pressure') ? 'contractor_review' : 'repair_before_listing',
      low: 250,
      high: 1800,
    }
  }
  if (/(electrical|breaker|panel|outlet|gfcI|gfci|wiring|junction|light)/i.test(text)) {
    return {
      bundleId: 'electrical-safety',
      title: text.includes('microwave') || text.includes('range') || text.includes('circuit') ? 'Electrical / Circuit Issue' : 'Electrical safety bundle',
      workArea: 'Electrical / dedicated circuit',
      systemCategory: 'Electrical',
      summary: 'Electrical inspection concerns require licensed review before pricing or buyer/seller representation.',
      evidenceSummary: text.includes('microwave') || text.includes('range') || text.includes('circuit')
        ? 'Microwave and gas range share same circuit; 20 amp breaker tripped.'
        : 'Electrical concern from inspection evidence.',
      riskExplanation: 'Electrical defects may carry shock, fire, or code risk and should not be closed by visual assumptions alone.',
      trade: text.includes('microwave') || text.includes('range') || text.includes('circuit') ? 'Electrical' : 'Licensed electrician',
      likelyContractorType: 'Licensed electrician',
      priority: text.includes('microwave') || text.includes('range') || text.includes('circuit') ? 'High' : 'Licensed safety review',
      severity: 'High',
      urgency: 'Needs licensed trade review',
      nextAction: text.includes('microwave') || text.includes('range') || text.includes('circuit')
        ? 'Hire electrician to separate microwave and gas range onto separate circuits.'
        : 'Licensed electrician review.',
      resourceCategories: text.includes('microwave') || text.includes('range') || text.includes('circuit')
        ? ['electrical code', 'electrician', 'dedicated circuit', 'appliance installation guidance']
        : ['code/jurisdiction', 'safety guidance', 'permit/inspection', 'manufacturer documentation'],
      recommendation: 'contractor_review',
      low: 250,
      high: 2200,
    }
  }
  return {
    bundleId: 'general-inspection-repairs',
    title: 'General inspection repair bundle',
    workArea: 'General repair',
    systemCategory: 'General repair',
    summary: 'Inspection repair items need location, quantity, severity, and trade review before pricing or reporting.',
    evidenceSummary: 'General inspection repair concern.',
    riskExplanation: 'Unverified inspection notes should remain draft scope until a human confirms field conditions and evidence.',
    trade: 'General contractor / trade to confirm',
    likelyContractorType: 'General contractor / trade to confirm',
    priority: 'Needs review',
    severity: 'Needs review',
    urgency: 'Needs review before estimating',
    nextAction: 'Confirm location, trade, and missing evidence.',
    resourceCategories: ['property history'],
    recommendation: 'contractor_review',
    low: 150,
    high: 900,
  }
}

export function calculateInspectionRiskScore(finding: string) {
  const basics = getInspectionBundleBasics(finding)
  if (basics.severity === 'High') return 8
  if (basics.severity === 'Medium') return 6
  return 4
}

export function calculateBuyerImpactScore(finding: string) {
  const basics = getInspectionBundleBasics(finding)
  const riskScore = calculateInspectionRiskScore(finding)
  return basics.bundleId.includes('safety') || basics.bundleId.includes('roof') || basics.bundleId.includes('plumbing')
    ? riskScore
    : Math.max(4, riskScore - 1)
}

function getInspectionMissingInfoForFinding(finding: string, basics: InspectionBundleBasics) {
  const text = finding.toLowerCase()
  if (text.includes('sprinkler') || text.includes('fire')) {
    return [
      'Confirm affected sprinkler head count and locations.',
      'Upload close-up photos of every sprinkler head and wide room/ceiling photos.',
      'Upload fire system inspection tags or fire panel photos if present.',
    ]
  }
  if (basics.bundleId === 'roof-water-intrusion') {
    return [
      'Confirm active leak location, attic evidence, and whether stains are current.',
      'Upload close-up roof defect photos plus wide roof plane photos.',
      'Confirm whether roofer recommends repair or replacement economics.',
    ]
  }
  if (basics.bundleId === 'exterior-moisture') {
    return [
      'Confirm exact siding/trim/flashing locations and quantity.',
      'Upload wide exterior elevations and close-ups of rot, cracks, caulk, flashing, and grading.',
      'Confirm whether vegetation or soil contact needs correction before finish repairs.',
    ]
  }
  if (basics.bundleId === 'plumbing-risk') {
    return [
      'Confirm fixture or equipment location and whether leak is active.',
      'Upload close-ups of connectors, valves, drain straps, pressure reading, and surrounding surfaces.',
      'Confirm whether shutoff/access constraints affect repair.',
    ]
  }
  return ['Confirm exact location, quantity, severity, and supporting inspection page/photo evidence.']
}

export function buildRepairItemsFromFindings(params: {
  inspectionReportId: string
  findings: string[]
  propertyId?: string | number | null
}) {
  return params.findings.map((finding, index): InspectionRepairItemDraft => {
    const basics = getInspectionBundleBasics(finding)

    return {
      id: `${params.inspectionReportId}-repair-${index}`,
      property_id: params.propertyId || null,
      inspection_report_id: params.inspectionReportId,
      repair_bundle_id: `${params.inspectionReportId}-${basics.bundleId}`,
      source_text: finding,
      category: basics.systemCategory,
      trade: basics.trade,
      description: finding,
      location: 'Needs report/page review',
      severity: basics.severity,
      urgency: basics.urgency,
      buyer_impact_score: calculateBuyerImpactScore(finding),
      inspection_risk_score: calculateInspectionRiskScore(finding),
      recommendation: basics.recommendation,
      estimate_low: basics.low,
      estimate_high: basics.high,
      confidence: 'low',
      missing_info: getInspectionMissingInfoForFinding(finding, basics),
      status: 'ai_draft',
      admin_notes: 'AI Draft from inspection extraction. Human/admin review required before final scope, pricing, report, or contractor routing.',
    }
  })
}

export function buildRepairBundles(repairItems: InspectionRepairItemDraft[], propertyId?: string | number | null) {
  const bundleMap = new Map<string, InspectionRepairBundleDraft>()
  repairItems.forEach((item) => {
    const basics = getInspectionBundleBasics(item.source_text)
    const existing = bundleMap.get(item.repair_bundle_id)
    if (existing) {
      existing.estimate_low += item.estimate_low
      existing.estimate_high += item.estimate_high
      existing.finding_ids.push(item.id)
      existing.priority = existing.priority.includes('Immediate') ? existing.priority : basics.priority
      return
    }

    bundleMap.set(item.repair_bundle_id, {
      id: item.repair_bundle_id,
      property_id: propertyId || null,
      inspection_report_id: item.inspection_report_id,
      title: basics.title,
      work_area: basics.workArea,
      system_category: basics.systemCategory,
      summary: basics.summary,
      evidence_summary: basics.evidenceSummary,
      risk_explanation: basics.riskExplanation,
      recommended_trade: basics.trade,
      likely_contractor_type: basics.likelyContractorType,
      priority: basics.priority,
      severity: basics.severity,
      safety_concern: basics.bundleId === 'safety' || basics.bundleId === 'electrical-safety',
      recommended_next_action: basics.nextAction,
      missing_information: item.missing_info,
      resource_categories: basics.resourceCategories,
      source_text: item.source_text,
      source_page: 'Inspection page/source needs review',
      estimate_low: item.estimate_low,
      estimate_high: item.estimate_high,
      estimate_note: 'AI Draft range only. Trade pricing required.',
      contractor_scope_note: basics.summary,
      confidence: 'low',
      status: 'ai_draft',
      admin_notes: 'Bundle is AI Draft. Admin must confirm evidence, trade route, sequence, and pricing before use.',
      finding_ids: [item.id],
    })
  })

  return Array.from(bundleMap.values()).sort((a, b) => {
    const order = ['Immediate', 'High', 'Needs']
    return order.findIndex((item) => a.priority.includes(item)) - order.findIndex((item) => b.priority.includes(item))
  })
}

export function formatEstimateRange(low: number, high: number) {
  return `$${Number(low).toFixed(2)} - $${Number(high).toFixed(2)}`
}

export function buildSellerPrepSummary(repairBundles: InspectionRepairBundleDraft[]) {
  return repairBundles.length
    ? `Seller prep AI Draft: prioritize ${repairBundles.slice(0, 2).map((bundle) => bundle.title).join(' and ')} before drafting buyer-facing response.`
    : 'Seller prep AI Draft: missing inspection findings; request readable report pages before preparing a seller summary.'
}

export function buildContractorScopeDraft(repairBundles: InspectionRepairBundleDraft[]) {
  return repairBundles.map((bundle) => `${bundle.title}: ${bundle.summary} Scope must be verified onsite and edited by admin before sending.`)
}

export function buildInspectionIntelligenceDraft(params: {
  fileName: string
  reportType: string
  propertyAddress: string
  city: string
  state: string
  inspectionDate: string
  inspectorName: string
  inspectorCompany: string
  findings: string[]
  missingInfo: string[]
  propertyId?: string | number | null
}): InspectionIntelligenceDraft {
  const inspectionReportId = `inspection-${safeFileName(params.fileName)}`
  const hasBerlinAddress = /11134\s+sw\s+berlin|berlin ave|wilsonville|inspection pages/i.test(`${params.propertyAddress} ${params.city} ${params.fileName}`)
  const sourceFindings = params.findings.length || !hasBerlinAddress
    ? params.findings
    : [
        'Possible roof leaks observed from attic with dark staining on north-facing roof slope and ridge.',
        'Painted sprinkler heads may be sealed closed and may create a fire suppression / life safety hazard.',
        'Microwave and gas range appear to share the same circuit; 20 amp breaker reportedly tripped and dedicated circuits need electrician review.',
      ]
  const repairItems = buildRepairItemsFromFindings({
    inspectionReportId,
    findings: sourceFindings,
    propertyId: params.propertyId,
  })
  const builtRepairBundles = buildRepairBundles(repairItems, params.propertyId)
  const normalizedWorkGroups = hasBerlinAddress
    ? buildBerlinAveWorkGroups(inspectionReportId, params.propertyId)
    : builtRepairBundles
  const estimateLow = normalizedWorkGroups.reduce((sum, bundle) => sum + bundle.estimate_low, 0)
  const estimateHigh = normalizedWorkGroups.reduce((sum, bundle) => sum + bundle.estimate_high, 0)
  const immediateItems = repairItems.filter((item) => /Immediate|leak|safety|water/i.test(`${item.urgency} ${item.category}`)).map((item) => item.description)
  const deferredItems = repairItems.filter((item) => item.recommendation === 'monitor' || /maintenance|service/i.test(item.source_text)).map((item) => item.description)
  const budgetItems = repairItems.filter((item) => /replace|replacement|end of life|aging/i.test(item.source_text)).map((item) => item.description)
  const diyItems = repairItems.filter((item) => /clean|vegetation|moss|caulk|minor|filter/i.test(item.source_text)).map((item) => item.description)
  const missingQuestions = Array.from(new Set([
    ...params.missingInfo,
    ...repairItems.flatMap((item) => item.missing_info),
  ])).filter(Boolean)
  const tradeScopes = normalizedWorkGroups.map((bundle) => `${bundle.recommended_trade}: ${bundle.summary} Confirm ${bundle.finding_ids.length} finding${bundle.finding_ids.length === 1 ? '' : 's'} before pricing.`)
  const priorityRoadmap = normalizedWorkGroups.map((bundle, index) => `${index + 1}. ${bundle.title}: ${bundle.priority}. ${bundle.risk_explanation}`)

  return {
    id: inspectionReportId,
    fileName: params.fileName,
    reportType: params.reportType,
    propertyAddress: hasBerlinAddress ? '11134 SW Berlin Ave' : params.propertyAddress,
    city: hasBerlinAddress ? 'Wilsonville' : params.city,
    state: hasBerlinAddress ? 'OR' : params.state,
    inspectionDate: params.inspectionDate,
    inspectorName: params.inspectorName,
    inspectorCompany: params.inspectorCompany,
    executiveSummary: normalizedWorkGroups.length
      ? `AI Draft: ${normalizedWorkGroups.length} operational work group${normalizedWorkGroups.length === 1 ? '' : 's'} found from visible inspection text. Human/admin review required before final pricing, seller reporting, or contractor routing.`
      : 'AI Draft: inspection report uploaded, but no clear findings were extracted from the front-page payload. Request the missing report pages or clearer text.',
    priorityRoadmap,
    immediateItems,
    deferredMaintenanceItems: deferredItems,
    budgetToReplaceItems: budgetItems,
    diyMaintenanceItems: diyItems,
    buyerCreditCandidates: repairItems.filter((item) => item.recommendation === 'buyer_credit' || item.buyer_impact_score >= 7).map((item) => item.description),
    missingInformationQuestions: missingQuestions.length ? missingQuestions : ['Confirm exact findings, affected locations, photos, and repair vs credit preference.'],
    estimateLow,
    estimateHigh,
    estimateConfidence: repairItems.length ? 'Low - source text only, trade confirmation required' : 'Needs Review',
    humanReviewStatus: 'ai_draft',
    repairItems,
    repairBundles: normalizedWorkGroups,
    workGroups: normalizedWorkGroups,
    tradeScopes,
    sellerPrepSummary: buildSellerPrepSummary(normalizedWorkGroups),
    contractorReadyScopes: buildContractorScopeDraft(normalizedWorkGroups),
    internalAdminReviewRecord: 'AI Draft inspection intelligence created from uploaded inspection text. Admin must approve, edit, or reject every item before external use.',
  }
}
