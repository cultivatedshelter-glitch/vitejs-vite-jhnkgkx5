import type { CSSProperties } from 'react'
import type { InspectionDraftStatus, InspectionIntelligenceDraft } from '../inspectionIntelligence'

type Styles = Record<string, CSSProperties>

type InspectionIntelligencePanelProps = {
  intelligence?: InspectionIntelligenceDraft | null
  styles: Styles
  money: (value: number | null | undefined) => string
  getStatusLabel: (value?: string | null) => string
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
}: InspectionIntelligencePanelProps) {
  if (!intelligence) return null

  return (
    <section style={styles.inspectionTaskPanel}>
      <InspectionSummarySection intelligence={intelligence} styles={styles} getStatusLabel={getStatusLabel} />
      <PriorityItemsSection intelligence={intelligence} styles={styles} getStatusLabel={getStatusLabel} />
      <RepairBundlesSection intelligence={intelligence} styles={styles} money={money} getStatusLabel={getStatusLabel} />
      <TradeScopesSection intelligence={intelligence} styles={styles} />
      <MissingInfoSection intelligence={intelligence} styles={styles} />
      <EstimateDraftSection intelligence={intelligence} styles={styles} money={money} />
      <SellerReportSection intelligence={intelligence} styles={styles} />
      <ContractorScopeSection intelligence={intelligence} styles={styles} />
    </section>
  )
}
