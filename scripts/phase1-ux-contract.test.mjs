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
  assert.match(main, /showLegacyApp \? <App \/> : <Phase1Experience \/>/)
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

test('moisture finding preserves epistemic, pricing, weather, and review boundaries', () => {
  for (const required of [
    'Development fixture',
    'What we know',
    'What we do not know',
    'Recommended next step',
    'Relevant weather context',
    'does not establish the cause',
    'City-level example pricing',
    'not a contractor bid or a ZIP-specific claim',
    'Contractor input',
    'not contractor verification',
    'Needs Human Review',
    'Not yet sourced',
    'Range history',
  ]) {
    assert.match(component, new RegExp(required, 'i'))
  }
  assert.doesNotMatch(component, /human_verified|contractor_verified/)
})

test('secondary evidence, sources, and range history use collapsed disclosure controls', () => {
  const details = component.match(/<details>/g) ?? []
  assert.equal(details.length, 3)
  assert.doesNotMatch(component, /<details\s+open/)
})

test('layout is mobile-first with stable controls and a single primary action class', () => {
  assert.match(css, /@media \(max-width: 640px\)/)
  assert.match(css, /\.phase1-primary[\s\S]*?min-height: 50px/)
  assert.match(css, /\.phase1-actions[\s\S]*?position: fixed/)
  assert.match(css, /border-radius: 7px/)
  assert.doesNotMatch(css, /gradient\(/)
})
