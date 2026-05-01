import React, { useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type {
  ShelterPrepAiEstimate,
  ShelterPrepLeadInput,
} from '../types/shelterprep-ai'

type AiEstimatorProps = {
  initialLead?: ShelterPrepLeadInput
  onResult?: (estimate: ShelterPrepAiEstimate) => void
}

const blankLead: ShelterPrepLeadInput = {
  requesterName: '',
  email: '',
  phone: '',
  workType: '',
  propertyAddress: '',
  city: '',
  state: 'OR',
  zip: '',
  urgency: 'Standard',
  occupancy: 'Unknown',
  timeline: '',
  description: '',
  notes: '',
  photos: [],
  documents: [],
}

function currency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

export default function AiEstimator({ initialLead, onResult }: AiEstimatorProps) {
  const [lead, setLead] = useState<ShelterPrepLeadInput>({
    ...blankLead,
    ...(initialLead || {}),
  })
  const [estimate, setEstimate] = useState<ShelterPrepAiEstimate | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const canRun = useMemo(() => {
    return Boolean(lead.workType?.trim() && lead.description?.trim())
  }, [lead.workType, lead.description])

  function updateLead(patch: Partial<ShelterPrepLeadInput>) {
    setLead((current) => ({ ...current, ...patch }))
  }

  async function runAiEstimate() {
    setError('')
    setEstimate(null)

    if (!canRun) {
      setError('Add at least a work type and project description first.')
      return
    }

    try {
      setLoading(true)

      const { data, error } = await supabase.functions.invoke('ai-estimator', {
        body: {
          lead,
          contractorContext:
            'Shelter Prep / Cultivated Shelter LLC is an Oregon contractor serving the Portland metro area. The app is used for pre-listing repairs, turnovers, inspection punch lists, cleaning, painting, decks, framing, exterior work, and general repairs. Estimates should be practical, clear, and client-ready.',
        },
      })

      if (error) {
        throw new Error(error.message)
      }

      if (!data?.success) {
        throw new Error(data?.error || 'AI estimator failed')
      }

      setEstimate(data.estimate)
      onResult?.(data.estimate)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <section style={styles.card}>
      <div style={styles.header}>
        <div>
          <div style={styles.kicker}>Shelter Prep AI</div>
          <h2 style={styles.title}>AI Estimate Assistant</h2>
          <p style={styles.text}>
            Generate a preliminary scope, pricing tiers, missing info, private notes,
            and a client-ready message.
          </p>
        </div>
        <button
          type="button"
          onClick={runAiEstimate}
          disabled={loading || !canRun}
          style={{
            ...styles.primaryButton,
            opacity: loading || !canRun ? 0.55 : 1,
          }}
        >
          {loading ? 'Building estimate...' : 'Run AI Estimate'}
        </button>
      </div>

      <div style={styles.grid2}>
        <input
          style={styles.input}
          placeholder="Client name"
          value={lead.requesterName || ''}
          onChange={(e) => updateLead({ requesterName: e.target.value })}
        />
        <input
          style={styles.input}
          placeholder="Client email"
          value={lead.email || ''}
          onChange={(e) => updateLead({ email: e.target.value })}
        />
      </div>

      <div style={styles.grid2}>
        <input
          style={styles.input}
          placeholder="Work type, example: Kitchen Remodel"
          value={lead.workType || ''}
          onChange={(e) => updateLead({ workType: e.target.value })}
        />
        <input
          style={styles.input}
          placeholder="Phone"
          value={lead.phone || ''}
          onChange={(e) => updateLead({ phone: e.target.value })}
        />
      </div>

      <input
        style={styles.input}
        placeholder="Property address"
        value={lead.propertyAddress || ''}
        onChange={(e) => updateLead({ propertyAddress: e.target.value })}
      />

      <div style={styles.grid4}>
        <input
          style={styles.input}
          placeholder="City"
          value={lead.city || ''}
          onChange={(e) => updateLead({ city: e.target.value })}
        />
        <input
          style={styles.input}
          placeholder="State"
          value={lead.state || ''}
          onChange={(e) => updateLead({ state: e.target.value })}
        />
        <input
          style={styles.input}
          placeholder="ZIP"
          value={lead.zip || ''}
          onChange={(e) => updateLead({ zip: e.target.value })}
        />
        <select
          style={styles.input}
          value={lead.urgency || 'Standard'}
          onChange={(e) => updateLead({ urgency: e.target.value })}
        >
          <option>Standard</option>
          <option>Urgent</option>
          <option>ASAP</option>
        </select>
      </div>

      <textarea
        style={styles.textarea}
        placeholder="Describe the work needed. Include measurements, photos uploaded, condition, timeline, and anything that may affect pricing."
        value={lead.description || ''}
        onChange={(e) => updateLead({ description: e.target.value })}
      />

      <textarea
        style={styles.textareaSmall}
        placeholder="Private notes for AI, example: client wants budget option, occupied home, needs fast turnaround, likely permit concerns."
        value={lead.notes || ''}
        onChange={(e) => updateLead({ notes: e.target.value })}
      />

      {error ? <div style={styles.error}>{error}</div> : null}

      {estimate ? (
        <div style={styles.results}>
          <h3 style={styles.resultTitle}>AI Estimate Result</h3>

          <div style={styles.resultBox}>
            <strong>Summary</strong>
            <p>{estimate.summary}</p>
          </div>

          <div style={styles.tierGrid}>
            {estimate.pricingTiers.map((tier) => (
              <div key={tier.name} style={styles.tierCard}>
                <h4>{tier.name}</h4>
                <div style={styles.price}>
                  {currency(tier.priceLow)} - {currency(tier.priceHigh)}
                </div>
                <p>{tier.description}</p>
                <ul>
                  {tier.included.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div style={styles.grid2}>
            <List title="Scope" items={estimate.scope.map((item) => `${item.title}: ${item.details}`)} />
            <List title="Missing Info" items={estimate.missingInfo} />
            <List title="Assumptions" items={estimate.assumptions} />
            <List title="Exclusions" items={estimate.exclusions} />
            <List title="Risks / Verify Onsite" items={estimate.risks} />
            <List title="Materials / Allowances" items={estimate.materials} />
          </div>

          <div style={styles.resultBox}>
            <strong>Schedule</strong>
            <p>
              <b>Estimated duration:</b> {estimate.schedule.estimatedDuration}
            </p>
            <p>
              <b>Recommended next step:</b> {estimate.schedule.recommendedNextStep}
            </p>
          </div>

          <div style={styles.resultBox}>
            <strong>Client-ready message</strong>
            <textarea
              style={styles.copyBox}
              readOnly
              value={estimate.clientMessage}
              onFocus={(e) => e.currentTarget.select()}
            />
          </div>

          <div style={styles.privateBox}>
            <strong>Private contractor notes</strong>
            <p>{estimate.privateContractorNotes}</p>
          </div>
        </div>
      ) : null}
    </section>
  )
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div style={styles.resultBox}>
      <strong>{title}</strong>
      {items.length ? (
        <ul>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p>None listed.</p>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: '#fff',
    borderRadius: 20,
    padding: 20,
    border: '1px solid #e2e7e3',
    boxShadow: '0 10px 28px rgba(0,0,0,0.05)',
    color: '#1d2a22',
    fontFamily: 'Inter, Arial, sans-serif',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 16,
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  kicker: {
    color: '#2e6b3f',
    fontWeight: 800,
    letterSpacing: 1,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  title: {
    margin: '4px 0 8px',
    fontSize: 28,
    color: '#123a21',
  },
  text: {
    margin: 0,
    color: '#66756c',
    lineHeight: 1.55,
    maxWidth: 680,
  },
  grid2: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: 12,
  },
  grid4: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: 12,
  },
  input: {
    width: '100%',
    padding: '14px 16px',
    borderRadius: 12,
    border: '1px solid #d5ddd6',
    boxSizing: 'border-box',
    fontSize: 15,
    marginBottom: 12,
  },
  textarea: {
    width: '100%',
    minHeight: 150,
    padding: '14px 16px',
    borderRadius: 12,
    border: '1px solid #d5ddd6',
    boxSizing: 'border-box',
    fontSize: 15,
    marginBottom: 12,
    resize: 'vertical',
  },
  textareaSmall: {
    width: '100%',
    minHeight: 90,
    padding: '14px 16px',
    borderRadius: 12,
    border: '1px solid #d5ddd6',
    boxSizing: 'border-box',
    fontSize: 15,
    marginBottom: 12,
    resize: 'vertical',
  },
  primaryButton: {
    border: 'none',
    background: '#134b26',
    color: '#fff',
    padding: '14px 18px',
    borderRadius: 12,
    cursor: 'pointer',
    fontWeight: 800,
  },
  error: {
    background: '#fff3f3',
    border: '1px solid #efc5c5',
    color: '#9f2424',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  results: {
    marginTop: 16,
    display: 'grid',
    gap: 14,
  },
  resultTitle: {
    margin: 0,
    fontSize: 22,
    color: '#123a21',
  },
  resultBox: {
    background: '#f7f6f1',
    border: '1px solid #e4ded3',
    borderRadius: 14,
    padding: 14,
    lineHeight: 1.55,
  },
  tierGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: 12,
  },
  tierCard: {
    background: '#f1f7f2',
    border: '1px solid #c9e3ce',
    borderRadius: 14,
    padding: 14,
    lineHeight: 1.5,
  },
  price: {
    fontSize: 20,
    fontWeight: 900,
    color: '#134b26',
  },
  copyBox: {
    width: '100%',
    minHeight: 160,
    border: '1px solid #d5ddd6',
    borderRadius: 12,
    padding: 12,
    resize: 'vertical',
    boxSizing: 'border-box',
    marginTop: 10,
    fontSize: 14,
    lineHeight: 1.5,
  },
  privateBox: {
    background: '#fff8e7',
    border: '1px solid #ead8a8',
    borderRadius: 14,
    padding: 14,
    lineHeight: 1.55,
  },
}