import { useEffect, useMemo, useRef, useState } from 'react'
import './Phase1Experience.css'

type Step = 'property' | 'evidence' | 'processing' | 'overview' | 'finding' | 'gap' | 'next'
type EvidenceMode = 'inspection' | 'photos' | 'question'

const STEP_LABELS: Record<Step, string> = {
  property: 'Property',
  evidence: 'Add evidence',
  processing: 'Processing',
  overview: 'Review findings',
  finding: 'Review findings',
  gap: 'Close gaps',
  next: 'Next steps',
}

const STEP_NUMBERS: Record<Step, number> = {
  property: 1,
  evidence: 2,
  processing: 3,
  overview: 4,
  finding: 4,
  gap: 5,
  next: 6,
}

const PROCESSING_TASKS = [
  'Reading the evidence',
  'Separating observations from interpretation',
  'Checking relevant context',
  'Preparing next steps',
]

const EVIDENCE_MODES: Array<{ value: EvidenceMode; title: string; copy: string }> = [
  { value: 'inspection', title: 'Inspection report', copy: 'PDF, document, or scan' },
  { value: 'photos', title: 'Photos or video', copy: 'Images from the property' },
  { value: 'question', title: 'Repair question', copy: 'A note or focused concern' },
]

function PhaseHeader({ step }: { step: Step }) {
  const number = STEP_NUMBERS[step]

  return (
    <header className="phase1-header">
      <div className="phase1-brand">Shelter Prep</div>
      <div className="phase1-progress" aria-label={`Step ${number} of 6: ${STEP_LABELS[step]}`}>
        <span>Step {number} of 6</span>
        <strong>{STEP_LABELS[step]}</strong>
      </div>
      <div className="phase1-progress-track" aria-hidden="true">
        <span style={{ width: `${(number / 6) * 100}%` }} />
      </div>
    </header>
  )
}

