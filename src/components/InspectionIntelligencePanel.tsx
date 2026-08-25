import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { EXTENDED_REVIEW_CUSTOMER_MESSAGE, applyReviewPacketToBundle, sequenceInspectionFindings, type CompactReviewPacket, type InvestigationPriority } from '../agents/inspectionIntelligence'
import type { InspectionDraftStatus, InspectionIntelligenceDraft, InspectionRepairBundleDraft, InspectionRepairItemDraft } from '../agents/inspectionIntelligence'
import {
  commitInspectionReviewDraftValue,
  createInspectionReviewSaveGate,
  updateInspectionReviewDraft,
} from '../lib/reviewProvenance'

type Styles = Record<string, CSSProperties>

type InspectionIntelligencePanelProps = {
  intelligence?: InspectionIntelligenceDraft | null
  styles: Styles
  money: (value: number | null | undefined) => string
  getStatusLabel: (value?: string | null) => string
  canEdit?: boolean
  savingFindingId?: string | null
  onUpdateFinding?: (itemId: string, changes: Partial<InspectionRepairItemDraft>) => Promise<boolean>
  onUpdateBundle?: (bundleId: string, changes: Partial<InspectionRepairBundleDraft>) => Promise<boolean>
}

function safeArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : []
}

function normalizeIntelligence(intelligence: InspectionIntelligenceDraft): InspectionIntelligenceDraft {
  return {
    ...intelligence,
    repairItems: safeArray(intelligence.repairItems),
    repairBundles: safeArray(intelligence.repairBundles),
    workGroups: safeArray(intelligence.workGroups),
    tradeScopes: safeArray(intelligence.tradeScopes),
    priorityRoadmap: safeArray(intelligence.priorityRoadmap),
    buyerCreditCandidates: safeArray(intelligence.buyerCreditCandidates),
    missingInformationQuestions: safeArray(intelligence.missingInformationQuestions),
    contractorReadyScopes: safeArray(intelligence.contractorReadyScopes),
  }
}

export function ReviewStatusBadge({
  status,
  styles,
  getStatusLabel,
}: {
  status?: InspectionDraftStatus | string | null
  styles: Styles
  getStatusLabel: (value?: string | null) => string
}) {
  return <span style={styles.badgeMuted}>{getStatusLabel(status)}</span>
}

function ReviewPacketSummary({
  packet,
  bundle,
  styles,
}: {
  packet?: CompactReviewPacket | null
  bundle: InspectionRepairBundleDraft
  styles: Styles
}) {
  if (!packet) return null
  const missingInfo = safeArray(packet.missing_info)
  const laneLabel = packet.review_lane === 'extended' ? 'Extended' : packet.review_lane === 'deep' ? 'Deep' : 'Standard'
  const targetLabel = bundle.target_review_time_seconds && bundle.target_review_time_seconds >= 172800
    ? 'Target 1-2 business days'
    : bundle.target_review_time_seconds && bundle.target_review_time_seconds >= 600
      ? 'Target up to 10 min'
      : 'Target under 320 sec'

  return (
    <div style={styles.noticeBox}>
      <div style={styles.buttonRow}>
        <span style={packet.review_lane === 'extended' ? styles.badgeDanger : styles.badgeMuted}>{laneLabel}</span>
        <span style={styles.badgeMuted}>{targetLabel}</span>
        <span style={styles.badgeMuted}>{packet.confidence} confidence</span>
        <span style={styles.badgeMuted}>{packet.source_reference_count} refs</span>
      </div>
      {bundle.packet_warning && <p style={styles.small}>{bundle.packet_warning}</p>}
      {packet.review_lane === 'extended' && <p style={styles.small}>{bundle.extended_review_message || EXTENDED_REVIEW_CUSTOMER_MESSAGE}</p>}
      <p style={styles.small}><strong>What matters:</strong> {packet.what_matters}</p>
      {missingInfo.length > 0 && <p style={styles.small}><strong>Missing info:</strong> {missingInfo.join(' ')}</p>}
      <p style={styles.small}><strong>Next action:</strong> {packet.suggested_next_action}</p>
      <p style={styles.small}><strong>Sources:</strong> {packet.source_reference_count} short reference{packet.source_reference_count === 1 ? '' : 's'} available.</p>
    </div>
  )
}

