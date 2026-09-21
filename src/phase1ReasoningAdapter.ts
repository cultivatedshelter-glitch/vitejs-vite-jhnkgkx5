export type Phase1ArtifactMode = 'live' | 'fixture'

export type Phase1LinkedSource = {
  id: string
  label: string
  reference: string
  url: string | null
  kind: string
  geography: string
  publishedAt: string | null
  retrievedAt: string | null
  scopeBasis: string
  priceLabel: string | null
}

export type Phase1RepairPath = {
  id: string
  label: string
  status: 'priced' | 'blocked'
  low: number | null
  high: number | null
  unit: string
  priceLabel: string
  geography: string
  assumptions: string[]
  exclusions: string[]
  confidence: string
  confidenceReason: string
  rangeStatus: 'Broad Preliminary' | 'Moderate Confidence' | 'Field-Supported'
  originalPriceLabel: string | null
  reviewedPriceVersion: number | null
  sources: Phase1LinkedSource[]
}

export type Phase1HumanObservation = {
  id: string
  observation: string
  identity: string
  role: string
  observedAt: string | null
  submittedAt: string | null
  directness: string
  professionalStatus: string
  verificationStatus: string
}

export type Phase1RangeHistoryItem = {
  id: string
  movement: string
  priorLabel: string | null
  currentLabel: string
  explanation: string
  sourceIds: string[]
}

export type Phase1WeatherViewModel = {
  status: 'available' | 'unavailable'
  text: string
  sourceIds: string[]
  failureReason: string | null
  provider: string | null
  requestedWindow: string | null
  location: string | null
  retrievedAt: string | null
  sourceUrl: string | null
  measurements: string[]
}

export type Phase1AffectedLocation = {
  orientation: string
  orientationStatus: 'explicit' | 'inferred_low_confidence' | 'unknown'
  area: string
  level: string
  roomOrZone: string
  element: string
  locationText: string
  sourceBasis: string
  confidence: string
  needsConfirmation: boolean
  resolutionPrompt: string
}

export type Phase1SourceEvidence = {
  documentName: string
  excerpt: string
  recommendation: string
  page: number | null
  itemNumber: string
  section: string
  primaryPhoto: { imageId: string; caption: string; page: number | null; linked: boolean } | null
  additionalEvidenceCount: number
  candidatePhotos: Array<{
    imageId: string
    caption: string
    page: number | null
    strength: 'strong' | 'possible'
    reason: string
    confirmationRequired: boolean
  }>
  pagePreviews: Array<{ page: number; relationship: string; textExcerpt: string }>
  fullReportAvailable: boolean
  confirmedEvidence: { imageId: string; relationship: string } | null
}

export type Phase1ReviewDecision = {
  findingId: string | null
  eventId: string | null
  status: string
  action: string | null
  reason: string | null
  reviewerId: string | null
  reviewedAt: string | null
  corrections: Record<string, unknown>
  deliveryEligible: boolean
}

export type Phase1FindingViewModel = {
  id: string
  title: string
  category: string
  observation: string
  interpretation: string
  observedAt: string | null
  known: string[]
  unknown: string[]
  missingInformation: string[]
  nextStep: string
  nextStepOwner: string
  whyNextStep: string
  reviewStatus: string
  reviewStatusLabel: string
  reviewPriority: 'quick_review' | 'careful_review' | 'waiting_for_evidence'
  reviewReasons: string[]
  reviewDecision: Phase1ReviewDecision
  releaseDisposition: 'approved' | 'needs_more_information' | 'rejected' | null
  fieldKnowledge: string
  likelyTrade: string
  affectedLocation: Phase1AffectedLocation
  sourceEvidence: Phase1SourceEvidence
  evidenceReferences: string[]
  sources: Phase1LinkedSource[]
  researchSources: Phase1LinkedSource[]
  price: {
    status: 'available' | 'blocked'
    low: number | null
    high: number | null
    label: string
    stage: string
    geography: string
    basis: string
    sourceIds: string[]
  }
  rangeHistory: Phase1RangeHistoryItem[]
  contractorQuote: {
    amount: number
    label: string
    sourceId: string
    reviewStatus: string
  } | null
  weather: Phase1WeatherViewModel | null
  relatedFindings: string[]
  repairPaths: Phase1RepairPath[]
  whatChangesDecision: string[]
  transactionConsiderations: string[]
}

