import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type Invoice = {
  id: string
  created_at: string
  file_name: string
  file_url: string
  vendor_name: string | null
  property_address: string | null
  extraction_status: string | null
  total: number | null
}

export default function InvoiceViewer() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(false)

  async function loadInvoices() {
    setLoading(true)

    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      alert(error.message)
    } else {
      setInvoices(data || [])
    }

    setLoading(false)
  }

  useEffect(() => {
    loadInvoices()
  }, [])

  return (
    <div style={cardStyle}>
      <h2>Invoice Records</h2>

      <button style={buttonStyle} onClick={loadInvoices}>
        {loading ? 'Loading...' : 'Refresh Invoices'}
      </button>

      {invoices.length === 0 && <p>No invoices uploaded yet.</p>}

      {invoices.map((invoice) => (
        <div key={invoice.id} style={itemStyle}>
          <strong>{invoice.file_name}</strong>
          <p>Vendor: {invoice.vendor_name || 'Not entered'}</p>
          <p>Property: {invoice.property_address || 'Not entered'}</p>
          <p>Status: {invoice.extraction_status || 'pending'}</p>
          <p>Total: {invoice.total ? `$${invoice.total}` : 'Not extracted yet'}</p>

          <a href={invoice.file_url} target="_blank" rel="noreferrer">
            Open / Download PDF
          </a>
        </div>
      ))}
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  background: 'white',
  padding: 24,
  borderRadius: 18,
  border: '1px solid #ddd',
  marginBottom: 20,
}

const itemStyle: React.CSSProperties = {
  padding: 16,
  border: '1px solid #ddd',
  borderRadius: 14,
  marginTop: 14,
  background: '#fafafa',
}

const buttonStyle: React.CSSProperties = {
  background: '#0f542d',
  color: 'white',
  padding: '10px 14px',
  border: 'none',
  borderRadius: 10,
  fontWeight: 700,
  cursor: 'pointer',
}