function BundleIntelligenceDetails({
  bundle,
  styles,
}: {
  bundle: InspectionRepairBundleDraft
  styles: Styles
}) {
  const relatedItems = safeArray(bundle.related_report_items)
  const knownFacts = safeArray(bundle.known_facts)
  const unknowns = safeArray(bundle.unknowns)
  const clues = safeArray(bundle.clues)
  const nextEvidence = safeArray(bundle.next_evidence_needed)
  const evidenceReferences = safeArray(bundle.evidence_references)
  const feedEntries = safeArray(bundle.operational_feed_entries)
  const hasOperationalDetails = [
    relatedItems,
    knownFacts,
    unknowns,
    clues,
    nextEvidence,
    evidenceReferences,
    feedEntries,
  ].some((items) => items.length > 0) || Boolean(bundle.trade_owner || bundle.recommended_next_move || bundle.seller_impact)

  if (!hasOperationalDetails) return null

  return (
    <details style={styles.moreActions}>
      <summary style={styles.moreActionsSummary}>Bundle logic</summary>
      <p style={styles.small}>Owner: {bundle.trade_owner || bundle.recommended_trade || 'Admin review needed'}</p>
      <p style={styles.small}>Status: {bundle.recommended_next_move || bundle.recommended_next_action || 'Needs review before use.'}</p>
      {bundle.seller_impact && <p style={styles.small}>Seller impact: {bundle.seller_impact}</p>}
      {bundle.contractor_packet_needed !== undefined && (
        <p style={styles.small}>Contractor packet needed: {bundle.contractor_packet_needed ? 'Yes' : 'No'}</p>
      )}
      {relatedItems.length > 0 && (
        <>
          <strong>Related report items</strong>
          <ul style={styles.smallList}>
            {relatedItems.map((item, index) => (
              <li key={`${bundle.id}-related-${index}`}>{item}</li>
            ))}
          </ul>
        </>
      )}
      {knownFacts.length > 0 && (
        <>
          <strong>Known facts</strong>
          <ul style={styles.smallList}>
            {knownFacts.map((item, index) => (
              <li key={`${bundle.id}-known-${index}`}>{item}</li>
            ))}
          </ul>
        </>
      )}
      {unknowns.length > 0 && (
        <>
          <strong>Unknowns</strong>
          <ul style={styles.smallList}>
            {unknowns.map((item, index) => (
              <li key={`${bundle.id}-unknown-${index}`}>{item}</li>
            ))}
          </ul>
        </>
      )}
      {clues.length > 0 && (
        <>
          <strong>Clues</strong>
          <ul style={styles.smallList}>
            {clues.map((item, index) => (
              <li key={`${bundle.id}-clue-${index}`}>{item}</li>
            ))}
          </ul>
        </>
      )}
      {nextEvidence.length > 0 && (
        <>
          <strong>Next evidence needed</strong>
          <ul style={styles.smallList}>
            {nextEvidence.map((item, index) => (
              <li key={`${bundle.id}-next-evidence-${index}`}>{item}</li>
            ))}
          </ul>
        </>
      )}
      {feedEntries.length > 0 && (
        <details style={styles.moreActions}>
          <summary style={styles.moreActionsSummary}>Operational Feed</summary>
          <ul style={styles.smallList}>
            {feedEntries.map((entry, index) => (
              <li key={`${bundle.id}-feed-${index}`}>
                Finding: {entry.finding} Move: {entry.move} Owner: {entry.owner} Status: {entry.status}
              </li>
            ))}
          </ul>
        </details>
      )}
      {evidenceReferences.length > 0 && (
        <details style={styles.moreActions}>
          <summary style={styles.moreActionsSummary}>Evidence references</summary>
          <ul style={styles.smallList}>
            {evidenceReferences.map((item, index) => (
              <li key={`${bundle.id}-evidence-reference-${index}`}>{item}</li>
            ))}
          </ul>
        </details>
      )}
    </details>
  )
}

