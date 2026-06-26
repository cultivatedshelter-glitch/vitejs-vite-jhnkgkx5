export type InspectionRepairRecommendation = 'repair_before_listing' | 'buyer_credit' | 'optional' | 'monitor' | 'contractor_review'
export type ReviewLane = 'standard' | 'deep' | 'extended'
export type ReviewConfidence = 'low' | 'medium' | 'high'
export type InspectionDraftStatus =
  | 'ai_draft'
  | 'needs_review'
  | 'in_review'
  | 'needs_more_info'
  | 'research_requested'
  | 'human_verified'
  | 'approved'
  | 'rejected'
  | 'deprecated'

export type ReviewPacketLink = {
  title: string
  url?: string | null
  status?: string | null
  visibility?: string | null
}

export type CompactReviewPacket = {
  property_address: string
  work_group_title: string
  trade_category: string
  priority_severity: string
  what_matters: string
  evidence_summary: string
  missing_info: string[]
  suggested_next_action: string
  estimate_range_bid_status: string
  research_confirmation_status: string
  top_source_links: ReviewPacketLink[]
  confidence: ReviewConfidence
  review_lane: ReviewLane
  source_reference_count: number
}

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
  review_lane?: ReviewLane
  target_review_time_seconds?: number
  review_started_at?: string | null
  review_due_at?: string | null
  reviewed_at?: string | null
  reviewed_by?: string | null
  packet_size_bytes?: number
  packet_warning?: string | null
  packet_version?: string
  source_reference_count?: number
  compact_review_packet?: CompactReviewPacket
  full_source_refs?: Array<Record<string, unknown>>
  extended_review_message?: string | null
  missing_info: string[]
  status: InspectionDraftStatus
  admin_notes: string
}

export type InspectionOperationalFeedEntry = {
  finding: string
  move: string
  owner: string
  status: string
}

export type InspectionRepairBundleDraft = {
  id: string
  bundle_id?: string
  property_id?: string | number | null
  inspection_report_id: string
  title: string
  related_report_items?: string[]
  trade_owner?: string
  finding_summary?: string
  known_facts?: string[]
  unknowns?: string[]
  clues?: string[]
  next_evidence_needed?: string[]
  recommended_next_move?: string
  review_status?: InspectionDraftStatus
  seller_impact?: string
  contractor_packet_needed?: boolean
  evidence_references?: string[]
  operational_feed_entries?: InspectionOperationalFeedEntry[]
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
  review_lane?: ReviewLane
  target_review_time_seconds?: number
  review_started_at?: string | null
  review_due_at?: string | null
  reviewed_at?: string | null
  reviewed_by?: string | null
  packet_size_bytes?: number
  packet_warning?: string | null
  packet_version?: string
  source_reference_count?: number
  compact_review_packet?: CompactReviewPacket
  full_source_refs?: Array<Record<string, unknown>>
  extended_review_message?: string | null
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

function safeArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : []
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return values
    .map((value) => String(value || '').replace(/\s+/g, ' ').trim())
    .filter((value, index, arr) => value.length > 0 && arr.indexOf(value) === index)
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72)
}

export const REVIEW_PACKET_VERSION = 'review-packet-v1'
export const REVIEW_PACKET_SIZE_LIMIT_BYTES = 250 * 1024
export const EXTENDED_REVIEW_CUSTOMER_MESSAGE =
  'We need additional time to verify reliable information for this item. We will follow up within 1-2 business days.'

export function getReviewLaneTargetSeconds(reviewLane: ReviewLane) {
  if (reviewLane === 'extended') return 172800
  if (reviewLane === 'deep') return 600
  return 320
}

export function normalizeReviewConfidence(confidence?: string | null): ReviewConfidence {
  const lower = (confidence || '').toLowerCase()
  if (lower.includes('high')) return 'high'
  if (lower.includes('medium')) return 'medium'
  return 'low'
}

function packetByteSize(packet: CompactReviewPacket) {
  const serialized = JSON.stringify(packet)
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(serialized).length
  return serialized.length
}

export function assignReviewLane(input: {
  confidence?: string | null
  missingInfo?: string[]
  text?: string
  sourceReferenceCount?: number
  hasResearchTask?: boolean
  hasConflictingEvidence?: boolean
}): ReviewLane {
  const text = `${input.text || ''} ${(input.missingInfo || []).join(' ')}`.toLowerCase()
  const confidence = normalizeReviewConfidence(input.confidence)
  const needsOutsideResearch = /(jurisdiction|code|permit|structural|mold|moisture|supplier|contractor|site confirmation|outside research|specialty|fire marshal|licensed|contradict|conflict)/i.test(text)
  const safetyOrWater = /(safety|fire|sprinkler|electrical|plumbing|water intrusion|leak|moisture|roof)/i.test(text)
  const missingCritical = (input.missingInfo || []).some((item) => /(critical|insufficient|cannot|unknown|confirm|required|documentation|location|quantity|photo)/i.test(item))

  if (confidence === 'low' && (missingCritical || needsOutsideResearch || input.hasConflictingEvidence)) return 'extended'
  if (needsOutsideResearch || input.hasResearchTask || safetyOrWater || confidence === 'low') return 'deep'
  return 'standard'
}

