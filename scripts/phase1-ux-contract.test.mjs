import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const componentUrl = new URL('../src/Phase1Experience.tsx', import.meta.url)
const cssUrl = new URL('../src/Phase1Experience.css', import.meta.url)
const mainUrl = new URL('../src/main.tsx', import.meta.url)

const [component, css, main] = await Promise.all([
  readFile(componentUrl, 'utf8'),
  readFile(cssUrl, 'utf8'),
  readFile(mainUrl, 'utf8'),
])

test('guided flow adds explicit review-submission and submitted handoff states', () => {
  assert.match(component, /type Step = 'property' \| 'evidence' \| 'submission_review' \| 'submitted'/)
  assert.match(component, /PROGRESS_STAGES = \['Property', 'Evidence', 'Review Submission', 'Submitted'\]/)
  assert.match(main, /showLegacyApp \? <App \/> : <Phase1Experience fixtureMode=\{fixtureMode\} \/>/)
  assert.match(main, /import\.meta\.env\.DEV.*fixture/)
})

test('property asks one question and evidence uses four large action cards', () => {
  assert.match(component, /Property address/)
  assert.match(component, /Add the property address/)
  for (const option of ['Upload inspection', 'Add photos / video', 'Type a note or question', 'Take a photo']) assert.match(component, new RegExp(option, 'i'))
  assert.match(component, /accept="\.pdf,\.doc,\.docx,\.txt"/)
  assert.match(component, /accept="image\/\*,video\/\*"/)
  assert.match(component, /capture="environment"/)
  assert.match(component, /secure and private/i)
  const propertyBlock = component.slice(component.indexOf('function PropertyStep'), component.indexOf('function EvidenceStep'))
  assert.doesNotMatch(propertyBlock, /Upload inspection|Add photos|note or question/)
  for (const disallowed of ['Phone number', 'Urgency', 'Occupancy', 'Desired timeline']) {
    assert.doesNotMatch(component, new RegExp(disallowed, 'i'))
  }
})

