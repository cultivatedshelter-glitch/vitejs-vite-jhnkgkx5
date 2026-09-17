const TRUSTED_REVIEW_STATES = new Set(['human_verified', 'human_reviewed', 'contractor_verified', 'seller_ready', 'finalized'])

function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null
}

function text(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function strings(value) {
  return Array.isArray(value) && value.length > 0 && value.every(text)
}

function fail(message) {
  throw new Error(`Reasoning artifact invalid: ${message}`)
}

export function validatePhase1Artifact(artifact, { propertyId } = {}) {
  const root = record(artifact)
  if (!root) fail('response must be an object')
  if (!text(root.schemaVersion) && !text(root.schema_version)) fail('artifact version is missing')
  if (root.fixture_backed === true || JSON.stringify(root).includes('fixture://')) fail('fixture-backed output cannot be returned by live processing')
  if (propertyId && root.property_id && root.property_id !== propertyId) fail('property identifier does not match the request')

  const observations = Array.isArray(root.atomicObservations) ? root.atomicObservations : []
  if (!observations.length) fail('atomic observations are missing')

  for (const [index, raw] of observations.entries()) {
    const observation = record(raw) || fail(`observation ${index + 1} must be an object`)
    const source = record(observation.source) || fail(`observation ${index + 1} source is missing`)
    const epistemic = record(observation.epistemic_states) || fail(`observation ${index + 1} epistemic states are missing`)
    const card = record(observation.finding_card) || fail(`observation ${index + 1} finding card is missing`)
    const chronology = record(observation.source_chronology) || fail(`observation ${index + 1} chronology is missing`)

    if (!text(epistemic.source_observation)) fail(`observation ${index + 1} source observation is missing`)
    if (!text(epistemic.shelter_prep_interpretation)) fail(`observation ${index + 1} interpretation is missing`)
    if (epistemic.source_observation.trim() === epistemic.shelter_prep_interpretation.trim()) fail(`observation ${index + 1} collapses observation into interpretation`)
    if (!strings(card.what_we_know)) fail(`observation ${index + 1} known facts are missing`)
    if (!strings(card.what_we_dont_know)) fail(`observation ${index + 1} unknowns are missing`)
    if (!text(card.recommended_next_step)) fail(`observation ${index + 1} next step is missing`)
    if (!text(card.why_next_step)) fail(`observation ${index + 1} next-step rationale is missing`)
    if (!record(card.evidence_refs) || !record(card.source_refs)) fail(`observation ${index + 1} evidence/source links are missing`)
    if (!text(source.when_observed) && !text(chronology.observation_date)) fail(`observation ${index + 1} observation date is missing`)
    if (chronology.upload_date_used_as_observation_date === true) fail(`observation ${index + 1} substitutes upload time for observation time`)

    const reviewStatus = String(card.review_status || epistemic.human_review_status || '')
    if (!reviewStatus) fail(`observation ${index + 1} review status is missing`)
    if (TRUSTED_REVIEW_STATES.has(reviewStatus)) fail(`observation ${index + 1} forges a trusted review state`)

    const priceBlocked = card.pricing_contract_status === 'BLOCKED_MISSING_SOURCED_RANGE'
    const hasRange = Number.isFinite(card.price_low) && Number.isFinite(card.price_high)
    if (!priceBlocked && !hasRange) fail(`observation ${index + 1} pricing state is incomplete`)
    if (hasRange) {
      if (!record(card.price_geography) || !strings(card.price_source_refs)) fail(`observation ${index + 1} priced range lacks geography or sources`)
      if (!text(card.price_range_explanation)) fail(`observation ${index + 1} priced range lacks explanation`)
    } else if (card.price_low !== null || card.price_high !== null) {
      fail(`observation ${index + 1} blocked range must use null bounds`)
    }

    const contractor = record(card.contractor_quote)
    if (contractor && Array.isArray(card.price_source_refs) && card.price_source_refs.includes(contractor.source_id)) {
      fail(`observation ${index + 1} contractor quote is merged into the Shelter Prep range`)
    }

    const weather = record(card.weather_context)
    const claim = record(weather?.claim)
    if (claim && claim.causal_status && claim.causal_status !== 'correlation_context_only') {
      fail(`observation ${index + 1} weather context asserts unsupported causation`)
    }
  }

  return artifact
}
