const GENERIC_UNKNOWN = /exact cause is not established|final field scope|means and methods|permit needs|contractor pricing remain unverified|no linked report photo caption|human review has not verified/i

const TRANSCRIPTION_FIXES = [
  [/\bqualied\b/gi, 'qualified'],
  [/\bqualier\b/gi, 'qualifier'],
  [/\boor\b/gi, 'floor'],
  [/\booring\b/gi, 'flooring'],
  [/\bashing\b/gi, 'flashing'],
  [/\bModications\b/g, 'Modifications'],
  [/\bmodications\b/g, 'modifications'],
  [/\btted\b/gi, 'fitted'],
]

export function cleanCustomerTranscription(value) {
  let text = String(value || '').replace(/\s+/g, ' ').trim()
  for (const [pattern, replacement] of TRANSCRIPTION_FIXES) text = text.replace(pattern, replacement)
  return text
}

function humanize(value) {
  return String(value || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()).trim()
}

function concise(value, maximum = 240, sentenceLimit = 2) {
  const text = cleanCustomerTranscription(value)
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || []
  const selected = sentences.slice(0, sentenceLimit).join(' ').trim()
  if (selected.length <= maximum) return selected
  return `${selected.slice(0, maximum).replace(/\s+\S*$/, '')}...`
}

function confidenceLabel(value) {
  const normalized = String(value || '').toLowerCase()
  if (/field|higher|high/.test(normalized)) return 'Higher'
  if (/moderate/.test(normalized)) return 'Moderate'
  return 'Low'
}

function displayTitle(value) {
  const text = cleanCustomerTranscription(value)
  const letters = text.replace(/[^a-z]/gi, '')
  if (!letters || letters !== letters.toUpperCase()) return text
  const acronyms = new Map([['hvac', 'HVAC'], ['cpvc', 'CPVC'], ['gfci', 'GFCI'], ['afci', 'AFCI'], ['co', 'CO'], ['tpr', 'TPR'], ['pdf', 'PDF']])
  return text.toLowerCase().replace(/\b[a-z][a-z0-9]*\b/g, (word) => acronyms.get(word) || `${word[0].toUpperCase()}${word.slice(1)}`)
}

function groupLabel(item) {
  const card = item.finding_card || {}
  const organization = item.organization || {}
  const value = `${organization.building_system || ''} ${organization.domain_key || ''} ${card.next_step_owner || ''}`.toLowerCase()
  if (/life safety|alarm|smoke|carbon monoxide/.test(value)) return 'Safety'
  if (/electric/.test(value)) return 'Electrical'
  if (/plumb|toilet|laundry/.test(value)) return 'Plumbing'
  if (/hvac|heating|venting|furnace/.test(value)) return 'HVAC'
  if (/roof/.test(value)) return 'Roof'
  if (/exterior|envelope|siding|window|deck|hardscape|site|drainage|foundation|structure/.test(value)) return 'Exterior / Envelope'
  return 'Maintenance / Minor Items'
}

function priorityLabels(item, action, paths) {
  const card = item.finding_card || {}
  const organization = item.organization || {}
  const text = `${organization.domain_key || ''} ${organization.building_system || ''} ${card.finding_title || ''} ${(organization.condition_categories || []).join(' ')}`.toLowerCase()
  const labels = []
  if (/life safety|electrical|trip hazard|combustion|smoke|carbon monoxide/.test(text)) labels.push('Safety attention')
  if (/moisture|water|roof|flashing|gutter|caulk|plumbing/.test(text)) labels.push('Water / moisture')
  if (/foundation|structural|deck/.test(text)) labels.push('Structural uncertainty')
  if (action === 'needs_more_info' || paths.some((path) => path.status === 'blocked')) labels.push('Scope blocked')
  return labels.slice(0, 2)
}

function sourceCatalog(artifact) {
  return new Map((artifact.external_sources || []).map((source) => [source.id || source.source_id, source]))
}