export function InspectionSummarySection({ intelligence, styles, getStatusLabel }: Omit<InspectionIntelligencePanelProps, 'money'> & { intelligence: InspectionIntelligenceDraft }) {
  return (
    <details open style={styles.moreActions}>
      <summary style={styles.moreActionsSummary}>Inspection summary</summary>
      <div style={styles.buttonRow}>
        <div style={{ flex: 1 }}>
          <strong>Inspection Intelligence</strong>
          <p style={styles.small}>{intelligence.executiveSummary}</p>
          <p style={styles.small}>
            Source: {intelligence.fileName} - {intelligence.reportType || 'Inspection report'} -{' '}
            {intelligence.inspectionDate || 'Inspection date needs review'}
          </p>
        </div>
        <ReviewStatusBadge status={intelligence.humanReviewStatus} styles={styles} getStatusLabel={getStatusLabel} />
      </div>
      <div style={styles.noticeBox}>
        AI Draft only. Admin review is required before pricing, seller report, contractor scope, or final repair recommendation.
      </div>
    </details>
  )
}

export function PriorityItemsSection({ intelligence, styles, getStatusLabel }: Omit<InspectionIntelligencePanelProps, 'money'> & { intelligence: InspectionIntelligenceDraft }) {
  const repairItems = safeArray(intelligence.repairItems)
  const topRepairItems = repairItems
    .slice()
    .sort((a, b) => b.inspection_risk_score - a.inspection_risk_score)
    .slice(0, 4)

  return (
    <details open style={styles.moreActions}>
      <summary style={styles.moreActionsSummary}>Priority items</summary>
      {topRepairItems.length === 0 ? (
        <div style={styles.empty}>No priority repair items extracted yet. Request readable inspection findings.</div>
      ) : (
        <div style={styles.inspectionTaskGrid}>
          {topRepairItems.map((item) => (
            <div key={item.id} style={styles.inspectionTaskCard}>
              <div style={styles.buttonRow}>
                <div style={{ flex: 1 }}>
                  <strong>{item.category}</strong>
                  <p style={styles.small}>{item.description}</p>
                </div>
                <span style={item.inspection_risk_score >= 8 ? styles.badgeDanger : styles.badgeMuted}>
                  Risk {item.inspection_risk_score}/10
                </span>
                <ReviewStatusBadge status={item.status} styles={styles} getStatusLabel={getStatusLabel} />
              </div>
              <p style={styles.small}>
                {item.trade} - {item.urgency} - {item.recommendation.replace(/_/g, ' ')}
              </p>
            </div>
          ))}
        </div>
      )}
    </details>
  )
}

