export type Phase1ArtifactMode = 'live' | 'fixture'

export type Phase1LinkedSource = {
  id: string
  label: string
  reference: string
  url: string | null
  kind: string
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
}

export type Phase1FindingViewModel = {
  id: string
  title: string
  category: string
  observation: string
  observedAt: string | null
  known: string[]
  unknown: string[]
  missingInformation: string[]
  nextStep: string
  nextStepOwner: string
  whyNextStep: string
  reviewStatus: string
  reviewStatusLabel: string
  evidenceReferences: string[]
  sources: Phase1LinkedSource[]
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
}

export type Phase1ExperienceViewModel = {
  schemaVersion: string
  mode: Phase1ArtifactMode
  isFixture: boolean
  propertyAddress: string | null
  findings: Phase1FindingViewModel[]
  categories: string[]
  openQuestionCount: number
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
  return {
    id,
    label: asString(source.source_name) || asString(source.provider) || humanize(asString(source.record_type)) || id,
    reference,
    url,
    kind: asString(source.source_type) || asString(source.record_type) || 'source',
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
    asString(sourceRefs.source_file_id),
    sourceRefs.source_page == null ? '' : `Page ${String(sourceRefs.source_page)}`,
    asString(sourceRefs.source_section),
    asString(sourceRefs.source_item_number),
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

  if (claimText) return { status: 'available', text: claimText, sourceIds }
  if (weather.is_relevant_to_interpretation === true || asString(weather.status).includes('not_researched')) {
    return {
      status: 'unavailable',
      text: 'Environmental context is relevant to this finding, but no sourced weather result was returned.',
      sourceIds,
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
  const id = asString(entry.id) || asString(entry.finding_id) || `finding-${index + 1}`
  const title = asString(card.finding_title) || asString(source.inspector_statement) || `Inspection finding ${index + 1}`
  const known = asStringArray(card.what_we_know)
  const unknown = asStringArray(card.what_we_dont_know)
  const recommended = asString(card.recommended_next_step)
  const explicitMissing = asString(nextEvidence.next_evidence_needed)
  const missingInformation = explicitMissing && explicitMissing !== recommended ? [explicitMissing] : unknown
  const priceLow = asNumber(card.price_low)
  const priceHigh = asNumber(card.price_high)
  const priced = priceLow !== null && priceHigh !== null && asString(card.pricing_contract_status) !== 'BLOCKED_MISSING_SOURCED_RANGE'
  const geography = asRecord(card.price_geography)
  const priceSourceIds = asStringArray(card.price_source_refs)
  const weather = normalizeWeather(card)
  const contractor = asRecord(card.contractor_quote)
  const contractorAmount = asNumber(contractor.amount)
  const catalog = collectSourceCatalog(root, entry)
  const linkedIds = [
    ...priceSourceIds,
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
    })

  const rawRelated = asStringArray(card.related_findings)
  const relatedFindings = [...rawRelated, ...(related.get(id) ?? [])]
    .filter((value, relatedIndex, all) => all.indexOf(value) === relatedIndex)

  return {
    id,
    title,
    category: asString(organization.building_system) || asString(asRecord(card.source_refs).source_section) || 'Inspection findings',
    observation: asString(epistemic.source_observation) || asString(source.inspector_statement) || known[0] || title,
    observedAt: asString(source.when_observed) || null,
    known,
    unknown,
    missingInformation,
    nextStep: recommended || explicitMissing || 'Human review is needed to choose the next step.',
    nextStepOwner: asString(card.next_step_owner) || 'human reviewer',
    whyNextStep: asString(card.why_next_step) || 'The artifact did not provide a next-step rationale.',
    reviewStatus: asString(card.review_status) || 'needs_human_review',
    reviewStatusLabel: reviewLabel(asString(card.review_status) || 'needs_human_review'),
    evidenceReferences: evidenceRefStrings(card, entry),
    sources,
    price: {
      status: priced ? 'available' : 'blocked',
      low: priced ? priceLow : null,
      high: priced ? priceHigh : null,
      label: priced ? rangeLabel(priceLow, priceHigh) ?? 'Not yet sourced' : 'Not yet sourced',
      stage: humanize(asString(card.price_stage) || 'blocked_missing_sourced_range'),
      geography: asString(geography.label) || humanize(asString(geography.most_defensible_available_geography)) || 'Geography not provided',
      basis: asString(card.price_range_explanation) || 'No sourced repair range was returned.',
      sourceIds: priceSourceIds,
    },
    rangeHistory: normalizeHistory(card),
    contractorQuote: contractorAmount === null ? null : {
      amount: contractorAmount,
      label: formatMoney(contractorAmount),
      sourceId: asString(contractor.source_id),
      reviewStatus: asString(contractor.review_status) || 'source_material',
    },
    weather,
    relatedFindings,
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
  options: { mode: Phase1ArtifactMode },
): Phase1ExperienceViewModel {
  if (!isRecord(input)) throw new Phase1ArtifactError('The reasoning response was not a structured object.')
  const entries = artifactEntries(input)
  if (!entries.length) throw new Phase1ArtifactError('The reasoning response did not contain any finding-card records.')
  const isFixture = hasFixtureMarker(input)
  if (isFixture && options.mode !== 'fixture') {
    throw new Phase1ArtifactError('Fixture-backed reasoning output is only allowed in explicit development/test mode.')
  }
  const related = relationMap(input, entries)
  const findings = entries.map((entry, index) => normalizeFinding(input, entry, index, related))
  const categories = findings.map((finding) => finding.category).filter((value, index, all) => all.indexOf(value) === index)
  return {
    schemaVersion: asString(input.schemaVersion) || asString(input.schema_version) || 'unknown',
    mode: options.mode,
    isFixture,
    propertyAddress: propertyAddress(input),
    findings,
    categories,
    openQuestionCount: findings.filter((finding) => finding.missingInformation.length > 0).length,
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
