import React, { useEffect, useMemo, useState } from 'react'
import { supabase, isSupabaseConfigured } from './supabase'

type Status = 'new' | 'needs_info' | 'pending_approval' | 'estimate_ready' | 'archived'
type Tab = 'dashboard' | 'intake' | 'leads' | 'estimates' | 'settings'

type Lead = {
  id: string
  created_at: string
  name: string
  email: string
  phone: string
  property_address: string
  zip: string
  work_type: string
  urgency: string
  description: string
  status: Status
  missing_info: string[]
  estimated_low?: number
  estimated_high?: number
  internal_notes?: string
}

const statusMeta: Record<Status, { label: string; className: string }> = {
  needs_info: { label: 'Needs info', className: 'status status-red' },
  new: { label: 'New lead', className: 'status status-blue' },
  pending_approval: { label: 'In review', className: 'status status-brown' },
  estimate_ready: { label: 'Estimate ready', className: 'status status-green' },
  archived: { label: 'Archived', className: 'status' },
}

const starterLeads: Lead[] = [
  {
    id: 'demo-1',
    created_at: new Date().toISOString(),
    name: 'Demo Agent',
    email: 'agent@example.com',
    phone: '503-000-0000',
    property_address: 'Lake Oswego, OR 97034',
    zip: '97034',
    work_type: 'Inspection repairs',
    urgency: 'Fast turnaround',
    description: 'Buyer/seller repair request. Needs photos, inspection notes, access details, and target deadline.',
    status: 'needs_info',
    missing_info: ['Clear photos', 'Inspection report', 'Access instructions'],
    estimated_low: 1200,
    estimated_high: 3500,
    internal_notes: 'Demo lead. Replace with real Supabase leads after table is connected.',
  },
]

const emptyLead: Omit<Lead, 'id' | 'created_at' | 'status' | 'missing_info'> = {
  name: '',
  email: '',
  phone: '',
  property_address: '',
  zip: '97034',
  work_type: 'General repair',
  urgency: 'Standard',
  description: '',
  estimated_low: undefined,
  estimated_high: undefined,
  internal_notes: '',
}

function money(value?: number) {
  if (!value && value !== 0) return 'Not priced'
  return `$${value.toLocaleString()}`
}

function makeId() {
  return crypto?.randomUUID?.() || String(Date.now())
}

function findMissingInfo(lead: Partial<Lead>) {
  const missing: string[] = []
  if (!lead.property_address) missing.push('Property address')
  if (!lead.description || lead.description.length < 25) missing.push('Clear scope description')
  if (!lead.phone && !lead.email) missing.push('Client contact')
  if (!String(lead.description || '').toLowerCase().includes('photo')) missing.push('Clear photos')
  return missing
}

function scoreLead(lead: Lead) {
  let score = 40
  if (lead.property_address) score += 15
  if (lead.email || lead.phone) score += 15
  if (lead.description.length > 60) score += 15
  if (lead.zip === '97034') score += 10
  if (lead.missing_info.length === 0) score += 10
  return Math.min(score, 100)
}