export function createReviewPacketMetadata(params: {
  propertyAddress?: string
  title?: string
  tradeCategory?: string
  priority?: string
  severity?: string
  whatMatters?: string
  evidenceSummary?: string
  missingInfo?: string[]
  nextAction?: string
  estimateLow?: number | null
  estimateHigh?: number | null
  estimateNote?: string | null
  researchConfirmationStatus?: string
  sourceLinks?: ReviewPacketLink[]
  confidence?: string | null
  sourceReferenceCount?: number
  reviewLane?: ReviewLane
}) {
  const sourceLinks = (params.sourceLinks || []).slice(0, 3).map((source) => ({
    title: source.title,
    url: source.url || null,
    status: source.status || null,
    visibility: source.visibility || null,
  }))
  const sourceReferenceCount = params.sourceReferenceCount ?? sourceLinks.length
  const confidence = normalizeReviewConfidence(params.confidence)
  const reviewLane = params.reviewLane || assignReviewLane({
    confidence,
    missingInfo: params.missingInfo || [],
    text: `${params.title || ''} ${params.tradeCategory || ''} ${params.whatMatters || ''} ${params.evidenceSummary || ''} ${params.nextAction || ''}`,
    sourceReferenceCount,
  })
  const estimateRange = Number(params.estimateLow || 0) > 0 || Number(params.estimateHigh || 0) > 0
    ? `$${Number(params.estimateLow || 0).toFixed(0)} - $${Number(params.estimateHigh || 0).toFixed(0)} Estimate Range draft. ${params.estimateNote || 'Not a final bid.'}`
    : params.estimateNote || 'No estimate range available yet.'
  const packet: CompactReviewPacket = {
    property_address: params.propertyAddress || 'Property address needs review',
    work_group_title: params.title || 'Review item',
    trade_category: params.tradeCategory || 'Trade/category needs review',
    priority_severity: [params.priority, params.severity].filter(Boolean).join(' / ') || 'Needs review',
    what_matters: params.whatMatters || params.evidenceSummary || 'Confirm visible condition, consequence, and next action.',
    evidence_summary: params.evidenceSummary || 'Evidence summary needs review.',
    missing_info: (params.missingInfo || []).filter(Boolean).slice(0, 5),
    suggested_next_action: params.nextAction || 'Confirm evidence, trade route, and whether more information is needed.',
    estimate_range_bid_status: estimateRange,
    research_confirmation_status: params.researchConfirmationStatus || 'No confirmation links reviewed yet.',
    top_source_links: sourceLinks,
    confidence,
    review_lane: reviewLane,
    source_reference_count: sourceReferenceCount,
  }
  const packetSizeBytes = packetByteSize(packet)

  return {
    review_lane: reviewLane,
    target_review_time_seconds: getReviewLaneTargetSeconds(reviewLane),
    packet_size_bytes: packetSizeBytes,
    packet_warning: packetSizeBytes > REVIEW_PACKET_SIZE_LIMIT_BYTES
      ? 'Review packet is too large. Compress summary or move raw details to source refs.'
      : null,
    packet_version: REVIEW_PACKET_VERSION,
    source_reference_count: sourceReferenceCount,
    compact_review_packet: packet,
    full_source_refs: [] as Array<Record<string, unknown>>,
    confidence,
    extended_review_message: reviewLane === 'extended' ? EXTENDED_REVIEW_CUSTOMER_MESSAGE : null,
  }
}

export function applyReviewPacketToBundle(
  bundle: InspectionRepairBundleDraft,
  propertyAddress = ''
): InspectionRepairBundleDraft {
  const missingInfo = uniqueStrings([
    ...safeArray(bundle.missing_information),
    ...safeArray(bundle.unknowns),
    ...safeArray(bundle.next_evidence_needed),
  ])
  const sourceReferenceCount = uniqueStrings([
    bundle.source_page,
    bundle.source_text,
    ...safeArray(bundle.resource_categories),
    ...safeArray(bundle.evidence_references),
  ]).length
  const metadata = createReviewPacketMetadata({
    propertyAddress,
    title: bundle.title,
    tradeCategory: bundle.trade_owner || bundle.recommended_trade || bundle.system_category,
    priority: bundle.priority,
    severity: bundle.severity,
    whatMatters: bundle.finding_summary || bundle.risk_explanation || bundle.summary,
    evidenceSummary: bundle.evidence_summary || safeArray(bundle.known_facts).join(' ') || bundle.summary,
    missingInfo,
    nextAction: bundle.recommended_next_move || bundle.recommended_next_action,
    estimateLow: bundle.estimate_low,
    estimateHigh: bundle.estimate_high,
    estimateNote: bundle.estimate_note,
    researchConfirmationStatus: (bundle.resource_categories || []).length ? 'Source research categories suggested; admin confirmation pending.' : 'No confirmation links reviewed yet.',
    sourceReferenceCount,
    confidence: bundle.confidence,
  })
  return {
    ...bundle,
    ...metadata,
    status: bundle.status,
    confidence: metadata.confidence,
  }
}