function normalizedSource(source, fallbackId) {
  const geography = source?.source_geography || {}
  const reference = source?.source_url || source?.source_reference || source?.internal_reference || ''
  return {
    id: source?.id || source?.source_id || fallbackId,
    name: source?.source_name || source?.provider || source?.title || fallbackId,
    url: /^https?:\/\//i.test(reference) ? reference : null,
    reference: reference || null,
    geography: geography.label || source?.geography || null,
    date: source?.published_at || source?.retrieved_at || source?.retrieval_time || null,
    scopeBasis: source?.scope_basis || null,
  }
}

function statusFor(action) {
  if (action === 'reject') return { key: 'rejected', label: 'Rejected during review' }
  if (action === 'needs_more_info') return { key: 'needs_more_information', label: 'Needs more information' }
  return { key: 'approved', label: 'Reviewed' }
}

function pathValues(path, corrections, catalog) {
  const adjustments = [corrections.price, ...(Array.isArray(corrections.price_adjustments) ? corrections.price_adjustments : [])].filter(Boolean)
  const adjustment = adjustments.find((item) => item.path_id === path.id) || {}
  const labelCorrection = (corrections.repair_paths || []).find((item) => item.id === path.id)
  const low = adjustment.low ?? path.price_low ?? null
  const high = adjustment.high ?? path.price_high ?? null
  const sourceIds = adjustment.supporting_source_ids || path.price_source_refs || []
  return {
    id: path.id,
    label: labelCorrection?.label || path.label || 'Potential repair path',
    status: Number.isFinite(low) && Number.isFinite(high) ? 'priced' : 'blocked',
    low,
    high,
    unit: path.price_unit || 'project',
    confidence: confidenceLabel(adjustment.confidence_status || path.range_status || path.confidence),
    sourceCount: sourceIds.length,
    sources: sourceIds.map((id) => normalizedSource(catalog.get(id), id)),
    geography: adjustment.geography || path.price_geography?.label || null,
    assumptions: adjustment.assumptions || path.assumptions || [],
    exclusions: adjustment.exclusions || path.major_exclusions || [],
  }
}

function buildFinding(item, artifact, catalog) {
  const state = artifact.reviewState?.[item.id] || {}
  const event = state.event || {}
  const corrections = event.new_value?.corrections || {}
  const card = item.finding_card || {}
  const source = item.source || {}
  const epistemic = item.epistemic_states || {}
  const action = event.review_action
  const status = statusFor(action)
  const paths = (card.repair_paths || []).map((path) => pathValues(path, corrections, catalog))
  const sourceRefs = card.source_refs || {}
  const known = corrections.known || card.what_we_know || []
  const allUnknowns = corrections.unknown || card.what_we_dont_know || []
  const specificUnknowns = allUnknowns.map(cleanCustomerTranscription).filter((value) => value && !GENERIC_UNKNOWN.test(value))
  const researchSourceIds = card.research_source_refs || []
  const researchSources = researchSourceIds.map((id) => normalizedSource(catalog.get(id), id))
  const fullFound = cleanCustomerTranscription(epistemic.source_observation || source.inspector_statement || card.finding_title)
  const fullView = cleanCustomerTranscription(corrections.interpretation || epistemic.shelter_prep_interpretation)
  const found = concise(fullFound, 175, 1)
  const view = concise(fullView, 185, 1)
  const title = displayTitle(corrections.title || card.finding_title || found || 'Inspection finding')
  const fullNextStep = cleanCustomerTranscription(corrections.next_step || card.recommended_next_step || 'Confirm the next field action.')
  const fullWhy = cleanCustomerTranscription(corrections.rationale || card.why_next_step || '')
  const nextStep = concise(fullNextStep, 190, 1)
  const why = concise(fullWhy, 170, 1)
  return {
    id: item.id,
    findingId: state.findingId || null,
    reviewEventId: event.id || null,
    status: status.key,
    statusLabel: status.label,
    title,
    category: groupLabel(item),
    trade: humanize(corrections.likely_trade || card.next_step_owner || 'Qualified trade'),
    priorityLabels: priorityLabels(item, action, paths),
    found,
    view,
    keyEvidence: cleanCustomerTranscription(known[0] || found),
    keyUnknowns: specificUnknowns.slice(0, 1),
    paths,
    nextStep,
    why,
    inspectionSource: {
      document: card.source_evidence?.document_name || 'Inspection report',
      page: sourceRefs.source_page || source.source_page || null,
      item: sourceRefs.source_item_number || source.source_item_number || null,
      section: sourceRefs.source_section || source.source_section || null,
    },
    researchSources,
    technicalDetails: {
      known: known.map(cleanCustomerTranscription),
      unknowns: allUnknowns.map(cleanCustomerTranscription),
      inspectorRecommendation: cleanCustomerTranscription(source.inspector_recommendation || card.source_evidence?.inspector_recommendation || ''),
      fullSourceText: fullFound,
      fullInterpretation: fullView,
      fullNextStep,
      fullWhy,
      affectedLocation: card.affected_location || null,
      reviewerReason: event.reason || null,
      reviewedAt: event.created_at || null,
    },
  }
}

