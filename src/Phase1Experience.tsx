import { useMemo, useRef, useState } from 'react'
import type { Phase1ExperienceViewModel, Phase1FindingViewModel } from './phase1ReasoningAdapter'
import { loadPhase1ReasoningArtifact } from './phase1ReasoningAdapter'
import './Phase1Experience.css'

type Step = 'property' | 'evidence' | 'processing' | 'overview' | 'finding' | 'gap' | 'next'
type EvidenceMode = 'inspection' | 'photos' | 'question'
type ProcessingState = 'idle' | 'loading' | 'ready' | 'error'

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
      <div className="phase1-progress-track" aria-hidden="true"><span style={{ width: `${(number / 6) * 100}%` }} /></div>
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
        <input autoComplete="street-address" value={address} onChange={(event) => onAddressChange(event.target.value)} placeholder="Street address" />
      </label>
      <fieldset className="phase1-choice-group">
        <legend>What do you have?</legend>
        {EVIDENCE_MODES.map((item) => (
          <label className={`phase1-choice${mode === item.value ? ' is-selected' : ''}`} key={item.value}>
            <input type="radio" name="evidence-mode" value={item.value} checked={mode === item.value} onChange={() => onModeChange(item.value)} />
            <span><strong>{item.title}</strong><small>{item.copy}</small></span>
          </label>
        ))}
      </fieldset>
      <div className="phase1-actions">
        <button className="phase1-primary" type="button" disabled={!address.trim() || !mode} onClick={onContinue}>Continue</button>
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
        <input type="file" multiple accept=".pdf,.doc,.docx,.txt,image/*,video/*" onChange={(event) => onFiles(Array.from(event.target.files ?? []))} />
        <strong>Choose files</strong>
        <span>PDF, document, photo, or video</span>
      </label>
      {files.length > 0 && <ul className="phase1-file-list" aria-label="Selected evidence">{files.map((file) => <li key={`${file.name}-${file.size}`}>{file.name}</li>)}</ul>}
      <label className="phase1-field">
        <span>{mode === 'question' ? 'Repair question' : 'Optional note'}</span>
        <textarea rows={4} value={note} onChange={(event) => onNote(event.target.value)} placeholder="What should the review pay attention to?" />
      </label>
      <div className="phase1-actions">
        <button className="phase1-primary" type="button" disabled={!canContinue} onClick={onContinue}>Organize evidence</button>
      </div>
    </main>
  )
}

function ProcessingStep({ state, error, onContinue, onBack }: {
  state: ProcessingState
  error: string
  onContinue: () => void
  onBack: () => void
}) {
  const ready = state === 'ready'
  const failed = state === 'error'
  return (
    <main className="phase1-main phase1-processing" aria-live="polite">
      <p className="phase1-kicker">Preparing the review</p>
      <h1>{ready ? 'The review is ready' : failed ? 'Reasoning output is not available' : 'Waiting for structured findings'}</h1>
      <p className="phase1-lede">{failed ? error : ready ? 'The returned findings are organized for review.' : 'Requesting the Phase 1 reasoning artifact.'}</p>
      <ol className="phase1-task-list">
        <li className={state === 'loading' ? 'is-active' : ready ? 'is-done' : ''}><span aria-hidden="true" />Request structured reasoning output</li>
        <li className={ready ? 'is-done' : ''}><span aria-hidden="true" />Map returned findings and sources</li>
        <li className={ready ? 'is-done' : ''}><span aria-hidden="true" />Prepare the review</li>
      </ol>
      {(ready || failed) && <div className="phase1-actions"><button className="phase1-primary" type="button" onClick={ready ? onContinue : onBack}>{ready ? 'Review findings' : 'Return to evidence'}</button></div>}
    </main>
  )
}

function OverviewStep({ artifact, onContinue }: { artifact: Phase1ExperienceViewModel; onContinue: () => void }) {
  return (
    <main className="phase1-main">
      {artifact.isFixture && <p className="phase1-kicker">Development fixture</p>}
      <h1>Inspection overview</h1>
      <p className="phase1-lede">Findings are grouped from the returned reasoning artifact.</p>
      <div className="phase1-stat-row" aria-label="Inspection summary">
        <div><strong>{artifact.findings.length}</strong><span>Findings</span></div>
        <div><strong>{artifact.openQuestionCount}</strong><span>Need evidence</span></div>
        <div><strong>{artifact.categories.length}</strong><span>Systems</span></div>
      </div>
      <section className="phase1-band" aria-labelledby="priority-findings">
        <h2 id="priority-findings">Findings</h2>
        {artifact.findings.map((finding) => (
          <div className="phase1-finding-row" key={finding.id}>
            <div><strong>{finding.title}</strong><span>{finding.category} · {finding.reviewStatusLabel}</span></div>
            <div className={`phase1-price-summary${finding.price.status === 'blocked' ? ' is-blocked' : ''}`}><strong>{finding.price.label}</strong><span>{finding.price.geography}</span></div>
          </div>
        ))}
      </section>
      <div className="phase1-actions"><button className="phase1-primary" type="button" onClick={onContinue}>Review first finding</button></div>
    </main>
  )
}