export default function AppMVP() {
  const [tab, setTab] = useState<Tab>('dashboard')
  const [leads, setLeads] = useState<Lead[]>(starterLeads)
  const [form, setForm] = useState(emptyLead)
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')

  useEffect(() => {
    loadLeads()
  }, [])

  async function loadLeads() {
    if (!isSupabaseConfigured || !supabase) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error
      if (data?.length) {
        setLeads(
          data.map((row: any) => ({
            id: row.id,
            created_at: row.created_at || new Date().toISOString(),
            name: row.name || row.requester_name || '',
            email: row.email || '',
            phone: row.phone || '',
            property_address: row.property_address || row.address || '',
            zip: row.zip || '97034',
            work_type: row.work_type || 'General repair',
            urgency: row.urgency || 'Standard',
            description: row.description || row.scope || '',
            status: (row.status || 'new') as Status,
            missing_info: row.missing_info || [],
            estimated_low: row.estimated_low || undefined,
            estimated_high: row.estimated_high || undefined,
            internal_notes: row.internal_notes || '',
          }))
        )
      }
    } catch (error) {
      console.warn(error)
      setNotice('Supabase leads table was not reachable, so the MVP is running in local demo mode.')
    } finally {
      setLoading(false)
    }
  }

  async function saveLead(event: React.FormEvent) {
    event.preventDefault()
    const missing = findMissingInfo(form)
    const nextLead: Lead = {
      ...form,
      id: makeId(),
      created_at: new Date().toISOString(),
      status: missing.length ? 'needs_info' : 'new',
      missing_info: missing,
    }

    setLeads((current) => [nextLead, ...current])
    setForm(emptyLead)
    setTab('leads')
    setNotice('Lead captured. Review missing info, then move it into estimate approval.')

    if (isSupabaseConfigured && supabase) {
      await supabase.from('leads').insert({
        id: nextLead.id,
        name: nextLead.name,
        email: nextLead.email,
        phone: nextLead.phone,
        property_address: nextLead.property_address,
        zip: nextLead.zip,
        work_type: nextLead.work_type,
        urgency: nextLead.urgency,
        description: nextLead.description,
        status: nextLead.status,
        missing_info: nextLead.missing_info,
        estimated_low: nextLead.estimated_low || null,
        estimated_high: nextLead.estimated_high || null,
        internal_notes: nextLead.internal_notes || null,
      })
    }
  }

  function updateStatus(id: string, status: Status) {
    setLeads((current) => current.map((lead) => (lead.id === id ? { ...lead, status } : lead)))
    if (isSupabaseConfigured && supabase) supabase.from('leads').update({ status }).eq('id', id)
  }

  const visibleLeads = useMemo(() => {
    const text = query.toLowerCase().trim()
    if (!text) return leads
    return leads.filter((lead) => [lead.name, lead.property_address, lead.work_type, lead.description, lead.zip].join(' ').toLowerCase().includes(text))
  }, [leads, query])

  const stats = useMemo(() => ({
    total: leads.length,
    needsInfo: leads.filter((lead) => lead.status === 'needs_info').length,
    ready: leads.filter((lead) => lead.status === 'estimate_ready').length,
    review: leads.filter((lead) => lead.status === 'pending_approval').length,
  }), [leads])

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">Shelter Prep MVP</p>
          <h1>Repair intake → estimate dashboard</h1>
          <p className="muted">For agents, contractors, and inspection repair leads.</p>
        </div>
        <nav>
          {(['dashboard', 'intake', 'leads', 'estimates', 'settings'] as Tab[]).map((item) => (
            <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>
              {item[0].toUpperCase() + item.slice(1)}
            </button>
          ))}
        </nav>
        <div className="connection-card">
          <strong>{isSupabaseConfigured ? 'Supabase connected' : 'Local demo mode'}</strong>
          <span>{isSupabaseConfigured ? 'Using VITE_SUPABASE_URL + anon key.' : 'Add env variables to save live leads.'}</span>
        </div>
      </aside>

      <section className="content">
        {notice && <div className="notice">{notice}<button onClick={() => setNotice('')}>×</button></div>}

        {tab === 'dashboard' && (
          <section className="panel-stack">
            <div className="hero-card">
              <p className="eyebrow">MVP workflow</p>
              <h2>Capture the lead, flag missing info, then prepare an estimate.</h2>
              <p>Color logic: red needs info, blue new lead, brown in review, green estimate ready.</p>
              <button onClick={() => setTab('intake')}>Start new intake</button>
            </div>
            <div className="stats-grid">
              <Stat label="Total leads" value={stats.total} />
              <Stat label="Needs info" value={stats.needsInfo} />
              <Stat label="In review" value={stats.review} />
              <Stat label="Ready" value={stats.ready} />
            </div>
            <LeadList leads={visibleLeads.slice(0, 3)} onStatus={updateStatus} compact />
          </section>
        )}

        {tab === 'intake' && (
          <section className="card">
            <p className="eyebrow">Client / agent intake</p>
            <h2>New repair request</h2>
            <form className="form-grid" onSubmit={saveLead}>
              <input placeholder="Client or agent name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <input placeholder="Property address" value={form.property_address} onChange={(e) => setForm({ ...form, property_address: e.target.value })} />
              <input placeholder="Zip" value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} />
              <select value={form.work_type} onChange={(e) => setForm({ ...form, work_type: e.target.value })}>
                <option>General repair</option><option>Inspection repairs</option><option>Roofing</option><option>Painting</option><option>Plumbing</option><option>Electrical</option><option>Cleaning</option><option>Decking</option>
              </select>
              <select value={form.urgency} onChange={(e) => setForm({ ...form, urgency: e.target.value })}>
                <option>Standard</option><option>Fast turnaround</option><option>Urgent</option><option>Negotiation deadline</option>
              </select>
              <input placeholder="Low estimate" inputMode="numeric" value={form.estimated_low || ''} onChange={(e) => setForm({ ...form, estimated_low: Number(e.target.value) || undefined })} />
              <input placeholder="High estimate" inputMode="numeric" value={form.estimated_high || ''} onChange={(e) => setForm({ ...form, estimated_high: Number(e.target.value) || undefined })} />
              <textarea className="span-2" placeholder="Scope, photos received, inspection notes, access details, deadline..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <textarea className="span-2" placeholder="Internal notes" value={form.internal_notes} onChange={(e) => setForm({ ...form, internal_notes: e.target.value })} />
              <button className="span-2" type="submit">Save lead</button>
            </form>
          </section>
        )}

        {tab === 'leads' && (
          <section className="panel-stack">
            <div className="toolbar"><h2>Lead dashboard</h2><input placeholder="Search leads" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
            {loading ? <p>Loading leads...</p> : <LeadList leads={visibleLeads} onStatus={updateStatus} />}
          </section>
        )}

        {tab === 'estimates' && (
          <section className="panel-stack">
            <div className="toolbar"><h2>Estimate queue</h2><button onClick={() => setTab('intake')}>Add lead</button></div>
            <LeadList leads={leads.filter((lead) => lead.status !== 'archived')} onStatus={updateStatus} estimatesOnly />
          </section>
        )}

        {tab === 'settings' && (
          <section className="card">
            <h2>Next build steps</h2>
            <ol className="steps">
              <li>Create/confirm Supabase table named <code>leads</code>.</li>
              <li>Add required env variables: <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>.</li>
              <li>Add storage buckets for photos and inspection reports.</li>
              <li>Add Edge Function later for AI estimate generation and email notifications.</li>
            </ol>
          </section>
        )}
      </section>
    </main>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="stat"><span>{label}</span><strong>{value}</strong></div>
}

