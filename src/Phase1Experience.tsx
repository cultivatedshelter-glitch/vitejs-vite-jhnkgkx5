import { useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { Phase1ExperienceViewModel, Phase1FindingViewModel, Phase1LinkedSource } from './phase1ReasoningAdapter'
import { adaptPhase1ReasoningArtifact, loadPhase1ReasoningArtifact } from './phase1ReasoningAdapter'
import { createPhase1SubmissionDraft, loadPhase1Dashboard, loadPhase1Identity, loadPhase1MyProperties, loadPhase1ProcessingRequest, loadPhase1PropertyReports, loadPhase1ReviewedReport, openPhase1ReviewedReportPdf, openPhase1SourceDocument, previewPhase1ReviewedReport, releasePhase1ReviewedReport, resolvePhase1Property, reviewPhase1Finding, savePhase1ReviewPosition, sendPhase1ReviewedResult, submitPhase1SubmissionDraft, updatePhase1SubmissionDraft, uploadPhase1Evidence, type EvidenceReference, type LiveProcessingState, type Phase1BriefFinding, type Phase1BriefPath, type Phase1DecisionBrief, type Phase1Identity, type Phase1LocalProfessional, type Phase1PropertyHistoryItem, type Phase1ReviewAction, type Phase1ReviewQueueItem, type Phase1ReviewSummary, type Phase1SubmissionMetadata } from './phase1ProcessingClient'
import { clearPhase1PropertyContext, propertyContextBelongsToUser, propertyContextMatchesAddress, readPhase1PropertyContext, writePhase1PropertyContext, type Phase1PropertyContext } from './phase1PropertyContext'
import { supabase } from './supabase'
import './Phase1Experience.css'

type Step = 'property' | 'evidence' | 'submission_review' | 'submitted' | 'processing' | 'overview' | 'finding' | 'report_preview' | 'report_released' | 'gap' | 'next'
type ProcessingState = 'idle' | LiveProcessingState

const PROGRESS_STAGES = ['Property', 'Evidence', 'Review Submission', 'Submitted']

function progressStage(step: Step) {
  if (step === 'property') return 0
  if (step === 'evidence') return 1
  if (step === 'submission_review') return 2
  return 3
}

function reviewRequestFromLocation() {
  const match = window.location.pathname.match(/^\/properties\/[^/]+\/review\/?$/)
  return match ? new URLSearchParams(window.location.search).get('request') : null
}

function audienceFromLocation(): 'reviewer' | 'agent' {
  return new URLSearchParams(window.location.search).get('audience') === 'agent' ? 'agent' : 'reviewer'
}

function isReviewQueueLocation() {
  return /^\/(review-queue|dashboard)\/?$/.test(window.location.pathname)
}

function submissionRequestFromLocation() {
  return window.location.pathname.match(/^\/submissions\/([^/]+)(?:\/review)?\/?$/)?.[1] || null
}

function findingFromLocation() {
  return new URLSearchParams(window.location.search).get('finding')
}

function reviewedReportFromLocation() {
  return window.location.pathname.match(/^\/properties\/[^/]+\/reports\/([^/]+)\/?$/)?.[1] || null
}

function propertyReportsFromLocation() {
  return window.location.pathname.match(/^\/properties\/([^/]+)\/reports\/?$/)?.[1] || null
}

function isTerminalReview(finding: Phase1FindingViewModel) {
  return ['approve', 'needs_more_info', 'reject'].includes(finding.reviewDecision.action || '')
}

function summarizeReview(artifact: Phase1ExperienceViewModel): Phase1ReviewSummary {
  const approved = artifact.findings.filter((finding) => finding.reviewDecision.action === 'approve').length
  const needsInfo = artifact.findings.filter((finding) => finding.reviewDecision.action === 'needs_more_info').length
  const rejected = artifact.findings.filter((finding) => finding.reviewDecision.action === 'reject').length
  const reviewed = artifact.findings.filter(isTerminalReview).length
  return { total: artifact.findings.length, reviewed, approved, needsInfo, rejected, remaining: Math.max(artifact.findings.length - reviewed, 0) }
}

function PhaseHeader({ step, email, identity, onSignOut, onNavigate }: { step: Step; email?: string; identity?: Phase1Identity | null; onSignOut?: () => void; onNavigate?: (path: string) => void }) {
  const activeStage = progressStage(step)
  return (
    <header className="phase1-header">
      <div className="phase1-brand"><strong>SHELTER PREP</strong><span>Repair clarity. Higher value.</span></div>
      <div className="phase1-header-actions">
        {identity && onNavigate && <nav className="phase1-role-nav" aria-label={identity.isReviewer ? 'Reviewer navigation' : 'Submitter navigation'}>
          {identity.isReviewer ? <><button type="button" onClick={() => onNavigate('/dashboard')}>Dashboard</button><button type="button" onClick={() => onNavigate('/properties')}>Properties</button><button type="button" onClick={() => onNavigate('/review-queue')}>Review</button><button type="button" onClick={() => onNavigate('/properties/new')}>+ New Property</button></> : <><button type="button" onClick={() => onNavigate('/properties')}>Properties</button><button type="button" onClick={() => onNavigate('/properties/new')}>Add Property</button></>}
        </nav>}
        {!identity?.isReviewer && <div className="phase1-progress" aria-label={`${PROGRESS_STAGES[activeStage]} stage, ${activeStage + 1} of 4`}>
          {PROGRESS_STAGES.map((label, index) => (
            <span className={index === activeStage ? 'is-current' : index < activeStage ? 'is-complete' : ''} key={label}>{label}</span>
          ))}
        </div>}
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
  existingEvidenceNames,
  note,
  submitting,
  error,
  onFiles,
  onNote,
  onContinue,
}: {
  files: File[]
  existingEvidenceNames: string[]
  note: string
  submitting: boolean
  error: string
  onFiles: (files: File[]) => void
  onNote: (value: string) => void
  onContinue: () => void
}) {
  const inspectionRef = useRef<HTMLInputElement>(null)
  const mediaRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const noteRef = useRef<HTMLTextAreaElement>(null)
  const canContinue = files.length > 0 || existingEvidenceNames.length > 0 || note.trim().length > 0
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
      {(existingEvidenceNames.length > 0 || files.length > 0) && <ul className="phase1-file-list" aria-label="Selected evidence" aria-live="polite">{existingEvidenceNames.map((name) => <li key={`persisted-${name}`}>{name}<small>Uploaded</small></li>)}{files.map((file) => <li key={`${file.name}-${file.size}`}>{file.name} <small>{(file.size / 1024 / 1024).toFixed(1)} MB</small></li>)}</ul>}
      <label className="phase1-field">
        <span>Anything specific we should know? <small>Optional</small></span>
        <textarea ref={noteRef} rows={3} value={note} onChange={(event) => onNote(event.target.value)} placeholder="Add a note or repair question" />
      </label>
      {error && <p className="phase1-inline-error" role="alert">{error}</p>}
      <p className="phase1-privacy"><span aria-hidden="true">✓</span> Your files are secure and private.</p>
      <div className="phase1-actions">
        <button className="phase1-primary" type="button" disabled={!canContinue || submitting} onClick={onContinue}>{submitting ? 'Uploading evidence…' : <>Continue <span aria-hidden="true">→</span></>}</button>
      </div>
    </main>
  )
}

function ReviewSubmissionStep({ address, evidenceNames, note, recipientName, recipientEmail, submitting, error, onRecipientName, onRecipientEmail, onBack, onSubmit }: {
  address: string
  evidenceNames: string[]
  note: string
  recipientName: string
  recipientEmail: string
  submitting: boolean
  error: string
  onRecipientName: (value: string) => void
  onRecipientEmail: (value: string) => void
  onBack: () => void
  onSubmit: () => void
}) {
  return <main className="phase1-main phase1-submission-review">
    <p className="phase1-kicker">Review Submission</p>
    <h1>Ready for Shelter Prep.</h1>
    <p className="phase1-lede">Confirm the handoff before review begins.</p>
    <section className="phase1-submission-card"><h2>Property</h2><p>{address}</p></section>
    <section className="phase1-submission-card"><h2>Evidence submitted</h2><ul>{evidenceNames.map((name) => <li key={name}>{name}</li>)}</ul>{note && <><h3>Question / context</h3><p>{note}</p></>}</section>
    <section className="phase1-submission-card"><h2>Result recipient</h2><p>The reviewed result will be sent to this person after human approval.</p><label className="phase1-field"><span>Name <small>Optional</small></span><input value={recipientName} onChange={(event) => onRecipientName(event.target.value)} /></label><label className="phase1-field"><span>Email</span><input type="email" required value={recipientEmail} onChange={(event) => onRecipientEmail(event.target.value)} /></label></section>
    {error && <p className="phase1-inline-error" role="alert">{error}</p>}
    <div className="phase1-actions"><button className="phase1-text-action" type="button" onClick={onBack}>Back to evidence</button><button className="phase1-primary" type="button" disabled={submitting || !recipientEmail.trim()} onClick={onSubmit}>{submitting ? 'Submitting…' : 'Submit to Shelter Prep'}</button></div>
  </main>
}

function SubmittedSummary({ address, submission, evidenceNames, note, onNavigate, onAddEvidence }: {
  address: string
  submission: Phase1SubmissionMetadata | null
  evidenceNames: string[]
  note: string
  onNavigate: (path: string) => void
  onAddEvidence: () => void
}) {
  const submitter = submission?.submitterName || submission?.submitterEmail || 'Authenticated submitter'
  const recipient = submission?.deliveryRecipientName
    ? `${submission.deliveryRecipientName} · ${submission.deliveryRecipientEmail}`
    : submission?.deliveryRecipientEmail || 'Result recipient pending'
  return <main className="phase1-main phase1-submitted">
    <p className="phase1-kicker">Submitted</p><h1>Your Property is under review.</h1><p className="phase1-lede">Shelter Prep has the evidence and the handoff details.</p>
    <div className="phase1-submitted-grid">
      <section><h2>Property</h2><p>{address}</p><h3>Submitted by</h3><p>{submitter}</p></section>
      <section><h2>What you submitted</h2><ul>{evidenceNames.map((name) => <li key={name}>{name}</li>)}{note && <li>1 note / question</li>}</ul></section>
      <section><h2>Reviewed result will be sent to</h2><p>{recipient}</p><span className="phase1-status">Under Review</span></section>
    </div>
    <section className="phase1-next-move"><p className="phase1-kicker">What Shelter Prep is doing</p><ul className="phase1-detail-list"><li>Organizing findings and evidence</li><li>Identifying likely repair paths</li><li>Researching sourced repair-cost ranges</li><li>Surfacing unknowns and next questions</li><li>Preparing the result for human review</li></ul><h2>What happens next</h2><p>You'll receive the reviewed result when it is ready.</p></section>
    <div className="phase1-actions"><button type="button" onClick={() => onNavigate('/properties')}>My Properties</button><button type="button" onClick={onAddEvidence}>Add More Evidence</button><button className="phase1-primary" type="button" onClick={() => onNavigate('/properties')}>View Submission</button></div>
  </main>
}

function PropertyReports({ propertyId, onNavigate }: { propertyId: string; onNavigate: (path: string) => void }) {
  const [items, setItems] = useState<Awaited<ReturnType<typeof loadPhase1PropertyReports>>>([])
  const [error, setError] = useState('')
  useEffect(() => { void loadPhase1PropertyReports(propertyId).then(setItems).catch((value) => setError(value instanceof Error ? value.message : 'Report history could not be loaded.')) }, [propertyId])
  return <main className="phase1-main phase1-properties"><p className="phase1-kicker">Property</p><h1>Reports / Reviewed Results</h1>{error && <p className="phase1-inline-error" role="alert">{error}</p>}{!error && !items.length && <p>No durable reviewed reports are available.</p>}<div className="phase1-property-list">{items.map((item) => <article key={item.id}><div><span className="phase1-status">{item.report_status}</span><h2>Reviewed Report · Version {item.report_version}</h2><p>Generated {new Date(item.generated_at || item.created_at).toLocaleString()}</p><p>Released {item.released_at ? new Date(item.released_at).toLocaleString() : 'Not released'}</p><p>Reviewer: {item.reviewer_name}</p><p>Recipient: {item.recipient}</p><p>Delivery: {item.delivery_status}{item.sent_at ? ` · ${new Date(item.sent_at).toLocaleString()}` : ''}</p></div><div className="phase1-actions"><button type="button" onClick={() => onNavigate(`/properties/${propertyId}/reports/${item.id}`)}>View</button><button type="button" onClick={() => void openPhase1ReviewedReportPdf(item.id)}>Download PDF</button></div></article>)}</div></main>
}

