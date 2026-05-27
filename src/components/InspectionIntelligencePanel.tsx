import type { CSSProperties } from 'react'
import { EXTENDED_REVIEW_CUSTOMER_MESSAGE, applyReviewPacketToBundle, type CompactReviewPacket } from '../inspectionIntelligence'
import type { InspectionDraftStatus, InspectionIntelligenceDraft, InspectionRepairBundleDraft, InspectionRepairItemDraft } from '../inspectionIntelligence'

type Styles = Record<string, CSSProperties>

type InspectionIntelligencePanelProps = {
  intelligence?: InspectionIntelligenceDraft | null
  styles: Styles
  money: (value: number | null | undefined) => string
  getStatusLabel: (value?: string | null) => string
  canEdit?: boolean
  savingFindingId?: string | null
  onUpdateFinding?: (itemId: string, changes: Partial<InspectionRepairItemDraft>) => void
  onUpdateBundle?: (bundleId: string, changes: Partial<InspectionRepairBundleDraft>) => void
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
      {packet.missing_info.length > 0 && <p style={styles.small}><strong>Missing info:</strong> {packet.missing_info.join(' ')}</p>}
      <p style={styles.small}><strong>Next action:</strong> {packet.suggested_next_action}</p>
      <p style={styles.small}><strong>Sources:</strong> {packet.source_reference_count} short reference{packet.source_reference_count === 1 ? '' : 's'} available.</p>
    </div>
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
  const topRepairItems = intelligence.repairItems
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
  return (
    <details style={styles.moreActions}>
      <summary style={styles.moreActionsSummary}>Repair findings</summary>
      {intelligence.repairItems.length === 0 ? (
        <div style={styles.empty}>No repair findings extracted yet.</div>
      ) : (
        <div style={styles.inspectionTaskGrid}>
          {intelligence.repairItems.map((item) => (
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
                    defaultValue={item.description}
                    onBlur={(event) => onUpdateFinding(item.id, { description: event.target.value, source_text: event.target.value })}
                  />
                  <div style={styles.grid3}>
                    <select
                      style={styles.input}
                      value={item.severity}
                      onChange={(event) => onUpdateFinding(item.id, { severity: event.target.value })}
                    >
                      {['High', 'Medium', 'Low', 'Needs review'].map((value) => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </select>
                    <select
                      style={styles.input}
                      value={item.urgency}
                      onChange={(event) => onUpdateFinding(item.id, { urgency: event.target.value })}
                    >
                      {['Immediate review', 'Needs licensed trade review', 'Needs review before estimating', 'Needs review'].map((value) => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </select>
                    <select
                      style={styles.input}
                      value={item.status}
                      onChange={(event) => onUpdateFinding(item.id, { status: event.target.value as InspectionDraftStatus })}
                      disabled={savingFindingId === item.id}
                    >
                      {['ai_draft', 'needs_review', 'approved', 'rejected'].map((value) => (
                        <option key={value} value={value}>{getStatusLabel(value)}</option>
                      ))}
                    </select>
                  </div>
                  <textarea
                    style={{ ...styles.input, minHeight: 72 }}
                    defaultValue={item.admin_notes}
                    placeholder="Admin review notes"
                    onBlur={(event) => onUpdateFinding(item.id, { admin_notes: event.target.value })}
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
      {intelligence.repairBundles.length === 0 ? (
        <div style={styles.empty}>No repair bundles created yet.</div>
      ) : (
        <div style={styles.inspectionTaskGrid}>
          {intelligence.repairBundles.map((bundle) => (
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
                {bundle.recommended_trade} - Draft range {money(bundle.estimate_low)} - {money(bundle.estimate_high)} - {bundle.confidence} confidence
              </p>
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
  onUpdateBundle,
}: InspectionIntelligencePanelProps & { intelligence: InspectionIntelligenceDraft }) {
  const activeBundles = intelligence.repairBundles.filter((bundle) => bundle.status !== 'rejected')
  const archivedBundles = intelligence.repairBundles.filter((bundle) => bundle.status === 'rejected')

  if (activeBundles.length === 0) return <p style={styles.small}>No grouped repair work extracted yet.</p>

  return (
    <>
      <div style={styles.inspectionTaskGrid}>
        {activeBundles.map((bundle) => (
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
              </div>
              <span style={styles.badgeMuted}>{bundle.priority}</span>
            </div>
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
                    value={bundle.title}
                    placeholder="Work group title"
                    onChange={(event) => onUpdateBundle(bundle.id, { title: event.target.value })}
                  />
                  <div style={styles.grid3}>
                    <input
                      style={styles.input}
                      value={bundle.recommended_trade}
                      placeholder="Trade"
                      onChange={(event) => onUpdateBundle(bundle.id, { recommended_trade: event.target.value })}
                    />
                    <input
                      style={styles.input}
                      value={bundle.priority}
                      placeholder="Priority"
                      onChange={(event) => onUpdateBundle(bundle.id, { priority: event.target.value })}
                    />
                    <select
                      style={styles.input}
                      value={bundle.status}
                      onChange={(event) => onUpdateBundle(bundle.id, { status: event.target.value as InspectionDraftStatus })}
                    >
                      {['ai_draft', 'needs_review', 'approved', 'rejected'].map((value) => (
                        <option key={value} value={value}>{getStatusLabel(value)}</option>
                      ))}
                    </select>
                  </div>
                  <textarea
                    style={{ ...styles.input, minHeight: 70 }}
                    value={bundle.evidence_summary || ''}
                    placeholder="Evidence summary"
                    onChange={(event) => onUpdateBundle(bundle.id, { evidence_summary: event.target.value })}
                  />
                  <textarea
                    style={{ ...styles.input, minHeight: 70 }}
                    value={bundle.recommended_next_action || ''}
                    placeholder="Next action"
                    onChange={(event) => onUpdateBundle(bundle.id, { recommended_next_action: event.target.value })}
                  />
                  <textarea
                    style={{ ...styles.input, minHeight: 70 }}
                    value={(bundle.missing_information || []).join('\n')}
                    placeholder="Missing information"
                    onChange={(event) => onUpdateBundle(bundle.id, { missing_information: event.target.value.split('\n').filter(Boolean) })}
                  />
                  <textarea
                    style={{ ...styles.input, minHeight: 70 }}
                    value={(bundle.resource_categories || []).join('\n')}
                    placeholder="Resource categories"
                    onChange={(event) => onUpdateBundle(bundle.id, { resource_categories: event.target.value.split('\n').filter(Boolean) })}
                  />
                  <textarea
                    style={{ ...styles.input, minHeight: 70 }}
                    value={bundle.estimate_note || ''}
                    placeholder="Estimate note"
                    onChange={(event) => onUpdateBundle(bundle.id, { estimate_note: event.target.value })}
                  />
                  <textarea
                    style={{ ...styles.input, minHeight: 70 }}
                    value={bundle.contractor_scope_note || ''}
                    placeholder="Contractor scope note"
                    onChange={(event) => onUpdateBundle(bundle.id, { contractor_scope_note: event.target.value })}
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
        ))}
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
        {intelligence.tradeScopes.map((scope, index) => (
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
        {intelligence.missingInformationQuestions.map((question, index) => (
          <li key={`${intelligence.id}-missing-${index}`}>{question}</li>
        ))}
      </ul>
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
      {intelligence.buyerCreditCandidates.length > 0 && (
        <>
          <strong>Buyer credit candidates</strong>
          <ul style={styles.smallList}>
            {intelligence.buyerCreditCandidates.map((item, index) => (
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
        {intelligence.contractorReadyScopes.map((scope, index) => (
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

  return (
    <section style={styles.inspectionTaskPanel}>
      <InspectionSummarySection intelligence={intelligence} styles={styles} getStatusLabel={getStatusLabel} />
      <details open={intelligence.repairBundles.length > 0} style={styles.moreActions}>
        <summary style={styles.moreActionsSummary}>Work Groups ({intelligence.repairBundles.filter((bundle) => bundle.status !== 'rejected').length})</summary>
        <AddressWorkGroupsSection
          intelligence={intelligence}
          styles={styles}
          money={money}
          getStatusLabel={getStatusLabel}
          canEdit={canEdit}
          savingFindingId={savingFindingId}
          onUpdateFinding={onUpdateFinding}
          onUpdateBundle={onUpdateBundle}
        />
      </details>
      {intelligence.repairItems.length > 0 && (
        <RepairFindingsSection
          intelligence={intelligence}
          styles={styles}
          getStatusLabel={getStatusLabel}
          canEdit={canEdit}
          savingFindingId={savingFindingId}
          onUpdateFinding={onUpdateFinding}
        />
      )}
      {intelligence.tradeScopes.length > 0 && <TradeScopesSection intelligence={intelligence} styles={styles} />}
      {intelligence.missingInformationQuestions.length > 0 && <MissingInfoSection intelligence={intelligence} styles={styles} />}
      {(intelligence.estimateLow > 0 || intelligence.estimateHigh > 0) && <EstimateDraftSection intelligence={intelligence} styles={styles} money={money} />}
      {intelligence.sellerPrepSummary && <SellerReportSection intelligence={intelligence} styles={styles} />}
      {intelligence.contractorReadyScopes.length > 0 && <ContractorScopeSection intelligence={intelligence} styles={styles} />}
    </section>
  )
}
