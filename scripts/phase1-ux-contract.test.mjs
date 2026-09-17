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

test('guided flow exposes the six Phase 1 stages without replacing the legacy app', () => {
  for (const label of ['Property', 'Add evidence', 'Processing', 'Review findings', 'Close gaps', 'Next steps']) {
    assert.match(component, new RegExp(label, 'i'))
  }
  assert.match(main, /showLegacyApp \? <App \/> : <Phase1Experience fixtureMode=\{fixtureMode\} \/>/)
  assert.match(main, /import\.meta\.env\.DEV.*fixture/)
})

test('intake stays minimal and accepts the required evidence formats', () => {
  assert.match(component, /Property address/)
  assert.match(component, /Inspection report/)
  assert.match(component, /Photos or video/)
  assert.match(component, /Repair question/)
  assert.match(component, /accept="\.pdf,\.doc,\.docx,\.txt,image\/\*,video\/\*"/)
  for (const disallowed of ['Phone number', 'Urgency', 'Occupancy', 'Desired timeline']) {
    assert.doesNotMatch(component, new RegExp(disallowed, 'i'))
  }
})

test('finding UI renders adapter fields without embedding fixture findings', () => {
  for (const required of [
    'Development fixture',
    'Observation',
    'What we know',
    'What we do not know',
    'Recommended next step',
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
  assert.match(component, /Request structured reasoning output/)
  assert.match(component, /Map returned findings and sources/)
  assert.match(component, /Reasoning output is not available/)
  assert.doesNotMatch(component, /setTimeout|activeTask|PROCESSING_TASKS/)
})

test('layout is mobile-first with stable controls and a single primary action class', () => {
  assert.match(css, /@media \(max-width: 640px\)/)
  assert.match(css, /\.phase1-primary[\s\S]*?min-height: 50px/)
  assert.match(css, /\.phase1-actions[\s\S]*?position: fixed/)
  assert.match(css, /border-radius: 7px/)
  assert.doesNotMatch(css, /gradient\(/)
})