test('finding UI renders adapter fields without embedding fixture findings', () => {
  for (const required of [
    'Development fixture',
    'Inspector reported',
    'Primary evidence',
    'Affected location',
    'Shelter Prep interpretation',
    'Known',
    'Unknown',
    'Next task',
    'Why this is the next task',
    'Missing information',
    'Environmental context',
    'Contractor input',
    'does not verify this finding',
    'Likely paths',
    'What would change the decision',
    'Pricing source',
    'Range history',
    'More Details',
    'Approve & Next',
    'Save Edit',
    'Needs Info',
    'Reject',
  ]) {
    assert.match(component, new RegExp(required, 'i'))
  }
  assert.match(component, /artifact\.findings\.length/)
  assert.match(component, /path\.priceLabel/)
  assert.match(component, /finding\.reviewStatusLabel/)
  assert.match(component, /finding\.weather &&/)
  assert.match(component, /loadPhase1ReasoningArtifact/)
  assert.doesNotMatch(component, /\$900|\$3,000|\$1,475|Ceiling water staining|Crawlspace moisture/)
  assert.doesNotMatch(component, /reviewStatus\s*=\s*['"]human_verified/)
})

test('reviewer and agent views keep evidence, correction, and release states distinct', () => {
  assert.match(component, /function AgentView/)
  assert.match(component, /audienceFromLocation/)
  assert.match(component, /reviewPhase1Finding/)
  assert.match(component, /Adjust Price/)
  assert.match(component, /Reviewer \/ Professional Judgment/)
  assert.match(component, /supporting_source_ids/)
  assert.doesNotMatch(component, /Edit finding/)
  assert.match(component, /Reviewer field knowledge/)
  assert.match(component, /field_knowledge: fieldKnowledge\.trim\(\)/)
  assert.match(component, /Under review/)
  assert.match(component, /Reviewed by Shelter Prep/)
  const findingView = component.slice(component.indexOf('function FindingStep'), component.indexOf('function AgentView'))
  assert.ok(findingView.indexOf('Primary evidence') < findingView.indexOf('Shelter Prep interpretation'))
  assert.doesNotMatch(findingView, /sourceFileId|source_file_id|sha256|checksum/)
  const agentView = component.slice(component.indexOf('function ReleasedResultContent'), component.indexOf('function GapStep'))
  assert.match(agentView, /finding\.nextStep/)
  assert.doesNotMatch(agentView, /reviewerId|parser|review queue|source_file_id|sha256/)
  assert.match(component, /function AdminDashboard/)
  assert.match(component, /Likely related photos/)
  assert.match(component, /Confirm photo link/)
  for (const sourceAction of ['View Source Page', 'Previous Page', 'Next Page', 'Nearby Pages', 'Open Full Report']) assert.match(component, new RegExp(sourceAction))
  assert.match(component, /expectedReviewEventId: finding\.reviewDecision\.eventId/)
  assert.match(component, /persistedFinding\.reviewDecision\.eventId !== result\.eventId/)
  assert.match(component, /Changes were not saved/)
  assert.match(component, /nextIndex/)
  assert.match(component, /setFindingIndex\(nextIndex\)/)
  assert.match(component, /Finding \{findingIndex \+ 1\} of \{findingCount\}/)
  assert.match(component, />Previous</)
  assert.match(component, />Next</)
  assert.match(component, /Approve & Next/)
  assert.match(component, /Quick review/)
  assert.match(component, /Careful review/)
  assert.match(component, /function SourceDrawer/)
})

test('agent drafts are withheld at the server boundary and reviewer queue stays role-gated', async () => {
  const repository = await readFile(new URL('../server/phase1SupabaseRepository.mjs', import.meta.url), 'utf8')
  const service = await readFile(new URL('../server/phase1ProcessingService.mjs', import.meta.url), 'utf8')
  assert.match(repository, /request\.status === 'completed' \? agentArtifact\(artifact/)
  assert.match(repository, /request\.status === 'needs_review'[\s\S]*'under_review'/)
  assert.match(repository, /delete copy\.source\?\.provenance/)
  assert.match(repository, /card\.release_disposition/)
  const agentProjection = repository.slice(repository.indexOf('function agentArtifact'), repository.indexOf('export function normalizePropertyAddress'))
  assert.doesNotMatch(agentProjection, /reviewState[,;]/)
  assert.match(service, /repository\.isReviewer/)
  assert.match(service, /Reviewer access is required/)
})

test('secondary evidence and machinery stay behind compact disclosure controls', () => {
  const details = component.match(/<details(?:\s|>)/g) ?? []
  assert.ok(details.length >= 4)
  assert.match(component, /<summary>More Details<\/summary>/)
})

test('review completion is explicit and separated from preview, release, and send', () => {
  for (const label of ['Review complete', 'Generate Reviewed Report', 'Reviewed Property Report', 'Preview for', 'Back to Review', 'Release Report', 'Report released', 'Send Reviewed Result']) {
    assert.match(component, new RegExp(label, 'i'))
  }
  assert.match(component, /isTerminalReview/)
  assert.match(component, /reviewDecision\.action === 'approve'/)
  assert.match(component, /previewPhase1ReviewedReport/)
  assert.match(component, /releasePhase1ReviewedReport/)
  assert.match(component, /sendPhase1ReviewedResult/)
  assert.match(component, /Human review complete/)
  assert.match(component, /Recipient report ready/)
  assert.match(component, /content correction before report generation/)
  assert.match(component, /Fix finding/)
  assert.match(component, /disabled=\{reportBusy \|\| \(humanReviewComplete && !recipientReady\)\}/)
  assert.match(component, /recipientReadiness\?\.ready/)
})

test('released web reports use the compact canonical decision brief with mobile-safe hierarchy', () => {
  for (const required of ['DecisionBriefContent', 'Likely paths', 'Key unknown', 'Next step', 'Why this matters', 'View pricing sources', 'Technical details and sources']) assert.match(component, new RegExp(required, 'i'))
  assert.match(component, /report\.reviewed_artifact\.decisionBrief/)
  assert.match(component, /preview\.report\?\.decisionBrief/)
  assert.match(css, /\.phase1-brief-summary[\s\S]*grid-template-columns: repeat\(4/)
  assert.match(css, /@media \(max-width: 430px\)[\s\S]*\.phase1-brief-summary[\s\S]*repeat\(2/)
  assert.match(css, /@media \(max-width: 430px\)[\s\S]*\.phase1-role-nav button[\s\S]*font-size: 11px/)
  assert.match(css, /overflow-wrap: anywhere/)
})

test('durable draft reports can be released from property history through the canonical endpoint', () => {
  assert.match(component, /function DurableReportView/)
  assert.match(component, /setRequestId\(report\.processing_request_id\)/)
  assert.match(component, /setStatus\(report\.report_status\)/)
  assert.match(component, /await releasePhase1ReviewedReport\(requestId, reportId\)/)
  assert.match(component, /status === 'draft'[\s\S]*Release Report/)
  assert.match(component, /status === 'released'[\s\S]*Released/)
})

test('processing reflects artifact request state without simulated timers', () => {
  for (const task of ['Uploading files', 'Reading inspection report', 'Finding and grouping issues', 'Checking relevant context', 'Building your summary']) assert.match(component, new RegExp(task, 'i'))
  assert.match(component, /We couldn't finish the review/)
  assert.doesNotMatch(component, /setTimeout|activeTask|PROCESSING_TASKS/)
})

test('evidence stays visible until upload and request creation succeed', () => {
  assert.match(component, /aria-label="Selected evidence" aria-live="polite"/)
  assert.match(component, /file\.size \/ 1024 \/ 1024/)
  assert.match(component, /Uploading evidence…/)
  assert.match(component, /error && <p className="phase1-inline-error" role="alert">\{error\}<\/p>/)
  assert.match(component, /await uploadPhase1Evidence/)
  assert.match(component, /await createPhase1SubmissionDraft/)
  assert.match(component, /updatePhase1SubmissionDraft/)
  assert.match(component, /setStep\('submission_review'\)/)
  assert.match(component, /else \{[\s\S]*setStep\('evidence'\)[\s\S]*setEvidenceError\(message\)/)
})

test('role-based navigation and continuity surfaces remain server-authoritative', () => {
  for (const required of ['loadPhase1Identity', 'Admin Dashboard', 'Continue where you left off', 'Resume Review', 'My Properties', 'Review Submission', 'Result recipient', 'Submit to Shelter Prep', 'Reviewed result will be sent to']) {
    assert.match(component, new RegExp(required, 'i'))
  }
  assert.match(component, /identity\.isReviewer/)
  assert.match(component, /savePhase1ReviewPosition/)
  assert.match(component, /lastViewedObservationId/)
  assert.match(component, /deliveryRecipientEmail/)
})

test('layout is mobile-first with stable controls, evidence-first stacking, and one primary action class', () => {
  assert.match(css, /@media \(max-width: 720px\)/)
  assert.match(css, /\.phase1-primary[\s\S]*?min-height: 52px/)
  assert.match(css, /\.phase1-actions[\s\S]*?position: fixed/)
  assert.match(css, /\.phase1-evidence-grid[\s\S]*?grid-template-columns: 1fr 1fr/)
  assert.match(css, /\.phase1-review-flow[\s\S]*?width: min\(100%, 790px\)/)
  assert.match(css, /\.phase1-review-controls[\s\S]*?position: sticky/)
  assert.match(css, /\.phase1-source-drawer-backdrop[\s\S]*?position: fixed/)
  assert.match(component, /path\.priceLabel/)
  assert.match(component, /Pricing source/)
  assert.doesNotMatch(css, /gradient\(/)
})
