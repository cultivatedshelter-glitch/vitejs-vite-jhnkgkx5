import { buildDecisionBrief } from './phase1DecisionBrief.mjs'

const TERMINAL = new Set(['approve', 'needs_more_info', 'reject'])
const INTERNAL_RELEASE_LANGUAGE = /organize it as|round 1|decision-blocking uncertainty|uncertainty-reduction item|human review has not verified this interpretation|ai draft interpretation|no additional field evidence is required for initial triage|identify the specific unresolved fact/i

function effectiveFindingContent(artifact, observation) {
  const card = observation.finding_card || {}
  const corrections = artifact?.reviewState?.[observation.id]?.event?.new_value?.corrections || {}
  return {
    title: String(corrections.title || card.finding_title || observation.id || 'Unknown finding'),
    interpretation: String(corrections.interpretation || observation.epistemic_states?.shelter_prep_interpretation || ''),
    nextTask: String(corrections.next_step || card.recommended_next_step || ''),
    unknowns: Array.isArray(corrections.unknown) ? corrections.unknown.join(' ') : Array.isArray(card.what_we_dont_know) ? card.what_we_dont_know.join(' ') : '',
    researchSourceRefs: Array.isArray(card.research_source_refs) ? card.research_source_refs : [],
  }
}

export function recipientReadiness(artifact) {
  const issues = []
  for (const observation of artifact?.atomicObservations || []) {
    const content = effectiveFindingContent(artifact, observation)
    const reasons = []
    if (!content.interpretation.trim()) reasons.push('missing_interpretation')
    if (INTERNAL_RELEASE_LANGUAGE.test(`${content.interpretation} ${content.nextTask} ${content.unknowns}`)) reasons.push('internal_or_generic_language')
    if (!content.nextTask.trim()) reasons.push('missing_next_task')
    if (!content.researchSourceRefs.length) reasons.push('missing_independent_research')
    if (reasons.length) issues.push({ observationId: observation.id, title: content.title, reasons })
  }
  return { ready: issues.length === 0, issueCount: issues.length, issues }
}

function assertInvestigationQuality(artifact) {
  const readiness = recipientReadiness(artifact)
  const issue = readiness.issues[0]
  if (!issue) return
  if (issue.reasons.includes('missing_independent_research') && issue.reasons.length === 1) {
    throw new Error(`Finding ${issue.title} has no independent research source.`)
  }
  throw new Error(`Finding ${issue.title} still contains internal or paraphrase-only reasoning.`)
}

export function reviewedReportSummary(artifact) {
  const observations = Array.isArray(artifact?.atomicObservations) ? artifact.atomicObservations : []
  const states = artifact?.reviewState && typeof artifact.reviewState === 'object' ? artifact.reviewState : {}
  const actions = observations.map((item) => states[item.id]?.event?.review_action || null)
  const approved = actions.filter((action) => action === 'approve').length
  const needsInfo = actions.filter((action) => action === 'needs_more_info').length
  const rejected = actions.filter((action) => action === 'reject').length
  const reviewed = actions.filter((action) => TERMINAL.has(action)).length
  return { total: observations.length, reviewed, approved, needsInfo, rejected, remaining: observations.length - reviewed }
}

export function buildReviewedReportDocument({ report, request, reviewer, localProfessionals }) {
  const summary = reviewedReportSummary(request.artifact)
  if (!summary.total || summary.remaining) throw new Error(`${summary.remaining || 'All'} findings still require a terminal review decision.`)
  assertInvestigationQuality(request.artifact)
  return {
    schemaVersion: 'phase1-reviewed-report-v1',
    reportId: report.id,
    reportVersion: report.report_version,
    propertyId: request.propertyId,
    processingRequestId: request.id,
    propertyAddress: request.submission?.propertyAddress || 'Property address unavailable',
    generatedAt: new Date().toISOString(),
    reviewer: { id: reviewer.id, name: reviewer.fullName || null },
    recipient: report.recipient,
    status: 'Human Reviewed',
    summary,
    decisionBrief: buildDecisionBrief(request.artifact, summary),
    artifact: structuredClone(request.artifact),
    localProfessionals: localProfessionals || { groups: [], lookups: [] },
    notice: 'Property-specific reviewed information. Not valid for unrelated properties. Qualified trades determine final field scope and means and methods.',
  }
}

export function reviewedFindingVersions(document) {
  const states = document.artifact?.reviewState || {}
  return Object.entries(states).map(([observationId, state]) => ({
    observationId,
    findingId: state?.findingId || null,
    reviewEventId: state?.event?.id || null,
    action: state?.event?.review_action || null,
    reviewedAt: state?.event?.created_at || null,
  }))
}

export function reviewedPricingVersions(document) {
  return (document.artifact?.atomicObservations || []).flatMap((observation) => {
    const event = document.artifact?.reviewState?.[observation.id]?.event || {}
    const corrections = event.new_value?.corrections || {}
    const adjusted = [corrections.price, ...(Array.isArray(corrections.price_adjustments) ? corrections.price_adjustments : [])]
      .filter(Boolean)
    return (observation.finding_card?.repair_paths || []).map((path) => {
      const correction = adjusted.find((item) => item.path_id === path.id) || null
      return {
        observationId: observation.id,
        pathId: path.id,
        pathLabel: (corrections.repair_paths || []).find((item) => item.id === path.id)?.label || path.label,
        low: correction?.low ?? path.price_low ?? null,
        high: correction?.high ?? path.price_high ?? null,
        unit: path.price_unit || 'project',
        sourceIds: correction?.supporting_source_ids || path.price_source_refs || [],
        sourceType: correction?.source_type || 'external_sources',
        geography: correction?.geography || path.price_geography || null,
        assumptions: correction?.assumptions || path.assumptions || [],
        exclusions: correction?.exclusions || path.major_exclusions || [],
        confidence: correction?.confidence_status || path.range_status || path.confidence || null,
        rangeHistory: path.range_history || observation.finding_card?.range_history || [],
        reviewEventId: event.id || null,
        reviewedAt: event.created_at || null,
      }
    })
  })
}