function MyProperties({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [items, setItems] = useState<Phase1PropertyHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => { void loadPhase1MyProperties().then(setItems).catch((value) => setError(value instanceof Error ? value.message : 'Properties could not be loaded.')).finally(() => setLoading(false)) }, [])
  return <main className="phase1-main phase1-properties"><div className="phase1-page-title"><div><p className="phase1-kicker">Properties</p><h1>My Properties</h1><p className="phase1-lede">Submission status and the next useful action.</p></div><button type="button" onClick={() => onNavigate('/properties/new')}>+ Add Property</button></div>
    {loading && <p>Loading Properties…</p>}{error && <p className="phase1-inline-error" role="alert">{error}</p>}
    {!loading && !error && !items.length && <section className="phase1-empty-state"><h2>No Properties yet.</h2><p>Start with an address and whatever evidence you have.</p><button className="phase1-primary" type="button" onClick={() => onNavigate('/properties/new')}>Add Property</button></section>}
    <div className="phase1-property-list">{items.map((item) => <article key={item.requestId}><div><span className="phase1-status">{item.status}</span><h2>{item.propertyAddress}</h2><p>Submitted {new Date(item.submittedAt).toLocaleDateString()}</p><p>Result recipient: {item.resultRecipientEmail}</p>{item.latestReportVersion && <p>Reviewed report: Version {item.latestReportVersion}</p>}{item.delivery && <p>Delivery: {item.delivery.delivery_status === 'sent' ? `Sent ${item.delivery.sent_at ? new Date(item.delivery.sent_at).toLocaleString() : ''}` : item.delivery.delivery_status}</p>}</div><div><p><strong>Next action</strong><br />{item.nextAction}</p>{item.latestReportId && <button type="button" onClick={() => onNavigate(`/properties/${item.propertyId}/reports`)}>Report History</button>}<button className="phase1-primary" type="button" onClick={() => onNavigate(item.status === 'Ready' && item.latestReportId ? `/properties/${item.propertyId}/reports/${item.latestReportId}` : item.status === 'Ready' ? `/properties/${item.propertyId}/review?request=${item.requestId}&audience=agent` : `/submissions/${item.requestId}`)}>{item.status === 'Ready' ? `View Reviewed Result${item.latestReportVersion ? ` v${item.latestReportVersion}` : ''}` : item.status === 'Needs Information' ? 'Add Requested Evidence' : 'View Submission'}</button></div></article>)}</div>
  </main>
}

function ProcessingStep({ state, error, onContinue, onBack }: {
  state: ProcessingState
  error: string
  onContinue: () => void
  onBack: () => void
}) {
  const ready = state === 'completed' || state === 'ready'
  const failed = state === 'failed'
  const statusCopy: Record<ProcessingState, string> = {
    idle: 'Uploading your evidence securely.',
    draft: 'Your evidence is ready for submission.',
    uploaded: 'Your evidence is uploaded.',
    queued: 'Your review is ready to begin.',
    processing: 'Reviewing and organizing the evidence.',
    completed: 'Your repair summary is ready.',
    under_review: 'Shelter Prep is reviewing the findings before release.',
    ready: 'Your reviewed result is ready.',
    failed: error,
  }
  const activeIndex = state === 'idle' ? 0 : ['draft', 'uploaded', 'queued', 'processing', 'under_review'].includes(state) ? 1 : ['completed', 'ready'].includes(state) ? 5 : -1
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

function OverviewStep({ artifact, reportBusy, reportError, onSelect, onGenerateReport }: { artifact: Phase1ExperienceViewModel; reportBusy: boolean; reportError: string; onSelect: (index: number) => void; onGenerateReport: () => void }) {
  const summary = summarizeReview(artifact)
  const firstUnresolved = artifact.findings.findIndex((finding) => !isTerminalReview(finding))
  const groups = [
    { priority: 'quick_review', label: 'Quick Review' },
    { priority: 'careful_review', label: 'Careful Review' },
    { priority: 'waiting_for_evidence', label: 'Waiting for Evidence' },
  ] as const
  return (
    <main className="phase1-main phase1-overview">
      {artifact.isFixture && <p className="phase1-kicker">Development fixture</p>}
      <p className="phase1-kicker">{summary.remaining === 0 ? 'Review complete' : 'Property review'}</p>
      <h1>{summary.remaining === 0 ? `${summary.reviewed} / ${summary.total} reviewed` : `${summary.remaining} findings remaining`}</h1>
      <p className="phase1-lede">{summary.remaining === 0 ? 'The current reviewed request is ready to generate as a recipient report.' : 'Continue with the first finding that still needs a decision.'}</p>
      {reportError && <p className="phase1-inline-error" role="alert">{reportError}</p>}
      <div className="phase1-review-summary" aria-label="Current review summary">
        <div><span>Findings</span><strong>{summary.total}</strong></div>
        <div><span>Reviewed</span><strong>{summary.reviewed}</strong></div>
        <div><span>Approved</span><strong>{summary.approved}</strong></div>
        <div><span>Needs info</span><strong>{summary.needsInfo}</strong></div>
        <div><span>Rejected</span><strong>{summary.rejected}</strong></div>
        <div><span>Remaining</span><strong>{summary.remaining}</strong></div>
      </div>
      <section className="phase1-decision-overview" aria-labelledby="whole-report-overview">
        <div className="phase1-section-heading"><h2 id="whole-report-overview">Whole-report decision picture</h2><span>{artifact.overview.findingsWithSourcedPaths} with sourced paths</span></div>
        {artifact.transactionPerspective !== 'Not Stated' && <p className="phase1-transaction-context"><strong>Transaction perspective</strong>{artifact.transactionPerspective}</p>}
        <div className="phase1-overview-grid">
          <div><h3>Major categories</h3>{artifact.overview.majorCategories.length ? <ul>{artifact.overview.majorCategories.map((category) => <li key={category.label}><span>{category.label}</span><strong>{category.findingCount}</strong></li>)}</ul> : <p>Categories are still being organized.</p>}</div>
          <div><h3>Likely upcoming decisions</h3><TextList values={artifact.overview.decisionFactors.slice(0, 6)} empty="No cross-report decision factors were returned." /></div>
          <div><h3>Immediate tasks</h3><TextList values={artifact.overview.immediateNextTasks.slice(0, 5)} empty="Open the first finding to choose the next task." /></div>
        </div>
        <p className="phase1-cost-rule"><strong>Cost context</strong>{artifact.overview.aggregateCostRule}</p>
        {artifact.humanObservations.length > 0 && <details><summary>Submitter context ({artifact.humanObservations.length})</summary>{artifact.humanObservations.map((observation) => <article className="phase1-human-observation" key={observation.id}><p>{observation.observation}</p><small>{observation.role} · {observation.directness} · professional status {observation.professionalStatus.toLowerCase()} · {observation.verificationStatus}</small></article>)}</details>}
      </section>
      <LocalProfessionals groups={artifact.localProfessionals.groups} />
      <section className="phase1-band" aria-labelledby="priority-findings">
        <div className="phase1-section-heading"><h2 id="priority-findings">Repair items</h2><span>{artifact.categories.length} systems</span></div>
        {groups.map((group) => {
          const entries = artifact.findings.map((finding, index) => ({ finding, index })).filter(({ finding }) => finding.reviewPriority === group.priority)
          if (!entries.length) return null
          return <div className="phase1-review-group" key={group.priority}><h3>{group.label}<span>{entries.length}</span></h3>{entries.map(({ finding, index }) => (
            <button className="phase1-finding-row" type="button" onClick={() => onSelect(index)} key={finding.id}>
              <span className="phase1-finding-thumb" aria-hidden="true">{finding.category.charAt(0)}</span>
              <span className="phase1-finding-copy"><strong>{finding.title}</strong><small>{finding.category} · {finding.reviewStatusLabel}</small><span>{finding.affectedLocation.locationText}</span></span>
              <span className="phase1-chevron" aria-hidden="true">›</span>
            </button>
          ))}</div>
        })}
      </section>
      <div className="phase1-actions"><button className="phase1-primary" type="button" disabled={reportBusy} onClick={summary.remaining === 0 ? onGenerateReport : () => onSelect(firstUnresolved >= 0 ? firstUnresolved : 0)}>{reportBusy ? 'Generating…' : summary.remaining === 0 ? 'Generate Reviewed Report' : 'Continue Review'} <span aria-hidden="true">→</span></button></div>
    </main>
  )
}

function TextList({ values, empty }: { values: string[]; empty: string }) {
  if (!values.length) return <p>{empty}</p>
  return <ul className="phase1-detail-list">{values.map((value) => <li key={value}>{value}</li>)}</ul>
}

function SourceDrawer({ source, onClose }: { source: Phase1LinkedSource; onClose: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    closeButton.current?.focus()
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])
  return <div className="phase1-source-drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <aside className="phase1-source-drawer" role="dialog" aria-modal="true" aria-labelledby="phase1-source-title">
      <button ref={closeButton} className="phase1-drawer-close" type="button" onClick={onClose} aria-label="Close source details">×</button>
      <p className="phase1-kicker">Pricing source</p>
      <h2 id="phase1-source-title">{source.label}</h2>
      <dl><div><dt>Range / reference</dt><dd>{source.priceLabel || source.reference || 'Stored source details only'}</dd></div><div><dt>Geography</dt><dd>{source.geography}</dd></div>{source.publishedAt && <div><dt>Published</dt><dd>{source.publishedAt}</dd></div>}{source.retrievedAt && <div><dt>Retrieved</dt><dd>{source.retrievedAt.slice(0, 10)}</dd></div>}<div><dt>Scope basis</dt><dd>{source.scopeBasis || 'Scope basis was not returned.'}</dd></div></dl>
      {source.url ? <a className="phase1-primary phase1-source-open" href={source.url} target="_blank" rel="noreferrer">Open actual source</a> : <p className="phase1-quiet-state">This source has stored reference details but no public URL.</p>}
    </aside>
  </div>
}

function ResearchSources({ sources }: { sources: Phase1LinkedSource[] }) {
  if (!sources.length) return null
  return <section className="phase1-research-sources"><p className="phase1-kicker">Independent research</p>{sources.map((source) => <p key={source.id}><strong>{source.label}</strong><span>{source.scopeBasis}</span><small>{source.geography}{source.publishedAt ? ` · Published ${source.publishedAt.slice(0, 10)}` : source.retrievedAt ? ` · Retrieved ${source.retrievedAt.slice(0, 10)}` : ''}</small>{source.url && <a href={source.url} target="_blank" rel="noreferrer">View source</a>}</p>)}</section>
}