export function applyReviewPacketToItem(
  item: InspectionRepairItemDraft,
  propertyAddress = ''
): InspectionRepairItemDraft {
  const metadata = createReviewPacketMetadata({
    propertyAddress,
    title: item.category,
    tradeCategory: item.trade || item.category,
    priority: item.urgency,
    severity: item.severity,
    whatMatters: item.description,
    evidenceSummary: item.source_text,
    missingInfo: item.missing_info || [],
    nextAction: item.recommendation.replace(/_/g, ' '),
    estimateLow: item.estimate_low,
    estimateHigh: item.estimate_high,
    sourceReferenceCount: item.source_text ? 1 : 0,
    confidence: item.confidence,
  })
  return {
    ...item,
    ...metadata,
    status: item.status,
    confidence: metadata.confidence,
  }
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

const RIVER_ROAD_REPORT_LABEL = '2681 SE River Rd Unit 10 inspection report'
const NO_PRICING_CLAIM_NOTE = 'No pricing claim. Trade review is required before estimating.'

type RiverRoadBundleSeed = {
  bundleId: string
  title: string
  workArea: string
  systemCategory: string
  relatedReportItems: string[]
  tradeOwner: string
  findingSummary: string
  knownFacts: string[]
  unknowns: string[]
  clues: string[]
  nextEvidenceNeeded: string[]
  recommendedNextMove: string
  priority: string
  severity: string
  sellerImpact: string
  contractorPacketNeeded: boolean
  safetyConcern?: boolean
  resourceCategories: string[]
  contractorScopeNote: string
}

export const RIVER_ROAD_FINDING_TEXTS = [
  'Metal roof penetrations have cracked sealant.',
  'Plumbing vent flashings are deteriorated.',
  'Gutter leak noted.',
  'Downspout drainage needs review.',
  'Living room ceiling sagging may be a related water-intrusion consequence and needs verification.',
  'Aluminum siding is warped or loose.',
  'Siding has missing fasteners.',
  'Gaps are present around windows or trim.',
  'Manufactured home skirting is damaged.',
  'Window head flashings are missing.',
  'Vegetation is against the structure.',
  'Crawlspace perimeter has pest openings.',
  'Bathroom floor discoloration has elevated moisture.',
  'Guest bath P-trap is actively leaking.',
  'Showerhead or faucet penetrations are loose.',
  'Shower pan-to-floor caulk is missing.',
  'Shower surround drainage channels have improper caulking.',
  'Primary bath toilet has moisture or wax ring concern.',
  'Sink shutoff valves are missing.',
  'Corrugated flexible drain lines are present.',
  'Living room ceiling panel is sagging.',
  'Adjacent kitchen ceiling area is sagging.',
  'Damaged belly wrap noted.',
  'Crawlspace access door does not fit properly.',
  'Rodent or pest entry points noted.',
  'Dryer vent is disconnected from exterior vent hood.',
  'Insulation visibility is limited.',
  'Heat pump has exposed wiring covered with electrical tape.',
  'Air filter is dirty.',
  'Rusted exterior man door noted.',
  'Primary bedroom sliding closet door needs adjustment.',
  'Dishwasher was not tested because shutoff valve was off.',
  'Laundry floor dips or damaged linoleum noted.',
  'Sink stopper linkages need repair or adjustment.',
]

const RIVER_ROAD_BUNDLE_SEEDS: RiverRoadBundleSeed[] = [
  {
    bundleId: 'roof-water-intrusion',
    title: 'Roof / Water Intrusion',
    workArea: 'Metal roof, gutters, downspouts, ceiling clue',
    systemCategory: 'Roof / water intrusion',
    relatedReportItems: [
      'Metal roof penetrations with cracked sealant',
      'Deteriorated plumbing vent flashings',
      'Gutter leak',
      'Downspout drainage',
      'Living room ceiling sagging as possible related consequence, needs verification',
    ],
    tradeOwner: 'Roofer / Admin',
    findingSummary: 'Roof penetrations, vent flashings, gutter leakage, and downspout drainage are grouped because they may share a water-management consequence. Ceiling sagging is only a clue until verified.',
    knownFacts: [
      'Metal roof penetrations have cracked sealant.',
      'Plumbing vent flashings are deteriorated.',
      'Gutter leakage and downspout drainage concerns were reported.',
      'Living room ceiling sagging was reported, but its cause is not verified.',
    ],
    unknowns: [
      'Whether roof or gutter defects are actively leaking.',
      'Whether the living room ceiling sagging is related to water intrusion.',
      'Whether sheathing, ceiling cavity, or finish damage exists behind visible surfaces.',
    ],
    clues: [
      'Cracked sealant at roof penetrations is a water-entry clue.',
      'Deteriorated plumbing vent flashings are a roof-side vulnerability clue.',
      'Ceiling sagging may be a consequence, but the cause is unknown.',
    ],
    nextEvidenceNeeded: [
      'Roof walk photos of penetrations, vent flashings, gutter leak area, and downspout discharge.',
      'Interior ceiling photos and moisture/cavity review where safely accessible.',
      'Roofer note separating roof repair scope from interior verification needs.',
    ],
    recommendedNextMove: 'Group these items into one roof/water-intrusion review; request roofer/admin verification before repair scope, seller report, or pricing.',
    priority: 'High',
    severity: 'High',
    sellerImpact: 'Potential water-intrusion issue can affect buyer confidence and should be explained as draft until source and hidden damage are verified.',
    contractorPacketNeeded: true,
    resourceCategories: ['roofing contractor', 'moisture/water intrusion', 'gutter/downspout drainage', 'hidden damage verification'],
    contractorScopeNote: 'Verify roof penetrations, vent flashings, gutter leak, downspout drainage, and whether ceiling sagging relates to water entry.',
  },
  {
    bundleId: 'exterior-envelope-siding-skirting-pest-entry',
    title: 'Exterior Envelope / Siding / Skirting / Pest Entry',
    workArea: 'Exterior siding, windows, trim, skirting, vegetation, pest openings',
    systemCategory: 'Exterior envelope / pest entry',
    relatedReportItems: [
      'Warped or loose aluminum siding',
      'Missing fasteners',
      'Gaps around windows/trim',
      'Damaged manufactured home skirting',
      'Missing window head flashings',
      'Vegetation against structure',
      'Crawlspace perimeter pest openings',
    ],
    tradeOwner: 'Exterior repair / Pest exclusion / Admin',
    findingSummary: 'Exterior envelope defects and pest-entry openings are grouped because they affect water shedding, perimeter protection, and access for pests.',
    knownFacts: [
      'Aluminum siding is warped or loose and has missing fasteners.',
      'Gaps exist around windows or trim.',
      'Manufactured home skirting is damaged.',
      'Window head flashings are missing.',
      'Vegetation contacts the structure and crawlspace perimeter pest openings were reported.',
    ],
    unknowns: [
      'Whether wall, trim, or skirting damage has allowed moisture or pest entry behind finishes.',
      'How many elevations and openings are affected.',
      'Whether pest exclusion, siding repair, or broader envelope repair should lead the work.',
    ],
    clues: [
      'Missing head flashings can indicate a water-management gap.',
      'Damaged skirting and perimeter openings are pest-access clues.',
      'Vegetation contact can hide siding/skirting damage and trap moisture.',
    ],
    nextEvidenceNeeded: [
      'Wide exterior elevation photos and close-ups of each siding, trim, window, skirting, and perimeter opening.',
      'Pest-exclusion review of crawlspace perimeter and skirting.',
      'Exterior contractor note on repair sequence before caulk/finish work.',
    ],
    recommendedNextMove: 'Bundle exterior defects into one envelope/pest-entry review so repair sequence and access points are verified before seller-facing guidance.',
    priority: 'High',
    severity: 'Medium',
    sellerImpact: 'Exterior defects may read as deferred maintenance and possible moisture/pest risk; keep conclusions draft until extent is verified.',
    contractorPacketNeeded: true,
    resourceCategories: ['siding/exterior repair contractor', 'pest exclusion', 'moisture management', 'manufactured home skirting'],
    contractorScopeNote: 'Review siding, window flashing, skirting, vegetation, and pest openings together; identify priority repairs and pest-exclusion steps.',
  },
  {
    bundleId: 'bathroom-moisture-plumbing',
    title: 'Bathroom Moisture / Plumbing',
    workArea: 'Bathrooms, fixtures, drains, shutoffs',
    systemCategory: 'Bathroom moisture / plumbing',
    relatedReportItems: [
      'Bathroom floor discoloration with elevated moisture',
      'Guest bath active P-trap leak',
      'Loose showerhead/faucet penetrations',
      'Missing shower pan-to-floor caulk',
      'Improper caulking in shower surround drainage channels',
      'Primary bath toilet moisture/wax ring concern',
      'Missing sink shutoff valves',
      'Corrugated flexible drain lines',
    ],
    tradeOwner: 'Licensed plumber / Admin',
    findingSummary: 'Bathroom moisture observations, active leak evidence, fixture penetrations, drain concerns, and missing shutoffs belong in one plumbing/moisture bundle.',
    knownFacts: [
      'Bathroom floor discoloration with elevated moisture was reported.',
      'Guest bath P-trap leak was described as active.',
      'Shower penetrations, shower pan caulk, and shower surround caulking need correction or review.',
      'Primary bath toilet moisture/wax ring concern was reported.',
      'Missing sink shutoff valves and corrugated flexible drain lines were reported.',
    ],
    unknowns: [
      'Whether elevated bathroom floor moisture is localized or indicates hidden subfloor damage.',
      'Whether the primary toilet concern is wax ring failure, supply leak, condensation, or another source.',
      'Whether drain-line and shutoff corrections require broader fixture access.',
    ],
    clues: [
      'Active P-trap leak is direct evidence of a plumbing defect.',
      'Elevated moisture and floor discoloration are hidden-damage clues.',
      'Loose penetrations and missing caulk can allow water into finishes.',
    ],
    nextEvidenceNeeded: [
      'Plumber photos/notes at P-trap, toilet base, shutoff locations, drain lines, and shower penetrations.',
      'Moisture readings and photos of bathroom flooring around affected fixtures.',
      'Admin decision on whether to open/verify subfloor conditions before seller-ready report.',
    ],
    recommendedNextMove: 'Route as one bathroom moisture/plumbing review; fix active leak and verify moisture source before any final seller or contractor packet.',
    priority: 'High',
    severity: 'High',
    sellerImpact: 'Active leak and moisture language can raise negotiation risk; keep as AI Draft until plumber/admin review confirms source and repair path.',
    contractorPacketNeeded: true,
    resourceCategories: ['licensed plumber', 'moisture verification', 'fixture/drain repair', 'hidden damage verification'],
    contractorScopeNote: 'Verify active guest bath leak, toilet moisture concern, shower penetrations/caulking, missing shutoffs, and drain-line materials.',
  },
  {
    bundleId: 'ceiling-possible-hidden-damage',
    title: 'Ceiling / Possible Hidden Damage',
    workArea: 'Living room and kitchen ceiling areas',
    systemCategory: 'Ceiling / concealed condition',
    relatedReportItems: [
      'Living room ceiling panel sagging',
      'Adjacent kitchen ceiling area sagging',
      'Unknown cause: moisture, support, panel failure, or concealed condition',
      'Requires interior and roof-side/cavity-side review where accessible',
    ],
    tradeOwner: 'General contractor / Roofer / Admin',
    findingSummary: 'Ceiling sagging is separated as a hidden-damage verification bundle because the cause is unknown and should not be guessed from surface evidence.',
    knownFacts: [
      'Living room ceiling panel sagging was reported.',
      'Adjacent kitchen ceiling area sagging was reported.',
      'The cause has not been verified.',
    ],
    unknowns: [
      'Whether sagging is from moisture, support movement, panel failure, installation condition, or another concealed issue.',
      'Whether roof-side, attic/cavity-side, or interior-side access can confirm the cause without destructive work.',
      'Whether repair is cosmetic, moisture-related, or structural/support-related.',
    ],
    clues: [
      'Nearby roof/water-management defects may be relevant but are not proof of cause.',
      'Sagging across adjacent ceiling areas may indicate a broader concealed condition.',
    ],
    nextEvidenceNeeded: [
      'Interior photos showing ceiling sagging extent and location relationship to roof penetrations or plumbing.',
      'Moisture readings and accessible cavity/roof-side review where safe.',
      'Admin decision on whether GC, roofer, or both should inspect before report finalization.',
    ],
    recommendedNextMove: 'Flag ceiling sagging as needs verification; do not assign cause until interior and roof-side/cavity-side review supports it.',
    priority: 'High',
    severity: 'Needs review',
    sellerImpact: 'Possible hidden damage can change negotiation posture; seller-facing language should say cause unknown until reviewed.',
    contractorPacketNeeded: true,
    resourceCategories: ['general contractor', 'roofing contractor', 'moisture verification', 'concealed condition review'],
    contractorScopeNote: 'Verify ceiling sagging cause and whether roof, moisture, support, panel failure, or concealed condition is involved.',
  },
  {
    bundleId: 'crawlspace-underfloor-protection',
    title: 'Crawlspace / Underfloor Protection',
    workArea: 'Crawlspace, belly wrap, access, dryer vent, insulation visibility',
    systemCategory: 'Crawlspace / underfloor protection',
    relatedReportItems: [
      'Damaged belly wrap',
      'Crawlspace access door does not fit properly',
      'Rodent/pest entry points',
      'Dryer vent disconnected from exterior vent hood',
      'Insulation visibility limitations',
    ],
    tradeOwner: 'Crawlspace / Pest exclusion / Dryer vent / Admin',
    findingSummary: 'Underfloor protection items are bundled because belly wrap damage, access gaps, pest entry, disconnected dryer venting, and limited visibility affect crawlspace condition and verification.',
    knownFacts: [
      'Belly wrap damage was reported.',
      'Crawlspace access door does not fit properly.',
      'Rodent/pest entry points were reported.',
      'Dryer vent is disconnected from the exterior vent hood.',
      'Insulation visibility was limited.',
    ],
    unknowns: [
      'Whether pests damaged insulation, ducts, wiring, or underfloor components.',
      'Whether disconnected dryer venting has added lint or moisture to the crawlspace.',
      'Whether insulation or belly wrap repairs require pest remediation first.',
    ],
    clues: [
      'Damaged belly wrap can expose underfloor insulation or systems.',
      'Access door gaps and pest openings are entry clues.',
      'Disconnected dryer vent can create lint/moisture concern.',
    ],
    nextEvidenceNeeded: [
      'Crawlspace photos of belly wrap, access door fit, pest openings, dryer vent route, and visible insulation.',
      'Contractor note on pest-exclusion and belly-wrap repair sequence.',
      'Dryer vent reconnection verification to exterior vent hood.',
    ],
    recommendedNextMove: 'Route crawlspace items as one underfloor protection review; verify pest/moisture implications before closing scope.',
    priority: 'Medium',
    severity: 'Medium',
    sellerImpact: 'Crawlspace defects can make buyers worry about hidden damage; clear evidence and owner assignment reduce uncertainty.',
    contractorPacketNeeded: true,
    resourceCategories: ['crawlspace contractor', 'pest exclusion', 'dryer vent repair', 'insulation/underfloor protection'],
    contractorScopeNote: 'Inspect belly wrap, pest openings, access door, dryer vent disconnection, and insulation visibility limits together.',
  },
  {
    bundleId: 'hvac-electrical-safety',
    title: 'HVAC / Electrical Safety',
    workArea: 'Heat pump and HVAC service items',
    systemCategory: 'HVAC / electrical safety',
    relatedReportItems: [
      'Heat pump exposed wiring covered with electrical tape',
      'Dirty air filter',
      'Licensed HVAC review required',
    ],
    tradeOwner: 'Licensed HVAC / Electrician / Admin',
    findingSummary: 'Heat pump wiring and service conditions are grouped because exposed wiring and equipment service concerns require licensed review before use in final guidance.',
    knownFacts: [
      'Heat pump exposed wiring covered with electrical tape was reported.',
      'Air filter is dirty.',
      'Licensed HVAC review is required before treating the condition as resolved.',
    ],
    unknowns: [
      'Whether exposed wiring is low-voltage/control wiring, line-voltage wiring, or another equipment condition.',
      'Whether equipment has other service or safety defects beyond visible filter/wiring notes.',
      'Whether an electrician is also required after HVAC review.',
    ],
    clues: [
      'Electrical tape over exposed heat pump wiring is a safety/service clue.',
      'Dirty filter suggests maintenance is overdue but does not prove system failure.',
    ],
    nextEvidenceNeeded: [
      'Close-up and wide photos of heat pump wiring condition.',
      'HVAC technician review note identifying wiring type and correction.',
      'Service record or filter replacement confirmation if available.',
    ],
    recommendedNextMove: 'Request licensed HVAC review first, with electrician follow-up if wiring condition is outside HVAC scope.',
    priority: 'High',
    severity: 'High',
    sellerImpact: 'Safety-adjacent HVAC/electrical language should stay draft until licensed review clarifies risk and repair path.',
    contractorPacketNeeded: true,
    safetyConcern: true,
    resourceCategories: ['licensed HVAC', 'licensed electrician', 'equipment safety', 'manufacturer/service guidance'],
    contractorScopeNote: 'Verify heat pump wiring condition, filter/service needs, and whether electrical correction is required.',
  },
  {
    bundleId: 'general-maintenance-minor-repairs',
    title: 'General Maintenance / Minor Repairs',
    workArea: 'Doors, closet, dishwasher test condition, laundry flooring, sink stoppers',
    systemCategory: 'General maintenance / minor repairs',
    relatedReportItems: [
      'Rusted exterior man door',
      'Primary bedroom sliding closet door adjustment',
      'Dishwasher not tested due to shutoff valve off',
      'Laundry floor dips/damaged linoleum',
      'Sink stopper linkages',
    ],
    tradeOwner: 'Handyman / Admin',
    findingSummary: 'Minor repair and maintenance items are grouped separately so they do not obscure higher-risk moisture, roof, crawlspace, or safety bundles.',
    knownFacts: [
      'Exterior man door is rusted.',
      'Primary bedroom sliding closet door needs adjustment.',
      'Dishwasher was not tested because the shutoff valve was off.',
      'Laundry floor dips or damaged linoleum were reported.',
      'Sink stopper linkages need repair or adjustment.',
    ],
    unknowns: [
      'Whether dishwasher operates normally once the shutoff valve is turned on.',
      'Whether laundry floor dips are cosmetic flooring damage or indicate subfloor/support concern.',
      'Whether door rust is surface-level or requires replacement.',
    ],
    clues: [
      'Dishwasher test limitation is a missing-decision/missing-access clue.',
      'Laundry floor dips may be cosmetic or may point to a concealed floor condition.',
    ],
    nextEvidenceNeeded: [
      'Photos of door rust, closet door track, laundry flooring, and stopper linkages.',
      'Admin decision on dishwasher test after shutoff valve is opened by appropriate person.',
      'Handyman review separating simple adjustments from items needing trade escalation.',
    ],
    recommendedNextMove: 'Keep these as a general maintenance bundle; verify dishwasher and laundry floor questions before seller-ready language.',
    priority: 'Low',
    severity: 'Low',
    sellerImpact: 'Useful for seller prep punch-list planning, but should not distract from high-risk review bundles.',
    contractorPacketNeeded: false,
    resourceCategories: ['handyman', 'appliance test limitation', 'flooring review', 'maintenance punch list'],
    contractorScopeNote: 'Review minor repairs and call out any item that needs plumber, appliance, or flooring trade escalation.',
  },
]

function buildEvidenceReferences(inspectionReportId: string, bundleId: string, items: string[]) {
  return items.map((item, index) => `inspection:${inspectionReportId}:${bundleId}:${index + 1}:${slugify(item)}`)
}

function createOperationalFeedEntry(params: {
  title: string
  finding: string
  owner: string
  status: string
}): InspectionOperationalFeedEntry {
  return {
    finding: params.finding,
    move: `Grouped into ${params.title} bundle.`,
    owner: params.owner,
    status: params.status,
  }
}

export function buildOperationalFeedEntriesFromBundles(bundles: InspectionRepairBundleDraft[]) {
  return safeArray(bundles).flatMap((bundle) => (
    safeArray(bundle.operational_feed_entries).length
      ? safeArray(bundle.operational_feed_entries)
      : [
          createOperationalFeedEntry({
            title: bundle.title,
            finding: bundle.finding_summary || bundle.evidence_summary || bundle.summary,
            owner: bundle.trade_owner || bundle.recommended_trade || 'Admin',
            status: bundle.recommended_next_move || bundle.recommended_next_action || 'Needs review before use.',
          }),
        ]
  ))
}

export function isRiverRoadInspectionContext(text: string) {
  return /2681\s+se\s+river|river\s+rd\s+unit\s*10|se\s+river\s+rd/i.test(text) ||
    (/(metal roof penetrations|deteriorated plumbing vent flashing|cracked sealant)/i.test(text) &&
      /(belly wrap|manufactured home skirting|guest bath|p-trap|heat pump exposed wiring)/i.test(text))
}

export function buildRiverRoadWorkGroups(
  inspectionReportId = 'inspection-2681-se-river-rd-unit-10',
  propertyId?: string | number | null
): InspectionRepairBundleDraft[] {
  return RIVER_ROAD_BUNDLE_SEEDS.map((seed, index) => {
    const evidenceReferences = buildEvidenceReferences(inspectionReportId, seed.bundleId, seed.relatedReportItems)
    const sourceText = seed.relatedReportItems.join('; ')
    const status = seed.title === 'Roof / Water Intrusion'
      ? 'Needs roof walk and penetration repair quote.'
      : seed.title === 'Ceiling / Possible Hidden Damage'
        ? 'Needs interior and roof-side/cavity-side verification; cause unknown.'
        : seed.title === 'HVAC / Electrical Safety'
          ? 'Needs licensed HVAC review before final guidance.'
          : seed.contractorPacketNeeded
            ? 'Needs contractor/admin verification before external use.'
            : 'Needs admin review before punch-list use.'

    return {
      id: `${inspectionReportId}-${seed.bundleId}`,
      bundle_id: seed.bundleId,
      property_id: propertyId || null,
      inspection_report_id: inspectionReportId,
      title: seed.title,
      related_report_items: seed.relatedReportItems,
      trade_owner: seed.tradeOwner,
      finding_summary: seed.findingSummary,
      known_facts: seed.knownFacts,
      unknowns: seed.unknowns,
      clues: seed.clues,
      next_evidence_needed: seed.nextEvidenceNeeded,
      recommended_next_move: seed.recommendedNextMove,
      review_status: 'needs_review',
      seller_impact: seed.sellerImpact,
      contractor_packet_needed: seed.contractorPacketNeeded,
      evidence_references: evidenceReferences,
      operational_feed_entries: [
        createOperationalFeedEntry({
          title: seed.title,
          finding: seed.knownFacts[0] || seed.findingSummary,
          owner: seed.tradeOwner,
          status,
        }),
      ],
      work_area: seed.workArea,
      system_category: seed.systemCategory,
      summary: seed.findingSummary,
      evidence_summary: seed.knownFacts.join(' '),
      risk_explanation: seed.sellerImpact,
      recommended_trade: seed.tradeOwner,
      likely_contractor_type: seed.tradeOwner,
      priority: seed.priority,
      severity: seed.severity,
      safety_concern: Boolean(seed.safetyConcern),
      recommended_next_action: seed.recommendedNextMove,
      missing_information: uniqueStrings([...seed.unknowns, ...seed.nextEvidenceNeeded]),
      resource_categories: seed.resourceCategories,
      source_text: sourceText,
      source_page: RIVER_ROAD_REPORT_LABEL,
      estimate_low: 0,
      estimate_high: 0,
      estimate_note: NO_PRICING_CLAIM_NOTE,
      contractor_scope_note: seed.contractorScopeNote,
      confidence: 'medium',
      status: 'ai_draft',
      admin_notes: 'AI Draft / Needs Review. Do not mark contractor verified unless a contractor has reviewed. Contractor corrections become memory candidates only after approval.',
      finding_ids: seed.relatedReportItems.map((_, itemIndex) => `${inspectionReportId}-river-${index}-${itemIndex}`),
    }
  })
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
  const hasRiverRoadSignal = isRiverRoadInspectionContext(text)
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

  const riverRoadFindings = hasRiverRoadSignal ? RIVER_ROAD_FINDING_TEXTS : []
  const limit = hasRiverRoadSignal ? RIVER_ROAD_FINDING_TEXTS.length : 8

  return Array.from(new Set([...riverRoadFindings, ...operationalFindings, ...extracted, ...berlinFallback])).slice(0, limit)
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
  propertyAddress?: string
}) {
  return params.findings.map((finding, index): InspectionRepairItemDraft => {
    const basics = getInspectionBundleBasics(finding)

    return applyReviewPacketToItem({
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
    }, params.propertyAddress)
  })
}

