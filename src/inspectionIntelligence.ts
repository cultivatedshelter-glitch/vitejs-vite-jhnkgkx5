export type InspectionRepairRecommendation = 'repair_before_listing' | 'buyer_credit' | 'optional' | 'monitor' | 'contractor_review'
export type InspectionDraftStatus = 'ai_draft' | 'needs_review' | 'approved' | 'rejected'

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
  system_category: string
  summary: string
  risk_explanation: string
  recommended_trade: string
  priority: string
  estimate_low: number
  estimate_high: number
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
  tradeScopes: string[]
  sellerPrepSummary: string
  contractorReadyScopes: string[]
  internalAdminReviewRecord: string
}

type InspectionBundleBasics = {
  bundleId: string
  title: string
  systemCategory: string
  summary: string
  riskExplanation: string
  trade: string
  priority: string
  severity: string
  urgency: string
  recommendation: InspectionRepairRecommendation
  low: number
  high: number
}

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '-')
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
  return chunks
    .filter((item) => findingWords.test(item))
    .filter((item) => {
      const key = item.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 6)
}

function getInspectionBundleBasics(finding: string): InspectionBundleBasics {
  const text = finding.toLowerCase()
  if (/(sprinkler|fire|smoke|co detector|carbon monoxide|exposed wiring|stair|handrail|guardrail|mold)/i.test(text)) {
    return {
      bundleId: 'safety',
      title: 'Safety / life-safety bundle',
      systemCategory: 'Safety / life safety',
      summary: 'Safety-related inspection concerns need review before seller guidance, occupancy, pricing, or buyer response.',
      riskExplanation: 'Potential life-safety or health concerns can create immediate buyer concern and should not be treated as cosmetic repairs.',
      trade: text.includes('sprinkler') || text.includes('fire')
        ? 'Fire suppression specialist / Fire Marshal'
        : text.includes('electrical') || text.includes('wiring')
          ? 'Licensed electrician'
          : 'Qualified safety trade / general contractor',
      priority: 'Immediate safety review',
      severity: 'High',
      urgency: 'Immediate review',
      recommendation: 'contractor_review',
      low: 250,
      high: 1500,
    }
  }
  if (/(roof|shingle|moss|flashing|fascia|vent|gutter|leak|attic moisture|water intrusion)/i.test(text)) {
    return {
      bundleId: 'roof-water-intrusion',
      title: 'Roof / water intrusion bundle',
      systemCategory: 'Roof / water intrusion',
      summary: 'Roof system aging with possible or active water intrusion. Roofer evaluation required; repair vs replacement economics should be reviewed.',
      riskExplanation: 'Small roof defects can combine into hidden sheathing, attic, fascia, or interior moisture damage if water is entering the assembly.',
      trade: 'Roofer / exterior contractor',
      priority: text.includes('leak') || text.includes('active') ? 'Immediate water-intrusion review' : 'High priority',
      severity: text.includes('leak') || text.includes('rot') ? 'High' : 'Medium',
      urgency: 'Needs review before estimating',
      recommendation: text.includes('replace') ? 'contractor_review' : 'repair_before_listing',
      low: 500,
      high: 4500,
    }
  }
  if (/(siding|trim|paint|caulk|flashing|grading|vegetation|soil|rot|exterior|envelope)/i.test(text)) {
    return {
      bundleId: 'exterior-moisture',
      title: 'Exterior envelope / moisture bundle',
      systemCategory: 'Exterior envelope / moisture management',
      summary: 'Exterior moisture-management system risk. Coordinate siding, trim, paint, flashing, grading, and vegetation work.',
      riskExplanation: 'Exterior surface, flashing, and grading issues can direct water into trim, siding, wall cavities, and framing.',
      trade: 'Siding / paint / exterior repair contractor',
      priority: 'High priority moisture review',
      severity: text.includes('rot') || text.includes('missing flashing') ? 'High' : 'Medium',
      urgency: 'Needs exterior review before seller report',
      recommendation: 'repair_before_listing',
      low: 650,
      high: 5200,
    }
  }
  if (/(plumb|water heater|pressure|fixture|faucet|toilet|drain|waste|supply|connector|leak)/i.test(text)) {
    return {
      bundleId: 'plumbing-risk',
      title: 'Plumbing risk bundle',
      systemCategory: 'Plumbing',
      summary: 'Plumbing leakage or pressure concerns need licensed review before they become water-damage or disclosure issues.',
      riskExplanation: 'Leaks, failed supports, high pressure, and aging connectors can create hidden water damage and buyer concern.',
      trade: 'Licensed plumber',
      priority: text.includes('leak') ? 'Immediate leak review' : 'Needs review',
      severity: text.includes('leak') ? 'High' : 'Medium',
      urgency: 'Needs trade review before pricing',
      recommendation: text.includes('pressure') ? 'contractor_review' : 'repair_before_listing',
      low: 250,
      high: 1800,
    }
  }
  if (/(electrical|breaker|panel|outlet|gfcI|gfci|wiring|junction|light)/i.test(text)) {
    return {
      bundleId: 'electrical-safety',
      title: 'Electrical safety bundle',
      systemCategory: 'Electrical',
      summary: 'Electrical inspection concerns require licensed review before pricing or buyer/seller representation.',
      riskExplanation: 'Electrical defects may carry shock, fire, or code risk and should not be closed by visual assumptions alone.',
      trade: 'Licensed electrician',
      priority: 'Licensed safety review',
      severity: 'High',
      urgency: 'Needs licensed trade review',
      recommendation: 'contractor_review',
      low: 250,
      high: 2200,
    }
  }
  return {
    bundleId: 'general-inspection-repairs',
    title: 'General inspection repair bundle',
    systemCategory: 'General repair',
    summary: 'Inspection repair items need location, quantity, severity, and trade review before pricing or reporting.',
    riskExplanation: 'Unverified inspection notes should remain draft scope until a human confirms field conditions and evidence.',
    trade: 'General contractor / trade to confirm',
    priority: 'Needs review',
    severity: 'Needs review',
    urgency: 'Needs review before estimating',
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
      system_category: basics.systemCategory,
      summary: basics.summary,
      risk_explanation: basics.riskExplanation,
      recommended_trade: basics.trade,
      priority: basics.priority,
      estimate_low: item.estimate_low,
      estimate_high: item.estimate_high,
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
  const repairItems = buildRepairItemsFromFindings({
    inspectionReportId,
    findings: params.findings,
    propertyId: params.propertyId,
  })
  const repairBundles = buildRepairBundles(repairItems, params.propertyId)
  const estimateLow = repairBundles.reduce((sum, bundle) => sum + bundle.estimate_low, 0)
  const estimateHigh = repairBundles.reduce((sum, bundle) => sum + bundle.estimate_high, 0)
  const immediateItems = repairItems.filter((item) => /Immediate|leak|safety|water/i.test(`${item.urgency} ${item.category}`)).map((item) => item.description)
  const deferredItems = repairItems.filter((item) => item.recommendation === 'monitor' || /maintenance|service/i.test(item.source_text)).map((item) => item.description)
  const budgetItems = repairItems.filter((item) => /replace|replacement|end of life|aging/i.test(item.source_text)).map((item) => item.description)
  const diyItems = repairItems.filter((item) => /clean|vegetation|moss|caulk|minor|filter/i.test(item.source_text)).map((item) => item.description)
  const missingQuestions = Array.from(new Set([
    ...params.missingInfo,
    ...repairItems.flatMap((item) => item.missing_info),
  ])).filter(Boolean)
  const tradeScopes = repairBundles.map((bundle) => `${bundle.recommended_trade}: ${bundle.summary} Confirm ${bundle.finding_ids.length} finding${bundle.finding_ids.length === 1 ? '' : 's'} before pricing.`)
  const priorityRoadmap = repairBundles.map((bundle, index) => `${index + 1}. ${bundle.title}: ${bundle.priority}. ${bundle.risk_explanation}`)

  return {
    id: inspectionReportId,
    fileName: params.fileName,
    reportType: params.reportType,
    propertyAddress: params.propertyAddress,
    city: params.city,
    state: params.state,
    inspectionDate: params.inspectionDate,
    inspectorName: params.inspectorName,
    inspectorCompany: params.inspectorCompany,
    executiveSummary: repairBundles.length
      ? `AI Draft: ${repairBundles.length} operational repair bundle${repairBundles.length === 1 ? '' : 's'} found from visible inspection text. Human/admin review required before final pricing, seller reporting, or contractor routing.`
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
    repairBundles,
    tradeScopes,
    sellerPrepSummary: buildSellerPrepSummary(repairBundles),
    contractorReadyScopes: buildContractorScopeDraft(repairBundles),
    internalAdminReviewRecord: 'AI Draft inspection intelligence created from uploaded inspection text. Admin must approve, edit, or reject every item before external use.',
  }
}