export type Phase1ExperienceViewModel = {
  schemaVersion: string
  mode: Phase1ArtifactMode
  isFixture: boolean
  propertyAddress: string | null
  findings: Phase1FindingViewModel[]
  categories: string[]
  openQuestionCount: number
  audience: 'reviewer' | 'agent'
  totalFindingCount: number
  overview: {
    majorCategories: Array<{ label: string; findingCount: number }>
    findingsWithSourcedPaths: number
    findingsWithoutSourcedPaths: number
    decisionFactors: string[]
    immediateNextTasks: string[]
    aggregateCostRule: string
  }
  humanObservations: Phase1HumanObservation[]
  localProfessionals: {
    groups: Array<{ trade: string; professionals: Array<{ providerId: string; name: string; address: string | null; rating: number | null; reviewCount: number | null; source: string; sourceUrl: string | null; retrievedAt: string; qualificationStatus: string }> }>
    lookups: Array<{ trade: string; status: string; provider: string }>
  }
  transactionPerspective: string
}

export class Phase1ArtifactError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'Phase1ArtifactError'
  }
}

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asRecord(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {}
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function asStringArray(value: unknown): string[] {
  return asArray(value).map(asString).filter(Boolean)
}

function humanize(value: string): string {
  if (!value) return ''
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function tradeLabel(value: string, category: string): string {
  const candidate = humanize(value).trim()
  if (candidate && !['Human Reviewer', 'Reviewer', 'Unknown Owner'].includes(candidate)) return candidate
  const normalized = category.toLowerCase()
  if (normalized.includes('plumb')) return 'Plumbing'
  if (normalized.includes('electric')) return 'Electrical'
  if (normalized.includes('hvac') || normalized.includes('heating')) return 'HVAC'
  if (normalized.includes('roof')) return 'Roofing'
  if (normalized.includes('siding') || normalized.includes('exterior') || normalized.includes('envelope')) return 'Exterior / Siding'
  if (normalized.includes('carpentry') || normalized.includes('window') || normalized.includes('door')) return 'Carpentry'
  return 'Unknown'
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function rangeLabel(low: number | null, high: number | null): string | null {
  return low !== null && high !== null ? `${formatMoney(low)}–${formatMoney(high)}` : null
}

function reviewLabel(status: string): string {
  const labels: Record<string, string> = {
    ai_draft: 'AI Draft',
    needs_review: 'Needs Human Review',
    needs_human_review: 'Needs Human Review',
    human_verified: 'Human Reviewed',
    contractor_informed: 'Contractor Informed',
    contractor_verified: 'Contractor Reviewed',
    rejected: 'Rejected',
  }
  return labels[status] ?? humanize(status || 'needs_human_review')
}

function sourceReference(source: UnknownRecord): string {
  return asString(source.source_url)
    || asString(source.source_reference)
    || asString(source.internal_reference)
    || asString(source.provider_documentation)
}

function normalizeSource(value: unknown): Phase1LinkedSource | null {
  const source = asRecord(value)
  const id = asString(source.source_id) || asString(source.id)
  if (!id) return null
  const reference = sourceReference(source)
  const url = /^https?:\/\//i.test(reference) ? reference : null
  const geography = asRecord(source.source_geography)
  return {
    id,
    label: asString(source.source_name) || asString(source.provider) || humanize(asString(source.record_type)) || id,
    reference,
    url,
    kind: asString(source.source_type) || asString(source.record_type) || 'source',
    geography: asString(geography.label) || humanize(asString(geography.level)) || 'Geography unavailable',
    publishedAt: asString(source.published_at) || null,
    retrievedAt: asString(source.retrieved_at) || null,
    scopeBasis: asString(source.scope_basis),
    priceLabel: rangeLabel(asNumber(source.price_low), asNumber(source.price_high)),
  }
}

function collectSourceCatalog(root: UnknownRecord, entry: UnknownRecord): Map<string, Phase1LinkedSource> {
  const catalog = new Map<string, Phase1LinkedSource>()
  for (const source of [...asArray(root.external_sources), ...asArray(entry.external_sources)]) {
    const normalized = normalizeSource(source)
    if (normalized) catalog.set(normalized.id, normalized)
  }
  return catalog
}

function hasFixtureMarker(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasFixtureMarker)
  if (!isRecord(value)) return typeof value === 'string' && (value.startsWith('fixture://') || value.startsWith('fixture-'))
  if (value.fixture_backed === true) return true
  return Object.values(value).some(hasFixtureMarker)
}

function artifactEntries(root: UnknownRecord): UnknownRecord[] {
  const observations = asArray(root.atomicObservations).filter(isRecord)
  if (observations.length) return observations

  const findings = asArray(root.findings).filter(isRecord)
  if (findings.length) return findings

  const bundles = asArray(root.bundles).filter(isRecord)
  if (bundles.length) return bundles

  return isRecord(root.finding_card) ? [root] : []
}

function sourceRefStrings(card: UnknownRecord): string[] {
  const sourceRefs = asRecord(card.source_refs)
  return [
    sourceRefs.source_page == null ? '' : `Page ${String(sourceRefs.source_page)}`,
    asString(sourceRefs.source_item_number) ? `Item ${asString(sourceRefs.source_item_number)}` : '',
    asString(sourceRefs.source_section),
  ].filter(Boolean)
}

function evidenceRefStrings(card: UnknownRecord, entry: UnknownRecord): string[] {
  const refs = asRecord(card.evidence_refs)
  const entryRefs = asRecord(entry.evidence_links)
  return [
    ...sourceRefStrings(card),
    ...asStringArray(refs.source_evidence_ids),
    ...asStringArray(refs.photo_caption_ids),
    ...asStringArray(refs.image_ids),
    ...asStringArray(entryRefs.source_evidence_ids),
  ].filter((value, index, all) => all.indexOf(value) === index)
}

function normalizeWeather(card: UnknownRecord): Phase1WeatherViewModel | null {
  const weather = asRecord(card.weather_context)
  if (!Object.keys(weather).length) return null
  if (weather.is_relevant_to_interpretation === false || weather.status === 'not_relevant_to_current_source_observation') return null

  const claim = asRecord(weather.claim)
  const claims = asArray(weather.weather_claims).filter(isRecord)
  const firstClaim = claims[0] ?? {}
  const claimText = asString(claim.claim_text) || asString(firstClaim.claim_text)
  const sourceIds = [
    ...asStringArray(claim.source_refs),
    ...asStringArray(firstClaim.source_refs),
    ...asStringArray(weather.weather_sources),
  ].filter((value, index, all) => all.indexOf(value) === index)

  const measurementsRecord = asRecord(weather.measurements)
  const measurements = Object.entries(measurementsRecord)
    .filter(([, value]) => typeof value === 'number')
    .map(([key, value]) => `${humanize(key)}: ${String(value)}`)
  const windowRecord = asRecord(weather.requested_window)
  const providerLocation = asRecord(weather.provider_location)
  const requestedWindow = asString(windowRecord.start_date) && asString(windowRecord.end_date)
    ? `${asString(windowRecord.start_date)} to ${asString(windowRecord.end_date)}`
    : null
  if (claimText) return {
    status: 'available',
    text: claimText,
    sourceIds,
    failureReason: null,
    provider: asString(weather.provider) || null,
    requestedWindow,
    location: asString(providerLocation.label) || null,
    retrievedAt: asString(weather.retrieval_time) || null,
    sourceUrl: asString(weather.source_url) || null,
    measurements,
  }
  if (weather.is_relevant_to_interpretation === true || asString(weather.status).includes('not_researched')) {
    return {
      status: 'unavailable',
      text: 'Environmental context is relevant to this finding, but no sourced weather result was returned.',
      sourceIds,
      failureReason: asString(weather.failure_reason) || asString(weather.lookup_status) || 'lookup not completed',
      provider: asString(weather.provider) || null,
      requestedWindow,
      location: asString(providerLocation.label) || null,
      retrievedAt: asString(weather.retrieval_time) || null,
      sourceUrl: asString(weather.source_url) || null,
      measurements,
    }
  }
  return null
}

function normalizeHistory(card: UnknownRecord): Phase1RangeHistoryItem[] {
  return asArray(card.range_history).filter(isRecord).map((item, index) => {
    const prior = rangeLabel(asNumber(item.prior_low), asNumber(item.prior_high))
    const current = rangeLabel(asNumber(item.new_low), asNumber(item.new_high)) ?? 'Range unavailable'
    const evidence = asStringArray(item.evidence_causing_change)
    return {
      id: asString(item.revision_id) || `range-revision-${index + 1}`,
      movement: humanize(asString(item.movement) || 'revision'),
      priorLabel: prior,
      currentLabel: current,
      explanation: evidence.join('; ') || 'No change explanation was returned.',
      sourceIds: asStringArray(item.source_refs),
    }
  })
}

function relationMap(root: UnknownRecord, entries: UnknownRecord[]): Map<string, string[]> {
  const titles = new Map<string, string>()
  for (const entry of entries) {
    const card = asRecord(entry.finding_card)
    const id = asString(entry.id) || asString(entry.finding_id)
    if (id) titles.set(id, asString(card.finding_title) || id)
  }

  const related = new Map<string, string[]>()
  for (const candidate of asArray(root.relationshipCandidates).filter(isRecord)) {
    if (asString(candidate.type) !== 'potential_condition_relationship') continue
    const ids = asStringArray(candidate.related_atomic_observation_ids)
    for (const id of ids) {
      const others = ids.filter((otherId) => otherId !== id).map((otherId) => titles.get(otherId) ?? otherId)
      related.set(id, [...(related.get(id) ?? []), ...others])
    }
  }
  return related
}

function normalizeFinding(
  root: UnknownRecord,
  entry: UnknownRecord,
  index: number,
  related: Map<string, string[]>,
): Phase1FindingViewModel {
  const card = asRecord(entry.finding_card)
  const source = asRecord(entry.source)
  const organization = asRecord(entry.organization)
  const epistemic = asRecord(entry.epistemic_states)
  const nextEvidence = asRecord(entry.smallest_useful_next_evidence)
  const sourceEvidence = asRecord(card.source_evidence)
  const primaryPhoto = asRecord(sourceEvidence.primary_photo)
  const affectedLocation = asRecord(card.affected_location)
  const reviewWorkflow = asRecord(card.review_workflow)
  const reviewState = asRecord(asRecord(root.reviewState)[asString(entry.id)])
  const reviewEvent = asRecord(reviewState.event)
  const reviewNewValue = asRecord(reviewEvent.new_value)
  const corrections = asRecord(reviewNewValue.corrections)
  const confirmedEvidence = Object.keys(asRecord(corrections.confirmed_evidence)).length
    ? asRecord(corrections.confirmed_evidence)
    : asRecord(card.confirmed_evidence)
  const id = asString(entry.id) || asString(entry.finding_id) || `finding-${index + 1}`
  const title = asString(corrections.title) || asString(card.finding_title) || asString(source.inspector_statement) || `Inspection finding ${index + 1}`
  const sourceKnown = asStringArray(card.what_we_know)
  const sourceUnknown = asStringArray(card.what_we_dont_know)
  const correctedKnown = asStringArray(corrections.known)
  const correctedUnknown = asStringArray(corrections.unknown)
  const known = correctedKnown.length ? correctedKnown : sourceKnown
  const unknown = correctedUnknown.length ? correctedUnknown : sourceUnknown
  const recommended = asString(corrections.next_step) || asString(card.recommended_next_step)
  const explicitMissing = asString(nextEvidence.next_evidence_needed)
  const missingInformation = explicitMissing && explicitMissing !== recommended ? [explicitMissing] : unknown
  const correctedPrice = Object.keys(asRecord(corrections.price)).length
    ? asRecord(corrections.price)
    : asRecord(card.released_price_correction)
  const correctedPrices = asArray(corrections.price_adjustments).filter(isRecord)
  const releasedPrices = asArray(card.released_price_corrections).filter(isRecord)
  const correctedPriceLow = asNumber(correctedPrice.low)
  const correctedPriceHigh = asNumber(correctedPrice.high)
  const correctedPriceSource = asString(correctedPrice.source_reference)
  const correctedPriceSourceType = asString(correctedPrice.source_type)
  const correctedPriceSourceIds = asStringArray(correctedPrice.supporting_source_ids)
  const hasCorrectedPrice = correctedPriceLow !== null && correctedPriceHigh !== null
    && (correctedPriceSourceIds.length > 0 || correctedPriceSourceType === 'reviewer_professional_judgment' || Boolean(correctedPriceSource))
  const correctedPricePathId = asString(correctedPrice.path_id)
  const priceLow = hasCorrectedPrice ? correctedPriceLow : asNumber(card.price_low)
  const priceHigh = hasCorrectedPrice ? correctedPriceHigh : asNumber(card.price_high)
  const priced = priceLow !== null && priceHigh !== null && (hasCorrectedPrice || asString(card.pricing_contract_status) !== 'BLOCKED_MISSING_SOURCED_RANGE')
  const geography = asRecord(card.price_geography)
  const priceSourceIds = hasCorrectedPrice ? correctedPriceSourceIds : asStringArray(card.price_source_refs)
  const weather = normalizeWeather(card)
  const contractor = asRecord(card.contractor_quote)
  const contractorAmount = asNumber(contractor.amount)
  const catalog = collectSourceCatalog(root, entry)
  const linkedIds = [
    ...priceSourceIds,
    ...asStringArray(card.research_source_refs),
    ...(weather?.sourceIds ?? []),
    asString(contractor.source_id),
  ].filter(Boolean)
  const sources = linkedIds
    .filter((sourceId, sourceIndex, all) => all.indexOf(sourceId) === sourceIndex)
    .map((sourceId) => catalog.get(sourceId) ?? {
      id: sourceId,
      label: sourceId,
      reference: '',
      url: null,
      kind: 'unresolved_source_reference',
      geography: 'Geography unavailable', publishedAt: null, retrievedAt: null, scopeBasis: '', priceLabel: null,
    })
  const researchSourceIds = asStringArray(card.research_source_refs)
  const researchSources = researchSourceIds
    .map((sourceId) => catalog.get(sourceId))
    .filter((source): source is Phase1LinkedSource => Boolean(source))

  const rawRelated = asStringArray(card.related_findings)
  const relatedFindings = [...rawRelated, ...(related.get(id) ?? [])]
    .filter((value, relatedIndex, all) => all.indexOf(value) === relatedIndex)

  const rawReviewStatus = asString(reviewState.status) || asString(card.review_status) || 'needs_human_review'
  const correctedLocation = asRecord(corrections.affected_location)
  const locationText = asString(correctedLocation.location_text) || asString(affectedLocation.location_text)
  const hasCorrectedLocation = Boolean(asString(correctedLocation.location_text))
  const repairPaths = asArray(card.repair_paths).filter(isRecord).map((item, pathIndex) => {
    const pathId = asString(item.id) || `${id}-path-${pathIndex + 1}`
    const pathCorrection = correctedPrices.find((price) => asString(price.path_id) === pathId)
      || releasedPrices.find((price) => asString(price.path_id) === pathId)
      || (hasCorrectedPrice && correctedPricePathId === pathId ? correctedPrice : {})
    const pathCorrectionLow = asNumber(pathCorrection.low)
    const pathCorrectionHigh = asNumber(pathCorrection.high)
    const correctionApplies = pathCorrectionLow !== null && pathCorrectionHigh !== null
    const low = correctionApplies ? pathCorrectionLow : asNumber(item.price_low)
    const high = correctionApplies ? pathCorrectionHigh : asNumber(item.price_high)
    const unit = asString(item.price_unit)
    const pathSourceIds = asStringArray(pathCorrection.supporting_source_ids)
    const pathSourceType = asString(pathCorrection.source_type)
    const sourceIds = correctionApplies ? pathSourceIds : asStringArray(item.price_source_refs)
    const professionalJudgmentSource: Phase1LinkedSource = {
      id: `reviewer-judgment-${pathId}`,
      label: 'Reviewer / Professional Judgment',
      reference: 'Attributed reviewer judgment',
      url: null,
      kind: 'reviewer_professional_judgment',
      geography: asString(pathCorrection.geography),
      publishedAt: null,
      retrievedAt: asString(pathCorrection.reviewed_at) || asString(reviewEvent.created_at) || null,
      scopeBasis: `Human-reviewed adjustment for ${asString(item.label) || `potential path ${pathIndex + 1}`}.`,
      priceLabel: rangeLabel(pathCorrectionLow, pathCorrectionHigh),
    }
    const pathSources = correctionApplies
      ? (pathSourceType === 'reviewer_professional_judgment'
          ? [professionalJudgmentSource]
          : sourceIds.map((sourceId) => catalog.get(sourceId)).filter((source): source is Phase1LinkedSource => Boolean(source)))
      : sourceIds.map((sourceId) => catalog.get(sourceId)).filter((source): source is Phase1LinkedSource => Boolean(source))
    const correctedPaths = asArray(corrections.repair_paths).filter(isRecord)
    const correctedPath = correctedPaths.find((path) => asString(path.id) === pathId)
    const originalRange = asRecord(pathCorrection.original_range)
    return {
      id: pathId,
      label: asString(correctedPath?.label) || asString(item.label) || `Potential path ${pathIndex + 1}`,
      status: low !== null && high !== null && pathSources.length ? 'priced' as const : 'blocked' as const,
      low,
      high,
      unit,
      priceLabel: low !== null && high !== null
        ? `${rangeLabel(low, high)}${unit === 'square_foot' ? ' per sq ft' : unit && unit !== 'project' ? ` per ${humanize(unit).toLowerCase()}` : ''}`
        : 'No defensible sourced range attached',
      geography: correctionApplies ? asString(pathCorrection.geography) : asString(asRecord(item.price_geography).label) || 'Geography unavailable',
      assumptions: correctionApplies ? asStringArray(pathCorrection.assumptions) : asStringArray(item.assumptions),
      exclusions: correctionApplies ? asStringArray(pathCorrection.exclusions) : asStringArray(item.major_exclusions),
      confidence: correctionApplies ? humanize(asString(pathCorrection.confidence_status)) : humanize(asString(item.confidence) || 'low'),
      confidenceReason: correctionApplies ? 'A human reviewer replaced the draft range using the cited source.' : asString(item.confidence_reason),
      rangeStatus: correctionApplies
        ? (asString(pathCorrection.confidence_status) === 'field_supported' ? 'Field-Supported' : asString(pathCorrection.confidence_status) === 'moderate_confidence' ? 'Moderate Confidence' : 'Broad Preliminary')
        : (asString(item.range_status) === 'moderate_confidence' ? 'Moderate Confidence' : 'Broad Preliminary'),
      originalPriceLabel: correctionApplies ? rangeLabel(asNumber(originalRange.low), asNumber(originalRange.high)) : null,
      reviewedPriceVersion: correctionApplies ? asNumber(pathCorrection.version) : null,
      sources: pathSources,
    }
  })
  const category = asString(organization.building_system) || asString(asRecord(card.source_refs).source_section) || 'Inspection findings'
  return {
    id,
    title,
    category,
    observation: asString(epistemic.source_observation) || asString(source.inspector_statement) || known[0] || title,
    interpretation: asString(corrections.interpretation) || asString(epistemic.shelter_prep_interpretation) || 'Shelter Prep interpretation was not returned.',
    observedAt: asString(source.when_observed) || null,
    known,
    unknown,
    missingInformation,
    nextStep: recommended || explicitMissing || 'Human review is needed to choose the next step.',
    nextStepOwner: humanize(asString(card.next_step_owner) || 'human reviewer'),
    whyNextStep: asString(corrections.rationale) || asString(card.why_next_step) || 'The artifact did not provide a next-step rationale.',
    reviewStatus: rawReviewStatus,
    reviewStatusLabel: reviewLabel(rawReviewStatus),
    reviewPriority: (['quick_review', 'careful_review', 'waiting_for_evidence'].includes(asString(reviewWorkflow.priority))
      ? asString(reviewWorkflow.priority)
      : 'careful_review') as Phase1FindingViewModel['reviewPriority'],
    reviewReasons: asStringArray(reviewWorkflow.reasons),
    reviewDecision: {
      findingId: asString(reviewState.findingId) || null,
      eventId: asString(reviewEvent.id) || null,
      status: rawReviewStatus,
      action: asString(reviewEvent.review_action) || null,
      reason: asString(reviewEvent.reason) || null,
      reviewerId: asString(reviewEvent.reviewer_id) || null,
      reviewedAt: asString(reviewEvent.created_at) || null,
      corrections,
      deliveryEligible: reviewNewValue.delivery_eligible === true || card.released_to_agent === true,
    },
    releaseDisposition: (['approved', 'needs_more_information', 'rejected'].includes(asString(card.release_disposition))
      ? asString(card.release_disposition)
      : asString(reviewEvent.review_action) === 'approve' ? 'approved'
        : asString(reviewEvent.review_action) === 'needs_more_info' ? 'needs_more_information'
          : asString(reviewEvent.review_action) === 'reject' ? 'rejected' : null) as Phase1FindingViewModel['releaseDisposition'],
    fieldKnowledge: asString(corrections.field_knowledge),
    likelyTrade: tradeLabel(asString(corrections.likely_trade) || asString(card.next_step_owner), category),
    affectedLocation: {
      orientation: asString(correctedLocation.orientation) || asString(affectedLocation.orientation) || 'Unknown',
      orientationStatus: (hasCorrectedLocation && asString(correctedLocation.orientation)
        ? 'explicit'
        : ['explicit', 'inferred_low_confidence', 'unknown'].includes(asString(affectedLocation.orientation_status))
          ? asString(affectedLocation.orientation_status)
        : 'unknown') as Phase1AffectedLocation['orientationStatus'],
      area: asString(affectedLocation.area) || 'Unknown',
      level: asString(affectedLocation.level) || 'Unknown',
      roomOrZone: asString(affectedLocation.room_or_zone) || 'Unknown',
      element: asString(affectedLocation.element) || 'Unknown',
      locationText: locationText || 'Location not established by the source evidence.',
      sourceBasis: hasCorrectedLocation ? 'human_entered' : asString(affectedLocation.source_basis) || 'unknown',
      confidence: hasCorrectedLocation ? 'human_reviewed' : asString(affectedLocation.confidence) || 'unknown',
      needsConfirmation: !hasCorrectedLocation && asString(affectedLocation.status) === 'needs_location_confirmation',
      resolutionPrompt: asString(affectedLocation.resolution_prompt) || 'Confirm the affected location from source evidence.',
    },
    sourceEvidence: {
      documentName: asString(sourceEvidence.document_name) || 'Inspection report',
      excerpt: asString(sourceEvidence.inspector_statement) || asString(sourceEvidence.source_excerpt) || asString(source.inspector_statement),
      recommendation: asString(sourceEvidence.inspector_recommendation) || asString(source.inspector_recommendation),
      page: asNumber(sourceEvidence.source_page) ?? asNumber(source.source_page),
      itemNumber: asString(sourceEvidence.source_item_number) || asString(source.source_item_number),
      section: asString(sourceEvidence.source_section) || asString(source.source_section),
      primaryPhoto: Object.keys(primaryPhoto).length ? {
        imageId: asString(primaryPhoto.image_id),
        caption: asString(primaryPhoto.caption),
        page: asNumber(primaryPhoto.source_page),
        linked: asString(primaryPhoto.link_status) === 'linked',
      } : null,
      additionalEvidenceCount: asNumber(sourceEvidence.additional_evidence_count) ?? 0,
      candidatePhotos: asArray(sourceEvidence.candidate_photos).filter(isRecord).map((candidate) => ({
        imageId: asString(candidate.image_id),
        caption: asString(candidate.caption),
        page: asNumber(candidate.source_page),
        strength: (asString(candidate.association_strength) === 'strong' ? 'strong' : 'possible') as 'strong' | 'possible',
        reason: asString(candidate.association_reason),
        confirmationRequired: candidate.confirmation_required !== false,
      })).filter((candidate) => candidate.imageId),
      pagePreviews: asArray(sourceEvidence.page_previews).filter(isRecord).map((preview) => ({
        page: asNumber(preview.page) ?? 0,
        relationship: asString(preview.relationship),
        textExcerpt: asString(preview.text_excerpt),
      })).filter((preview) => preview.page > 0 && preview.textExcerpt),
      fullReportAvailable: sourceEvidence.full_report_available === true,
      confirmedEvidence: asString(confirmedEvidence.image_id) ? {
        imageId: asString(confirmedEvidence.image_id),
        relationship: asString(corrections.evidence_relationship) || asString(card.reviewed_evidence_relationship) || 'Reviewer confirmed this evidence relationship.',
      } : null,
    },
    evidenceReferences: evidenceRefStrings(card, entry),
    sources,
    researchSources,
    price: {
      status: priced ? 'available' : 'blocked',
      low: priced ? priceLow : null,
      high: priced ? priceHigh : null,
      label: priced ? rangeLabel(priceLow, priceHigh) ?? 'Not yet sourced' : 'Not yet sourced',
      stage: hasCorrectedPrice ? 'Human reviewed correction' : humanize(asString(card.price_stage) || 'blocked_missing_sourced_range'),
      geography: asString(geography.label) || humanize(asString(geography.most_defensible_available_geography)) || 'Geography not provided',
      basis: hasCorrectedPrice ? `Human correction supported by ${correctedPriceSource}.` : asString(card.price_range_explanation) || 'No sourced repair range was returned.',
      sourceIds: priceSourceIds,
    },
    rangeHistory: [
      ...normalizeHistory(card),
      ...(hasCorrectedPrice ? [{
        id: `reviewed-price-${id}-${asNumber(correctedPrice.version) ?? 1}`,
        movement: 'Human reviewed adjustment',
        priorLabel: rangeLabel(asNumber(asRecord(correctedPrice.original_range).low), asNumber(asRecord(correctedPrice.original_range).high)),
        currentLabel: rangeLabel(correctedPriceLow, correctedPriceHigh) ?? 'Range unavailable',
        explanation: asString(reviewEvent.reason) || 'Reviewer reason was not returned.',
        sourceIds: correctedPriceSourceIds,
      }] : []),
    ],
    contractorQuote: contractorAmount === null ? null : {
      amount: contractorAmount,
      label: formatMoney(contractorAmount),
      sourceId: asString(contractor.source_id),
      reviewStatus: asString(contractor.review_status) || 'source_material',
    },
    weather,
    relatedFindings,
    repairPaths,
    whatChangesDecision: asStringArray(card.what_changes_the_decision),
    transactionConsiderations: asStringArray(card.transaction_considerations),
  }
}

function propertyAddress(root: UnknownRecord): string | null {
  const reconstruction = asRecord(root.propertyReportReconstruction)
  const property = asRecord(reconstruction.property)
  const parts = [asString(property.address_line1), asString(property.city), asString(property.state), asString(property.zip)].filter(Boolean)
  return parts.length ? parts.join(', ') : null
}

export function adaptPhase1ReasoningArtifact(
  input: unknown,
  options: { mode: Phase1ArtifactMode; audience?: 'reviewer' | 'agent' },
): Phase1ExperienceViewModel {
  if (!isRecord(input)) throw new Phase1ArtifactError('The reasoning response was not a structured object.')
  const entries = artifactEntries(input)
  if (!entries.length) throw new Phase1ArtifactError('The reasoning response did not contain any finding-card records.')
  const isFixture = hasFixtureMarker(input)
  if (isFixture && options.mode !== 'fixture') {
    throw new Phase1ArtifactError('Fixture-backed reasoning output is only allowed in explicit development/test mode.')
  }
  const related = relationMap(input, entries)
  const allFindings = entries.map((entry, index) => normalizeFinding(input, entry, index, related))
  const audience = options.audience ?? 'reviewer'
  const findings = audience === 'agent'
    ? allFindings.filter((finding) => finding.releaseDisposition !== null)
    : allFindings
  const categories = findings.map((finding) => finding.category).filter((value, index, all) => all.indexOf(value) === index)
  const rawOverview = asRecord(input.decisionOverview)
  const reportedMajorCategories = asArray(rawOverview.major_categories).filter(isRecord).map((item) => ({
    label: asString(item.label),
    findingCount: asNumber(item.finding_count) ?? 0,
  })).filter((item) => item.label && item.findingCount > 0)
  const findingCategoryCounts = new Map<string, number>()
  for (const finding of findings) findingCategoryCounts.set(finding.category, (findingCategoryCounts.get(finding.category) ?? 0) + 1)
  const derivedMajorCategories = [...findingCategoryCounts].map(([label, findingCount]) => ({ label, findingCount })).sort((a, b) => b.findingCount - a.findingCount || a.label.localeCompare(b.label))
  const majorCategories = audience === 'agent' || !reportedMajorCategories.length ? derivedMajorCategories : reportedMajorCategories
  const humanObservations = asArray(input.humanObservations).filter(isRecord).map((item, index) => {
    const source = asRecord(item.source)
    return {
      id: asString(item.id) || `human-observation-${index + 1}`,
      observation: asString(item.observation),
      identity: asString(source.identity) || 'Unknown submitter',
      role: humanize(asString(source.role) || 'unknown'),
      observedAt: asString(source.observed_at) || null,
      submittedAt: asString(source.submitted_at) || null,
      directness: humanize(asString(source.directness) || 'not stated'),
      professionalStatus: humanize(asString(source.professional_status) || 'not established'),
      verificationStatus: humanize(asString(source.verification_status) || 'needs review'),
    }
  }).filter((item) => item.observation)
  const transactionContext = asRecord(input.transactionContext)
  const localProfessionalResearch = asRecord(input.localProfessionals)
  return {
    schemaVersion: asString(input.schemaVersion) || asString(input.schema_version) || 'unknown',
    mode: options.mode,
    isFixture,
    propertyAddress: propertyAddress(input),
    findings,
    categories,
    openQuestionCount: findings.filter((finding) => finding.missingInformation.length > 0).length,
    audience,
    totalFindingCount: allFindings.length,
    overview: {
      majorCategories,
      findingsWithSourcedPaths: asNumber(rawOverview.findings_with_sourced_paths) ?? findings.filter((finding) => finding.repairPaths.some((path) => path.status === 'priced')).length,
      findingsWithoutSourcedPaths: asNumber(rawOverview.findings_without_sourced_paths) ?? findings.filter((finding) => !finding.repairPaths.some((path) => path.status === 'priced')).length,
      decisionFactors: audience === 'agent'
        ? [...new Set(findings.flatMap((finding) => finding.whatChangesDecision))].slice(0, 10)
        : asStringArray(rawOverview.decision_factors),
      immediateNextTasks: audience === 'agent'
        ? [...new Set(findings.map((finding) => finding.nextStep))].slice(0, 8)
        : asStringArray(rawOverview.immediate_next_tasks),
      aggregateCostRule: asString(rawOverview.aggregate_cost_rule) || 'Finding and path ranges should not be summed without reconciling overlap and alternatives.',
    },
    humanObservations,
    localProfessionals: {
      groups: asArray(localProfessionalResearch.groups).filter(isRecord).map((group) => ({
        trade: asString(group.trade),
        professionals: asArray(group.professionals).filter(isRecord).map((professional) => ({
          providerId: asString(professional.providerId),
          name: asString(professional.name),
          address: asString(professional.address) || null,
          rating: asNumber(professional.rating),
          reviewCount: asNumber(professional.reviewCount),
          source: asString(professional.source),
          sourceUrl: asString(professional.sourceUrl) || null,
          retrievedAt: asString(professional.retrievedAt),
          qualificationStatus: asString(professional.qualificationStatus),
        })).filter((professional) => professional.providerId && professional.name),
      })).filter((group) => group.trade && group.professionals.length),
      lookups: asArray(localProfessionalResearch.lookups).filter(isRecord).map((lookup) => ({
        trade: asString(lookup.trade),
        status: asString(lookup.status),
        provider: asString(lookup.provider),
      })).filter((lookup) => lookup.trade && lookup.status),
    },
    transactionPerspective: humanize(asString(transactionContext.perspective) || 'not stated'),
  }
}

export async function loadPhase1ReasoningArtifact({
  mode,
  signal,
}: {
  mode: Phase1ArtifactMode
  signal?: AbortSignal
}): Promise<Phase1ExperienceViewModel> {
  if (mode !== 'fixture') throw new Phase1ArtifactError('Live artifacts must come through the authenticated Phase 1 processing boundary.')
  const url = '/phase1-round1g-moisture.fixture.json'
  const response = await fetch(url, { headers: { Accept: 'application/json' }, signal })
  if (!response.ok) throw new Phase1ArtifactError(`The reasoning-output request failed with status ${response.status}.`)
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) throw new Phase1ArtifactError('The reasoning-output endpoint did not return JSON.')
  return adaptPhase1ReasoningArtifact(await response.json(), { mode })
}
