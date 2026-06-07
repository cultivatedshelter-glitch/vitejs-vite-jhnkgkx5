import type React from 'react'

export type ReportPreviewFile = {
  name: string
  type?: string
  url?: string
}

export type ReportPreviewWorkGroup = {
  id: string
  title: string
  category?: string
  priority?: string
  reviewStatus?: string
  whatMatters?: string
  evidenceSummary?: string
  likelyCostImpact?: string
  recommendedAction?: string
  missingInfo?: string[]
  sourceIds?: string[]
}

export type ReportPreviewData = {
  propertyAddress?: string
  propertyLocation?: string
  propertyId?: string
  requestId: string
  requestTitle?: string
  requesterName?: string
  requestStatus?: string
  interpretationStatus?: string
  reviewStatus: 'Draft' | 'Needs Review' | 'Human Reviewed' | 'Human Verified'
  generatedAt: string
  uploadedFiles: ReportPreviewFile[]
  workGroups: ReportPreviewWorkGroup[]
  knownFacts: string[]
  missingInfo: string[]
  nextActions: string[]
  warnings: string[]
  errors: string[]
  summary: {
    totalWorkGroups: number
    highPriorityCount: number
    missingInfoCount: number
    humanVerifiedCount: number
    needsReviewCount: number
  }
}

type StyleMap = Record<string, React.CSSProperties>

type ReportPreviewProps = {
  data: ReportPreviewData
  styles: StyleMap
  getStatusLabel: (value?: string | null) => string
}

function display(value?: string | null) {
  return value && value.trim() ? value : 'Not provided'
}

function statusStyle(styles: StyleMap, status?: string | null) {
  const normalized = String(status || '').toLowerCase()
  if (normalized.includes('verified') || normalized.includes('approved')) return styles.badge
  if (normalized.includes('rejected') || normalized.includes('failed')) return styles.badgeDanger
  return styles.badgeMuted
}

function reportStatusLabel(status: string | null | undefined, fallback: (value?: string | null) => string) {
  const normalized = String(status || '').trim().toLowerCase()
  const reportStatusLabels: Record<string, string> = {
    ai_draft: 'AI Draft',
    needs_review: 'Needs Review',
    in_review: 'Needs Review',
    human_reviewed: 'Human Reviewed',
    human_verified: 'Human Verified',
    approved: 'Human Verified',
    human_approved: 'Human Verified',
    needs_more_info: 'Needs More Info',
    research_requested: 'Research Needed',
    research_drafted: 'Research Needed',
    rejected: 'Rejected',
    deprecated: 'Deprecated',
  }
  return reportStatusLabels[normalized] || fallback(status)
}

function ReportStatusBadge({
  status,
  styles,
  getStatusLabel,
}: {
  status?: string | null
  styles: StyleMap
  getStatusLabel: (value?: string | null) => string
}) {
  return <span style={statusStyle(styles, status)}>{reportStatusLabel(status, getStatusLabel)}</span>
}

function ReportSection({
  title,
  children,
  styles,
}: {
  title: string
  children: React.ReactNode
  styles: StyleMap
}) {
  return (
    <section style={styles.noticeBox}>
      <h4 style={{ margin: '0 0 10px', color: '#173425', letterSpacing: 0 }}>{title}</h4>
      {children}
    </section>
  )
}

function ReportFindingCard({
  group,
  styles,
  getStatusLabel,
}: {
  group: ReportPreviewWorkGroup
  styles: StyleMap
  getStatusLabel: (value?: string | null) => string
}) {
  return (
    <article style={styles.inspectionTaskCard}>
      <div style={styles.buttonRow}>
        <div style={{ flex: 1 }}>
          <strong>{display(group.title)}</strong>
          <p style={styles.small}>{display(group.category)}</p>
        </div>
        <span style={group.priority === 'Critical' || group.priority === 'High' ? styles.badgeDanger : styles.badgeMuted}>
          {display(group.priority)}
        </span>
      </div>
      <div style={styles.badgeRow}>
        <ReportStatusBadge status={group.reviewStatus || 'ai_draft'} styles={styles} getStatusLabel={getStatusLabel} />
      </div>
      <p style={styles.small}>
        <strong>What matters:</strong> {display(group.whatMatters)}
      </p>
      <p style={styles.small}>
        <strong>Evidence:</strong> {display(group.evidenceSummary)}
      </p>
      <p style={styles.small}>
        <strong>Likely coordination impact:</strong> {display(group.likelyCostImpact)}
      </p>
      <p style={styles.small}>
        <strong>Recommended next action:</strong> {display(group.recommendedAction)}
      </p>
      {group.missingInfo && group.missingInfo.length > 0 && (
        <>
          <strong style={styles.small}>Open questions</strong>
          <ul style={styles.smallList}>
            {group.missingInfo.map((item) => (
              <li key={`${group.id}-missing-${item}`}>{item}</li>
            ))}
          </ul>
        </>
      )}
      {group.sourceIds && group.sourceIds.length > 0 && (
        <p style={styles.small}>Source refs: {group.sourceIds.join(', ')}</p>
      )}
    </article>
  )
}