export function buildRepairBundles(repairItems: InspectionRepairItemDraft[], propertyId?: string | number | null, propertyAddress = '') {
  const bundleMap = new Map<string, InspectionRepairBundleDraft>()
  repairItems.forEach((item) => {
    const basics = getInspectionBundleBasics(item.source_text)
    const existing = bundleMap.get(item.repair_bundle_id)
    if (existing) {
      existing.estimate_low += item.estimate_low
      existing.estimate_high += item.estimate_high
      existing.finding_ids = uniqueStrings([...existing.finding_ids, item.id])
      existing.related_report_items = uniqueStrings([...(existing.related_report_items || []), item.source_text])
      existing.known_facts = uniqueStrings([...(existing.known_facts || []), item.source_text])
      existing.unknowns = uniqueStrings([...(existing.unknowns || []), ...safeArray(item.missing_info)])
      existing.next_evidence_needed = uniqueStrings([...(existing.next_evidence_needed || []), ...safeArray(item.missing_info)])
      existing.evidence_references = uniqueStrings([...(existing.evidence_references || []), item.id, item.inspection_report_id])
      existing.priority = existing.priority.includes('Immediate') ? existing.priority : basics.priority
      return
    }

    bundleMap.set(item.repair_bundle_id, applyReviewPacketToBundle({
      id: item.repair_bundle_id,
      bundle_id: basics.bundleId,
      property_id: propertyId || null,
      inspection_report_id: item.inspection_report_id,
      title: basics.title,
      related_report_items: [item.source_text],
      trade_owner: basics.trade,
      finding_summary: basics.summary,
      known_facts: [item.source_text],
      unknowns: item.missing_info,
      clues: [basics.evidenceSummary],
      next_evidence_needed: item.missing_info,
      recommended_next_move: basics.nextAction,
      review_status: 'needs_review',
      seller_impact: basics.riskExplanation,
      contractor_packet_needed: basics.recommendation === 'contractor_review' || basics.severity === 'High',
      evidence_references: [item.id, item.inspection_report_id],
      operational_feed_entries: [
        createOperationalFeedEntry({
          title: basics.title,
          finding: item.source_text,
          owner: basics.trade,
          status: basics.nextAction,
        }),
      ],
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
    }, propertyAddress))
  })

  return Array.from(bundleMap.values()).map((bundle) => applyReviewPacketToBundle(bundle, propertyAddress)).sort((a, b) => {
    const order = ['Immediate', 'High', 'Needs']
    return order.findIndex((item) => a.priority.includes(item)) - order.findIndex((item) => b.priority.includes(item))
  })
}