function largestCostUncertainties(findings) {
  return findings.flatMap((finding) => finding.paths.map((path) => ({ finding, path })))
    .filter(({ path }) => path.status === 'blocked' || (Number.isFinite(path.low) && Number.isFinite(path.high)))
    .sort((a, b) => {
      if (a.path.status === 'blocked' && b.path.status !== 'blocked') return -1
      if (b.path.status === 'blocked' && a.path.status !== 'blocked') return 1
      return (b.path.high - b.path.low) - (a.path.high - a.path.low)
    })
    .slice(0, 5)
    .map(({ finding, path }) => ({ findingId: finding.id, title: finding.title, path: path.label, low: path.low, high: path.high, status: path.status, keyUnknown: finding.keyUnknowns[0] || 'Field scope remains to be confirmed.' }))
}

export function buildDecisionBrief(artifact, summary) {
  const catalog = sourceCatalog(artifact)
  const findings = (artifact.atomicObservations || []).map((item) => buildFinding(item, artifact, catalog))
  const order = ['Safety', 'Roof', 'Exterior / Envelope', 'Electrical', 'Plumbing', 'HVAC', 'Maintenance / Minor Items']
  const groups = order.map((label) => ({ label, findings: findings.filter((finding) => finding.category === label) })).filter((group) => group.findings.length)
  const tradeCounts = new Map()
  for (const finding of findings) tradeCounts.set(finding.trade, (tradeCounts.get(finding.trade) || 0) + 1)
  const keyDecisions = findings.filter((finding) => finding.paths.length > 1 || finding.status !== 'approved' || finding.priorityLabels.length)
    .slice(0, 6).map((finding) => ({ findingId: finding.id, title: finding.title, decision: finding.keyUnknowns[0] || finding.nextStep }))
  return {
    schemaVersion: 'phase1-reviewed-decision-brief.v1',
    summary,
    overview: {
      keyDecisions,
      immediateFollowUp: findings.filter((finding) => finding.status !== 'rejected').slice(0, 5).map((finding) => ({ findingId: finding.id, title: finding.title, task: finding.nextStep })),
      majorTrades: [...tradeCounts].map(([trade, count]) => ({ trade, count })).sort((a, b) => b.count - a.count || a.trade.localeCompare(b.trade)).slice(0, 7),
      largestCostUncertainties: largestCostUncertainties(findings),
    },
    groups,
    appendix: { findings },
    universalCaveats: [
      'Ranges are scope-specific context and should not be added together without reconciling overlapping work and mutually exclusive paths.',
      'Qualified trades determine final field scope, means and methods, permit needs, and contractor pricing.',
      'Unlinked report photos and raw extraction detail remain available in the stored evidence record when needed for verification.',
    ],
  }
}
