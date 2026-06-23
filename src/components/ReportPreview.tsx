import { useEffect, useMemo, useRef, useState } from 'react'
import type React from 'react'
import {
  isReviewedReportStatus,
  outputNeedsDraftStamp,
  roleViewPolicy,
  workflowStateLabel,
  workflowStateUnlocks,
} from '../lib/workflowGating'
import type {
  GeneratedOutputEvidenceLink,
  PropertyReportStatusLabel,
  RoleBasedShareView,
  WorkflowAccessState,
} from '../types/app'

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
  propertyId?: string
  sourceFileIds?: string[]
  evidenceItemIds?: string[]
  repairItemId?: string
  generatedAt?: string
  reviewerId?: string | null
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
  reviewStatus: PropertyReportStatusLabel
  workflowState: WorkflowAccessState
  generatedAt: string
  sourceFileReferences: string[]
  roleViews: RoleBasedShareView[]
  evidenceLinks: GeneratedOutputEvidenceLink[]
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
}

type EditableReportWorkGroup = {
  id: string
  title: string
  category?: string
  priority?: string
  reviewStatus?: string
  propertyId?: string
  sourceFileIds?: string[]
  evidenceItemIds?: string[]
  repairItemId?: string
  generatedAt?: string
  reviewerId?: string | null
  whatMatters: string
  evidenceSummary: string
  likelyCostImpact: string
  recommendedAction: string
  missingInfo: string[]
  sourceIds?: string[]
}

type EditableReportDraft = {
  executiveSummary: string
  useGuidance: string
  recommendedNextActions: string[]
  workGroups: EditableReportWorkGroup[]
}

function display(value?: string | null) {
  return value && value.trim() ? value : 'Not provided'
}

function cleanLines(value: string) {
  return value
    .split('\n')
    .map((line) => line.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean)
}

function uniqueStrings(values: string[]) {
  return values.filter((value, index, arr) => value.trim().length > 0 && arr.indexOf(value) === index)
}

function buildExecutiveSummary(data: ReportPreviewData) {
  return [
    `This property has ${data.summary.totalWorkGroups} interpreted work group${data.summary.totalWorkGroups === 1 ? '' : 's'}.`,
    `${data.summary.highPriorityCount} item${data.summary.highPriorityCount === 1 ? '' : 's'} are marked high priority,`,
    `${data.summary.missingInfoCount} item${data.summary.missingInfoCount === 1 ? '' : 's'} need more information, and`,
    `${data.summary.humanVerifiedCount} item${data.summary.humanVerifiedCount === 1 ? '' : 's'} are human reviewed.`,
  ].join(' ')
}

function createReportDraft(data: ReportPreviewData): EditableReportDraft {
  return {
    executiveSummary: buildExecutiveSummary(data),
    useGuidance: getUseGuidance(data),
    recommendedNextActions: data.nextActions.length ? data.nextActions : ['Review this preview before any client-facing use.'],
    workGroups: data.workGroups.map((group) => ({
      id: group.id,
      title: display(group.title),
      category: group.category,
      priority: group.priority,
      reviewStatus: group.reviewStatus || 'needs_review',
      propertyId: group.propertyId,
      sourceFileIds: group.sourceFileIds,
      evidenceItemIds: group.evidenceItemIds,
      repairItemId: group.repairItemId,
      generatedAt: group.generatedAt,
      reviewerId: group.reviewerId,
      whatMatters: display(group.whatMatters),
      evidenceSummary: display(group.evidenceSummary),
      likelyCostImpact: display(group.likelyCostImpact),
      recommendedAction: display(group.recommendedAction),
      missingInfo: uniqueStrings(group.missingInfo || []),
      sourceIds: group.sourceIds,
    })),
  }
}

function createDraftSourceKey(data: ReportPreviewData) {
  return JSON.stringify({
    requestId: data.requestId,
    reviewStatus: data.reviewStatus,
    summary: data.summary,
    workGroups: data.workGroups.map((group) => ({
      id: group.id,
      title: group.title,
      reviewStatus: group.reviewStatus,
      propertyId: group.propertyId,
      sourceFileIds: group.sourceFileIds,
      evidenceItemIds: group.evidenceItemIds,
      repairItemId: group.repairItemId,
      generatedAt: group.generatedAt,
      whatMatters: group.whatMatters,
      evidenceSummary: group.evidenceSummary,
      likelyCostImpact: group.likelyCostImpact,
      recommendedAction: group.recommendedAction,
      missingInfo: group.missingInfo,
      sourceIds: group.sourceIds,
    })),
    nextActions: data.nextActions,
    knownFacts: data.knownFacts,
    missingInfo: data.missingInfo,
    warnings: data.warnings,
    errors: data.errors,
  })
}

function getDraftMissingInfo(data: ReportPreviewData, draft: EditableReportDraft) {
  return uniqueStrings([
    ...data.missingInfo,
    ...draft.workGroups.flatMap((group) => group.missingInfo),
  ])
}

function getDraftWarnings(data: ReportPreviewData) {
  return uniqueStrings([
    outputNeedsDraftStamp(data.reviewStatus)
      ? 'This report contains AI-organized draft findings. Human review is required before client use.'
      : '',
    outputNeedsDraftStamp(data.reviewStatus) ? 'AI draft until reviewed.' : '',
    'Not valid for unrelated properties.',
    ...data.warnings,
  ])
}

function escapeHtml(value: string | number | undefined | null) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatBullets(items: string[]) {
  return items.length ? items.map((item) => `- ${item}`).join('\n') : '- None recorded.'
}