function RepairPathList({ finding, onAdjustPrice, onOpenSource }: { finding: Phase1FindingViewModel; onAdjustPrice?: (pathId: string) => void; onOpenSource?: (source: Phase1LinkedSource) => void }) {
  if (!finding.repairPaths.length) return <section className="phase1-repair-paths"><p className="phase1-kicker">Likely paths</p><p className="phase1-quiet-state">No defensible routine path was matched. The reviewer should define the smallest useful evaluation task before pricing.</p></section>
  return <section className="phase1-repair-paths">
    <p className="phase1-kicker">Likely paths</p>
    <div className="phase1-path-list">{finding.repairPaths.map((path) => <article className={`phase1-path phase1-path-compact${path.status === 'blocked' ? ' is-blocked' : ''}`} key={path.id}>
      <div className="phase1-path-decision"><strong>{path.label}</strong><span>{path.priceLabel}</span></div>
      <div className="phase1-path-actions"><span>{path.sources.length} pricing {path.sources.length === 1 ? 'source' : 'sources'}</span>{path.sources[0] && onOpenSource && <button type="button" onClick={() => onOpenSource(path.sources[0])}>View Sources</button>}{onAdjustPrice && <button type="button" onClick={() => onAdjustPrice(path.id)}>Adjust Price</button>}</div>
      {path.status === 'blocked' && <p className="phase1-quiet-state">No defensible source is attached to this path.</p>}
      <details className="phase1-path-details"><summary>Pricing details</summary>
        <div className="phase1-path-meta"><span>{path.rangeStatus}</span><span>{path.geography}</span>{onAdjustPrice && path.reviewedPriceVersion && <span>Reviewed version {path.reviewedPriceVersion}</span>}</div>
        {onAdjustPrice && path.originalPriceLabel && <p><strong>Original sourced range:</strong> {path.originalPriceLabel}</p>}
        {path.confidenceReason && <p>{path.confidenceReason}</p>}
        <div className="phase1-path-terms"><div><h3>Assumptions</h3><TextList values={path.assumptions} empty="No assumptions returned." /></div><div><h3>Major exclusions</h3><TextList values={path.exclusions} empty="No exclusions returned." /></div></div>
        {path.sources.length > 0 && <div className="phase1-path-sources"><h3>Pricing sources ({path.sources.length})</h3>{path.sources.map((source, index) => <div key={source.id}><strong>Source {index + 1}: {source.label}</strong>{source.priceLabel && <span>Range / reference: {source.priceLabel}</span>}<span>Geography: {source.geography}</span>{source.publishedAt && <span>Published: {source.publishedAt}</span>}{source.retrievedAt && <span>Retrieved: {source.retrievedAt.slice(0, 10)}</span>}{source.scopeBasis && <span>Scope basis: {source.scopeBasis}</span>}{onOpenSource ? <button type="button" onClick={() => onOpenSource(source)}>{source.url ? 'Open' : 'View stored reference'}</button> : source.url ? <a href={source.url} target="_blank" rel="noreferrer">Open source</a> : <span>{source.reference}</span>}</div>)}</div>}
      </details>
    </article>)}</div>
  </section>
}