export function RepairFindingsSection({
  intelligence,
  styles,
  getStatusLabel,
  canEdit,
  savingFindingId,
  onUpdateFinding,
}: Omit<InspectionIntelligencePanelProps, 'money'> & { intelligence: InspectionIntelligenceDraft }) {
  const [drafts, setDrafts] = useState<Record<string, { description: string; admin_notes: string }>>({})
  const saveGate = useRef(createInspectionReviewSaveGate())

  useEffect(() => {
    setDrafts(Object.fromEntries(safeArray(intelligence.repairItems).map((item) => [item.id, {
      description: item.description || '',
      admin_notes: item.admin_notes || '',
    }])))
  }, [intelligence.repairItems])

  async function commitFindingText(
    item: InspectionRepairItemDraft,
    field: 'description' | 'admin_notes'
  ) {
    if (!onUpdateFinding) return
    const committedValue = item[field] || ''
    const draftValue = drafts[item.id]?.[field] ?? committedValue
    if (draftValue === committedValue) return

    await commitInspectionReviewDraftValue({
      gate: saveGate.current,
      key: item.id,
      committedValue,
      draftValue,
      save: (value) => onUpdateFinding(item.id, { [field]: value }),
      rollback: (value) => setDrafts((current) => ({
        ...current,
        [item.id]: updateInspectionReviewDraft(
          current[item.id] || { description: item.description || '', admin_notes: item.admin_notes || '' },
          { [field]: value }
        ),
      })),
    })
  }

  return (
    <details style={styles.moreActions}>
      <summary style={styles.moreActionsSummary}>Repair findings</summary>
      {safeArray(intelligence.repairItems).length === 0 ? (
        <div style={styles.empty}>No repair findings extracted yet.</div>
      ) : (
        <div style={styles.inspectionTaskGrid}>
          {safeArray(intelligence.repairItems).map((item) => (
            <div key={item.id} style={styles.inspectionTaskCard}>
              <div style={styles.buttonRow}>
                <div style={{ flex: 1 }}>
                  <strong>{item.category}</strong>
                  <p style={styles.small}>
                    {item.trade} - {item.urgency} - Risk {item.inspection_risk_score}/10
                  </p>
                </div>
                <ReviewStatusBadge status={item.status} styles={styles} getStatusLabel={getStatusLabel} />
              </div>

              {canEdit && onUpdateFinding ? (
                <>
                  <textarea
                    style={{ ...styles.input, minHeight: 82 }}
                    value={drafts[item.id]?.description ?? item.description ?? ''}
                    disabled={savingFindingId === item.id}
                    onChange={(event) => setDrafts((current) => ({
                      ...current,
                      [item.id]: updateInspectionReviewDraft(
                        current[item.id] || { description: item.description || '', admin_notes: item.admin_notes || '' },
                        { description: event.target.value }
                      ),
                    }))}
                    onBlur={() => void commitFindingText(item, 'description')}
                  />
                  <div style={styles.grid3}>
                    <select
                      style={styles.input}
                      value={item.severity}
                      disabled={savingFindingId === item.id}
                      onChange={(event) => void saveGate.current.run(item.id, () => onUpdateFinding(item.id, { severity: event.target.value }))}
                    >
                      {['High', 'Medium', 'Low', 'Needs review'].map((value) => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </select>
                    <select
                      style={styles.input}
                      value={item.urgency}
                      disabled={savingFindingId === item.id}
                      onChange={(event) => void saveGate.current.run(item.id, () => onUpdateFinding(item.id, { urgency: event.target.value }))}
                    >
                      {['Immediate review', 'Needs licensed trade review', 'Needs review before estimating', 'Needs review'].map((value) => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </select>
                    <select
                      style={styles.input}
                      value={item.status}
                      onChange={(event) => void saveGate.current.run(item.id, () => onUpdateFinding(item.id, { status: event.target.value as InspectionDraftStatus }))}
                      disabled={savingFindingId === item.id}
                    >
                      {['ai_draft', 'needs_review', 'approved', 'rejected'].map((value) => (
                        <option key={value} value={value}>{getStatusLabel(value)}</option>
                      ))}
                    </select>
                  </div>
                  <textarea
                    style={{ ...styles.input, minHeight: 72 }}
                    value={drafts[item.id]?.admin_notes ?? item.admin_notes ?? ''}
                    disabled={savingFindingId === item.id}
                    placeholder="Admin review notes"
                    onChange={(event) => setDrafts((current) => ({
                      ...current,
                      [item.id]: updateInspectionReviewDraft(
                        current[item.id] || { description: item.description || '', admin_notes: item.admin_notes || '' },
                        { admin_notes: event.target.value }
                      ),
                    }))}
                    onBlur={() => void commitFindingText(item, 'admin_notes')}
                  />
                </>
              ) : (
                <>
                  <p style={styles.small}>{item.description}</p>
                  {item.admin_notes && <p style={styles.small}>Admin notes: {item.admin_notes}</p>}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </details>
  )
}

export function RepairBundlesSection({ intelligence, styles, money, getStatusLabel }: InspectionIntelligencePanelProps & { intelligence: InspectionIntelligenceDraft }) {
  return (
    <details style={styles.moreActions}>
      <summary style={styles.moreActionsSummary}>Repair bundles</summary>
      {safeArray(intelligence.repairBundles).length === 0 ? (
        <div style={styles.empty}>No repair bundles created yet.</div>
      ) : (
        <div style={styles.inspectionTaskGrid}>
          {safeArray(intelligence.repairBundles).map((bundle) => (
            <div key={bundle.id} style={styles.inspectionTaskCard}>
              <div style={styles.buttonRow}>
                <div style={{ flex: 1 }}>
                  <strong>{bundle.title}</strong>
                  <p style={styles.small}>{bundle.summary}</p>
                </div>
                <span style={styles.badge}>{bundle.priority}</span>
                <ReviewStatusBadge status={bundle.status} styles={styles} getStatusLabel={getStatusLabel} />
              </div>
              <p style={styles.small}>{bundle.risk_explanation}</p>
              <p style={styles.small}>
                {bundle.trade_owner || bundle.recommended_trade} - Draft range {money(bundle.estimate_low)} - {money(bundle.estimate_high)} - {bundle.confidence} confidence
              </p>
              <BundleIntelligenceDetails bundle={bundle} styles={styles} />
            </div>
          ))}
        </div>
      )}
    </details>
  )
}

export function AddressWorkGroupsSection({
  intelligence,
  styles,
  getStatusLabel,
  canEdit,
  savingFindingId,
  onUpdateBundle,
}: InspectionIntelligencePanelProps & { intelligence: InspectionIntelligenceDraft }) {
  const repairBundles = safeArray(intelligence.repairBundles)
  const [drafts, setDrafts] = useState<Record<string, InspectionRepairBundleDraft>>({})
  const saveGate = useRef(createInspectionReviewSaveGate())

  useEffect(() => {
    setDrafts(Object.fromEntries(repairBundles.map((bundle) => [bundle.id, { ...bundle }])))
  }, [intelligence.repairBundles])

  function editBundle(bundle: InspectionRepairBundleDraft, changes: Partial<InspectionRepairBundleDraft>) {
    setDrafts((current) => ({
      ...current,
      [bundle.id]: updateInspectionReviewDraft(current[bundle.id] || bundle, changes),
    }))
  }

  async function commitBundleField<K extends keyof InspectionRepairBundleDraft>(
    bundle: InspectionRepairBundleDraft,
    field: K
  ) {
    if (!onUpdateBundle) return
    const draft = drafts[bundle.id] || bundle
    if (JSON.stringify(draft[field]) === JSON.stringify(bundle[field])) return

    await commitInspectionReviewDraftValue({
      gate: saveGate.current,
      key: bundle.id,
      committedValue: bundle[field],
      draftValue: draft[field],
      save: (value) => onUpdateBundle(bundle.id, { [field]: value }),
      rollback: (value) => setDrafts((current) => ({
        ...current,
        [bundle.id]: updateInspectionReviewDraft(current[bundle.id] || bundle, { [field]: value }),
      })),
    })
  }

  const activeBundles = repairBundles.filter((bundle) => bundle.status !== 'rejected')
  const archivedBundles = repairBundles.filter((bundle) => bundle.status === 'rejected')

  if (activeBundles.length === 0) return <p style={styles.small}>No grouped repair work extracted yet.</p>

  return (
    <>
      <div style={styles.inspectionTaskGrid}>
        {activeBundles.map((bundle) => {
          const draft = drafts[bundle.id] || bundle
          const saving = savingFindingId === bundle.id
          return (
            <div key={bundle.id} style={styles.inspectionTaskCard}>
            <ReviewPacketSummary
              packet={bundle.compact_review_packet || applyReviewPacketToBundle(bundle, intelligence.propertyAddress).compact_review_packet}
              bundle={bundle.compact_review_packet ? bundle : applyReviewPacketToBundle(bundle, intelligence.propertyAddress)}
              styles={styles}
            />
            <div style={styles.buttonRow}>
              <div style={{ flex: 1 }}>
                <strong>{bundle.title}</strong>
                <p style={styles.small}>{bundle.evidence_summary || bundle.summary}</p>
                <p style={styles.small}>
                  Owner: {bundle.trade_owner || bundle.recommended_trade || 'Admin'} - Status:{' '}
                  {getStatusLabel(bundle.review_status || bundle.status)}
                </p>
              </div>
              <span style={styles.badgeMuted}>{bundle.priority}</span>
            </div>
            <BundleIntelligenceDetails bundle={bundle} styles={styles} />
            <details style={styles.moreActions}>
              <summary style={styles.moreActionsSummary}>Show Audit Details</summary>
            <p style={styles.small}>Trade: {bundle.recommended_trade}</p>
            <p style={styles.small}>Next action: {bundle.recommended_next_action || 'Review before use.'}</p>
            <details style={styles.moreActions}>
              <summary style={styles.moreActionsSummary}>Review</summary>
              {canEdit && onUpdateBundle ? (
                <>
                  <input
                    style={styles.input}
                    value={draft.title}
                    disabled={saving}
                    placeholder="Work group title"
                    onChange={(event) => editBundle(bundle, { title: event.target.value })}
                    onBlur={() => void commitBundleField(bundle, 'title')}
                  />
                  <div style={styles.grid3}>
                    <input
                      style={styles.input}
                      value={draft.recommended_trade}
                      disabled={saving}
                      placeholder="Trade"
                      onChange={(event) => editBundle(bundle, { recommended_trade: event.target.value })}
                      onBlur={() => void commitBundleField(bundle, 'recommended_trade')}
                    />
                    <input
                      style={styles.input}
                      value={draft.priority}
                      disabled={saving}
                      placeholder="Priority"
                      onChange={(event) => editBundle(bundle, { priority: event.target.value })}
                      onBlur={() => void commitBundleField(bundle, 'priority')}
                    />
                    <select
                      style={styles.input}
                      value={bundle.status}
                      disabled={saving}
                      onChange={(event) => void saveGate.current.run(bundle.id, () => onUpdateBundle(bundle.id, { status: event.target.value as InspectionDraftStatus }))}
                    >
                      {['ai_draft', 'needs_review', 'approved', 'rejected'].map((value) => (
                        <option key={value} value={value}>{getStatusLabel(value)}</option>
                      ))}
                    </select>
                  </div>
                  <textarea
                    style={{ ...styles.input, minHeight: 70 }}
                    value={draft.evidence_summary || ''}
                    disabled={saving}
                    placeholder="Evidence summary"
                    onChange={(event) => editBundle(bundle, { evidence_summary: event.target.value })}
                    onBlur={() => void commitBundleField(bundle, 'evidence_summary')}
                  />
                  <textarea
                    style={{ ...styles.input, minHeight: 70 }}
                    value={draft.recommended_next_action || ''}
                    disabled={saving}
                    placeholder="Next action"
                    onChange={(event) => editBundle(bundle, { recommended_next_action: event.target.value })}
                    onBlur={() => void commitBundleField(bundle, 'recommended_next_action')}
                  />
                  <textarea
                    style={{ ...styles.input, minHeight: 70 }}
                    value={(draft.missing_information || []).join('\n')}
                    disabled={saving}
                    placeholder="Missing information"
                    onChange={(event) => editBundle(bundle, { missing_information: event.target.value.split('\n').filter(Boolean) })}
                    onBlur={() => void commitBundleField(bundle, 'missing_information')}
                  />
                  <textarea
                    style={{ ...styles.input, minHeight: 70 }}
                    value={(draft.resource_categories || []).join('\n')}
                    disabled={saving}
                    placeholder="Resource categories"
                    onChange={(event) => editBundle(bundle, { resource_categories: event.target.value.split('\n').filter(Boolean) })}
                    onBlur={() => void commitBundleField(bundle, 'resource_categories')}
                  />
                  <textarea
                    style={{ ...styles.input, minHeight: 70 }}
                    value={draft.estimate_note || ''}
                    disabled={saving}
                    placeholder="Estimate note"
                    onChange={(event) => editBundle(bundle, { estimate_note: event.target.value })}
                    onBlur={() => void commitBundleField(bundle, 'estimate_note')}
                  />
                  <textarea
                    style={{ ...styles.input, minHeight: 70 }}
                    value={draft.contractor_scope_note || ''}
                    disabled={saving}
                    placeholder="Contractor scope note"
                    onChange={(event) => editBundle(bundle, { contractor_scope_note: event.target.value })}
                    onBlur={() => void commitBundleField(bundle, 'contractor_scope_note')}
                  />
                </>
              ) : null}
              <p style={styles.small}>Area: {bundle.work_area || bundle.system_category}</p>
              <p style={styles.small}>Severity: {bundle.severity || 'Needs review'}; safety concern: {bundle.safety_concern ? 'yes' : 'no'}</p>
              <p style={styles.small}>Source: {bundle.source_page || 'Inspection source needs review'}</p>
              <p style={styles.small}>Source text: {bundle.source_text || bundle.summary}</p>
              {(bundle.missing_information || []).length > 0 && (
                <details style={styles.moreActions}>
                  <summary style={styles.moreActionsSummary}>Missing information</summary>
                  <ul style={styles.smallList}>
                    {(bundle.missing_information || []).map((item, index) => (
                      <li key={`${bundle.id}-missing-${index}`}>{item}</li>
                    ))}
                  </ul>
                </details>
              )}
            </details>
            {(bundle.resource_categories || []).length > 0 && (
              <details style={styles.moreActions}>
                <summary style={styles.moreActionsSummary}>Show Full Sources</summary>
                  <ul style={styles.smallList}>
                    {(bundle.resource_categories || []).map((item, index) => (
                      <li key={`${bundle.id}-resource-${index}`}>{item}</li>
                    ))}
                  </ul>
                  <p style={styles.small}>Source research not yet performed.</p>
                </details>
              )}
            </details>
            </div>
          )
        })}
      </div>
      {archivedBundles.length > 0 && (
        <details style={styles.moreActions}>
          <summary style={styles.moreActionsSummary}>Rejected / Archived ({archivedBundles.length})</summary>
          <ul style={styles.smallList}>
            {archivedBundles.map((bundle) => (
              <li key={`archived-bundle-${bundle.id}`}>{bundle.title}</li>
            ))}
          </ul>
        </details>
      )}
    </>
  )
}

export function TradeScopesSection({ intelligence, styles }: { intelligence: InspectionIntelligenceDraft; styles: Styles }) {
  return (
    <details style={styles.moreActions}>
      <summary style={styles.moreActionsSummary}>Trade scopes</summary>
      <ul style={styles.smallList}>
        {safeArray(intelligence.tradeScopes).map((scope, index) => (
          <li key={`${intelligence.id}-trade-${index}`}>{scope}</li>
        ))}
      </ul>
    </details>
  )
}

export function MissingInfoSection({ intelligence, styles }: { intelligence: InspectionIntelligenceDraft; styles: Styles }) {
  return (
    <details style={styles.moreActions}>
      <summary style={styles.moreActionsSummary}>Missing information</summary>
      <ul style={styles.smallList}>
        {safeArray(intelligence.missingInformationQuestions).map((question, index) => (
          <li key={`${intelligence.id}-missing-${index}`}>{question}</li>
        ))}
      </ul>
    </details>
  )
}

const INVESTIGATION_LABELS: Record<InvestigationPriority, string> = {
  investigate_first: 'Investigate First',
  price_next: 'Price Next',
  can_wait: 'Can Wait',
  unknown: 'Needs Review',
}

export function InvestigationSequenceSection({
  intelligence,
  styles,
}: {
  intelligence: InspectionIntelligenceDraft
  styles: Styles
}) {
  const sequenced = sequenceInspectionFindings(
    safeArray(intelligence.workGroups).filter((bundle) => bundle.status !== 'rejected')
  )
  const supported = sequenced.filter((bundle) => bundle.investigation_priority && bundle.investigation_priority !== 'unknown')
  if (supported.length === 0) return null
  const first = supported[0]

  return (
    <details open style={styles.moreActions}>
      <summary style={styles.moreActionsSummary}>What to Investigate First</summary>
      <div style={styles.noticeBox}>
        <strong>Next: {first.investigation_priority === 'investigate_first'
          ? safeArray(first.next_evidence_needed)[0] || first.recommended_next_action || first.recommended_next_move || `Review ${first.title}`
          : `Review ${first.title}`}</strong>
        <p style={styles.small}>AI Draft · Human review required before transaction, negotiation, scope, or spending decisions.</p>
      </div>
      <div style={styles.inspectionTaskGrid}>
        {supported.map((bundle) => (
          <div key={`investigation-${bundle.id}`} style={styles.inspectionTaskCard}>
            <div style={styles.buttonRow}>
              <strong>{bundle.title}</strong>
              <span style={bundle.investigation_priority === 'investigate_first' ? styles.badgeDanger : styles.badgeMuted}>
                {INVESTIGATION_LABELS[bundle.investigation_priority || 'unknown']}
              </span>
            </div>
            <p style={styles.small}>
              Transaction impact: {bundle.transaction_impact || 'unknown'} · Potential cost exposure: {bundle.potential_cost_exposure || 'unknown'}
            </p>
            {bundle.dependency_reason && <p style={styles.small}>{bundle.dependency_reason}</p>}
            <details style={styles.moreActions}>
              <summary style={styles.moreActionsSummary}>Evidence and uncertainty</summary>
              <p style={styles.small}><strong>Known:</strong> {safeArray(bundle.known_facts).join(' ') || bundle.evidence_summary || 'No reviewed condition established.'}</p>
              <p style={styles.small}><strong>Unknown:</strong> {safeArray(bundle.unknowns).join(' ') || 'No additional unknown recorded.'}</p>
              <p style={styles.small}><strong>Sources:</strong> {safeArray(bundle.evidence_references).length} linked reference{safeArray(bundle.evidence_references).length === 1 ? '' : 's'}.</p>
            </details>
          </div>
        ))}
      </div>
    </details>
  )
}

export function EstimateDraftSection({ intelligence, styles, money }: Pick<InspectionIntelligencePanelProps, 'styles' | 'money'> & { intelligence: InspectionIntelligenceDraft }) {
  return (
    <details style={styles.moreActions}>
      <summary style={styles.moreActionsSummary}>Estimate draft</summary>
      <div style={styles.noticeBox}>
        Draft range: <strong>{money(intelligence.estimateLow)} - {money(intelligence.estimateHigh)}</strong>
        <br />
        Confidence: {intelligence.estimateConfidence}
      </div>
      <p style={styles.small}>
        AI cannot finalize pricing. Admin and trade review are required before estimates are used externally.
      </p>
    </details>
  )
}

export function SellerReportSection({ intelligence, styles }: { intelligence: InspectionIntelligenceDraft; styles: Styles }) {
  return (
    <details style={styles.moreActions}>
      <summary style={styles.moreActionsSummary}>Seller report</summary>
      <p style={styles.small}>{intelligence.sellerPrepSummary}</p>
      {safeArray(intelligence.buyerCreditCandidates).length > 0 && (
        <>
          <strong>Buyer credit candidates</strong>
          <ul style={styles.smallList}>
            {safeArray(intelligence.buyerCreditCandidates).map((item, index) => (
              <li key={`${intelligence.id}-credit-${index}`}>{item}</li>
            ))}
          </ul>
        </>
      )}
    </details>
  )
}

export function ContractorScopeSection({ intelligence, styles }: { intelligence: InspectionIntelligenceDraft; styles: Styles }) {
  return (
    <details style={styles.moreActions}>
      <summary style={styles.moreActionsSummary}>Contractor scope</summary>
      <ul style={styles.smallList}>
        {safeArray(intelligence.contractorReadyScopes).map((scope, index) => (
          <li key={`${intelligence.id}-contractor-${index}`}>{scope}</li>
        ))}
      </ul>
      <div style={styles.noticeBox}>{intelligence.internalAdminReviewRecord}</div>
    </details>
  )
}

export function InspectionIntelligencePanel({
  intelligence,
  styles,
  money,
  getStatusLabel,
  canEdit,
  savingFindingId,
  onUpdateFinding,
  onUpdateBundle,
}: InspectionIntelligencePanelProps) {
  if (!intelligence) return null
  const safeIntelligence = normalizeIntelligence(intelligence)
  const activeRepairBundles = safeIntelligence.repairBundles.filter((bundle) => bundle.status !== 'rejected')

  return (
    <section style={styles.inspectionTaskPanel}>
      <InspectionSummarySection intelligence={safeIntelligence} styles={styles} getStatusLabel={getStatusLabel} />
      <InvestigationSequenceSection intelligence={safeIntelligence} styles={styles} />
      <details open={safeIntelligence.repairBundles.length > 0} style={styles.moreActions}>
        <summary style={styles.moreActionsSummary}>Work Groups ({activeRepairBundles.length})</summary>
        <AddressWorkGroupsSection
          intelligence={safeIntelligence}
          styles={styles}
          money={money}
          getStatusLabel={getStatusLabel}
          canEdit={canEdit}
          savingFindingId={savingFindingId}
          onUpdateFinding={onUpdateFinding}
          onUpdateBundle={onUpdateBundle}
        />
      </details>
      {safeIntelligence.repairItems.length > 0 && (
        <RepairFindingsSection
          intelligence={safeIntelligence}
          styles={styles}
          getStatusLabel={getStatusLabel}
          canEdit={canEdit}
          savingFindingId={savingFindingId}
          onUpdateFinding={onUpdateFinding}
        />
      )}
      {safeIntelligence.tradeScopes.length > 0 && <TradeScopesSection intelligence={safeIntelligence} styles={styles} />}
      {safeIntelligence.missingInformationQuestions.length > 0 && <MissingInfoSection intelligence={safeIntelligence} styles={styles} />}
      {(safeIntelligence.estimateLow > 0 || safeIntelligence.estimateHigh > 0) && <EstimateDraftSection intelligence={safeIntelligence} styles={styles} money={money} />}
      {safeIntelligence.sellerPrepSummary && <SellerReportSection intelligence={safeIntelligence} styles={styles} />}
    </section>
  )
}
