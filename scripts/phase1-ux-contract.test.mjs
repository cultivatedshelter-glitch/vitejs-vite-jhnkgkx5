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

test('guided flow keeps six internal states behind a simple three-stage progress model', () => {
  assert.match(component, /type Step = 'property' \| 'evidence' \| 'processing' \| 'overview' \| 'finding' \| 'gap' \| 'next'/)
  assert.match(component, /PROGRESS_STAGES = \['Property', 'Evidence', 'Review'\]/)
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
    'Shelter Prep recommends',
    'Why this next step',
    'Missing information',
    'Environmental context',
    'Contractor input',
    'does not verify this finding',
    'Likely paths',
    'What would change the decision',
    'Pricing source',
    'Range history',
    'Related findings',
    'Approve',
    'Edit / Correct',
    'Needs More Information',
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
  assert.match(component, /Source-supported path price correction/)
  assert.match(component, /Evidence relationship/)
  assert.match(component, /Under review/)
  assert.match(component, /Reviewed by Shelter Prep/)
  const findingView = component.slice(component.indexOf('function FindingStep'), component.indexOf('function AgentView'))
  assert.ok(findingView.indexOf('Primary evidence') < findingView.indexOf('Shelter Prep interpretation'))
  assert.doesNotMatch(findingView, /sourceFileId|source_file_id|sha256|checksum/)
  const agentView = component.slice(component.indexOf('function AgentView'), component.indexOf('function GapStep'))
  assert.match(agentView, /finding\.nextStep/)
  assert.doesNotMatch(agentView, /reviewerId|parser|review queue|source_file_id|sha256/)
  assert.match(component, /function ReviewQueue/)
  assert.match(component, /Likely related photos/)
  assert.match(component, /Confirm photo link/)
  assert.match(component, /Source and nearby page previews/)
  assert.match(component, /View full report/)
})

test('agent drafts are withheld at the server boundary and reviewer queue stays role-gated', async () => {
  const repository = await readFile(new URL('../server/phase1SupabaseRepository.mjs', import.meta.url), 'utf8')
  const service = await readFile(new URL('../server/phase1ProcessingService.mjs', import.meta.url), 'utf8')
  assert.match(repository, /request\.status === 'completed' \? agentArtifact\(artifact/)
  assert.match(repository, /request\.status === 'needs_review'[\s\S]*'under_review'/)
  assert.match(repository, /delete copy\.source\?\.provenance/)
  assert.match(repository, /card\.released_to_agent = true/)
  const agentProjection = repository.slice(repository.indexOf('function agentArtifact'), repository.indexOf('export function normalizePropertyAddress'))
  assert.doesNotMatch(agentProjection, /reviewState[,;]/)
  assert.match(service, /repository\.isReviewer/)
  assert.match(service, /Reviewer access is required/)
})

test('secondary evidence, sources, context, and history use collapsed disclosure controls', () => {
  const details = component.match(/<details>/g) ?? []
  assert.ok(details.length >= 5)
  assert.doesNotMatch(component, /<details\s+open/)
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
  assert.match(component, /state === 'queued' \|\| state === 'processing'[\s\S]*setStep\('processing'\)/)
  assert.match(component, /else \{[\s\S]*setStep\('evidence'\)[\s\S]*setEvidenceError\(message\)/)
})

test('layout is mobile-first with stable controls, evidence-first stacking, and one primary action class', () => {
  assert.match(css, /@media \(max-width: 720px\)/)
  assert.match(css, /\.phase1-primary[\s\S]*?min-height: 52px/)
  assert.match(css, /\.phase1-actions[\s\S]*?position: fixed/)
  assert.match(css, /\.phase1-evidence-grid[\s\S]*?grid-template-columns: 1fr 1fr/)
  assert.match(css, /grid-template-areas: "main" "aside"/)
  assert.match(component, /Estimated repair cost/)
  assert.match(component, /Pricing source/)
  assert.doesNotMatch(css, /gradient\(/)
})