function AdminDashboard({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [items, setItems] = useState<Phase1ReviewQueueItem[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  useEffect(() => {
    void loadPhase1Dashboard().then(setItems).catch((value) => setError(value instanceof Error ? value.message : 'The admin dashboard could not be loaded.')).finally(() => setLoading(false))
  }, [])
  const groups = [
    ['needs_review', 'Needs Review'],
    ['in_review', 'In Review'],
    ['waiting_for_evidence', 'Waiting for Evidence'],
    ['released', 'Ready / Released'],
    ['failed', 'Failed'],
    ['processing', 'Processing'],
  ] as const
  const visible = items.filter((item) => `${item.propertyAddress} ${item.submittingAgent}`.toLowerCase().includes(search.trim().toLowerCase()))
  const resume = visible.find((item) => ['in_review', 'needs_review', 'waiting_for_evidence'].includes(item.queueStatus))
  function reviewPath(item: Phase1ReviewQueueItem) {
    const finding = item.lastViewedObservationId ? `&finding=${encodeURIComponent(item.lastViewedObservationId)}` : '&resume=1'
    return `/properties/${encodeURIComponent(item.propertyId)}/review?request=${encodeURIComponent(item.requestId)}${finding}`
  }
  return <main className="phase1-main phase1-review-queue"><div className="phase1-page-title"><div><p className="phase1-kicker">Internal review</p><h1>Admin Dashboard</h1><p className="phase1-lede">Continue the next Property decision without reconstructing the workflow.</p></div><button type="button" onClick={() => onNavigate('/properties/new')}>+ New Property</button></div>
    {loading && <p>Loading review work…</p>}{error && <p className="phase1-inline-error" role="alert">{error}</p>}
    {!loading && !error && resume && <section className="phase1-resume"><p className="phase1-kicker">Continue where you left off</p><div><h2>{resume.propertyAddress}</h2><p>{resume.reviewedCount} of {resume.findingCount} findings reviewed · {resume.remainingCount} remaining</p><p>Status: {resume.queueStatus === 'waiting_for_evidence' ? 'Waiting for Evidence' : 'In Review'} · Last activity {new Date(resume.lastActivityAt).toLocaleString([], { hour: 'numeric', minute: '2-digit' })}</p><p><strong>Next action</strong><br />{resume.nextAction}</p></div><button className="phase1-primary" type="button" onClick={() => onNavigate(reviewPath(resume))}>Resume Review</button></section>}
    {!loading && !error && <label className="phase1-field phase1-search"><span>Search</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Property or submitter" /></label>}
    {!loading && !error && groups.map(([status, label]) => {
      const rows = visible.filter((item) => item.queueStatus === status)
      return <section className="phase1-queue-group" key={status}><h2>{label}<span>{rows.length}</span></h2>{rows.length === 0 ? <p className="phase1-quiet-state">No requests.</p> : rows.map((item) => <article className="phase1-queue-row" key={item.requestId}><div><strong>{item.propertyAddress}</strong><span>{item.submittingAgent}</span></div><span>{item.findingCount} findings · {item.reviewedCount} reviewed · {item.remainingCount} remaining</span><span>{item.nextAction}{item.delivery ? ` · Delivery ${item.delivery.delivery_status}` : ''}</span><span>{new Date(item.lastActivityAt).toLocaleString()}</span><button type="button" onClick={() => onNavigate(item.queueStatus === 'released' && item.latestReportId ? `/properties/${item.propertyId}/reports/${item.latestReportId}` : reviewPath(item))}>{item.queueStatus === 'released' ? `View Released Result${item.latestReportVersion ? ` v${item.latestReportVersion}` : ''}` : item.queueStatus === 'in_review' ? 'Resume Review' : 'Open'}</button></article>)}</section>
    })}
    {!loading && !error && <section className="phase1-queue-group"><h2>Recent Properties<span>{visible.length}</span></h2>{visible.slice(0, 6).map((item) => <button className="phase1-recent-property" type="button" key={`recent-${item.requestId}`} onClick={() => onNavigate(item.queueStatus === 'released' ? `/properties/${item.propertyId}/review?request=${item.requestId}` : reviewPath(item))}><strong>{item.propertyAddress}</strong><span>{item.queueStatus.replaceAll('_', ' ')}</span></button>)}</section>}
  </main>
}

function FindingStep({ finding, findingIndex, findingCount, reviewedCount, remainingCount, propertyAddress, transactionPerspective, isFixture, requestId, reviewing, reviewError, onBack, onOpenProperty, onPrevious, onNext, onReview }: {
  finding: Phase1FindingViewModel
  findingIndex: number
  findingCount: number
  reviewedCount: number
  remainingCount: number
  propertyAddress: string
  transactionPerspective: string
  isFixture: boolean
  requestId: string | null
  reviewing: boolean
  reviewError: string
  onBack: () => void
  onOpenProperty: () => void
  onPrevious: () => void
  onNext: () => void
  onReview: (action: Phase1ReviewAction, payload: { corrections?: Record<string, unknown>; reason?: string; fieldsApproved?: string[] }) => void
}) {
  type EditableField = 'title' | 'interpretation' | 'unknown' | 'location' | 'next_step' | 'rationale' | 'likely_trade' | 'field_knowledge'
  const [reviewMode, setReviewMode] = useState<'quick' | 'careful'>(finding.reviewPriority === 'quick_review' ? 'quick' : 'careful')
  const [reviewAction, setReviewAction] = useState<Phase1ReviewAction | null>(null)
  const [editingField, setEditingField] = useState<EditableField | null>(null)
  const [editingPricePathId, setEditingPricePathId] = useState<string | null>(null)
  const [selectedSource, setSelectedSource] = useState<Phase1LinkedSource | null>(null)
  const [reasonCategory, setReasonCategory] = useState('Interpretation')
  const [reasonNote, setReasonNote] = useState('')
  const [title, setTitle] = useState(finding.title)
  const [interpretation, setInterpretation] = useState(finding.interpretation)
  const [unknown, setUnknown] = useState(finding.unknown.join('\n'))
  const [location, setLocation] = useState(finding.affectedLocation.locationText)
  const [orientation, setOrientation] = useState(finding.affectedLocation.orientation === 'Unknown' ? '' : finding.affectedLocation.orientation)
  const [nextStep, setNextStep] = useState(finding.nextStep)
  const [rationale, setRationale] = useState(finding.whyNextStep)
  const [likelyTrade, setLikelyTrade] = useState(finding.likelyTrade)
  const [fieldKnowledge, setFieldKnowledge] = useState(finding.fieldKnowledge)
  const [priceLow, setPriceLow] = useState('')
  const [priceHigh, setPriceHigh] = useState('')
  const [priceGeography, setPriceGeography] = useState('')
  const [priceConfidence, setPriceConfidence] = useState('broad_preliminary')
  const [priceSourceType, setPriceSourceType] = useState<'external_sources' | 'reviewer_professional_judgment'>('external_sources')
  const [selectedPriceSourceIds, setSelectedPriceSourceIds] = useState<string[]>([])
  const [priceAssumptions, setPriceAssumptions] = useState('')
  const [priceExclusions, setPriceExclusions] = useState('')
  const [priceEvidenceState, setPriceEvidenceState] = useState('inspection_report_only')

  const editingPricePath = finding.repairPaths.find((path) => path.id === editingPricePathId) || null

  function beginPriceAdjustment(pathId: string) {
    const path = finding.repairPaths.find((item) => item.id === pathId)
    if (!path) return
    setReviewAction('edit')
    setEditingField(null)
    setEditingPricePathId(pathId)
    setPriceLow(path.low === null ? '' : String(path.low))
    setPriceHigh(path.high === null ? '' : String(path.high))
    setPriceGeography(path.geography === 'Geography unavailable' ? '' : path.geography)
    setPriceConfidence(path.rangeStatus === 'Field-Supported' ? 'field_supported' : path.rangeStatus === 'Moderate Confidence' ? 'moderate_confidence' : 'broad_preliminary')
    setSelectedPriceSourceIds(path.sources.filter((source) => source.kind !== 'reviewer_professional_judgment').map((source) => source.id))
    setPriceSourceType(path.sources.some((source) => source.kind === 'reviewer_professional_judgment') ? 'reviewer_professional_judgment' : 'external_sources')
    setPriceAssumptions(path.assumptions.join('\n'))
    setPriceExclusions(path.exclusions.join('\n'))
    setReasonCategory('Price')
    setReasonNote('')
  }

  function beginFieldEdit(field: EditableField) {
    const categoryByField: Record<EditableField, string> = {
      title: 'Interpretation', interpretation: 'Interpretation', unknown: 'Missing Evidence', location: 'Location',
      next_step: 'Scope', rationale: 'Scope', likely_trade: 'Scope', field_knowledge: 'Other',
    }
    setEditingPricePathId(null)
    setEditingField(field)
    setReviewAction('edit')
    setReasonCategory(categoryByField[field])
    setReasonNote('')
  }

  function cancelEdit() {
    setReviewAction(null)
    setEditingField(null)
    setEditingPricePathId(null)
    setReasonNote('')
  }

  function submitReview() {
    if (!reviewAction) return
    const price = editingPricePath ? {
      low: Number(priceLow),
      high: Number(priceHigh),
      geography: priceGeography.trim(),
      path_id: editingPricePath.id,
      confidence_status: priceConfidence,
      source_type: priceSourceType,
      supporting_source_ids: priceSourceType === 'external_sources' ? selectedPriceSourceIds : [],
      assumptions: priceAssumptions.split('\n').map((value) => value.trim()).filter(Boolean),
      exclusions: priceExclusions.split('\n').map((value) => value.trim()).filter(Boolean),
      evidence_state: priceEvidenceState,
    } : undefined
    const fieldCorrections: Record<EditableField, Record<string, unknown>> = {
      title: { title: title.trim() },
      interpretation: { interpretation: interpretation.trim() },
      unknown: { unknown: unknown.split('\n').map((value) => value.trim()).filter(Boolean) },
      location: { affected_location: { location_text: location.trim(), orientation: orientation.trim() || null, source_basis: 'human_entered' } },
      next_step: { next_step: nextStep.trim() },
      rationale: { rationale: rationale.trim() },
      likely_trade: { likely_trade: likelyTrade.trim() },
      field_knowledge: { field_knowledge: fieldKnowledge.trim() },
    }
    const corrections = reviewAction === 'edit' && editingPricePath ? { price } : reviewAction === 'edit' && editingField ? fieldCorrections[editingField] : undefined
    const reason = reviewAction === 'approve' ? '' : `${reasonCategory}${reasonNote.trim() ? `: ${reasonNote.trim()}` : ''}`
    onReview(reviewAction, {
      corrections,
      reason,
      fieldsApproved: reviewAction === 'approve'
        ? ['title', 'interpretation', 'known', 'unknown', 'affected_location', 'next_step', 'rationale', 'likely_trade', 'evidence_relationship']
        : [],
    })
  }

  function InlineSaveControls() {
    return <div className="phase1-inline-save"><button type="button" onClick={cancelEdit}>Cancel</button><button type="button" disabled={reviewing} onClick={submitReview}>{reviewing ? 'Saving…' : 'Save Edit'}</button></div>
  }

  return (
    <main className="phase1-main phase1-finding-detail">
      {selectedSource && <SourceDrawer source={selectedSource} onClose={() => setSelectedSource(null)} />}
      <nav className="phase1-review-progress" aria-label="Finding review progress">
        <div className="phase1-review-context"><button className="phase1-back" type="button" onClick={onBack}><span aria-hidden="true">←</span> All repair items</button><button className="phase1-property-link" type="button" onClick={onOpenProperty}>{propertyAddress}</button></div>
        <p><strong>Finding {findingIndex + 1} of {findingCount}</strong><span>{reviewedCount} reviewed · {remainingCount} remaining</span></p>
        <div><button type="button" onClick={onPrevious} disabled={findingIndex === 0}>Previous</button><button type="button" onClick={onNext} disabled={findingIndex + 1 >= findingCount}>Next</button></div>
      </nav>
      <div className="phase1-review-mode" role="group" aria-label="Review detail level"><button type="button" className={reviewMode === 'quick' ? 'is-active' : ''} onClick={() => setReviewMode('quick')}>Quick review</button><button type="button" className={reviewMode === 'careful' ? 'is-active' : ''} onClick={() => setReviewMode('careful')}>Careful review</button></div>
      <header className="phase1-finding-header">
        <p className="phase1-kicker">{finding.category}{isFixture ? ' · Development fixture' : ''}</p>
        <div className="phase1-inline-heading"><h1>{finding.title}</h1>{!isFixture && <button type="button" onClick={() => beginFieldEdit('title')}>Edit</button>}</div>
        {editingField === 'title' && <div className="phase1-inline-editor"><label>Issue<input value={title} onChange={(event) => setTitle(event.target.value)} /></label><InlineSaveControls /></div>}
        <div className="phase1-status-line"><span className="phase1-status">{finding.reviewStatusLabel}</span><span>{finding.reviewPriority.replaceAll('_', ' ')}</span>{finding.observedAt && <span>Observed {finding.observedAt}</span>}</div>
      </header>
      <div className="phase1-review-flow">
          <section className="phase1-primary-evidence">
            <p className="phase1-kicker">Primary evidence</p>
            {finding.sourceEvidence.primaryPhoto?.linked
              ? <><div className="phase1-photo-placeholder">Linked report photo</div><p>{finding.sourceEvidence.primaryPhoto.caption || 'No caption was supplied.'}</p></>
              : <p className="phase1-quiet-state">Photo evidence: No report photo was clearly linked to this finding.</p>}
            {finding.sourceEvidence.additionalEvidenceCount > 0 && <details><summary>Additional evidence ({finding.sourceEvidence.additionalEvidenceCount})</summary><p>Additional linked source records remain available for review.</p></details>}
            {finding.sourceEvidence.confirmedEvidence && <p><strong>Confirmed evidence</strong><br />{finding.sourceEvidence.confirmedEvidence.relationship}</p>}
            {finding.sourceEvidence.candidatePhotos.length > 0 && <div className="phase1-candidate-evidence"><h3>Likely related photos</h3>{finding.sourceEvidence.candidatePhotos.map((candidate) => <article key={candidate.imageId}><strong>{candidate.strength === 'strong' ? 'Strong layout association' : 'Possible layout association'} - reviewer confirmation required</strong><p>{candidate.caption || `Report image on page ${candidate.page ?? 'unknown'}.`} {candidate.reason}</p><button type="button" disabled={reviewing} onClick={() => onReview('edit', { corrections: { evidence_relationship: `Confirmed report image ${candidate.imageId} as supporting evidence.`, confirmed_evidence: { image_id: candidate.imageId, source_page: candidate.page, association_basis: candidate.reason } }, reason: 'Reviewer confirmed the candidate evidence relationship against the source report.' })}>Confirm photo link</button></article>)}</div>}
            {requestId && finding.sourceEvidence.page && <div className="phase1-page-actions"><button type="button" onClick={() => void openPhase1SourceDocument(requestId, finding.sourceEvidence.page!)}>View Source Page</button><button type="button" disabled={finding.sourceEvidence.page <= 1} onClick={() => void openPhase1SourceDocument(requestId, finding.sourceEvidence.page! - 1)}>Previous Page</button><button type="button" onClick={() => void openPhase1SourceDocument(requestId, finding.sourceEvidence.page! + 1)}>Next Page</button></div>}
            {finding.sourceEvidence.pagePreviews.length > 0 && <details><summary>Nearby Pages</summary>{finding.sourceEvidence.pagePreviews.map((preview) => <article className="phase1-page-preview" key={`${preview.page}-${preview.relationship}`}><strong>Page {preview.page} · {preview.relationship.replaceAll('_', ' ')}</strong><p>{preview.textExcerpt}</p>{requestId && <button type="button" onClick={() => void openPhase1SourceDocument(requestId, preview.page)}>View page {preview.page}</button>}</article>)}</details>}
            {requestId && finding.sourceEvidence.fullReportAvailable && <button className="phase1-source-button" type="button" onClick={() => void openPhase1SourceDocument(requestId)}>Open Full Report</button>}
          </section>
          <section className="phase1-source-evidence">
            <p className="phase1-kicker">Inspector reported</p>
            <p>{finding.sourceEvidence.excerpt}</p>
            {finding.sourceEvidence.recommendation && <div className="phase1-source-recommendation"><strong>Inspector recommendation</strong><p>{finding.sourceEvidence.recommendation}</p></div>}
            <div className="phase1-source-meta"><span>{finding.sourceEvidence.documentName}</span>{finding.sourceEvidence.page && <span>Page {finding.sourceEvidence.page}</span>}{finding.sourceEvidence.itemNumber && <span>Item {finding.sourceEvidence.itemNumber}</span>}{finding.sourceEvidence.section && <span>{finding.sourceEvidence.section}</span>}</div>
          </section>
          <section className="phase1-reasoning-section"><div className="phase1-inline-label"><p className="phase1-kicker">Shelter Prep interpretation</p>{!isFixture && <button type="button" onClick={() => beginFieldEdit('interpretation')}>Edit</button>}</div><p>{finding.interpretation}</p>{editingField === 'interpretation' && <div className="phase1-inline-editor"><label>Interpretation<textarea value={interpretation} onChange={(event) => setInterpretation(event.target.value)} /></label><InlineSaveControls /></div>}</section>
          <ResearchSources sources={finding.researchSources} />
          <section className="phase1-inline-fact"><div><span>Likely trade</span><strong>{finding.likelyTrade}</strong></div>{!isFixture && <button type="button" onClick={() => beginFieldEdit('likely_trade')}>Edit</button>}{editingField === 'likely_trade' && <div className="phase1-inline-editor"><label>Likely trade<select value={likelyTrade} onChange={(event) => setLikelyTrade(event.target.value)}><option>Plumbing</option><option>Electrical</option><option>HVAC</option><option>Roofing</option><option>Carpentry</option><option>General Contractor</option><option>Exterior / Siding</option><option>Unknown</option></select></label><InlineSaveControls /></div>}</section>
          <RepairPathList finding={finding} onAdjustPrice={beginPriceAdjustment} onOpenSource={setSelectedSource} />
          {transactionPerspective !== 'Not Stated' && <section className="phase1-transaction-considerations"><p className="phase1-kicker">{transactionPerspective} context</p><TextList values={finding.transactionConsiderations} empty="No transaction-specific considerations were returned." /></section>}
          {reviewMode === 'careful' && finding.rangeHistory.length > 0 && <details className="phase1-range-history"><summary>Range history</summary>{finding.rangeHistory.map((revision) => <article key={revision.id}><strong>{revision.movement}: {revision.currentLabel}</strong><span>{revision.explanation}</span></article>)}</details>}
          <section className="phase1-reasoning-section phase1-important-unknown"><div className="phase1-inline-label"><p className="phase1-kicker">Important unknown</p>{!isFixture && <button type="button" onClick={() => beginFieldEdit('unknown')}>Edit</button>}</div><p>{finding.unknown[0] || finding.missingInformation[0] || 'No consequential unknown was returned.'}</p>{editingField === 'unknown' && <div className="phase1-inline-editor"><label>Unknowns, one per line<textarea value={unknown} onChange={(event) => setUnknown(event.target.value)} /></label><InlineSaveControls /></div>}</section>
          <section className="phase1-next-move"><div className="phase1-inline-label"><p className="phase1-kicker">Next task</p>{!isFixture && <button type="button" onClick={() => beginFieldEdit('next_step')}>Edit</button>}</div><h2>{finding.nextStep}</h2>{editingField === 'next_step' && <div className="phase1-inline-editor"><label>Next task<textarea value={nextStep} onChange={(event) => setNextStep(event.target.value)} /></label><InlineSaveControls /></div>}<div className="phase1-why"><div className="phase1-inline-label"><h3>Why this is the next task</h3>{!isFixture && <button type="button" onClick={() => beginFieldEdit('rationale')}>Edit</button>}</div><p>{finding.whyNextStep}</p>{editingField === 'rationale' && <div className="phase1-inline-editor"><label>Why<textarea value={rationale} onChange={(event) => setRationale(event.target.value)} /></label><InlineSaveControls /></div>}</div></section>
          {finding.contractorQuote && <section className="phase1-contractor-input"><div><span>Contractor input</span><strong>{finding.contractorQuote.label}</strong></div><p>Retained as source material with status {finding.contractorQuote.reviewStatus}. It is separate from Shelter Prep's range and does not verify this finding.</p></section>}
          <details className="phase1-more-details" open={reviewMode === 'careful'}><summary>More Details</summary>
            <section className="phase1-location-panel"><div className="phase1-inline-label"><p className="phase1-kicker">Affected location</p>{!isFixture && <button type="button" onClick={() => beginFieldEdit('location')}>Edit</button>}</div><h2>{finding.affectedLocation.locationText}</h2>{editingField === 'location' && <div className="phase1-inline-editor"><label>Location<input value={location} onChange={(event) => setLocation(event.target.value)} /></label><label>Orientation<input value={orientation} onChange={(event) => setOrientation(event.target.value)} /></label><InlineSaveControls /></div>}<dl><div><dt>Orientation</dt><dd>{finding.affectedLocation.orientation}</dd></div><div><dt>Area</dt><dd>{finding.affectedLocation.area}</dd></div><div><dt>Level</dt><dd>{finding.affectedLocation.level}</dd></div><div><dt>Room / zone</dt><dd>{finding.affectedLocation.roomOrZone}</dd></div><div><dt>Element</dt><dd>{finding.affectedLocation.element}</dd></div></dl></section>
            <div className="phase1-fact-grid"><section className="phase1-fact-box"><h3>Known</h3><TextList values={finding.known} empty="No confirmed facts were returned." /></section><section className="phase1-fact-box"><h3>All unknowns</h3><TextList values={finding.unknown} empty="No unresolved unknowns were returned." /></section><section className="phase1-fact-box"><h3>What would change the decision</h3><TextList values={finding.whatChangesDecision} empty="No additional decision factors were returned." /></section></div>
            {finding.missingInformation.length > 0 && <><h3>Missing information</h3><TextList values={finding.missingInformation} empty="No missing information was returned." /></>}
            {finding.fieldKnowledge && <section><div className="phase1-inline-label"><h3>Reviewer field knowledge</h3>{!isFixture && <button type="button" onClick={() => beginFieldEdit('field_knowledge')}>Edit</button>}</div><p>{finding.fieldKnowledge}</p></section>}
            {editingField === 'field_knowledge' && <div className="phase1-inline-editor"><label>Attributed field knowledge<textarea value={fieldKnowledge} onChange={(event) => setFieldKnowledge(event.target.value)} /></label><InlineSaveControls /></div>}
            {finding.weather && <section className="phase1-context-panel"><h3>Environmental context</h3><p>{finding.weather.text}</p>{finding.weather.provider && <div className="phase1-weather-source"><strong>Source: {finding.weather.provider}</strong>{finding.weather.requestedWindow && <span>Observation window: {finding.weather.requestedWindow}</span>}{finding.weather.location && <span>Location: {finding.weather.location}</span>}{finding.weather.retrievedAt && <span>Retrieved: {finding.weather.retrievedAt.slice(0, 10)}</span>}{finding.weather.sourceUrl && <a href={finding.weather.sourceUrl} target="_blank" rel="noreferrer">View source</a>}</div>}{finding.weather.failureReason && <p className="phase1-quiet-state">Lookup reason: {finding.weather.failureReason}</p>}</section>}
            <h3>Source context</h3><p>{finding.observation}</p><TextList values={finding.evidenceReferences} empty="No human-readable evidence references were returned." />
            <h3>Review routing</h3><TextList values={finding.reviewReasons.map((value) => value.replaceAll('_', ' '))} empty="Ready for routine review." />
            {finding.reviewDecision.action && <p className="phase1-recorded-review">Recorded {finding.reviewDecision.action.replaceAll('_', ' ')}{finding.reviewDecision.reviewedAt ? ` on ${new Date(finding.reviewDecision.reviewedAt).toLocaleDateString()}` : ''}.</p>}
          </details>
          {!isFixture && <section className="phase1-review-panel phase1-review-controls">
            <p className="phase1-kicker">Review action</p>
            <div className="phase1-review-buttons">
              <button type="button" className="phase1-review-approve" disabled={reviewing} onClick={() => onReview('approve', { fieldsApproved: ['title', 'interpretation', 'known', 'unknown', 'affected_location', 'next_step', 'rationale', 'likely_trade'] })}>{reviewing ? 'Saving…' : 'Approve & Next'}</button>
              <button type="button" onClick={() => { setEditingField(null); setEditingPricePathId(null); setReasonCategory('Missing Evidence'); setReasonNote(''); setReviewAction('needs_more_info') }}>Needs Info</button>
              <button type="button" onClick={() => { setEditingField(null); setEditingPricePathId(null); setReasonCategory('Other'); setReasonNote(''); setReviewAction('reject') }}>Reject</button>
            </div>
            {editingPricePath && <fieldset className="phase1-price-correction"><legend>Adjust price · {editingPricePath.label}</legend><label>Low<input type="number" min="0" value={priceLow} onChange={(event) => setPriceLow(event.target.value)} /></label><label>High<input type="number" min="0" value={priceHigh} onChange={(event) => setPriceHigh(event.target.value)} /></label><label>Range status<select value={priceConfidence} onChange={(event) => setPriceConfidence(event.target.value)}><option value="broad_preliminary">Broad Preliminary</option><option value="moderate_confidence">Moderate Confidence</option><option value="field_supported">Field-Supported</option></select></label><label>Geography<input value={priceGeography} onChange={(event) => setPriceGeography(event.target.value)} placeholder="ZIP, city, metro, county, state, regional, or national" /></label><label>Source basis<select value={priceSourceType} onChange={(event) => setPriceSourceType(event.target.value as 'external_sources' | 'reviewer_professional_judgment')}><option value="external_sources">Selected external sources</option><option value="reviewer_professional_judgment">Reviewer / Professional Judgment</option></select></label>{priceSourceType === 'external_sources' && <div className="phase1-source-selection"><strong>Supporting sources</strong>{editingPricePath.sources.map((source) => <label key={source.id}><input type="checkbox" checked={selectedPriceSourceIds.includes(source.id)} onChange={(event) => setSelectedPriceSourceIds((current) => event.target.checked ? [...new Set([...current, source.id])] : current.filter((id) => id !== source.id))} />{source.label}</label>)}</div>}<label>Assumptions, one per line<textarea value={priceAssumptions} onChange={(event) => setPriceAssumptions(event.target.value)} /></label><label>Major exclusions, one per line<textarea value={priceExclusions} onChange={(event) => setPriceExclusions(event.target.value)} /></label><label>Evidence state<select value={priceEvidenceState} onChange={(event) => setPriceEvidenceState(event.target.value)}><option value="inspection_report_only">Inspection report only</option><option value="supplemental_evidence">Supplemental evidence</option><option value="field_verified">Field verified</option></select></label></fieldset>}
            {reviewAction && reviewAction !== 'approve' && !editingField && <div className="phase1-review-reason-picker"><span>Reason</span><div>{['Interpretation', 'Price', 'Missing Evidence', 'Location', 'Scope', 'Source', 'Other'].map((option) => <button className={reasonCategory === option ? 'is-active' : ''} type="button" onClick={() => setReasonCategory(option)} key={option}>{option}</button>)}</div><label><span>Note <small>Optional</small></span><textarea value={reasonNote} onChange={(event) => setReasonNote(event.target.value)} placeholder={reviewAction === 'needs_more_info' ? 'Name the exact missing fact when useful.' : 'Add context only when the category is not enough.'} /></label></div>}
            {reviewError && <p className="phase1-inline-error" role="alert">{reviewError}</p>}
            {reviewAction && reviewAction !== 'approve' && !editingField && <div className="phase1-save-row"><button type="button" onClick={cancelEdit}>Cancel</button><button className="phase1-primary phase1-submit-review" type="button" disabled={reviewing || Boolean(editingPricePath && (!priceLow || !priceHigh || !priceGeography.trim() || (priceSourceType === 'external_sources' && !selectedPriceSourceIds.length)))} onClick={submitReview}>{reviewing ? 'Saving…' : editingPricePath ? 'Save Price' : reviewAction === 'needs_more_info' ? 'Save Needs Info' : 'Save Rejection'}</button></div>}
          </section>}
      </div>
    </main>
  )
}

function ReleasedResultContent({ artifact }: { artifact: Phase1ExperienceViewModel }) {
  return <>
    <section className="phase1-decision-overview" aria-labelledby="released-overview">
      <div className="phase1-section-heading"><h2 id="released-overview">Whole-property overview</h2><span>{artifact.overview.findingsWithSourcedPaths} with sourced paths</span></div>
      {artifact.transactionPerspective !== 'Not Stated' && <p className="phase1-transaction-context"><strong>Transaction perspective</strong>{artifact.transactionPerspective}</p>}
      <div className="phase1-overview-grid">
        <div><h3>Major categories</h3><ul>{artifact.overview.majorCategories.map((category) => <li key={category.label}><span>{category.label}</span><strong>{category.findingCount}</strong></li>)}</ul></div>
        <div><h3>Likely upcoming decisions</h3><TextList values={artifact.overview.decisionFactors.slice(0, 6)} empty="No cross-report decision factors were released." /></div>
        <div><h3>Immediate tasks</h3><TextList values={artifact.overview.immediateNextTasks.slice(0, 5)} empty="No immediate tasks were released." /></div>
      </div>
      <p className="phase1-cost-rule"><strong>Cost context</strong>{artifact.overview.aggregateCostRule}</p>
    </section>
    {artifact.findings.map((finding) => <article className={`phase1-agent-finding is-${finding.releaseDisposition || 'approved'}`} key={finding.id}>
      <p className="phase1-kicker">{finding.releaseDisposition === 'needs_more_information' ? 'Needs more information' : finding.releaseDisposition === 'rejected' ? 'Rejected during review' : finding.category}</p>
      <h2>{finding.title}</h2>
      <p><strong>What was reported</strong>{finding.sourceEvidence.excerpt}</p>
      <p className="phase1-agent-source"><strong>Source</strong>{finding.sourceEvidence.documentName}{finding.sourceEvidence.page ? ` · Page ${finding.sourceEvidence.page}` : ''}{finding.sourceEvidence.itemNumber ? ` · Item ${finding.sourceEvidence.itemNumber}` : ''}{finding.sourceEvidence.section ? ` · ${finding.sourceEvidence.section}` : ''}</p>
      <p><strong>Shelter Prep interpretation</strong>{finding.interpretation}</p>
      <ResearchSources sources={finding.researchSources} />
      {finding.releaseDisposition === 'approved' && <RepairPathList finding={finding} />}
      {artifact.transactionPerspective !== 'Not Stated' && <><p><strong>{artifact.transactionPerspective} context</strong></p><TextList values={finding.transactionConsiderations} empty="No transaction-specific considerations were released." /></>}
      <div className="phase1-released-facts"><section><p><strong>What we know</strong></p><TextList values={finding.known} empty="No reviewed known facts were released." /></section><section><p><strong>What is still unknown</strong></p><TextList values={finding.unknown} empty="No reviewed unknowns were released." /></section><section><p><strong>What changes the decision</strong></p><TextList values={finding.whatChangesDecision} empty="No additional decision factors were released." /></section></div>
      <div className="phase1-released-next"><p><strong>Next task</strong>{finding.nextStep}</p><p><strong>Why</strong>{finding.whyNextStep}</p></div>
      <small>Reviewed by Shelter Prep</small>
    </article>)}
  </>
}

function briefMoney(value: number | null) {
  return value === null ? 'Not yet sourced' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

function BriefPath({ path }: { path: Phase1BriefPath }) {
  const price = path.status === 'priced' ? `${briefMoney(path.low)}–${briefMoney(path.high)}${path.unit !== 'project' ? ` / ${path.unit}` : ''}` : 'Not yet sourced'
  return <div className="phase1-brief-path">
    <div><strong>{path.label}</strong><span>{price}</span></div>
    <small>Confidence: {path.confidence} · Pricing sources: {path.sourceCount}</small>
    {(path.sources.length > 0 || path.assumptions.length > 0 || path.exclusions.length > 0) && <details><summary>View pricing sources</summary><div className="phase1-brief-sources">{path.sources.map((source) => <p key={source.id}><strong>{source.name}</strong>{source.geography && <> · {source.geography}</>}{source.date && <> · {source.date}</>}{source.scopeBasis && <> · {source.scopeBasis}</>}{source.url && <> · <a href={source.url} target="_blank" rel="noreferrer">View source</a></>}</p>)}{path.assumptions.length > 0 && <p><strong>Assumptions</strong>{path.assumptions.join('; ')}</p>}{path.exclusions.length > 0 && <p><strong>Major exclusions</strong>{path.exclusions.join('; ')}</p>}</div></details>}
  </div>
}

function BriefFinding({ finding, requestId }: { finding: Phase1BriefFinding; requestId?: string | null }) {
  return <article className={`phase1-brief-finding is-${finding.status}`} id={`finding-${finding.id}`}>
    <div className="phase1-brief-status"><span>{finding.statusLabel}</span>{finding.priorityLabels.map((label) => <span key={label}>{label}</span>)}<small>{finding.trade}</small></div>
    <h3>{finding.title}</h3>
    <div className="phase1-brief-copy"><p><strong>What was found</strong>{finding.found}</p><p><strong>Shelter Prep view</strong>{finding.view}</p></div>
    {finding.paths.length > 0 && finding.status !== 'rejected' && <section className="phase1-brief-paths"><h4>Likely paths</h4>{finding.paths.map((path) => <BriefPath path={path} key={path.id} />)}</section>}
    {finding.keyUnknowns.length > 0 && <p className="phase1-brief-unknown"><strong>Key unknown</strong>{finding.keyUnknowns.join(' ')}</p>}
    <section className="phase1-brief-next"><span>Next step</span><strong>{finding.nextStep}</strong><small><b>Why this matters</b>{finding.why}</small></section>
    <div className="phase1-brief-source-row"><span>{finding.inspectionSource.document}{finding.inspectionSource.page ? ` · Page ${finding.inspectionSource.page}` : ''}{finding.inspectionSource.item ? ` · Item ${finding.inspectionSource.item}` : ''}{requestId && <button type="button" onClick={() => void openPhase1SourceDocument(requestId, finding.inspectionSource.page)}>View source</button>}</span><span>Research sources: {finding.researchSources.length}</span></div>
    <details className="phase1-brief-details"><summary>Technical details and sources</summary><div><h4>Inspection source text</h4><p>{finding.technicalDetails.fullSourceText}</p><h4>Reviewed interpretation</h4><p>{finding.technicalDetails.fullInterpretation}</p>{finding.researchSources.length > 0 && <><h4>Research sources</h4>{finding.researchSources.map((source) => <p key={source.id}><strong>{source.name}</strong>{source.geography && <> · {source.geography}</>}{source.date && <> · {source.date}</>}{source.scopeBasis && <> · {source.scopeBasis}</>}{source.url && <> · <a href={source.url} target="_blank" rel="noreferrer">View source</a></>}</p>)}</>}<h4>Known</h4><TextList values={finding.technicalDetails.known} empty="No additional known detail." /><h4>Unknown</h4><TextList values={finding.technicalDetails.unknowns} empty="No additional unknown detail." /></div></details>
  </article>
}

function DecisionBriefContent({ brief, requestId }: { brief: Phase1DecisionBrief; requestId?: string | null }) {
  const summary = brief.summary
  return <div className="phase1-decision-brief">
    <section className="phase1-brief-summary" aria-label="Reviewed report summary"><div><strong>{summary.total}</strong><span>Findings</span></div><div><strong>{summary.approved}</strong><span>Approved</span></div><div><strong>{summary.rejected}</strong><span>Rejected</span></div><div><strong>{summary.needsInfo}</strong><span>Need more information</span></div></section>
    <section className="phase1-brief-overview">
      <div><h2>Key decisions</h2>{brief.overview.keyDecisions.slice(0, 6).map((item) => <p key={item.findingId}><strong>{item.title}</strong>{item.decision}</p>)}</div>
      <div><h2>Immediate follow-up</h2>{brief.overview.immediateFollowUp.slice(0, 5).map((item) => <p key={item.findingId}><strong>{item.title}</strong>{item.task}</p>)}</div>
      <div><h2>Major trades</h2><ul>{brief.overview.majorTrades.map((item) => <li key={item.trade}><span>{item.trade}</span><strong>{item.count}</strong></li>)}</ul></div>
      <div><h2>Largest cost uncertainties</h2>{brief.overview.largestCostUncertainties.map((item) => <p key={`${item.findingId}-${item.path}`}><strong>{item.title}</strong>{item.status === 'blocked' ? 'Not yet sourced' : `${briefMoney(item.low)}–${briefMoney(item.high)}`} · {item.path}</p>)}</div>
    </section>
    {brief.groups.map((group) => <section className="phase1-brief-group" key={group.label}><header><h2>{group.label}</h2><span>{group.findings.length} {group.findings.length === 1 ? 'finding' : 'findings'}</span></header>{group.findings.map((finding) => <BriefFinding finding={finding} requestId={requestId} key={finding.id} />)}</section>)}
    <details className="phase1-report-caveats"><summary>Report notes</summary>{brief.universalCaveats.map((value) => <p key={value}>{value}</p>)}</details>
  </div>
}

function LocalProfessionals({ groups }: { groups: Array<{ trade: string; professionals: Phase1LocalProfessional[] }> }) {
  if (!groups.length) return null
  return <section className="phase1-decision-overview"><div className="phase1-section-heading"><h2>Local pros to consider</h2></div><p>Selected from public business information based on trade, location, rating, review volume, and recency. Shelter Prep has not independently verified availability, pricing, licensing, or workmanship unless specifically noted.</p>{groups.map((group) => <div key={group.trade}><h3>{group.trade}</h3>{group.professionals.map((professional) => <p key={professional.providerId}><strong>{professional.name}</strong><br />{professional.rating !== null ? `${professional.rating} / 5` : 'Rating not returned'}{professional.reviewCount !== null ? ` · ${professional.reviewCount} reviews` : ''}<br />{professional.address || 'Service area not returned'}<br />Source: {professional.source}{professional.sourceUrl && <> · <a href={professional.sourceUrl} target="_blank" rel="noreferrer">View Business</a></>}</p>)}</div>)}</section>
}

function AgentView({ artifact }: { artifact: Phase1ExperienceViewModel }) {
  if (!artifact.findings.length) return <main className="phase1-main phase1-agent-view"><p className="phase1-kicker">Under review</p><h1>{artifact.totalFindingCount} repair items identified</h1><p className="phase1-lede">Shelter Prep is reviewing the findings before release.</p></main>
  return <main className="phase1-main phase1-agent-view">
    <p className="phase1-kicker">Reviewed by Shelter Prep</p>
    <h1>{artifact.findings.length} reviewed repair items.</h1>
    <p className="phase1-lede">The reviewed result keeps the evidence, realistic response paths, cost context, and next decisions together.</p>
    <ReleasedResultContent artifact={artifact} />
  </main>
}

function DurableReportView({ reportId }: { reportId: string }) {
  const [artifact, setArtifact] = useState<Phase1ExperienceViewModel | null>(null)
  const [decisionBrief, setDecisionBrief] = useState<Phase1DecisionBrief | null>(null)
  const [version, setVersion] = useState<number | null>(null)
  const [requestId, setRequestId] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const [releasing, setReleasing] = useState(false)
  const [error, setError] = useState('')
  const [professionalGroups, setProfessionalGroups] = useState<Array<{ trade: string; professionals: Phase1LocalProfessional[] }>>([])
  useEffect(() => {
    void loadPhase1ReviewedReport(reportId).then((report) => {
      setArtifact(adaptPhase1ReasoningArtifact(report.reviewed_artifact.artifact, { mode: 'live', audience: 'agent' }))
      setDecisionBrief(report.reviewed_artifact.decisionBrief || null)
      setVersion(report.report_version)
      setRequestId(report.processing_request_id)
      setStatus(report.report_status)
      setProfessionalGroups(report.reviewed_artifact.localProfessionals?.groups || [])
    }).catch((reason) => setError(reason instanceof Error ? reason.message : 'The reviewed report is unavailable.'))
  }, [reportId])
  if (error) return <main className="phase1-main"><p className="phase1-inline-error" role="alert">{error}</p></main>
  if (!artifact) return <main className="phase1-main"><p className="phase1-lede">Loading reviewed report…</p></main>
  async function release() {
    if (!requestId) return
    setReleasing(true)
    setError('')
    try {
      await releasePhase1ReviewedReport(requestId, reportId)
      setStatus('released')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The reviewed report could not be released.')
    } finally {
      setReleasing(false)
    }
  }
  return <main className="phase1-main phase1-agent-view"><p className="phase1-kicker">Shelter Prep</p><h1>Reviewed Property Report</h1><p className="phase1-report-address">{artifact.propertyAddress}</p><p className="phase1-report-meta">Version {version} · Human Reviewed</p><div className="phase1-report-actions"><button type="button" onClick={() => void openPhase1ReviewedReportPdf(reportId)}>View PDF</button>{status === 'draft' && requestId && <button className="phase1-primary" type="button" disabled={releasing} onClick={() => void release()}>{releasing ? 'Releasing…' : 'Release Report'}</button>}{status === 'released' && <span className="phase1-status">Released</span>}</div>{error && <p className="phase1-inline-error" role="alert">{error}</p>}{decisionBrief ? <DecisionBriefContent brief={decisionBrief} requestId={requestId} /> : <ReleasedResultContent artifact={artifact} />}<LocalProfessionals groups={professionalGroups} /></main>
}

function ReviewedReportPreview({ artifact, brief, requestId, summary, recipient, professionalGroups, busy, error, onBack, onViewPdf, onRelease }: { artifact: Phase1ExperienceViewModel; brief: Phase1DecisionBrief | null; requestId: string | null; summary: Phase1ReviewSummary; recipient: string; professionalGroups: Array<{ trade: string; professionals: Phase1LocalProfessional[] }>; busy: boolean; error: string; onBack: () => void; onViewPdf: () => void; onRelease: () => void }) {
  return <main className="phase1-main phase1-report-preview"><p className="phase1-kicker">Shelter Prep</p><h1>Reviewed Property Report</h1><p className="phase1-report-address">{artifact.propertyAddress}</p><p className="phase1-lede">Preview for {recipient || 'the stored recipient'}. Nothing has been sent.</p>
    {brief ? <DecisionBriefContent brief={brief} requestId={requestId} /> : <><div className="phase1-review-summary"><div><span>Approved</span><strong>{summary.approved}</strong></div><div><span>Needs info</span><strong>{summary.needsInfo}</strong></div><div><span>Rejected</span><strong>{summary.rejected}</strong></div></div><ReleasedResultContent artifact={artifact} /></>}
    <LocalProfessionals groups={professionalGroups} />
    {error && <p className="phase1-inline-error" role="alert">{error}</p>}<div className="phase1-actions"><button type="button" className="phase1-text-action" onClick={onBack}>Back to Review</button><button type="button" onClick={onViewPdf}>View PDF</button><button type="button" className="phase1-primary" disabled={busy} onClick={onRelease}>{busy ? 'Releasing…' : 'Release Report'}</button></div>
  </main>
}

function ReportReleased({ address, submission, busy, error, onSend }: { address: string | null; submission: Phase1SubmissionMetadata | null; busy: boolean; error: string; onSend: () => void }) {
  const sent = submission?.delivery?.delivery_status === 'sent'
  return <main className="phase1-main phase1-report-released"><p className="phase1-kicker">Report released</p><h1>{address}</h1><p className="phase1-lede">The reviewed report is locked to this request and ready for its stored recipient.</p><section className="phase1-release-status"><p><strong>Recipient</strong><br />{submission?.deliveryRecipientEmail || 'Recipient unavailable'}</p><p><strong>Released</strong><br />{submission?.releasedAt ? new Date(submission.releasedAt).toLocaleString() : 'Just now'}</p>{sent && <p><strong>Sent to</strong><br />{submission?.delivery?.recipient}<br /><small>Sent at {submission?.delivery?.sent_at ? new Date(submission.delivery.sent_at).toLocaleString() : 'recorded by the delivery provider'}</small></p>}</section>{error && <p className="phase1-inline-error" role="alert">{error}</p>}{!sent && <div className="phase1-actions"><button className="phase1-primary" type="button" disabled={busy} onClick={onSend}>{busy ? 'Sending…' : 'Send Reviewed Result'}</button></div>}</main>
}

function AgentSubmissionStatus({ count }: { count: number }) {
  return <main className="phase1-main phase1-agent-view"><p className="phase1-kicker">Under review</p><h1>{count} repair {count === 1 ? 'item' : 'items'} identified</h1><p className="phase1-lede">Shelter Prep is reviewing the findings before release.</p></main>
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
  const storedProperty = useMemo(() => fixtureMode || /^\/properties\/new\/?$/.test(window.location.pathname) ? null : readPhase1PropertyContext(window.sessionStorage), [fixtureMode])
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(fixtureMode)
  const [identity, setIdentity] = useState<Phase1Identity | null>(null)
  const [landingReady, setLandingReady] = useState(fixtureMode)
  const [route, setRoute] = useState(window.location.pathname + window.location.search)
  const [step, setStep] = useState<Step>('property')
  const [address, setAddress] = useState(storedProperty?.address || '')
  const [propertyContext, setPropertyContext] = useState<Phase1PropertyContext | null>(storedProperty)
  const [propertyResolving, setPropertyResolving] = useState(false)
  const [propertyError, setPropertyError] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [note, setNote] = useState('')
  const [evidenceSubmitting, setEvidenceSubmitting] = useState(false)
  const [evidenceError, setEvidenceError] = useState('')
  const [uploadedEvidenceNames, setUploadedEvidenceNames] = useState<string[]>([])
  const [uploadedEvidenceReferences, setUploadedEvidenceReferences] = useState<EvidenceReference[]>([])
  const [submission, setSubmission] = useState<Phase1SubmissionMetadata | null>(null)
  const [recipientName, setRecipientName] = useState('')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [submissionError, setSubmissionError] = useState('')
  const [submissionSubmitting, setSubmissionSubmitting] = useState(false)
  const [processingState, setProcessingState] = useState<ProcessingState>('idle')
  const [processingError, setProcessingError] = useState('')
  const [artifact, setArtifact] = useState<Phase1ExperienceViewModel | null>(null)
  const [agentSubmissionCount, setAgentSubmissionCount] = useState<number | null>(null)
  const [findingIndex, setFindingIndex] = useState(0)
  const reviewRequestId = useMemo(() => fixtureMode ? null : reviewRequestFromLocation(), [fixtureMode, route])
  const reviewedReportIdFromRoute = useMemo(() => fixtureMode ? null : reviewedReportFromLocation(), [fixtureMode, route])
  const propertyReportsIdFromRoute = useMemo(() => fixtureMode ? null : propertyReportsFromLocation(), [fixtureMode, route])
  const submissionRequestId = useMemo(() => fixtureMode ? null : submissionRequestFromLocation(), [fixtureMode, route])
  const audience = useMemo(() => audienceFromLocation(), [route])
  const [resolvedAudience, setResolvedAudience] = useState<'reviewer' | 'agent'>(audience)
  const reviewQueue = useMemo(() => !fixtureMode && isReviewQueueLocation(), [fixtureMode, route])
  const [activeRequestId, setActiveRequestId] = useState<string | null>(reviewRequestId)
  const [reviewing, setReviewing] = useState(false)
  const [reviewError, setReviewError] = useState('')
  const [reportSummary, setReportSummary] = useState<Phase1ReviewSummary | null>(null)
  const [reportBusy, setReportBusy] = useState(false)
  const [reportError, setReportError] = useState('')
  const [reportProfessionalGroups, setReportProfessionalGroups] = useState<Array<{ trade: string; professionals: Phase1LocalProfessional[] }>>([])
  const [reportDecisionBrief, setReportDecisionBrief] = useState<Phase1DecisionBrief | null>(null)
  const [reviewedReportId, setReviewedReportId] = useState<string | null>(null)
  const reviewLoadStarted = useRef<string | null>(null)
  const evidenceCount = useMemo(() => files.length + (note.trim() ? 1 : 0), [files, note])
  const finding = artifact?.findings[findingIndex] ?? null

  function navigate(path: string) {
    window.history.pushState({}, '', path)
    if (path === '/properties/new') {
      setStep('property')
      setAddress('')
      setPropertyContext(null)
      setFiles([])
      setNote('')
      setArtifact(null)
      setSubmission(null)
      setActiveRequestId(null)
      setUploadedEvidenceNames([])
      setUploadedEvidenceReferences([])
      clearPhase1PropertyContext(window.sessionStorage)
    }
    setRoute(window.location.pathname + window.location.search)
  }

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
    const onPopState = () => setRoute(window.location.pathname + window.location.search)
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    if (fixtureMode || !session) return
    let active = true
    setLandingReady(false)
    void loadPhase1Identity().then(async (profile) => {
      if (!active) return
      setIdentity(profile)
      setRecipientEmail((current) => current || profile.email || session.user.email || '')
      const protectedAdminRoute = /^\/(dashboard|review-queue)\/?$/.test(window.location.pathname)
      if (protectedAdminRoute && !profile.isReviewer) {
        const properties = await loadPhase1MyProperties()
        if (!active) return
        navigate(properties.length ? '/properties' : '/properties/new')
      } else if (window.location.pathname === '/' || window.location.pathname === '/login') {
        if (profile.isReviewer) navigate('/dashboard')
        else {
          const properties = await loadPhase1MyProperties()
          if (!active) return
          navigate(properties.length ? '/properties' : '/properties/new')
        }
      }
    }).catch(() => setIdentity(null)).finally(() => { if (active) setLandingReady(true) })
    return () => { active = false }
  }, [fixtureMode, session])

  useEffect(() => {
    if (fixtureMode || !authReady) return
    if (!session || (propertyContext && !propertyContextBelongsToUser(propertyContext, session.user.id))) {
      setPropertyContext(null)
      setAddress('')
      setFiles([])
      setNote('')
      setArtifact(null)
      setIdentity(null)
      setStep('property')
      clearPhase1PropertyContext(window.sessionStorage)
    }
  }, [authReady, fixtureMode, propertyContext, session])

  useEffect(() => {
    if (fixtureMode || !session || !reviewRequestId || reviewLoadStarted.current === reviewRequestId) return
    reviewLoadStarted.current = reviewRequestId
    setStep('processing')
    setProcessingState('processing')
    setProcessingError('')
    void loadPhase1ProcessingRequest(reviewRequestId).then((request) => {
      if (request.processingStatus === 'failed') {
        setProcessingState('failed')
        setProcessingError(request.error || 'Processing failed. Review the request before retrying.')
        return
      }
      if (request.processingStatus === 'under_review') {
        setAgentSubmissionCount(request.totalFindingCount || 0)
        setProcessingState('under_review')
        return
      }
      if (!['completed', 'ready'].includes(request.processingStatus) || !request.artifact) {
        setProcessingState(request.processingStatus)
        return
      }
      const responseAudience = audience === 'agent' ? 'agent' : request.audience || audience
      setResolvedAudience(responseAudience)
      const result = adaptPhase1ReasoningArtifact(request.artifact, { mode: 'live', audience: responseAudience })
      const reviewAddress = result.propertyAddress || 'Property review'
      const context = { id: request.propertyId, address: reviewAddress, userId: session.user.id }
      setAddress(reviewAddress)
      setPropertyContext(context)
      writePhase1PropertyContext(window.sessionStorage, context)
      setArtifact(result)
      setSubmission(request.submission || null)
      setActiveRequestId(request.id)
      const requestedFinding = findingFromLocation() || request.submission?.lastViewedObservationId
      const requestedIndex = requestedFinding ? result.findings.findIndex((item) => item.id === requestedFinding) : -1
      const unresolvedIndex = result.findings.findIndex((item) => ['ai_draft', 'needs_review', 'needs_human_review'].includes(item.reviewDecision.status))
      const resume = new URLSearchParams(window.location.search).get('resume') === '1' || Boolean(requestedFinding)
      setFindingIndex(requestedIndex >= 0 ? requestedIndex : unresolvedIndex >= 0 ? unresolvedIndex : 0)
      setProcessingState('completed')
      setStep(responseAudience === 'reviewer' && request.submission?.releasedAt ? 'report_released' : responseAudience === 'reviewer' && resume ? 'finding' : 'overview')
    }).catch((error) => {
      setProcessingState('failed')
      setProcessingError(error instanceof Error ? error.message : 'This review request is not available.')
    })
  }, [audience, fixtureMode, reviewRequestId, session])

  useEffect(() => {
    if (fixtureMode || !session || !submissionRequestId || reviewRequestId) return
    let active = true
    void loadPhase1ProcessingRequest(submissionRequestId).then((request) => {
      if (!active || !request.submission) return
      setActiveRequestId(request.id)
      setSubmission(request.submission)
      setNote(request.submission.note || '')
      setUploadedEvidenceNames(request.submission.evidence.map((item) => item.name))
      setUploadedEvidenceReferences(request.submission.evidence.map((item) => ({ id: item.id, sourceFileId: item.sourceFileId })))
      setRecipientName(request.submission.deliveryRecipientName || '')
      setRecipientEmail(request.submission.deliveryRecipientEmail || session.user.email || '')
      const propertyAddress = request.submission.propertyAddress || storedProperty?.address || 'Property submission'
      const context = { id: request.propertyId, address: propertyAddress, userId: session.user.id }
      setAddress(propertyAddress)
      setPropertyContext(context)
      writePhase1PropertyContext(window.sessionStorage, context)
      setStep(request.processingStatus === 'draft' ? 'submission_review' : 'submitted')
    }).catch((error) => setSubmissionError(error instanceof Error ? error.message : 'This submission is not available.'))
    return () => { active = false }
  }, [fixtureMode, reviewRequestId, session, storedProperty?.address, submissionRequestId])

  useEffect(() => {
    if (fixtureMode || !identity?.isReviewer || step !== 'finding' || !activeRequestId || !finding) return
    void savePhase1ReviewPosition(activeRequestId, finding.id).catch(() => undefined)
  }, [activeRequestId, finding, fixtureMode, identity?.isReviewer, step])

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
    setProcessingState('idle')
    setProcessingError('')
    setEvidenceError('')
    setEvidenceSubmitting(true)
    try {
      if (fixtureMode) setStep('processing')
      let result: Phase1ExperienceViewModel
      if (fixtureMode) {
        result = await loadPhase1ReasoningArtifact({ mode: 'fixture' })
      } else {
        let requestId = activeRequestId
        if (activeRequestId && submission?.workflowState === 'draft') {
          let references = uploadedEvidenceReferences
          if (files.length) {
            const upload = await uploadPhase1Evidence({ propertyId: propertyContext?.id || '', files })
            references = [...uploadedEvidenceReferences, ...upload.evidenceReferences]
          }
          await updatePhase1SubmissionDraft(activeRequestId, {
            propertyId: propertyContext?.id || '',
            evidenceReferences: references,
            note,
            deliveryRecipient: { name: recipientName, email: recipientEmail || session?.user.email || '' },
          })
        } else {
          const upload = await uploadPhase1Evidence({ propertyId: propertyContext?.id || '', files })
          setProcessingState('uploaded')
          const draft = await createPhase1SubmissionDraft({
            propertyId: propertyContext?.id || '',
            evidenceReferences: upload.evidenceReferences,
            note,
            deliveryRecipient: { name: recipientName, email: recipientEmail || session?.user.email || '' },
          })
          requestId = draft.id
          setActiveRequestId(draft.id)
        }
        if (!requestId) throw new Error('Submission draft persistence did not return a request identifier.')
        const persisted = await loadPhase1ProcessingRequest(requestId)
        setSubmission(persisted.submission || null)
        setUploadedEvidenceNames(persisted.submission?.evidence.map((item) => item.name) || [])
        setUploadedEvidenceReferences(persisted.submission?.evidence.map((item) => ({ id: item.id, sourceFileId: item.sourceFileId })) || [])
        setFiles([])
        setRecipientName(persisted.submission?.deliveryRecipientName || '')
        setRecipientEmail(persisted.submission?.deliveryRecipientEmail || session?.user.email || '')
        window.history.replaceState({}, '', `/submissions/${encodeURIComponent(requestId)}/review`)
        setRoute(window.location.pathname + window.location.search)
        setStep('submission_review')
        return
      }
      setArtifact(result)
      setFindingIndex(0)
      setProcessingState('completed')
    } catch (error) {
      setArtifact(null)
      const message = error instanceof Error ? error.message : 'Processing failed. The selected evidence was not replaced with fixture data.'
      if (fixtureMode) {
        setStep('processing')
        setProcessingState('failed')
        setProcessingError(message)
      } else {
        setStep('evidence')
        setProcessingState('idle')
        setEvidenceError(message)
      }
    } finally {
      setEvidenceSubmitting(false)
    }
  }

  async function submitReviewedSubmission() {
    if (!activeRequestId) return
    setSubmissionSubmitting(true)
    setSubmissionError('')
    try {
      const request = await submitPhase1SubmissionDraft(activeRequestId, { name: recipientName, email: recipientEmail })
      setProcessingState(request.processingStatus)
      const persisted = await loadPhase1ProcessingRequest(activeRequestId)
      setSubmission(persisted.submission || submission)
      window.history.replaceState({}, '', `/submissions/${encodeURIComponent(activeRequestId)}`)
      setRoute(window.location.pathname + window.location.search)
      setStep('submitted')
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : 'The submission could not be started.')
    } finally {
      setSubmissionSubmitting(false)
    }
  }

  async function reviewFinding(action: Phase1ReviewAction, payload: { corrections?: Record<string, unknown>; reason?: string; fieldsApproved?: string[] }) {
    if (!activeRequestId || !finding) return
    const reviewedFindingId = finding.id
    const reviewedFindingIndex = findingIndex
    let saved = false
    setReviewing(true)
    setReviewError('')
    try {
      const result = await reviewPhase1Finding({
        requestId: activeRequestId,
        observationId: reviewedFindingId,
        action,
        expectedReviewEventId: finding.reviewDecision.eventId,
        ...payload,
      })
      saved = true
      const request = await loadPhase1ProcessingRequest(activeRequestId)
      if (!request.artifact) throw new Error('The reviewed artifact could not be reloaded.')
      const refreshed = adaptPhase1ReasoningArtifact(request.artifact, { mode: 'live', audience })
      const refreshedIndex = refreshed.findings.findIndex((item) => item.id === reviewedFindingId)
      const persistedFinding = refreshed.findings[refreshedIndex]
      if (!persistedFinding || persistedFinding.reviewDecision.eventId !== result.eventId) {
        throw new Error('The saved review could not be verified against the current finding.')
      }
      setArtifact(refreshed)
      if (action === 'edit') {
        setFindingIndex(refreshedIndex >= 0 ? refreshedIndex : reviewedFindingIndex)
        setStep('finding')
        return
      }
      const unresolved = (item: Phase1FindingViewModel) => !isTerminalReview(item)
      const orderedIndexes = refreshed.findings.map((_item, index) => index)
      const nextIndex = [...orderedIndexes.slice(reviewedFindingIndex + 1), ...orderedIndexes.slice(0, reviewedFindingIndex)]
        .find((index) => unresolved(refreshed.findings[index]))
      if (nextIndex === undefined) {
        setFindingIndex(refreshedIndex >= 0 ? refreshedIndex : 0)
        setStep('overview')
        window.history.replaceState({}, '', `/properties/${encodeURIComponent(propertyContext?.id || 'phase1')}/review?request=${encodeURIComponent(activeRequestId)}`)
      } else {
        setFindingIndex(nextIndex)
        setStep('finding')
        window.history.replaceState({}, '', `/properties/${encodeURIComponent(propertyContext?.id || 'phase1')}/review?request=${encodeURIComponent(activeRequestId)}&finding=${encodeURIComponent(refreshed.findings[nextIndex].id)}`)
      }
      setRoute(window.location.pathname + window.location.search)
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'The review decision could not be saved.'
      setReviewError(saved ? `Changes were saved, but the refreshed finding could not be verified. ${detail}` : `Changes were not saved. ${detail}`)
    } finally {
      setReviewing(false)
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

  function openFinding(index: number) {
    if (!artifact) return
    setFindingIndex(index)
    setStep('finding')
    if (activeRequestId && artifact.findings[index]) {
      window.history.replaceState({}, '', `/properties/${encodeURIComponent(propertyContext?.id || 'phase1')}/review?request=${encodeURIComponent(activeRequestId)}&finding=${encodeURIComponent(artifact.findings[index].id)}`)
      setRoute(window.location.pathname + window.location.search)
    }
  }

  async function generateReviewedReport() {
    if (!activeRequestId) return
    setReportBusy(true)
    setReportError('')
    try {
      const preview = await previewPhase1ReviewedReport(activeRequestId)
      const reviewedArtifact = adaptPhase1ReasoningArtifact(preview.artifact, { mode: 'live', audience: 'agent' })
      setArtifact(reviewedArtifact)
      setSubmission(preview.submission)
      setReportSummary(preview.summary)
      setReportDecisionBrief(preview.report?.decisionBrief || null)
      setReportProfessionalGroups(preview.report?.localProfessionals.groups || [])
      setReviewedReportId(preview.reportId || null)
      setStep('report_preview')
    } catch (error) {
      setReportError(error instanceof Error ? error.message : 'The reviewed report could not be generated.')
    } finally {
      setReportBusy(false)
    }
  }

  async function releaseReviewedReport() {
    if (!activeRequestId) return
    setReportBusy(true)
    setReportError('')
    try {
      if (!reviewedReportId) throw new Error('Generate the durable reviewed report before release.')
      await releasePhase1ReviewedReport(activeRequestId, reviewedReportId)
      const refreshed = await loadPhase1ProcessingRequest(activeRequestId)
      setSubmission(refreshed.submission || submission)
      setStep('report_released')
    } catch (error) {
      setReportError(error instanceof Error ? error.message : 'The reviewed report could not be released.')
    } finally {
      setReportBusy(false)
    }
  }

  async function sendReviewedResult() {
    if (!activeRequestId) return
    setReportBusy(true)
    setReportError('')
    try {
      if (!reviewedReportId) throw new Error('The released report identity is unavailable.')
      await sendPhase1ReviewedResult(activeRequestId, reviewedReportId)
      const refreshed = await loadPhase1ProcessingRequest(activeRequestId)
      setSubmission(refreshed.submission || submission)
    } catch (error) {
      setReportError(error instanceof Error ? error.message : 'The reviewed result could not be sent.')
    } finally {
      setReportBusy(false)
    }
  }

  async function signOut() {
    clearPhase1PropertyContext(window.sessionStorage)
    await supabase.auth.signOut()
  }

  if (!fixtureMode && !authReady) return <div className="phase1-shell"><main className="phase1-main phase1-sign-in"><p className="phase1-lede">Checking your session…</p></main></div>
  if (!fixtureMode && !session) return <SignInStep onSignedIn={setSession} />
  if (!fixtureMode && (!landingReady || !identity)) return <div className="phase1-shell"><main className="phase1-main phase1-sign-in"><p className="phase1-lede">Loading your workspace…</p></main></div>
  if (reviewedReportIdFromRoute) return <div className="phase1-shell"><PhaseHeader step="overview" email={session?.user.email} identity={identity} onNavigate={navigate} onSignOut={() => void signOut()} /><DurableReportView reportId={reviewedReportIdFromRoute} /></div>
  if (propertyReportsIdFromRoute) return <div className="phase1-shell"><PhaseHeader step="overview" email={session?.user.email} identity={identity} onNavigate={navigate} onSignOut={() => void signOut()} /><PropertyReports propertyId={propertyReportsIdFromRoute} onNavigate={navigate} /></div>
  if (reviewQueue && identity?.isReviewer) return <div className="phase1-shell"><PhaseHeader step="overview" email={session?.user.email} identity={identity} onNavigate={navigate} onSignOut={() => void signOut()} /><AdminDashboard onNavigate={navigate} /></div>
  if (!fixtureMode && /^\/properties\/?$/.test(window.location.pathname) && !reviewRequestId) return <div className="phase1-shell"><PhaseHeader step="property" email={session?.user.email} identity={identity} onNavigate={navigate} onSignOut={() => void signOut()} /><MyProperties onNavigate={navigate} /></div>
  if (agentSubmissionCount !== null && reviewRequestId) return <div className="phase1-shell"><PhaseHeader step="overview" email={session?.user.email} identity={identity} onNavigate={navigate} onSignOut={() => void signOut()} /><AgentSubmissionStatus count={agentSubmissionCount} /></div>
  if (resolvedAudience === 'agent' && artifact && reviewRequestId) return <div className="phase1-shell"><PhaseHeader step="overview" email={session?.user.email} identity={identity} onNavigate={navigate} onSignOut={fixtureMode ? undefined : () => void signOut()} /><AgentView artifact={artifact} /></div>

  return (
    <div className="phase1-shell">
      <PhaseHeader step={step} email={fixtureMode ? undefined : session?.user.email} identity={identity} onNavigate={fixtureMode ? undefined : navigate} onSignOut={fixtureMode ? undefined : () => void signOut()} />
      {step === 'property' && <PropertyStep address={address} resolving={propertyResolving} error={propertyError} onAddressChange={changeAddress} onContinue={() => void continueFromProperty()} />}
      {step === 'evidence' && <EvidenceStep files={files} existingEvidenceNames={submission?.workflowState === 'draft' ? uploadedEvidenceNames : []} note={note} submitting={evidenceSubmitting} error={evidenceError} onFiles={(nextFiles) => { setFiles(nextFiles); setEvidenceError('') }} onNote={setNote} onContinue={() => void organizeEvidence()} />}
      {step === 'submission_review' && <ReviewSubmissionStep address={submission?.propertyAddress || address} evidenceNames={uploadedEvidenceNames.length ? uploadedEvidenceNames : submission?.evidence.map((item) => item.name) || []} note={note} recipientName={recipientName} recipientEmail={recipientEmail} submitting={submissionSubmitting} error={submissionError} onRecipientName={setRecipientName} onRecipientEmail={setRecipientEmail} onBack={() => setStep('evidence')} onSubmit={() => void submitReviewedSubmission()} />}
      {step === 'submitted' && <SubmittedSummary address={submission?.propertyAddress || address} submission={submission} evidenceNames={uploadedEvidenceNames.length ? uploadedEvidenceNames : submission?.evidence.map((item) => item.name) || []} note={note} onNavigate={navigate} onAddEvidence={() => { setFiles([]); setNote(''); setSubmission(null); setActiveRequestId(null); setUploadedEvidenceNames([]); setUploadedEvidenceReferences([]); window.history.pushState({}, '', `/properties/${encodeURIComponent(propertyContext?.id || '')}/evidence`); setRoute(window.location.pathname); setStep('evidence') }} />}
      {step === 'processing' && <ProcessingStep state={processingState} error={processingError} onContinue={() => setStep('overview')} onBack={() => setStep('evidence')} />}
      {step === 'overview' && artifact && <OverviewStep artifact={artifact} reportBusy={reportBusy} reportError={reportError} onSelect={openFinding} onGenerateReport={() => void generateReviewedReport()} />}
      {step === 'finding' && artifact && finding && <FindingStep key={`${finding.id}-${finding.reviewDecision.reviewedAt || 'draft'}`} finding={finding} findingIndex={findingIndex} findingCount={artifact.findings.length} reviewedCount={summarizeReview(artifact).reviewed} remainingCount={summarizeReview(artifact).remaining} propertyAddress={artifact.propertyAddress} transactionPerspective={artifact.transactionPerspective} isFixture={artifact.isFixture} requestId={activeRequestId} reviewing={reviewing} reviewError={reviewError} onBack={() => setStep('overview')} onOpenProperty={() => setStep('overview')} onPrevious={() => openFinding(Math.max(0, findingIndex - 1))} onNext={() => openFinding(Math.min(artifact.findings.length - 1, findingIndex + 1))} onReview={(action, payload) => void reviewFinding(action, payload)} />}
      {step === 'report_preview' && artifact && reportSummary && <ReviewedReportPreview artifact={artifact} brief={reportDecisionBrief} requestId={activeRequestId} summary={reportSummary} recipient={submission?.deliveryRecipientEmail || ''} professionalGroups={reportProfessionalGroups} busy={reportBusy} error={reportError} onBack={() => setStep('overview')} onViewPdf={() => reviewedReportId && void openPhase1ReviewedReportPdf(reviewedReportId)} onRelease={() => void releaseReviewedReport()} />}
      {step === 'report_released' && artifact && <ReportReleased address={artifact.propertyAddress} submission={submission} busy={reportBusy} error={reportError} onSend={() => void sendReviewedResult()} />}
      {step === 'gap' && finding && <GapStep finding={finding} onEvidence={(file) => { setFiles((current) => [...current, file]); setStep('next') }} onSkip={() => setStep('next')} />}
      {step === 'next' && artifact && finding && <NextStep address={address} evidenceCount={evidenceCount} artifact={artifact} finding={finding} onContinue={continueReview} />}
    </div>
  )
}