function TextList({ values, empty }: { values: string[]; empty: string }) {
  if (!values.length) return <p>{empty}</p>
  return <ul className="phase1-detail-list">{values.map((value) => <li key={value}>{value}</li>)}</ul>
}

function FindingStep({ finding, isFixture, onContinue }: {
  finding: Phase1FindingViewModel
  isFixture: boolean
  onContinue: () => void
}) {
  return (
    <main className="phase1-main">
      <p className="phase1-kicker">{finding.category}{isFixture ? ' · Development fixture' : ''}</p>
      <h1>{finding.title}</h1>
      <div className="phase1-status-line"><span className="phase1-status">{finding.reviewStatusLabel}</span>{finding.observedAt && <span>Observed {finding.observedAt}</span>}</div>
      <section className="phase1-price-band" aria-label="Localized repair cost context">
        <div><span>Repair range · {finding.price.stage}</span><strong>{finding.price.label}</strong></div>
        <p>{finding.price.geography}. {finding.price.basis}</p>
      </section>
      <section className="phase1-observation"><h2>Observation</h2><p>{finding.observation}</p></section>
      <section className="phase1-two-column">
        <div><h2>What we know</h2><TextList values={finding.known} empty="No confirmed facts were returned." /></div>
        <div><h2>What we do not know</h2><TextList values={finding.unknown} empty="No unresolved unknowns were returned." /></div>
      </section>
      <section className="phase1-next-move">
        <p className="phase1-kicker">Recommended next step · {finding.nextStepOwner}</p>
        <h2>{finding.nextStep}</h2>
        <p>{finding.whyNextStep}</p>
      </section>
      {finding.contractorQuote && (
        <section className="phase1-contractor-input">
          <div><span>Contractor input</span><strong>{finding.contractorQuote.label}</strong></div>
          <p>Retained as source material with status {finding.contractorQuote.reviewStatus}. It is separate from Shelter Prep's range and does not verify this finding.</p>
        </section>
      )}
      <div className="phase1-disclosures">
        <details><summary>Evidence</summary><TextList values={finding.evidenceReferences} empty="No evidence references were returned." /></details>
        <details>
          <summary>Sources</summary>
          {finding.sources.length ? (
            <ul className="phase1-source-list">
              {finding.sources.map((source) => (
                <li key={source.id}>
                  {source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.label}</a> : <strong>{source.label}</strong>}
                  {source.reference && !source.url && <span>{source.reference}</span>}
                </li>
              ))}
            </ul>
          ) : <p>No linked source records were returned.</p>}
        </details>
        <details><summary>Price basis</summary><p>{finding.price.basis}</p><p><strong>Geography:</strong> {finding.price.geography}</p></details>
        {finding.weather && <details><summary>Weather and environment</summary><p>{finding.weather.text}</p>{finding.weather.status === 'unavailable' && <p className="phase1-quiet-state">Sourced context unavailable.</p>}</details>}
        {finding.rangeHistory.length > 0 && (
          <details>
            <summary>Range history</summary>
            {finding.rangeHistory.map((revision) => (
              <div className="phase1-history-entry" key={revision.id}>
                <p><strong>{revision.movement}:</strong> {revision.priorLabel ? `${revision.priorLabel} → ` : ''}{revision.currentLabel}</p>
                <p>{revision.explanation}</p>
              </div>
            ))}
          </details>
        )}
        {finding.relatedFindings.length > 0 && <details><summary>Related findings</summary><TextList values={finding.relatedFindings} empty="No related findings were returned." /></details>}
      </div>
      <div className="phase1-actions"><button className="phase1-primary" type="button" onClick={onContinue}>{finding.missingInformation.length ? 'Add requested evidence' : 'Continue'}</button></div>
    </main>
  )
}