export function ReportPreview({ data, styles, getStatusLabel }: ReportPreviewProps) {
  const hasUnverifiedContent = data.reviewStatus !== 'Human Verified'

  return (
    <section style={styles.reviewBox} aria-label="Report Preview">
      <div style={styles.buttonRow}>
        <div style={{ flex: 1 }}>
          <span style={styles.workflowStage}>Shelter Prep</span>
          <h3 style={{ margin: '4px 0 6px', color: '#173425', letterSpacing: 0 }}>Report Preview</h3>
          <p style={styles.small}>
            {display(data.propertyAddress)}
            {data.propertyLocation ? ` - ${data.propertyLocation}` : ''}
          </p>
          <p style={styles.small}>
            Generated: {new Date(data.generatedAt).toLocaleString()} - Request: {data.requestId}
          </p>
        </div>
        <span style={data.reviewStatus === 'Human Verified' ? styles.badge : styles.badgeMuted}>{data.reviewStatus}</span>
      </div>

      {hasUnverifiedContent && (
        <div style={styles.warningBox}>
          This report contains AI-organized draft findings. Human review is required before client use.
        </div>
      )}

      {data.errors.length > 0 && (
        <div style={{ ...styles.noticeBox, background: '#fde8df', borderColor: '#e5b4a3', color: '#8a2f12' }}>
          {data.errors.map((error) => (
            <p key={error} style={{ ...styles.small, color: '#8a2f12' }}>{error}</p>
          ))}
        </div>
      )}

      {data.warnings.length > 0 && (
        <div style={styles.noticeBox}>
          {data.warnings.map((warning) => (
            <p key={warning} style={styles.small}>{warning}</p>
          ))}
        </div>
      )}

      <ReportSection title="Property / Request Summary" styles={styles}>
        <div style={styles.compactMetaGrid}>
          <span>Property: {display(data.propertyAddress)}</span>
          <span>Requester: {display(data.requesterName)}</span>
          <span>Work request: {display(data.requestTitle)}</span>
          <span>Request status: {display(data.requestStatus)}</span>
          <span>Uploaded files: {data.uploadedFiles.length}</span>
          <span>Interpretation: {display(data.interpretationStatus)}</span>
          <span>Review: {data.reviewStatus}</span>
          {data.propertyId && <span>Property ID: {data.propertyId}</span>}
        </div>
      </ReportSection>

      <ReportSection title="Executive Summary" styles={styles}>
        <p style={styles.small}>
          This property has {data.summary.totalWorkGroups} interpreted work group{data.summary.totalWorkGroups === 1 ? '' : 's'}.
          {' '}
          {data.summary.highPriorityCount} item{data.summary.highPriorityCount === 1 ? '' : 's'} are marked high priority,
          {' '}
          {data.summary.missingInfoCount} item{data.summary.missingInfoCount === 1 ? '' : 's'} need more information, and
          {' '}
          {data.summary.humanVerifiedCount} item{data.summary.humanVerifiedCount === 1 ? '' : 's'} are human verified.
        </p>
      </ReportSection>

      <ReportSection title="Priority Repair Roadmap" styles={styles}>
        {data.workGroups.length === 0 ? (
          <p style={styles.small}>No interpreted work groups found.</p>
        ) : (
          <div style={styles.inspectionTaskGrid}>
            {data.workGroups.map((group) => (
              <ReportFindingCard key={group.id} group={group} styles={styles} getStatusLabel={getStatusLabel} />
            ))}
          </div>
        )}
      </ReportSection>

      <ReportSection title="Known Facts" styles={styles}>
        {data.knownFacts.length === 0 ? (
          <p style={styles.small}>Source ledger is limited. Uploaded evidence and reviewed findings will appear here when available.</p>
        ) : (
          <ul style={styles.smallList}>
            {data.knownFacts.map((fact) => (
              <li key={fact}>{fact}</li>
            ))}
          </ul>
        )}
      </ReportSection>

      <ReportSection title="Missing Information" styles={styles}>
        {data.missingInfo.length === 0 ? (
          <p style={styles.small}>No missing information questions are currently recorded.</p>
        ) : (
          <ul style={styles.smallList}>
            {data.missingInfo.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </ReportSection>

      <ReportSection title="Human Review Status" styles={styles}>
        {data.workGroups.length === 0 ? (
          <p style={styles.small}>No interpreted items are available for review status display.</p>
        ) : (
          <ul style={styles.smallList}>
            {data.workGroups.map((group) => (
              <li key={`${group.id}-status`}>
                {group.title}: <ReportStatusBadge status={group.reviewStatus || 'ai_draft'} styles={styles} getStatusLabel={getStatusLabel} />
              </li>
            ))}
          </ul>
        )}
      </ReportSection>

      <ReportSection title="Recommended Next Actions" styles={styles}>
        <ul style={styles.smallList}>
          {data.nextActions.map((action) => (
            <li key={action}>{action}</li>
          ))}
        </ul>
      </ReportSection>
    </section>
  )
}