function primarySourceReference(data: ReportPreviewData) {
  return data.sourceFileReferences[0] ||
    data.workGroups.flatMap((group) => group.sourceIds || [])[0] ||
    'No source file or inspection reference recorded.'
}

function propertySpecificStampLines(data: ReportPreviewData) {
  return [
    `Property address: ${display(data.propertyAddress)}`,
    `Report date: ${new Date(data.generatedAt).toLocaleString()}`,
    `Source file / inspection reference: ${primarySourceReference(data)}`,
    `Review status: ${data.reviewStatus}`,
    `Workflow state: ${workflowStateLabel(data.workflowState)}`,
    'Not valid for unrelated properties.',
    `AI draft until reviewed: ${outputNeedsDraftStamp(data.reviewStatus) ? 'Yes' : 'No - current status is reviewed for this property.'}`,
  ]
}

function formatReportPlainText(data: ReportPreviewData, draft: EditableReportDraft, sourceNote: string) {
  const missingInfo = getDraftMissingInfo(data, draft)
  const visibleMissingInfo = data.workflowState === 'preview' ? missingInfo.slice(0, 3) : missingInfo
  const visibleWorkGroups = data.workflowState === 'preview' ? draft.workGroups.slice(0, 2) : draft.workGroups
  const warnings = getDraftWarnings(data)
  const lines = [
    'Shelter Prep',
    'Report Preview',
    '',
    'Property-Specific Output Stamp:',
    ...propertySpecificStampLines(data),
    '',
    'Property:',
    display(data.propertyAddress),
    data.propertyLocation ? data.propertyLocation : '',
    '',
    'Generated:',
    new Date(data.generatedAt).toLocaleString(),
    '',
    'Request ID:',
    data.requestId,
    '',
    'Status:',
    data.reviewStatus,
    '',
    'Workflow Gate:',
    workflowStateLabel(data.workflowState),
    'Unlocked workflow value:',
    formatBullets(workflowStateUnlocks(data.workflowState)),
    '',
    'Available role views:',
    formatBullets(data.roleViews.map((view) => `${view}: ${roleViewPolicy(view).join('; ')}`)),
    '',
    'Important:',
    warnings.length ? warnings.join('\n') : 'Human review status is shown on each item.',
    '',
    'Report Completeness:',
    `Work groups: ${data.summary.totalWorkGroups}`,
    `Human reviewed: ${data.summary.humanVerifiedCount}`,
    `Needs review: ${data.summary.needsReviewCount}`,
    `Missing info questions: ${visibleMissingInfo.length}${data.workflowState === 'preview' && missingInfo.length > visibleMissingInfo.length ? ' shown in preview' : ''}`,
    `Uploaded files: ${data.uploadedFiles.length}`,
    '',
    'Property / Request Summary:',
    `Property: ${display(data.propertyAddress)}`,
    `Requester: ${display(data.requesterName)}`,
    `Work request: ${display(data.requestTitle)}`,
    `Request status: ${display(data.requestStatus)}`,
    `Interpretation: ${display(data.interpretationStatus)}`,
    `Review: ${data.reviewStatus}`,
    data.propertyId ? `Property ID: ${data.propertyId}` : '',
    '',
    'Executive Summary:',
    draft.executiveSummary,
    '',
    'How to Use This Report:',
    draft.useGuidance,
    '',
    'Priority Repair Roadmap:',
  ].filter((line) => line !== '')

  if (!draft.workGroups.length) {
    lines.push('No interpreted repair items are available for this report yet. Upload evidence or run interpretation before generating a report.')
  } else {
    visibleWorkGroups.forEach((group, index) => {
      lines.push(
        '',
        `${index + 1}. ${display(group.title)}`,
        `Status: ${reportStatusLabel(group.reviewStatus || 'needs_review')}`,
        `Priority: ${display(group.priority)}`,
        `Category: ${display(group.category)}`,
        'What matters:',
        group.whatMatters,
        'Evidence:',
        group.evidenceSummary,
        'Likely coordination impact:',
        group.likelyCostImpact,
        'Recommended next action:',
        group.recommendedAction,
        'Open questions:',
        formatBullets(group.missingInfo),
        'Evidence link:',
        `Property ID: ${display(group.propertyId || data.propertyId)}`,
        `Source file IDs: ${group.sourceFileIds && group.sourceFileIds.length ? group.sourceFileIds.join(', ') : 'Not recorded'}`,
        `Evidence item IDs: ${group.evidenceItemIds && group.evidenceItemIds.length ? group.evidenceItemIds.join(', ') : 'Not recorded'}`,
        `Repair item ID: ${display(group.repairItemId || group.id)}`,
        `Generated at: ${display(group.generatedAt || data.generatedAt)}`,
        `Reviewer ID: ${display(group.reviewerId)}`,
      )
      if (group.sourceIds && group.sourceIds.length > 0) {
        lines.push(`Source refs: ${group.sourceIds.join(', ')}`)
      }
    })
    if (data.workflowState === 'preview' && draft.workGroups.length > visibleWorkGroups.length) {
      lines.push('', 'Preview mode shows sample findings only. Open an active property workspace for the full repair roadmap.')
    }
  }

  lines.push(
    '',
    'Known Facts / Source Notes:',
    sourceNote,
    data.knownFacts.length ? formatBullets(data.knownFacts) : '- Unavailable source detail: no uploaded file names or saved interpretation summaries are available for this report.',
    '',
    'Missing Information:',
    formatBullets(visibleMissingInfo),
    data.workflowState === 'preview' && missingInfo.length > visibleMissingInfo.length
      ? 'Preview mode shows limited questions only. The full checklist belongs inside the property workspace.'
      : '',
    '',
    'Review Status:',
  ).filter((line) => line !== '')

  if (!draft.workGroups.length) {
    lines.push('No interpreted items are available for review status display.')
  } else {
    visibleWorkGroups.forEach((group) => {
      lines.push(`- ${display(group.title)}: ${reportStatusLabel(group.reviewStatus || 'needs_review')}`)
    })
  }

  lines.push('', 'Recommended Next Actions:', formatBullets(draft.recommendedNextActions))
  return lines.join('\n')
}