function LeadList({ leads, onStatus, compact, estimatesOnly }: { leads: Lead[]; onStatus: (id: string, status: Status) => void; compact?: boolean; estimatesOnly?: boolean }) {
  if (!leads.length) return <div className="card"><p>No leads yet.</p></div>
  return <div className="lead-grid">{leads.map((lead) => <LeadCard key={lead.id} lead={lead} onStatus={onStatus} compact={compact} estimatesOnly={estimatesOnly} />)}</div>
}

function LeadCard({ lead, onStatus, compact, estimatesOnly }: { lead: Lead; onStatus: (id: string, status: Status) => void; compact?: boolean; estimatesOnly?: boolean }) {
  return (
    <article className="lead-card">
      <div className="lead-head"><span className={statusMeta[lead.status].className}>{statusMeta[lead.status].label}</span><span className="score">Score {scoreLead(lead)}%</span></div>
      <h3>{lead.property_address || 'Address needed'}</h3>
      <p className="muted">{lead.name || 'Unknown contact'} · {lead.work_type} · {lead.zip}</p>
      {!compact && <p>{lead.description}</p>}
      <div className="price-row"><span>{money(lead.estimated_low)}</span><span>to</span><span>{money(lead.estimated_high)}</span></div>
      {!!lead.missing_info.length && !estimatesOnly && <div className="chips">{lead.missing_info.map((item) => <span key={item}>{item}</span>)}</div>}
      <div className="actions">
        <button onClick={() => onStatus(lead.id, 'needs_info')}>Needs info</button>
        <button onClick={() => onStatus(lead.id, 'pending_approval')}>Review</button>
        <button onClick={() => onStatus(lead.id, 'estimate_ready')}>Ready</button>
        <button onClick={() => onStatus(lead.id, 'archived')}>Archive</button>
      </div>
    </article>
  )
}