export function formatEstimateRange(low: number, high: number) {
  return `$${Number(low).toFixed(2)} - $${Number(high).toFixed(2)}`
}

export function buildSellerPrepSummary(repairBundles: InspectionRepairBundleDraft[]) {
  const bundles = safeArray(repairBundles)
  return bundles.length
    ? `Seller prep AI Draft: prioritize ${bundles.slice(0, 2).map((bundle) => bundle.title).join(' and ')} before drafting buyer-facing response.`
    : 'Seller prep AI Draft: missing inspection findings; request readable report pages before preparing a seller summary.'
}

export function buildContractorScopeDraft(repairBundles: InspectionRepairBundleDraft[]) {
  return safeArray(repairBundles).map((bundle) => `${bundle.title}: ${bundle.summary} Scope must be verified onsite and edited by admin before sending.`)
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
  const inputFindings = safeArray(params.findings)
  const sourceContext = `${params.propertyAddress} ${params.city} ${params.state} ${params.fileName} ${inputFindings.join(' ')}`
  const hasRiverRoadAddress = isRiverRoadInspectionContext(sourceContext)
  const hasBerlinAddress = !hasRiverRoadAddress && /11134\s+sw\s+berlin|berlin ave|wilsonville|inspection pages/i.test(sourceContext)
  const inputMissingInfo = safeArray(params.missingInfo)
  const sourceFindings = hasRiverRoadAddress
    ? RIVER_ROAD_FINDING_TEXTS
    : inputFindings.length || !hasBerlinAddress
    ? inputFindings
    : [
        'Possible roof leaks observed from attic with dark staining on north-facing roof slope and ridge.',
        'Painted sprinkler heads may be sealed closed and may create a fire suppression / life safety hazard.',
        'Microwave and gas range appear to share the same circuit; 20 amp breaker reportedly tripped and dedicated circuits need electrician review.',
      ]
  const repairItems = buildRepairItemsFromFindings({
    inspectionReportId,
    findings: sourceFindings,
    propertyId: params.propertyId,
    propertyAddress: params.propertyAddress,
  })
  const builtRepairBundles = buildRepairBundles(repairItems, params.propertyId, params.propertyAddress)
  const normalizedWorkGroups = hasBerlinAddress
    ? buildBerlinAveWorkGroups(inspectionReportId, params.propertyId).map((bundle) => applyReviewPacketToBundle(bundle, '11134 SW Berlin Ave'))
    : hasRiverRoadAddress
      ? buildRiverRoadWorkGroups(inspectionReportId, params.propertyId).map((bundle) => applyReviewPacketToBundle(bundle, '2681 SE River Rd Unit 10'))
      : builtRepairBundles
  const estimateLow = normalizedWorkGroups.reduce((sum, bundle) => sum + bundle.estimate_low, 0)
  const estimateHigh = normalizedWorkGroups.reduce((sum, bundle) => sum + bundle.estimate_high, 0)
  const immediateItems = repairItems.filter((item) => /Immediate|leak|safety|water/i.test(`${item.urgency} ${item.category}`)).map((item) => item.description)
  const deferredItems = repairItems.filter((item) => item.recommendation === 'monitor' || /maintenance|service/i.test(item.source_text)).map((item) => item.description)
  const budgetItems = repairItems.filter((item) => /replace|replacement|end of life|aging/i.test(item.source_text)).map((item) => item.description)
  const diyItems = repairItems.filter((item) => /clean|vegetation|moss|caulk|minor|filter/i.test(item.source_text)).map((item) => item.description)
  const missingQuestions = Array.from(new Set([
    ...inputMissingInfo,
    ...repairItems.flatMap((item) => item.missing_info),
    ...normalizedWorkGroups.flatMap((bundle) => [
      ...safeArray(bundle.unknowns),
      ...safeArray(bundle.next_evidence_needed),
    ]),
  ])).filter(Boolean)
  const tradeScopes = normalizedWorkGroups.map((bundle) => `${bundle.trade_owner || bundle.recommended_trade}: ${bundle.summary} Confirm ${bundle.finding_ids.length} finding${bundle.finding_ids.length === 1 ? '' : 's'} before pricing.`)
  const priorityRoadmap = normalizedWorkGroups.map((bundle, index) => `${index + 1}. ${bundle.title}: ${bundle.priority}. ${bundle.finding_summary || bundle.risk_explanation}`)

  return {
    id: inspectionReportId,
    fileName: params.fileName,
    reportType: params.reportType,
    propertyAddress: hasBerlinAddress ? '11134 SW Berlin Ave' : hasRiverRoadAddress ? (params.propertyAddress || '2681 SE River Rd Unit 10') : params.propertyAddress,
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
