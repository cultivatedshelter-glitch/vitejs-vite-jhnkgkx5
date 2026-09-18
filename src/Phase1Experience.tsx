import { useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { Phase1ExperienceViewModel, Phase1FindingViewModel } from './phase1ReasoningAdapter'
import { adaptPhase1ReasoningArtifact, loadPhase1ReasoningArtifact } from './phase1ReasoningAdapter'
import { loadPhase1ProcessingRequest, processPhase1Evidence, resolvePhase1Property, type LiveProcessingState } from './phase1ProcessingClient'
import { clearPhase1PropertyContext, propertyContextBelongsToUser, propertyContextMatchesAddress, readPhase1PropertyContext, writePhase1PropertyContext, type Phase1PropertyContext } from './phase1PropertyContext'
import { supabase } from './supabase'
import './Phase1Experience.css'

type Step = 'property' | 'evidence' | 'processing' | 'overview' | 'finding' | 'gap' | 'next'
type ProcessingState = 'idle' | LiveProcessingState

const PROGRESS_STAGES = ['Property', 'Evidence', 'Review']

function progressStage(step: Step) {
  if (step === 'property') return 0
  if (step === 'evidence') return 1
  return 2
}

function reviewRequestFromLocation() {
  const match = window.location.pathname.match(/^\/properties\/[^/]+\/review\/?$/)
  return match ? new URLSearchParams(window.location.search).get('request') : null
}

function PhaseHeader({ step, email, onSignOut }: { step: Step; email?: string; onSignOut?: () => void }) {
  const activeStage = progressStage(step)
  return (
    <header className="phase1-header">
      <div className="phase1-brand"><strong>SHELTER PREP</strong><span>Repair clarity. Higher value.</span></div>
      <div className="phase1-header-actions">
        <div className="phase1-progress" aria-label={`${PROGRESS_STAGES[activeStage]} stage, ${activeStage + 1} of 3`}>
          {PROGRESS_STAGES.map((label, index) => (
            <span className={index === activeStage ? 'is-current' : index < activeStage ? 'is-complete' : ''} key={label}>{label}</span>
          ))}
        </div>
        {email && onSignOut && <div className="phase1-session"><span>{email}</span><button type="button" onClick={onSignOut}>Sign out</button></div>}
      </div>
    </header>
  )
}

function SignInStep({ onSignedIn }: { onSignedIn: (session: Session) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function signIn() {
    setSubmitting(true)
    setError('')
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (signInError || !data.session) setError(signInError?.message || 'Sign in did not return an authenticated session.')
    else onSignedIn(data.session)
    setSubmitting(false)
  }

  return (
    <div className="phase1-shell">
      <header className="phase1-header"><div className="phase1-brand"><strong>SHELTER PREP</strong><span>Repair clarity. Higher value.</span></div></header>
      <main className="phase1-main phase1-sign-in">
        <p className="phase1-kicker">Pilot access</p>
        <h1>Sign in to continue.</h1>
        <p className="phase1-lede">Use your Phase 1 pilot identity.</p>
        <form onSubmit={(event) => { event.preventDefault(); void signIn() }}>
          <label className="phase1-field"><span>Email</span><input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label className="phase1-field"><span>Password</span><input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          {error && <p className="phase1-inline-error" role="alert">{error}</p>}
          <div className="phase1-actions"><button className="phase1-primary" type="submit" disabled={!email.trim() || !password || submitting}>{submitting ? 'Signing in…' : 'Sign in'}</button></div>
        </form>
      </main>
    </div>
  )
}

function PropertyStep({
  address,
  resolving,
  error,
  onAddressChange,
  onContinue,
}: {
  address: string
  resolving: boolean
  error: string
  onAddressChange: (value: string) => void
  onContinue: () => void
}) {
  return (
    <main className="phase1-main phase1-property">
      <p className="phase1-kicker">Let's get started</p>
      <h1>Add the property address.</h1>
      <p className="phase1-lede">You can add more details later.</p>
      <label className="phase1-field phase1-address-field">
        <span>Property address</span>
        <input autoFocus autoComplete="street-address" value={address} onChange={(event) => onAddressChange(event.target.value)} placeholder="1234 Main Street, Portland, OR" />
      </label>
      {error && <p className="phase1-inline-error" role="alert">{error}</p>}
      <div className="phase1-actions">
        <button className="phase1-primary" type="button" disabled={!address.trim() || resolving} onClick={onContinue}>{resolving ? 'Creating property workspace…' : <>Continue <span aria-hidden="true">→</span></>}</button>
      </div>
    </main>
  )
}

function EvidenceStep({
  files,
  note,
  onFiles,
  onNote,
  onContinue,
}: {
  files: File[]
  note: string
  onFiles: (files: File[]) => void
  onNote: (value: string) => void
  onContinue: () => void
}) {
  const inspectionRef = useRef<HTMLInputElement>(null)
  const mediaRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const noteRef = useRef<HTMLTextAreaElement>(null)
  const canContinue = files.length > 0 || note.trim().length > 0
  return (
    <main className="phase1-main phase1-evidence">
      <p className="phase1-kicker">Evidence</p>
      <h1>What do you have?</h1>
      <p className="phase1-lede">Add whatever you've got. We'll organize it.</p>
      <input ref={inspectionRef} className="phase1-hidden-input" type="file" accept=".pdf,.doc,.docx,.txt" onChange={(event) => onFiles(Array.from(event.target.files ?? []))} />
      <input ref={mediaRef} className="phase1-hidden-input" type="file" multiple accept="image/*,video/*" onChange={(event) => onFiles(Array.from(event.target.files ?? []))} />
      <input ref={cameraRef} className="phase1-hidden-input" type="file" accept="image/*" capture="environment" onChange={(event) => onFiles(Array.from(event.target.files ?? []))} />
      <div className="phase1-evidence-grid" aria-label="Evidence options">
        <button className="phase1-evidence-option" type="button" onClick={() => inspectionRef.current?.click()}><span className="phase1-option-icon" aria-hidden="true">PDF</span><strong>Upload inspection</strong><small>PDF, document, or scan</small></button>
        <button className="phase1-evidence-option" type="button" onClick={() => mediaRef.current?.click()}><span className="phase1-option-icon" aria-hidden="true">+</span><strong>Add photos / video</strong><small>Images from the property</small></button>
        <button className="phase1-evidence-option" type="button" onClick={() => noteRef.current?.focus()}><span className="phase1-option-icon" aria-hidden="true">?</span><strong>Type a note or question</strong><small>Describe the repair concern</small></button>
        <button className="phase1-evidence-option" type="button" onClick={() => cameraRef.current?.click()}><span className="phase1-option-icon phase1-camera-icon" aria-hidden="true" /><strong>Take a photo</strong><small>Use your camera</small></button>
      </div>
      {files.length > 0 && <ul className="phase1-file-list" aria-label="Selected evidence">{files.map((file) => <li key={`${file.name}-${file.size}`}>{file.name}</li>)}</ul>}
      <label className="phase1-field">
        <span>Anything specific we should know? <small>Optional</small></span>
        <textarea ref={noteRef} rows={3} value={note} onChange={(event) => onNote(event.target.value)} placeholder="Add a note or repair question" />
      </label>
      <p className="phase1-privacy"><span aria-hidden="true">✓</span> Your files are secure and private.</p>
      <div className="phase1-actions">
        <button className="phase1-primary" type="button" disabled={!canContinue} onClick={onContinue}>Continue <span aria-hidden="true">→</span></button>
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
  const ready = state === 'completed'
  const failed = state === 'failed'
  const statusCopy: Record<ProcessingState, string> = {
    idle: 'Uploading your evidence securely.',
    uploaded: 'Your evidence is uploaded.',
    queued: 'Your review is ready to begin.',
    processing: 'Reviewing and organizing the evidence.',
    completed: 'Your repair summary is ready.',
    failed: error,
  }
  const activeIndex = state === 'idle' ? 0 : ['uploaded', 'queued', 'processing'].includes(state) ? 1 : ready ? 5 : -1
  const tasks = ['Uploading files', 'Reading inspection report', 'Finding and grouping issues', 'Checking relevant context', 'Building your summary']
  return (
    <main className="phase1-main phase1-processing" aria-live="polite">
      <p className="phase1-kicker">Review</p>
      <h1>{ready ? 'Everything is organized.' : failed ? "We couldn't finish the review." : "We're organizing everything."}</h1>
      <p className="phase1-lede">{failed ? statusCopy[state] : ready ? statusCopy[state] : 'This usually takes a short moment.'}</p>
      <ol className="phase1-task-list">
        {tasks.map((task, index) => <li className={index < activeIndex ? 'is-done' : index === activeIndex ? 'is-active' : ''} key={task}><span aria-hidden="true">{index < activeIndex ? '✓' : ''}</span>{task}</li>)}
      </ol>
      {!failed && !ready && <p className="phase1-processing-status">{statusCopy[state]}</p>}
      {(ready || failed) && <div className="phase1-actions"><button className="phase1-primary" type="button" onClick={ready ? onContinue : onBack}>{ready ? <>Review findings <span aria-hidden="true">→</span></> : 'Return to evidence'}</button></div>}
    </main>
  )
}

function OverviewStep({ artifact, onSelect }: { artifact: Phase1ExperienceViewModel; onSelect: (index: number) => void }) {
  const readyCount = Math.max(artifact.findings.length - artifact.openQuestionCount, 0)
  return (
    <main className="phase1-main phase1-overview">
      {artifact.isFixture && <p className="phase1-kicker">Development fixture</p>}
      <h1>We found {artifact.findings.length} repair {artifact.findings.length === 1 ? 'item' : 'items'}.</h1>
      <p className="phase1-lede">Here's what needs attention and what to do next.</p>
      <div className="phase1-stat-row" aria-label="Inspection summary">
        <div className="is-attention"><span>Need attention</span><strong>{artifact.findings.length}</strong></div>
        <div className="is-info"><span>Need more info</span><strong>{artifact.openQuestionCount}</strong></div>
        <div className="is-ready"><span>Ready to review</span><strong>{readyCount}</strong></div>
      </div>
      <section className="phase1-band" aria-labelledby="priority-findings">
        <div className="phase1-section-heading"><h2 id="priority-findings">Repair items</h2><span>{artifact.categories.length} systems</span></div>
        {artifact.findings.map((finding, index) => (
          <button className="phase1-finding-row" type="button" onClick={() => onSelect(index)} key={finding.id}>
            <span className="phase1-finding-thumb" aria-hidden="true">{finding.category.charAt(0)}</span>
            <span className="phase1-finding-copy"><strong>{finding.title}</strong><small>{finding.category} · {finding.reviewStatusLabel}</small><span>{finding.nextStep}</span></span>
            <span className="phase1-chevron" aria-hidden="true">›</span>
          </button>
        ))}
      </section>
      <div className="phase1-actions"><button className="phase1-primary" type="button" onClick={() => onSelect(0)}>Review first finding <span aria-hidden="true">→</span></button></div>
    </main>
  )
}

function TextList({ values, empty }: { values: string[]; empty: string }) {
  if (!values.length) return <p>{empty}</p>
  return <ul className="phase1-detail-list">{values.map((value) => <li key={value}>{value}</li>)}</ul>
}

function FindingStep({ finding, isFixture, onBack, onContinue }: {
  finding: Phase1FindingViewModel
  isFixture: boolean
  onBack: () => void
  onContinue: () => void
}) {
  return (
    <main className="phase1-main phase1-finding-detail">
      <button className="phase1-back" type="button" onClick={onBack}><span aria-hidden="true">←</span> All repair items</button>
      <header className="phase1-finding-header">
        <p className="phase1-kicker">{finding.category}{isFixture ? ' · Development fixture' : ''}</p>
        <h1>{finding.title}</h1>
        <div className="phase1-status-line"><span className="phase1-status">{finding.reviewStatusLabel}</span>{finding.observedAt && <span>Observed {finding.observedAt}</span>}</div>
      </header>
      <div className="phase1-detail-layout">
        <aside className="phase1-detail-aside">
          <section className={`phase1-price-card${finding.price.status === 'blocked' ? ' is-blocked' : ''}`} aria-label="Localized repair cost context">
            <span>Estimated local repair cost</span>
            <strong>{finding.price.label}</strong>
            <div><span>{finding.price.geography}</span><span>{finding.price.stage}</span></div>
            <p>{finding.price.basis}</p>
            <details><summary>View pricing sources</summary><TextList values={finding.price.sourceIds} empty="No pricing sources were returned." /></details>
            {finding.rangeHistory.length > 0 && <div className="phase1-range-note"><span>Range history</span>{finding.rangeHistory.map((revision) => <p key={revision.id}><strong>{revision.movement}</strong>{revision.priorLabel ? ` from ${revision.priorLabel} to ${revision.currentLabel}` : ` at ${revision.currentLabel}`}. {revision.explanation}</p>)}</div>}
          </section>
          <section className="phase1-next-move">
            <p className="phase1-kicker">Next step · {finding.nextStepOwner}</p>
            <h2>{finding.nextStep}</h2>
            <div className="phase1-why"><h3>Why this next step?</h3><p>{finding.whyNextStep}</p></div>
          </section>
          {finding.missingInformation.length > 0 && <section className="phase1-missing"><h2>Missing information</h2><TextList values={finding.missingInformation} empty="No missing information was returned." /></section>}
        </aside>
        <div className="phase1-detail-main">
          <section className="phase1-observation"><h2>Observation</h2><p>{finding.observation}</p></section>
          <section className="phase1-reasoning-section"><h2>What we know</h2><TextList values={finding.known} empty="No confirmed facts were returned." /></section>
          <section className="phase1-reasoning-section"><h2>What we don't know</h2><TextList values={finding.unknown} empty="No unresolved unknowns were returned." /></section>
          {finding.contractorQuote && <section className="phase1-contractor-input"><div><span>Contractor input</span><strong>{finding.contractorQuote.label}</strong></div><p>Retained as source material with status {finding.contractorQuote.reviewStatus}. It is separate from Shelter Prep's range and does not verify this finding.</p></section>}
          <div className="phase1-disclosures">
            <details><summary>Evidence</summary><TextList values={finding.evidenceReferences} empty="No evidence references were returned." /></details>
            <details><summary>Sources</summary>{finding.sources.length ? <ul className="phase1-source-list">{finding.sources.map((source) => <li key={source.id}>{source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.label}</a> : <strong>{source.label}</strong>}{source.reference && !source.url && <span>{source.reference}</span>}</li>)}</ul> : <p>No linked source records were returned.</p>}</details>
            <details><summary>Price basis</summary><p>{finding.price.basis}</p><p><strong>Geography:</strong> {finding.price.geography}</p></details>
            {finding.weather && <details><summary>Weather and environment</summary><p>{finding.weather.text}</p>{finding.weather.status === 'unavailable' && <p className="phase1-quiet-state">Sourced context unavailable.</p>}</details>}
            {finding.relatedFindings.length > 0 && <details><summary>Related findings</summary><TextList values={finding.relatedFindings} empty="No related findings were returned." /></details>}
          </div>
        </div>
      </div>
      <div className="phase1-actions"><button className="phase1-primary" type="button" onClick={onContinue}>{finding.missingInformation.length ? 'Add requested evidence' : 'Continue'} <span aria-hidden="true">→</span></button></div>
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
  const storedProperty = useMemo(() => fixtureMode ? null : readPhase1PropertyContext(window.sessionStorage), [fixtureMode])
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(fixtureMode)
  const [step, setStep] = useState<Step>('property')
  const [address, setAddress] = useState(storedProperty?.address || '')
  const [propertyContext, setPropertyContext] = useState<Phase1PropertyContext | null>(storedProperty)
  const [propertyResolving, setPropertyResolving] = useState(false)
  const [propertyError, setPropertyError] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [note, setNote] = useState('')
  const [processingState, setProcessingState] = useState<ProcessingState>('idle')
  const [processingError, setProcessingError] = useState('')
  const [artifact, setArtifact] = useState<Phase1ExperienceViewModel | null>(null)
  const [findingIndex, setFindingIndex] = useState(0)
  const reviewRequestId = useMemo(() => fixtureMode ? null : reviewRequestFromLocation(), [fixtureMode])
  const reviewLoadStarted = useRef(false)
  const evidenceCount = useMemo(() => files.length + (note.trim() ? 1 : 0), [files, note])
  const finding = artifact?.findings[findingIndex] ?? null

  useEffect(() => {
    if (fixtureMode) return
    let active = true
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setAuthReady(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAuthReady(true)
    })
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [fixtureMode])

  useEffect(() => {
    if (fixtureMode || !authReady) return
    if (!session || (propertyContext && !propertyContextBelongsToUser(propertyContext, session.user.id))) {
      setPropertyContext(null)
      setAddress('')
      setFiles([])
      setNote('')
      setArtifact(null)
      setStep('property')
      clearPhase1PropertyContext(window.sessionStorage)
    }
  }, [authReady, fixtureMode, propertyContext, session])

  useEffect(() => {
    if (fixtureMode || !session || !reviewRequestId || reviewLoadStarted.current) return
    reviewLoadStarted.current = true
    setStep('processing')
    setProcessingState('processing')
    setProcessingError('')
    void loadPhase1ProcessingRequest(reviewRequestId).then((request) => {
      if (request.processingStatus === 'failed') {
        setProcessingState('failed')
        setProcessingError(request.error || 'Processing failed. Review the request before retrying.')
        return
      }
      if (request.processingStatus !== 'completed' || !request.artifact) {
        setProcessingState(request.processingStatus)
        return
      }
      const result = adaptPhase1ReasoningArtifact(request.artifact, { mode: 'live' })
      const reviewAddress = result.propertyAddress || 'Property review'
      const context = { id: request.propertyId, address: reviewAddress, userId: session.user.id }
      setAddress(reviewAddress)
      setPropertyContext(context)
      writePhase1PropertyContext(window.sessionStorage, context)
      setArtifact(result)
      setFindingIndex(0)
      setProcessingState('completed')
      setStep('overview')
    }).catch((error) => {
      setProcessingState('failed')
      setProcessingError(error instanceof Error ? error.message : 'This review request is not available.')
    })
  }, [fixtureMode, reviewRequestId, session])

  function changeAddress(value: string) {
    setAddress(value)
    setPropertyError('')
    if (propertyContext && !propertyContextMatchesAddress(propertyContext, value)) {
      setPropertyContext(null)
      clearPhase1PropertyContext(window.sessionStorage)
    }
  }

  async function continueFromProperty() {
    if (fixtureMode) {
      setStep('evidence')
      return
    }
    setPropertyResolving(true)
    setPropertyError('')
    try {
      const property = await resolvePhase1Property(address)
      setPropertyContext(property)
      writePhase1PropertyContext(window.sessionStorage, property)
      setStep('evidence')
    } catch (error) {
      setPropertyContext(null)
      clearPhase1PropertyContext(window.sessionStorage)
      setPropertyError(error instanceof Error ? error.message : 'The property workspace could not be created.')
    } finally {
      setPropertyResolving(false)
    }
  }

  async function organizeEvidence() {
    setStep('processing')
    setProcessingState('idle')
    setProcessingError('')
    try {
      const result = fixtureMode
        ? await loadPhase1ReasoningArtifact({ mode: 'fixture' })
        : adaptPhase1ReasoningArtifact(await processPhase1Evidence({
          propertyId: propertyContext?.id || '',
          files,
          note,
          onState: setProcessingState,
        }), { mode: 'live' })
      setArtifact(result)
      setFindingIndex(0)
      setProcessingState('completed')
    } catch (error) {
      setArtifact(null)
      setProcessingState('failed')
      setProcessingError(error instanceof Error ? error.message : 'Processing failed. The selected evidence was not replaced with fixture data.')
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

  async function signOut() {
    clearPhase1PropertyContext(window.sessionStorage)
    await supabase.auth.signOut()
  }

  if (!fixtureMode && !authReady) return <div className="phase1-shell"><main className="phase1-main phase1-sign-in"><p className="phase1-lede">Checking your session…</p></main></div>
  if (!fixtureMode && !session) return <SignInStep onSignedIn={setSession} />

  return (
    <div className="phase1-shell">
      <PhaseHeader step={step} email={fixtureMode ? undefined : session?.user.email} onSignOut={fixtureMode ? undefined : () => void signOut()} />
      {step === 'property' && <PropertyStep address={address} resolving={propertyResolving} error={propertyError} onAddressChange={changeAddress} onContinue={() => void continueFromProperty()} />}
      {step === 'evidence' && <EvidenceStep files={files} note={note} onFiles={setFiles} onNote={setNote} onContinue={() => void organizeEvidence()} />}
      {step === 'processing' && <ProcessingStep state={processingState} error={processingError} onContinue={() => setStep('overview')} onBack={() => setStep('evidence')} />}
      {step === 'overview' && artifact && <OverviewStep artifact={artifact} onSelect={(index) => { setFindingIndex(index); setStep('finding') }} />}
      {step === 'finding' && artifact && finding && <FindingStep finding={finding} isFixture={artifact.isFixture} onBack={() => setStep('overview')} onContinue={() => setStep(finding.missingInformation.length ? 'gap' : 'next')} />}
      {step === 'gap' && finding && <GapStep finding={finding} onEvidence={(file) => { setFiles((current) => [...current, file]); setStep('next') }} onSkip={() => setStep('next')} />}
      {step === 'next' && artifact && finding && <NextStep address={address} evidenceCount={evidenceCount} artifact={artifact} finding={finding} onContinue={continueReview} />}
    </div>
  )
}