function PropertyStep({
  address,
  mode,
  onAddressChange,
  onModeChange,
  onContinue,
}: {
  address: string
  mode: EvidenceMode | null
  onAddressChange: (value: string) => void
  onModeChange: (value: EvidenceMode) => void
  onContinue: () => void
}) {
  return (
    <main className="phase1-main">
      <p className="phase1-kicker">Start with the property</p>
      <h1>What are we looking at?</h1>
      <p className="phase1-lede">Add the address and the kind of evidence you have today.</p>

      <label className="phase1-field">
        <span>Property address</span>
        <input
          autoComplete="street-address"
          value={address}
          onChange={(event) => onAddressChange(event.target.value)}
          placeholder="Street address"
        />
      </label>

      <fieldset className="phase1-choice-group">
        <legend>What do you have?</legend>
        {EVIDENCE_MODES.map((item) => (
          <label className={`phase1-choice${mode === item.value ? ' is-selected' : ''}`} key={item.value}>
            <input
              type="radio"
              name="evidence-mode"
              value={item.value}
              checked={mode === item.value}
              onChange={() => onModeChange(item.value)}
            />
            <span>
              <strong>{item.title}</strong>
              <small>{item.copy}</small>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="phase1-actions">
        <button className="phase1-primary" type="button" disabled={!address.trim() || !mode} onClick={onContinue}>
          Continue
        </button>
      </div>
    </main>
  )
}

function EvidenceStep({
  mode,
  files,
  note,
  onFiles,
  onNote,
  onContinue,
}: {
  mode: EvidenceMode
  files: File[]
  note: string
  onFiles: (files: File[]) => void
  onNote: (value: string) => void
  onContinue: () => void
}) {
  const canContinue = files.length > 0 || note.trim().length > 0

  return (
    <main className="phase1-main">
      <p className="phase1-kicker">Add what you have</p>
      <h1>{mode === 'question' ? 'Describe the repair question' : 'Choose evidence to review'}</h1>
      <p className="phase1-lede">One report, a few photos, or a short note is enough to begin.</p>

      <label className="phase1-upload">
        <input
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.txt,image/*,video/*"
          onChange={(event) => onFiles(Array.from(event.target.files ?? []))}
        />
        <strong>Choose files</strong>
        <span>PDF, document, photo, or video</span>
      </label>

      {files.length > 0 && (
        <ul className="phase1-file-list" aria-label="Selected evidence">
          {files.map((file) => <li key={`${file.name}-${file.size}`}>{file.name}</li>)}
        </ul>
      )}

      <label className="phase1-field">
        <span>{mode === 'question' ? 'Repair question' : 'Optional note'}</span>
        <textarea
          rows={4}
          value={note}
          onChange={(event) => onNote(event.target.value)}
          placeholder="What should the review pay attention to?"
        />
      </label>

      <div className="phase1-actions">
        <button className="phase1-primary" type="button" disabled={!canContinue} onClick={onContinue}>
          Organize evidence
        </button>
      </div>
    </main>
  )
}

function ProcessingStep({ complete, activeTask, onContinue }: { complete: boolean; activeTask: number; onContinue: () => void }) {
  return (
    <main className="phase1-main phase1-processing" aria-live="polite">
      <p className="phase1-kicker">Preparing the review</p>
      <h1>{complete ? 'The review is ready' : 'Organizing the evidence'}</h1>
      <p className="phase1-lede">This development fixture stays local and does not create a verified record.</p>

      <ol className="phase1-task-list">
        {PROCESSING_TASKS.map((task, index) => {
          const state = index < activeTask || complete ? 'is-done' : index === activeTask ? 'is-active' : ''
          return <li className={state} key={task}><span aria-hidden="true" />{task}</li>
        })}
      </ol>

      {complete && (
        <div className="phase1-actions">
          <button className="phase1-primary" type="button" onClick={onContinue}>Review findings</button>
        </div>
      )}
    </main>
  )
}

function OverviewStep({ onContinue }: { onContinue: () => void }) {
  return (
    <main className="phase1-main">
      <p className="phase1-kicker">Development fixture</p>
      <h1>Inspection overview</h1>
      <p className="phase1-lede">Eight repair items are grouped by building system. Two need more evidence first.</p>

      <div className="phase1-stat-row" aria-label="Inspection summary">
        <div><strong>8</strong><span>Findings</span></div>
        <div><strong>2</strong><span>Need evidence</span></div>
        <div><strong>3</strong><span>Repair bundles</span></div>
      </div>

      <section className="phase1-band" aria-labelledby="priority-findings">
        <h2 id="priority-findings">Priority findings</h2>
        <div className="phase1-finding-row">
          <div><strong>Ceiling water staining</strong><span>Roof and interior moisture</span></div>
          <div className="phase1-price-summary"><strong>$900–$3,000</strong><span>City-level fixture</span></div>
        </div>
        <div className="phase1-finding-row">
          <div><strong>Crawlspace moisture</strong><span>Foundation and drainage</span></div>
          <div className="phase1-price-summary is-blocked"><strong>Not yet sourced</strong><span>Price blocked</span></div>
        </div>
      </section>

      <div className="phase1-actions">
        <button className="phase1-primary" type="button" onClick={onContinue}>Review first finding</button>
      </div>
    </main>
  )
}

function FindingStep({ onContinue }: { onContinue: () => void }) {
  return (
    <main className="phase1-main">
      <p className="phase1-kicker">Roof and interior moisture · Development fixture</p>
      <h1>Ceiling water staining</h1>
      <div className="phase1-status-line">
        <span className="phase1-status">Needs Human Review</span>
        <span>Observed May 14, 2026</span>
      </div>

      <section className="phase1-price-band" aria-label="Localized repair cost context">
        <div>
          <span>Evidence-informed fixture range</span>
          <strong>$900–$3,000</strong>
        </div>
        <p>City-level example pricing. This is not a contractor bid or a ZIP-specific claim.</p>
      </section>

      <section className="phase1-two-column">
        <div>
          <h2>What we know</h2>
          <p>Brown staining was visible at the upstairs hallway ceiling below the roof plane.</p>
        </div>
        <div>
          <h2>What we do not know</h2>
          <p>The evidence does not show whether the material is currently wet or where water entered.</p>
        </div>
      </section>

      <section className="phase1-next-move">
        <p className="phase1-kicker">Recommended next step</p>
        <h2>Photograph the attic side and take a moisture reading.</h2>
        <p>This checks active moisture and helps locate a path before repair scope or price is narrowed.</p>
      </section>

      <section className="phase1-context-strip">
        <h2>Relevant weather context</h2>
        <p>The fixture records 1.4 inches of rain in the 48 hours before the inspection. Timing makes recent rain relevant, but it does not establish the cause of the staining.</p>
      </section>

      <section className="phase1-contractor-input">
        <div><span>Contractor input</span><strong>$1,475</strong></div>
        <p>Point quote retained as source material. It is not contractor verification of this finding.</p>
      </section>

      <div className="phase1-disclosures">
        <details>
          <summary>Evidence</summary>
          <p>Inspection page 18, hallway ceiling photo, observed May 14, 2026.</p>
        </details>
        <details>
          <summary>Sources and price basis</summary>
          <p>Fixture city benchmark, retrieved May 16, 2026; inspection observation; fixture historical-weather record. All claims remain Needs Human Review.</p>
        </details>
        <details>
          <summary>Range history</summary>
          <p><strong>Initial:</strong> $500–$5,000 with stain location only.</p>
          <p><strong>Current:</strong> $900–$3,000 after roof-plane location and access assumptions were added. Active moisture and entry point remain unresolved.</p>
        </details>
      </div>

      <div className="phase1-actions">
        <button className="phase1-primary" type="button" onClick={onContinue}>Add requested evidence</button>
      </div>
    </main>
  )
}

function GapStep({ onEvidence, onSkip }: { onEvidence: (file: File) => void; onSkip: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <main className="phase1-main phase1-gap">
      <p className="phase1-kicker">One useful question</p>
      <h1>Can you get a photo from the attic side of this stain?</h1>
      <p className="phase1-lede">A close photo plus a moisture-meter reading would reduce uncertainty faster than another broad review.</p>

      <input
        ref={inputRef}
        className="phase1-hidden-input"
        type="file"
        accept="image/*"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onEvidence(file)
        }}
      />

      <div className="phase1-actions">
        <button className="phase1-primary" type="button" onClick={() => inputRef.current?.click()}>Add attic photo</button>
        <button className="phase1-text-action" type="button" onClick={onSkip}>Ask the contractor</button>
        <button className="phase1-text-action" type="button" onClick={onSkip}>Skip for now</button>
      </div>
    </main>
  )
}

function NextStep({ address, evidenceCount, onContinue }: { address: string; evidenceCount: number; onContinue: () => void }) {
  return (
    <main className="phase1-main">
      <p className="phase1-kicker">Property</p>
      <h1>{address}</h1>
      <p className="phase1-lede">The evidence is organized. Findings still need human review before they become verified.</p>

      <div className="phase1-stat-row" aria-label="Property review summary">
        <div><strong>{evidenceCount}</strong><span>Evidence items</span></div>
        <div><strong>8</strong><span>Findings</span></div>
        <div><strong>2</strong><span>Open questions</span></div>
      </div>

      <section className="phase1-next-move">
        <p className="phase1-kicker">Next move</p>
        <h2>Collect the attic photo, then review the moisture bundle.</h2>
        <p>The remaining findings can stay in draft while that targeted evidence is gathered.</p>
      </section>

      <div className="phase1-actions">
        <button className="phase1-primary" type="button" onClick={onContinue}>Continue review</button>
      </div>
    </main>
  )
}

export default function Phase1Experience() {
  const [step, setStep] = useState<Step>('property')
  const [address, setAddress] = useState('')
  const [mode, setMode] = useState<EvidenceMode | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [note, setNote] = useState('')
  const [activeTask, setActiveTask] = useState(0)
  const complete = activeTask >= PROCESSING_TASKS.length
  const evidenceCount = useMemo(() => files.length + (note.trim() ? 1 : 0), [files, note])

  useEffect(() => {
    if (step !== 'processing' || complete) return
    const timeout = window.setTimeout(() => setActiveTask((current) => current + 1), 550)
    return () => window.clearTimeout(timeout)
  }, [step, activeTask, complete])

  return (
    <div className="phase1-shell">
      <PhaseHeader step={step} />
      {step === 'property' && (
        <PropertyStep address={address} mode={mode} onAddressChange={setAddress} onModeChange={setMode} onContinue={() => setStep('evidence')} />
      )}
      {step === 'evidence' && mode && (
        <EvidenceStep mode={mode} files={files} note={note} onFiles={setFiles} onNote={setNote} onContinue={() => setStep('processing')} />
      )}
      {step === 'processing' && <ProcessingStep complete={complete} activeTask={activeTask} onContinue={() => setStep('overview')} />}
      {step === 'overview' && <OverviewStep onContinue={() => setStep('finding')} />}
      {step === 'finding' && <FindingStep onContinue={() => setStep('gap')} />}
      {step === 'gap' && (
        <GapStep
          onEvidence={(file) => { setFiles((current) => [...current, file]); setStep('next') }}
          onSkip={() => setStep('next')}
        />
      )}
      {step === 'next' && <NextStep address={address} evidenceCount={evidenceCount} onContinue={() => setStep('finding')} />}
    </div>
  )
}