function htmlList(items: string[]) {
  if (!items.length) return '<p>None recorded.</p>'
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
}

function stripHtml(value: string) {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isRenderableReportHtml(html: string) {
  const text = stripHtml(html)
  return html.includes('id="shelter-prep-printable-report"') &&
    text.includes('Shelter Prep') &&
    text.includes('Report Preview') &&
    text.length > 180
}

function buildPrintDocumentHtml(data: ReportPreviewData, draft: EditableReportDraft, sourceNote: string) {
  const missingInfo = getDraftMissingInfo(data, draft)
  const visibleMissingInfo = data.workflowState === 'preview' ? missingInfo.slice(0, 3) : missingInfo
  const visibleWorkGroups = data.workflowState === 'preview' ? draft.workGroups.slice(0, 2) : draft.workGroups
  const warnings = getDraftWarnings(data)
  const stampHtml = htmlList(propertySpecificStampLines(data))
  const workflowUnlockHtml = htmlList(workflowStateUnlocks(data.workflowState))
  const roleViewsHtml = htmlList(data.roleViews.map((view) => `${view}: ${roleViewPolicy(view).join('; ')}`))
  const roadmapHtml = draft.workGroups.length
    ? `${visibleWorkGroups.map((group, index) => `
      <article class="work-item" data-sp-report-section="work-item">
        <div class="report-row">
          <div>
            <h3>${index + 1}. ${escapeHtml(display(group.title))}</h3>
            <p>${escapeHtml(display(group.category))}</p>
          </div>
          <div class="badges">
            <span class="badge">${escapeHtml(reportStatusLabel(group.reviewStatus || 'needs_review'))}</span>
            <span class="badge">${escapeHtml(display(group.priority))}</span>
          </div>
        </div>
        <p><strong>What matters:</strong> ${escapeHtml(group.whatMatters)}</p>
        <p><strong>Evidence:</strong> ${escapeHtml(group.evidenceSummary)}</p>
        <p><strong>Likely coordination impact:</strong> ${escapeHtml(group.likelyCostImpact)}</p>
        <p><strong>Recommended next action:</strong> ${escapeHtml(group.recommendedAction)}</p>
        <p><strong>Open questions:</strong></p>
        ${htmlList(group.missingInfo)}
        <p><strong>Evidence link:</strong> Property ID ${escapeHtml(display(group.propertyId || data.propertyId))}; source file IDs ${escapeHtml(group.sourceFileIds && group.sourceFileIds.length ? group.sourceFileIds.join(', ') : 'Not recorded')}; evidence item IDs ${escapeHtml(group.evidenceItemIds && group.evidenceItemIds.length ? group.evidenceItemIds.join(', ') : 'Not recorded')}; repair item ID ${escapeHtml(display(group.repairItemId || group.id))}; generated ${escapeHtml(display(group.generatedAt || data.generatedAt))}; reviewer ${escapeHtml(display(group.reviewerId))}.</p>
        ${group.sourceIds && group.sourceIds.length > 0 ? `<p>Source refs: ${escapeHtml(group.sourceIds.join(', '))}</p>` : ''}
      </article>
    `).join('')}${data.workflowState === 'preview' && draft.workGroups.length > visibleWorkGroups.length ? '<p>Preview mode shows sample findings only. Open an active property workspace for the full repair roadmap.</p>' : ''}`
    : '<p>No interpreted repair items are available for this report yet. Upload evidence or run interpretation before generating a report.</p>'

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Shelter Prep Report Preview</title>
    <style>
      @page { margin: 0.5in; }
      * { box-sizing: border-box; }
      html {
        margin: 0;
        padding: 0;
        background: #ffffff;
      }
      body {
        margin: 0;
        padding: 0;
        background: #ffffff;
        color: #111827;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 12.5px;
        line-height: 1.45;
      }
      main {
        width: 100%;
        max-width: 7.5in;
        margin: 0 auto;
        padding: 0;
      }
      h1, h2, h3 { color: #173425; break-after: avoid; page-break-after: avoid; }
      h1 { margin: 0 0 4px; font-size: 24px; }
      h2 { margin: 0 0 8px; font-size: 15px; }
      h3 { margin: 0 0 6px; font-size: 13px; }
      p { margin: 0 0 8px; }
      ul { margin: 4px 0 8px; padding-left: 18px; }
      .print-toolbar {
        position: sticky;
        top: 0;
        z-index: 2;
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin: 0 0 16px;
        padding: 12px 0;
        background: #ffffff;
        border-bottom: 1px solid #d7dcd3;
      }
      .print-button {
        appearance: none;
        border: 1px solid #173425;
        background: #173425;
        color: #ffffff;
        border-radius: 6px;
        padding: 9px 12px;
        font: inherit;
        font-weight: 800;
        cursor: pointer;
      }
      .label { color: #4b5563; font-weight: 700; text-transform: uppercase; font-size: 10px; letter-spacing: 0.04em; }
      .header { border-bottom: 2px solid #173425; padding-bottom: 10px; margin-bottom: 12px; }
      .meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 14px; margin-top: 10px; }
      .report-section {
        border: 1px solid #c8d0c4;
        padding: 10px;
        margin: 0 0 10px;
        background: #ffffff;
      }
      .work-item {
        border: 1px solid #d7dcd3;
        padding: 10px;
        margin: 0 0 8px;
        background: #ffffff;
      }
      .warning {
        background: #fff8e8;
        border-color: #d9b35f;
        color: #111827;
      }
      .report-row { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
      .badges { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
      .badge { border: 1px solid #a9b5a5; padding: 3px 6px; font-size: 10px; font-weight: 700; white-space: nowrap; }
      @media print {
        html,
        body {
          width: auto;
          height: auto;
          min-height: 0;
          overflow: visible;
          background: #ffffff;
        }
        main {
          width: 100%;
          max-width: none;
        }
        .print-toolbar {
          display: none !important;
        }
        .report-section {
          break-inside: auto;
          page-break-inside: auto;
        }
        .work-item {
          break-inside: auto;
          page-break-inside: auto;
        }
      }
    </style>
  </head>
  <body>
    <main id="shelter-prep-printable-report">
      <div class="print-toolbar">
        <button id="sp-print-document-button" class="print-button" type="button" onclick="window.print()">Print / Save PDF</button>
      </div>
      <header class="header">
        <div class="label">Shelter Prep</div>
        <h1>Report Preview</h1>
        <p>${escapeHtml(display(data.propertyAddress))}${data.propertyLocation ? ` - ${escapeHtml(data.propertyLocation)}` : ''}</p>
        <div class="meta">
          <span>Generated: ${escapeHtml(new Date(data.generatedAt).toLocaleString())}</span>
          <span>Request: ${escapeHtml(data.requestId)}</span>
          <span>Status: ${escapeHtml(data.reviewStatus)}</span>
          <span>Workflow: ${escapeHtml(workflowStateLabel(data.workflowState))}</span>
          <span>Source: ${escapeHtml(primarySourceReference(data))}</span>
          <span>Uploaded files: ${data.uploadedFiles.length}</span>
        </div>
      </header>
      ${warnings.map((warning) => `<section class="report-section warning" data-sp-report-section="warning"><p>${escapeHtml(warning)}</p></section>`).join('')}
      ${data.errors.map((error) => `<section class="report-section warning" data-sp-report-section="error"><p>${escapeHtml(error)}</p></section>`).join('')}
      <section class="report-section" data-sp-report-section="property-stamp">
        <h2>Property-Specific Output Stamp</h2>
        ${stampHtml}
      </section>
      <section class="report-section" data-sp-report-section="workflow-gate">
        <h2>Workflow Gate</h2>
        <p><strong>${escapeHtml(workflowStateLabel(data.workflowState))}</strong></p>
        ${workflowUnlockHtml}
      </section>
      <section class="report-section" data-sp-report-section="role-views">
        <h2>Role-Based Share Views</h2>
        ${roleViewsHtml}
      </section>
      <section class="report-section" data-sp-report-section="completeness">
        <h2>Report Completeness</h2>
        <div class="meta">
          <span>Work groups: ${data.summary.totalWorkGroups}</span>
          <span>Human reviewed: ${data.summary.humanVerifiedCount}</span>
          <span>Needs review: ${data.summary.needsReviewCount}</span>
          <span>Missing info questions: ${visibleMissingInfo.length}${data.workflowState === 'preview' && missingInfo.length > visibleMissingInfo.length ? ' shown in preview' : ''}</span>
          <span>Uploaded files: ${data.uploadedFiles.length}</span>
        </div>
      </section>
      <section class="report-section" data-sp-report-section="summary">
        <h2>Property / Request Summary</h2>
        <div class="meta">
          <span>Property: ${escapeHtml(display(data.propertyAddress))}</span>
          <span>Requester: ${escapeHtml(display(data.requesterName))}</span>
          <span>Work request: ${escapeHtml(display(data.requestTitle))}</span>
          <span>Request status: ${escapeHtml(display(data.requestStatus))}</span>
          <span>Interpretation: ${escapeHtml(display(data.interpretationStatus))}</span>
          <span>Review: ${escapeHtml(data.reviewStatus)}</span>
          <span>Source: ${escapeHtml(primarySourceReference(data))}</span>
          ${data.propertyId ? `<span>Property ID: ${escapeHtml(data.propertyId)}</span>` : ''}
        </div>
      </section>
      <section class="report-section" data-sp-report-section="executive-summary"><h2>Executive Summary</h2><p>${escapeHtml(draft.executiveSummary)}</p></section>
      <section class="report-section" data-sp-report-section="use-guidance"><h2>How to Use This Report</h2><p>${escapeHtml(draft.useGuidance)}</p></section>
      <section class="report-section" data-sp-report-section="roadmap"><h2>Priority Repair Roadmap</h2>${roadmapHtml}</section>
      <section class="report-section" data-sp-report-section="known-facts"><h2>Known Facts</h2><p>${escapeHtml(sourceNote)}</p>${data.knownFacts.length ? htmlList(data.knownFacts) : '<p>Unavailable source detail: no uploaded file names or saved interpretation summaries are available for this report.</p>'}</section>
      <section class="report-section" data-sp-report-section="missing-info"><h2>Missing Information</h2>${htmlList(visibleMissingInfo)}${data.workflowState === 'preview' && missingInfo.length > visibleMissingInfo.length ? '<p>Preview mode shows limited questions only. The full checklist belongs inside the property workspace.</p>' : ''}</section>
      <section class="report-section" data-sp-report-section="review-status"><h2>Human Review Status</h2>${draft.workGroups.length ? htmlList(visibleWorkGroups.map((group) => `${display(group.title)}: ${reportStatusLabel(group.reviewStatus || 'needs_review')}`)) : '<p>No interpreted items are available for review status display.</p>'}</section>
      <section class="report-section" data-sp-report-section="next-actions"><h2>Recommended Next Actions</h2>${htmlList(draft.recommendedNextActions)}</section>
    </main>
  </body>
</html>`
}

function statusStyle(styles: StyleMap, status?: string | null) {
  const normalized = String(status || '').toLowerCase()
  if (normalized.includes('verified') || normalized.includes('approved')) return styles.badge
  if (normalized.includes('rejected') || normalized.includes('failed')) return styles.badgeDanger
  return styles.badgeMuted
}

function reportStatusLabel(status: string | null | undefined) {
  const normalized = String(status || '').trim().toLowerCase()
  const reportStatusLabels: Record<string, string> = {
    ai_draft: 'AI Draft',
    needs_review: 'Needs Review',
    in_review: 'Needs Review',
    human_reviewed: 'Human Reviewed',
    human_verified: 'Human Reviewed',
    approved: 'Human Reviewed',
    human_approved: 'Human Reviewed',
    contractor_reviewed: 'Contractor Reviewed',
    contractor_verified: 'Contractor Reviewed',
    contractor_verified_structured_summary: 'Contractor Reviewed',
    seller_ready: 'Seller Ready',
    finalized: 'Finalized',
    needs_more_info: 'Needs More Info',
    research_requested: 'Research Needed',
    research_drafted: 'Research Needed',
    rejected: 'Rejected',
    deprecated: 'Deprecated',
  }
  return reportStatusLabels[normalized] || 'Needs Review'
}

function ReportStatusBadge({
  status,
  styles,
}: {
  status?: string | null
  styles: StyleMap
}) {
  return <span style={statusStyle(styles, status)}>{reportStatusLabel(status)}</span>
}

function ReportSection({
  title,
  children,
  styles,
  testId,
}: {
  title: string
  children: React.ReactNode
  styles: StyleMap
  testId?: string
}) {
  return (
    <section
      className="report-print-section sp-report-section"
      style={styles.noticeBox}
      data-testid={testId}
    >
      <h4 style={{ margin: '0 0 10px', color: '#173425', letterSpacing: 0 }}>{title}</h4>
      {children}
    </section>
  )
}

function ReportFindingCard({
  group,
  styles,
}: {
  group: ReportPreviewWorkGroup
  styles: StyleMap
}) {
  return (
    <article className="report-print-card sp-report-card" style={styles.inspectionTaskCard}>
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
        <ReportStatusBadge status={group.reviewStatus || 'needs_review'} styles={styles} />
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
      <p style={styles.small}>
        Evidence link: property {display(group.propertyId)}; source files {group.sourceFileIds?.length ? group.sourceFileIds.join(', ') : 'Not recorded'}; evidence items {group.evidenceItemIds?.length ? group.evidenceItemIds.join(', ') : 'Not recorded'}; repair item {display(group.repairItemId || group.id)}; generated {display(group.generatedAt)}; reviewer {display(group.reviewerId)}.
      </p>
    </article>
  )
}

function getUseGuidance(data: ReportPreviewData) {
  const total = data.summary.totalWorkGroups
  const verified = data.summary.humanVerifiedCount

  if (!total || verified === 0) {
    return 'Use this as an internal workflow draft only. It is property-specific and not valid for unrelated properties. Review findings before sending to a client, seller, buyer, or contractor.'
  }

  if (verified < total) {
    return 'Reviewed items may support internal coordination. Draft items still require review before external use.'
  }

  return 'This property-specific report may support seller-facing coordination. Confirm pricing, contractor scope, and approval history before treating it as final.'
}

function EditableReportTextarea({
  label,
  value,
  minHeight = 82,
  styles,
  onChange,
}: {
  label: string
  value: string
  minHeight?: number
  styles: StyleMap
  onChange: (value: string) => void
}) {
  return (
    <label style={{ display: 'grid', gap: 6 }}>
      <span style={styles.small}>{label}</span>
      <textarea
        style={{ ...styles.input, minHeight, resize: 'vertical' }}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}

function EditableReportInput({
  label,
  value,
  styles,
  onChange,
}: {
  label: string
  value: string
  styles: StyleMap
  onChange: (value: string) => void
}) {
  return (
    <label style={{ display: 'grid', gap: 6 }}>
      <span style={styles.small}>{label}</span>
      <input
        style={styles.input}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}

export function ReportPreview({ data, styles }: ReportPreviewProps) {
  const reportRef = useRef<HTMLElement | null>(null)
  const draftSourceKey = useMemo(() => createDraftSourceKey(data), [data])
  const draftSourceKeyRef = useRef(draftSourceKey)
  const [draft, setDraft] = useState(() => createReportDraft(data))
  const [isEditing, setIsEditing] = useState(false)
  const [actionMessage, setActionMessage] = useState('')
  const [actionError, setActionError] = useState('')
  const hasUnverifiedContent = outputNeedsDraftStamp(data.reviewStatus)
  const sourceNote = 'Source detail is limited to currently saved uploaded files and interpretation data.'
  const draftMissingInfo = getDraftMissingInfo(data, draft)
  const visibleWorkGroups = data.workflowState === 'preview' ? draft.workGroups.slice(0, 2) : draft.workGroups
  const visibleMissingInfo = data.workflowState === 'preview' ? draftMissingInfo.slice(0, 3) : draftMissingInfo

  useEffect(() => {
    if (draftSourceKeyRef.current === draftSourceKey) return
    draftSourceKeyRef.current = draftSourceKey
    setDraft(createReportDraft(data))
    setIsEditing(false)
    setActionError('')
    setActionMessage('Report draft refreshed from current data. Local edits were replaced.')
  }, [data, draftSourceKey])

  function setDraftMessage(message: string, error = '') {
    setActionMessage(message)
    setActionError(error)
  }

  function updateDraft(updates: Partial<EditableReportDraft>) {
    setDraft((current) => ({ ...current, ...updates }))
    setDraftMessage('')
  }

  function updateDraftGroup(groupId: string, updates: Partial<EditableReportWorkGroup>) {
    setDraft((current) => ({
      ...current,
      workGroups: current.workGroups.map((group) => (
        group.id === groupId ? { ...group, ...updates } : group
      )),
    }))
    setDraftMessage('')
  }

  function handlePrintReport() {
    if (!draft) {
      setDraftMessage('', 'Report draft is not ready to print yet.')
      return
    }

    const generatedHtml = buildPrintDocumentHtml(data, draft, sourceNote)
    const reportText = stripHtml(generatedHtml)
    const generatedHtmlHasMarker = generatedHtml.includes('id="shelter-prep-printable-report"')
    console.info('[Shelter Prep] generated report print HTML', {
      requestId: data.requestId,
      generatedHtmlLength: generatedHtml.length,
      generatedHtmlHasMarker,
      textLength: reportText.length,
      textPreview: reportText.slice(0, 700),
      generatedHtml,
    })
    ;(window as unknown as { __shelterPrepLastReportPrintHtml?: string }).__shelterPrepLastReportPrintHtml = generatedHtml

    if (!generatedHtmlHasMarker) {
      setDraftMessage('', 'Printable report HTML is missing the report marker.')
      return
    }

    if (!isRenderableReportHtml(generatedHtml)) {
      setDraftMessage('', 'Printable report shell rendered but report text was missing.')
      return
    }

    const printWindow = window.open('', '_blank', 'width=900,height=700')
    if (!printWindow) {
      setDraftMessage('', 'Print window was blocked. Allow popups for this site and try again.')
      return
    }

    printWindow.document.open()
    printWindow.document.write(generatedHtml)
    printWindow.document.close()
    printWindow.focus()
    printWindow.setTimeout(() => {
      const marker = printWindow.document.querySelector('#shelter-prep-printable-report')
      const bodyTextLength = printWindow.document.body?.innerText?.trim().length ?? 0
      const bodyHtmlPreview = printWindow.document.body?.innerHTML.slice(0, 1000) || ''
      console.info('[Shelter Prep] printable report page inspection', {
        generatedHtmlLength: generatedHtml.length,
        generatedHtmlHasMarker,
        markerFound: Boolean(marker),
        bodyTextLength,
        bodyHtmlPreview,
      })

      if (!marker) {
        setDraftMessage('', 'Printable report marker was not found after rendering.')
        return
      }

      if (bodyTextLength <= 300) {
        setDraftMessage('', 'Printable report shell rendered but report text was missing.')
        return
      }

      setDraftMessage('Printable report page opened. Review it, then click Print / Save PDF in that page.')
    }, 500)
  }

  async function handleCopyReportText() {
    const plainText = formatReportPlainText(data, draft, sourceNote)
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(plainText)
      } else {
        const textArea = document.createElement('textarea')
        textArea.value = plainText
        textArea.setAttribute('readonly', 'true')
        textArea.style.position = 'fixed'
        textArea.style.opacity = '0'
        document.body.appendChild(textArea)
        textArea.select()
        const copied = document.execCommand('copy')
        document.body.removeChild(textArea)
        if (!copied) throw new Error('Fallback copy failed')
      }
      setDraftMessage('Report copied to clipboard.')
    } catch {
      setDraftMessage('', 'Unable to copy report. Please select and copy manually.')
    }
  }

  return (
    <section
      ref={reportRef}
      className="report-preview report-print-root sp-report-preview"
      style={styles.reviewBox}
      aria-label="Report Preview"
      data-testid="report-preview-root"
      data-report-request-id={data.requestId}
      data-report-workflow-state={data.workflowState}
      data-report-review-status={data.reviewStatus}
    >
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
          <p style={styles.small}>
            Source: {primarySourceReference(data)} - Workflow: {workflowStateLabel(data.workflowState)}
          </p>
        </div>
        <div style={styles.buttonRow}>
          <span style={isReviewedReportStatus(data.reviewStatus) ? styles.badge : styles.badgeMuted}>{data.reviewStatus}</span>
          <button
            type="button"
            className="report-print-hidden sp-print-hidden"
            style={styles.outlineButton}
            onClick={() => {
              setIsEditing((current) => !current)
              setDraftMessage(isEditing ? 'Preview mode shows the current edited draft.' : 'Edit mode is local to this report preview.')
            }}
          >
            {isEditing ? 'Preview Report' : 'Edit Report'}
          </button>
          <button
            type="button"
            className="report-print-hidden sp-print-hidden"
            style={styles.outlineButton}
            data-testid="copy-report"
            onClick={handleCopyReportText}
          >
            Copy Report Text
          </button>
          <button
            type="button"
            className="report-print-hidden sp-print-hidden"
            style={styles.outlineButton}
            data-testid="print-report"
            onClick={handlePrintReport}
          >
            Print Report
          </button>
        </div>
      </div>

      {(actionMessage || actionError) && (
        <div
          className="report-print-hidden sp-print-hidden"
          style={actionError ? { ...styles.noticeBox, background: '#fde8df', borderColor: '#e5b4a3', color: '#8a2f12' } : styles.noticeBox}
        >
          <p style={actionError ? { ...styles.small, color: '#8a2f12' } : styles.small}>
            {actionError || actionMessage}
          </p>
        </div>
      )}

      {isEditing && (
        <div className="report-print-hidden sp-print-hidden" style={styles.noticeBox}>
          <p style={styles.small}>
            Edits are local to this draft preview until copied, printed, or saved through a future report workflow.
            Editing wording does not mark findings human reviewed, approved, sent, or final.
          </p>
        </div>
      )}

      {hasUnverifiedContent && (
        <div className="report-print-warning sp-report-warning" style={styles.warningBox}>
          This report contains AI-organized draft findings. Human review is required before client use. Not valid for unrelated properties.
        </div>
      )}

      <ReportSection title="Property-Specific Output Stamp" styles={styles}>
        <ul style={styles.smallList}>
          {propertySpecificStampLines(data).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </ReportSection>

      <ReportSection title="Workflow Gate" styles={styles} testId="workflow-gating-stamp">
        <p style={styles.small}>
          Free output identifies the shape of the problem. Reviewed workflow moves the transaction forward through evidence, status, role-based views, and final report generation.
        </p>
        <div style={styles.badgeRow}>
          <span style={styles.badgeMuted}>{workflowStateLabel(data.workflowState)}</span>
          {workflowStateUnlocks(data.workflowState).map((item) => (
            <span key={item} style={styles.badgeMuted}>{item}</span>
          ))}
        </div>
      </ReportSection>

      <ReportSection title="Role-Based Share Views" styles={styles}>
        <div style={styles.fileGrid}>
          {data.roleViews.map((view) => (
            <div key={view} style={styles.noticeBox}>
              <strong>{view}</strong>
              <ul style={styles.smallList}>
                {roleViewPolicy(view).map((item) => (
                  <li key={`${view}-${item}`}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </ReportSection>

      {data.errors.length > 0 && (
        <div className="report-print-warning sp-report-warning" style={{ ...styles.noticeBox, background: '#fde8df', borderColor: '#e5b4a3', color: '#8a2f12' }}>
          {data.errors.map((error) => (
            <p key={error} style={{ ...styles.small, color: '#8a2f12' }}>{error}</p>
          ))}
        </div>
      )}

      {data.warnings.length > 0 && (
        <div className="report-print-warning sp-report-warning" style={styles.noticeBox}>
          {data.warnings.map((warning) => (
            <p key={warning} style={styles.small}>{warning}</p>
          ))}
        </div>
      )}

      <ReportSection title="Report Completeness" styles={styles}>
        <div className="sp-report-meta-grid" style={styles.compactMetaGrid}>
          <span>Work groups: {data.summary.totalWorkGroups}</span>
          <span>Human reviewed: {data.summary.humanVerifiedCount}</span>
          <span>Needs review: {data.summary.needsReviewCount}</span>
          <span>Missing info questions: {draftMissingInfo.length}</span>
          <span>Uploaded files: {data.uploadedFiles.length}</span>
        </div>
      </ReportSection>

      <ReportSection title="Property / Request Summary" styles={styles}>
        <div className="sp-report-meta-grid" style={styles.compactMetaGrid}>
          <span>Property: {display(data.propertyAddress)}</span>
          <span>Requester: {display(data.requesterName)}</span>
          <span>Work request: {display(data.requestTitle)}</span>
          <span>Request status: {display(data.requestStatus)}</span>
          <span>Uploaded files: {data.uploadedFiles.length}</span>
          <span>Interpretation: {display(data.interpretationStatus)}</span>
          <span>Review: {data.reviewStatus}</span>
          <span>Source: {primarySourceReference(data)}</span>
          {data.propertyId && <span>Property ID: {data.propertyId}</span>}
        </div>
      </ReportSection>

      <ReportSection title="Executive Summary" styles={styles}>
        {isEditing ? (
          <EditableReportTextarea
            label="Executive summary"
            minHeight={100}
            value={draft.executiveSummary}
            styles={styles}
            onChange={(value) => updateDraft({ executiveSummary: value })}
          />
        ) : (
          <p style={styles.small}>{draft.executiveSummary}</p>
        )}
      </ReportSection>

      <ReportSection title="How to Use This Report" styles={styles}>
        {isEditing ? (
          <EditableReportTextarea
            label="Use guidance"
            minHeight={90}
            value={draft.useGuidance}
            styles={styles}
            onChange={(value) => updateDraft({ useGuidance: value })}
          />
        ) : (
          <p style={styles.small}>{draft.useGuidance}</p>
        )}
      </ReportSection>

      <ReportSection title="Priority Repair Roadmap" styles={styles}>
        {draft.workGroups.length === 0 ? (
          <p style={styles.small}>No interpreted repair items are available for this report yet. Upload evidence or run interpretation before generating a report.</p>
        ) : isEditing ? (
          <div className="sp-report-roadmap" style={styles.inspectionTaskGrid}>
            {visibleWorkGroups.map((group) => (
              <article key={group.id} className="report-print-card sp-report-card" style={styles.inspectionTaskCard}>
                <div style={styles.buttonRow}>
                  <div style={{ flex: 1 }}>
                    <EditableReportInput
                      label="Roadmap item title"
                      value={group.title}
                      styles={styles}
                      onChange={(value) => updateDraftGroup(group.id, { title: value })}
                    />
                  </div>
                  <span style={group.priority === 'Critical' || group.priority === 'High' ? styles.badgeDanger : styles.badgeMuted}>
                    {display(group.priority)}
                  </span>
                </div>
                <div style={styles.badgeRow}>
                  <ReportStatusBadge status={group.reviewStatus || 'needs_review'} styles={styles} />
                  <span style={styles.badgeMuted}>{display(group.category)}</span>
                </div>
                <EditableReportTextarea
                  label="What matters"
                  value={group.whatMatters}
                  styles={styles}
                  onChange={(value) => updateDraftGroup(group.id, { whatMatters: value })}
                />
                <EditableReportTextarea
                  label="Evidence / source summary"
                  value={group.evidenceSummary}
                  styles={styles}
                  onChange={(value) => updateDraftGroup(group.id, { evidenceSummary: value })}
                />
                <EditableReportTextarea
                  label="Likely coordination impact"
                  value={group.likelyCostImpact}
                  styles={styles}
                  onChange={(value) => updateDraftGroup(group.id, { likelyCostImpact: value })}
                />
                <EditableReportTextarea
                  label="Recommended next action"
                  value={group.recommendedAction}
                  styles={styles}
                  onChange={(value) => updateDraftGroup(group.id, { recommendedAction: value })}
                />
                <EditableReportTextarea
                  label="Open questions / missing information"
                  value={group.missingInfo.join('\n')}
                  styles={styles}
                  onChange={(value) => updateDraftGroup(group.id, { missingInfo: cleanLines(value) })}
                />
                {group.sourceIds && group.sourceIds.length > 0 && (
                  <p style={styles.small}>Source refs: {group.sourceIds.join(', ')}</p>
                )}
                <p style={styles.small}>
                  Evidence link: property {display(group.propertyId || data.propertyId)}; source files {group.sourceFileIds?.length ? group.sourceFileIds.join(', ') : 'Not recorded'}; evidence items {group.evidenceItemIds?.length ? group.evidenceItemIds.join(', ') : 'Not recorded'}; repair item {display(group.repairItemId || group.id)}.
                </p>
              </article>
            ))}
          </div>
        ) : (
          <div className="sp-report-roadmap" style={styles.inspectionTaskGrid}>
            {visibleWorkGroups.map((group) => (
              <ReportFindingCard key={group.id} group={group} styles={styles} />
            ))}
          </div>
        )}
        {data.workflowState === 'preview' && draft.workGroups.length > visibleWorkGroups.length && (
          <p style={styles.small}>Preview mode shows sample findings only. Open an active property workspace for the full repair roadmap.</p>
        )}
      </ReportSection>

      <ReportSection title="Known Facts" styles={styles}>
        <p style={styles.small}>{sourceNote}</p>
        {data.knownFacts.length === 0 ? (
          <p style={styles.small}>Unavailable source detail: no uploaded file names or saved interpretation summaries are available for this report.</p>
        ) : (
          <ul style={styles.smallList}>
            {data.knownFacts.map((fact) => (
              <li key={fact}>{fact}</li>
            ))}
          </ul>
        )}
      </ReportSection>

      <ReportSection title="Missing Information" styles={styles}>
        {visibleMissingInfo.length === 0 ? (
          <p style={styles.small}>No missing information questions are currently recorded.</p>
        ) : (
          <ul style={styles.smallList}>
            {visibleMissingInfo.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
        {data.workflowState === 'preview' && draftMissingInfo.length > visibleMissingInfo.length && (
          <p style={styles.small}>Preview mode shows limited questions only. The full checklist belongs inside the property workspace.</p>
        )}
      </ReportSection>

      <ReportSection title="Human Review Status" styles={styles}>
        {draft.workGroups.length === 0 ? (
          <p style={styles.small}>No interpreted items are available for review status display.</p>
        ) : (
          <ul style={styles.smallList}>
            {draft.workGroups.map((group) => (
              <li key={`${group.id}-status`}>
                {group.title}: <ReportStatusBadge status={group.reviewStatus || 'needs_review'} styles={styles} />
              </li>
            ))}
          </ul>
        )}
      </ReportSection>

      <ReportSection title="Recommended Next Actions" styles={styles}>
        {isEditing ? (
          <EditableReportTextarea
            label="Recommended next actions"
            minHeight={110}
            value={draft.recommendedNextActions.join('\n')}
            styles={styles}
            onChange={(value) => updateDraft({ recommendedNextActions: cleanLines(value) })}
          />
        ) : (
          draft.recommendedNextActions.length === 0 ? (
            <p style={styles.small}>No recommended next actions are currently recorded.</p>
          ) : (
            <ul style={styles.smallList}>
              {draft.recommendedNextActions.map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ul>
          )
        )}
      </ReportSection>
    </section>
  )
}
