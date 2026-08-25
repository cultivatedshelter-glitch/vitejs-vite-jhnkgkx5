import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildInspectionIntelligenceDraft,
  classifyInspectionConsequence,
  sequenceInspectionFindings,
} from '../src/agents/inspectionIntelligence.ts'

test('specialist investigation can be investigate_first without claiming a defect', () => {
  const result = classifyInspectionConsequence({
    sourceText: 'Inspector recommends a sewer scope. No sewer scope has been completed and actual sewer condition is unknown.',
    missingInfo: ['Complete sewer scope.'],
    severity: 'Low',
  })
  assert.equal(result.investigation_priority, 'investigate_first')
  assert.equal(result.specialist_review_required, true)
  assert.match(result.dependency_reason, /does not establish that a defect exists/i)
  assert.doesNotMatch(result.dependency_reason, /sewer is defective/i)
})

test('high transaction impact remains distinct from safety severity', () => {
  const result = classifyInspectionConsequence({
    sourceText: 'Inspector recommends sewer scope; actual sewer condition has not been established.',
    severity: 'Low',
  })
  assert.equal(result.transaction_impact, 'high')
  assert.equal(result.investigation_priority, 'investigate_first')
})

test('high potential cost exposure remains distinct from transaction impact', () => {
  const result = classifyInspectionConsequence({
    sourceText: 'HVAC equipment was documented at end of life and replacement was recommended.',
    severity: 'Medium',
  })
  assert.equal(result.potential_cost_exposure, 'high')
  assert.equal(result.transaction_impact, 'medium')
})

test('blocks_downstream_scope always carries a dependency reason', () => {
  const result = classifyInspectionConsequence({ sourceText: 'Foundation movement requires structural specialist investigation.' })
  assert.equal(result.blocks_downstream_scope, true)
  assert.ok(result.dependency_reason.trim().length > 0)
  assert.ok(result.next_evidence_needed.length > 0)
})

test('transaction impact stays unknown when evidence is insufficient', () => {
  const result = classifyInspectionConsequence({ sourceText: 'Further evaluation recommended.' })
  assert.equal(result.transaction_impact, 'unknown')
  assert.equal(result.potential_cost_exposure, 'unknown')
  assert.equal(result.investigation_priority, 'unknown')
})

test('finding and bundle sequencing retains evidence provenance', () => {
  const intelligence = buildInspectionIntelligenceDraft({
    fileName: 'inspection.pdf', reportType: 'inspection_report', propertyAddress: 'Test property', city: 'Portland', state: 'OR',
    inspectionDate: '', inspectorName: '', inspectorCompany: '',
    findings: ['Inspector recommends a sewer scope. Actual sewer condition is unknown.'], missingInfo: [], propertyId: 42,
  })
  const finding = intelligence.repairItems[0]
  const bundle = intelligence.workGroups[0]
  assert.equal(finding.source_text, 'Inspector recommends a sewer scope. Actual sewer condition is unknown.')
  assert.equal(finding.inspection_report_id, intelligence.id)
  assert.ok(bundle.finding_ids.includes(finding.id))
  assert.ok(bundle.evidence_references.includes(finding.id))
})

test('AI consequence recommendation remains unverified until human review', () => {
  const intelligence = buildInspectionIntelligenceDraft({
    fileName: 'sewer.pdf', reportType: 'inspection_report', propertyAddress: 'Test property', city: '', state: '',
    inspectionDate: '', inspectorName: '', inspectorCompany: '',
    findings: ['Inspector recommends sewer scope; condition unknown.'], missingInfo: [],
  })
  assert.equal(intelligence.humanReviewStatus, 'ai_draft')
  assert.equal(intelligence.repairItems[0].status, 'ai_draft')
  assert.equal(intelligence.workGroups[0].status, 'ai_draft')
})

test('lower-priority findings remain present after sequencing', () => {
  const items = [
    { id: 'minor', investigation_priority: 'can_wait' },
    { id: 'sewer', investigation_priority: 'investigate_first' },
    { id: 'roof', investigation_priority: 'price_next' },
  ]
  const sequenced = sequenceInspectionFindings(items)
  assert.deepEqual(sequenced.map((item) => item.id), ['sewer', 'roof', 'minor'])
  assert.equal(sequenced.length, items.length)
})

test('highest-value investigation improves missing-information wording', () => {
  const intelligence = buildInspectionIntelligenceDraft({
    fileName: 'sewer.pdf', reportType: 'inspection_report', propertyAddress: 'Test property', city: '', state: '',
    inspectionDate: '', inspectorName: '', inspectorCompany: '',
    findings: ['Inspector recommends sewer scope; actual sewer condition is unknown.'], missingInfo: [],
  })
  assert.ok(intelligence.missingInformationQuestions.some((question) => /complete sewer scope/i.test(question)))
  assert.ok(intelligence.missingInformationQuestions.some((question) => /before finalizing lower-priority bids/i.test(question)))
})

test('consequence model uses categorical values and no transaction probability score', () => {
  const result = classifyInspectionConsequence({ sourceText: 'Minor caulking maintenance was observed.' })
  assert.equal(result.transaction_impact, 'low')
  assert.equal(result.potential_cost_exposure, 'low')
  assert.equal(result.investigation_priority, 'can_wait')
  assert.equal('transaction_probability' in result, false)
})
