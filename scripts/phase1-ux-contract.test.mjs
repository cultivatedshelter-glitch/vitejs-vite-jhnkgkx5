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
    'Observation',
    'What we know',
    "What we don't know",
    'Next step',
    'Why this next step',
    'Missing information',
    'Weather and environment',
    'Contractor input',
    'does not verify this finding',
    'Price basis',
    'Range history',
    'Related findings',
  ]) {
    assert.match(component, new RegExp(required, 'i'))
  }
  assert.match(component, /artifact\.findings\.length/)
  assert.match(component, /finding\.price\.label/)
  assert.match(component, /finding\.reviewStatusLabel/)
  assert.match(component, /finding\.weather &&/)
  assert.match(component, /loadPhase1ReasoningArtifact/)
  assert.doesNotMatch(component, /\$900|\$3,000|\$1,475|Ceiling water staining|Crawlspace moisture/)
  assert.doesNotMatch(component, /human_verified|contractor_verified/)
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

test('layout is mobile-first with stable controls, price-first stacking, and one primary action class', () => {
  assert.match(css, /@media \(max-width: 720px\)/)
  assert.match(css, /\.phase1-primary[\s\S]*?min-height: 52px/)
  assert.match(css, /\.phase1-actions[\s\S]*?position: fixed/)
  assert.match(css, /\.phase1-evidence-grid[\s\S]*?grid-template-columns: 1fr 1fr/)
  assert.match(css, /grid-template-areas: "aside" "main"/)
  assert.match(component, /Estimated local repair cost/)
  assert.match(component, /View pricing sources/)
  assert.doesNotMatch(css, /gradient\(/)
})