function GapStep({ finding, onEvidence, onSkip }: {
  finding: Phase1FindingViewModel
  onEvidence: (file: File) => void
  onSkip: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const question = finding.missingInformation[0] || finding.nextStep
  return (
    <main className="phase1-main phase1-gap">
      <p className="phase1-kicker">One useful question</p>
      <h1>{question}</h1>
      <p className="phase1-lede">{finding.whyNextStep}</p>
      <input ref={inputRef} className="phase1-hidden-input" type="file" accept="image/*" onChange={(event) => {
        const file = event.target.files?.[0]
        if (file) onEvidence(file)
      }} />
      <div className="phase1-actions">
        <button className="phase1-primary" type="button" onClick={() => inputRef.current?.click()}>Add requested photo</button>
        <button className="phase1-text-action" type="button" onClick={onSkip}>Ask {finding.nextStepOwner}</button>
        <button className="phase1-text-action" type="button" onClick={onSkip}>Skip for now</button>
      </div>
    </main>
  )
}

function NextStep({ address, evidenceCount, artifact, finding, onContinue }: {
  address: string
  evidenceCount: number
  artifact: Phase1ExperienceViewModel
  finding: Phase1FindingViewModel
  onContinue: () => void
}) {
  return (
    <main className="phase1-main">
      <p className="phase1-kicker">Property</p>
      <h1>{artifact.propertyAddress || address}</h1>
      <p className="phase1-lede">The returned findings still need human review before they become verified.</p>
      <div className="phase1-stat-row" aria-label="Property review summary">
        <div><strong>{evidenceCount}</strong><span>Evidence items</span></div>
        <div><strong>{artifact.findings.length}</strong><span>Findings</span></div>
        <div><strong>{artifact.openQuestionCount}</strong><span>Open questions</span></div>
      </div>
      <section className="phase1-next-move">
        <p className="phase1-kicker">Next move · {finding.nextStepOwner}</p>
        <h2>{finding.nextStep}</h2>
        <p>{finding.whyNextStep}</p>
      </section>
      <div className="phase1-actions"><button className="phase1-primary" type="button" onClick={onContinue}>Continue review</button></div>
    </main>
  )
}

export default function Phase1Experience({ fixtureMode = false }: { fixtureMode?: boolean }) {
  const [step, setStep] = useState<Step>('property')
  const [address, setAddress] = useState('')
  const [mode, setMode] = useState<EvidenceMode | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [note, setNote] = useState('')
  const [processingState, setProcessingState] = useState<ProcessingState>('idle')
  const [processingError, setProcessingError] = useState('')
  const [artifact, setArtifact] = useState<Phase1ExperienceViewModel | null>(null)
  const [findingIndex, setFindingIndex] = useState(0)
  const evidenceCount = useMemo(() => files.length + (note.trim() ? 1 : 0), [files, note])
  const finding = artifact?.findings[findingIndex] ?? null

  async function organizeEvidence() {
    setStep('processing')
    setProcessingState('loading')
    setProcessingError('')
    try {
      const result = await loadPhase1ReasoningArtifact({
        mode: fixtureMode ? 'fixture' : 'live',
        artifactUrl: import.meta.env.VITE_PHASE1_REASONING_ARTIFACT_URL,
      })
      setArtifact(result)
      setFindingIndex(0)
      setProcessingState('ready')
    } catch (error) {
      setArtifact(null)
      setProcessingState('error')
      setProcessingError(error instanceof Error ? error.message : 'Structured reasoning output could not be loaded. Selected evidence remains local to this browser.')
    }
  }

  function continueReview() {
    if (!artifact) return
    if (findingIndex + 1 < artifact.findings.length) {
      setFindingIndex((current) => current + 1)
      setStep('finding')
    } else {
      setFindingIndex(0)
      setStep('overview')
    }
  }

  return (
    <div className="phase1-shell">
      <PhaseHeader step={step} />
      {step === 'property' && <PropertyStep address={address} mode={mode} onAddressChange={setAddress} onModeChange={setMode} onContinue={() => setStep('evidence')} />}
      {step === 'evidence' && mode && <EvidenceStep mode={mode} files={files} note={note} onFiles={setFiles} onNote={setNote} onContinue={() => void organizeEvidence()} />}
      {step === 'processing' && <ProcessingStep state={processingState} error={processingError} onContinue={() => setStep('overview')} onBack={() => setStep('evidence')} />}
      {step === 'overview' && artifact && <OverviewStep artifact={artifact} onContinue={() => { setFindingIndex(0); setStep('finding') }} />}
      {step === 'finding' && artifact && finding && <FindingStep finding={finding} isFixture={artifact.isFixture} onContinue={() => setStep(finding.missingInformation.length ? 'gap' : 'next')} />}
      {step === 'gap' && finding && <GapStep finding={finding} onEvidence={(file) => { setFiles((current) => [...current, file]); setStep('next') }} onSkip={() => setStep('next')} />}
      {step === 'next' && artifact && finding && <NextStep address={address} evidenceCount={evidenceCount} artifact={artifact} finding={finding} onContinue={continueReview} />}
    </div>
  )
}
