import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type Invoice = {
  id: string
  created_at: string
  file_name: string
  file_url: string
  vendor_name: string | null
  property_address: string | null
  extraction_status: string
}

export default function AdminInvoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)

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
    <div style={boxStyle}>
      <h2>Uploaded Invoices</h2>

      {loading && <p>Loading invoices...</p>}

      {!loading && invoices.length === 0 && <p>No invoices uploaded yet.</p>}

      {invoices.map((invoice) => (
        <div key={invoice.id} style={cardStyle}>
          <strong>{invoice.file_name}</strong>

          <p>Vendor: {invoice.vendor_name || 'Not entered'}</p>
          <p>Property: {invoice.property_address || 'Not entered'}</p>
          <p>Status: {invoice.extraction_status}</p>

          <a href={invoice.file_url} target="_blank" rel="noreferrer">
            Open / Download PDF
          </a>
        </div>
      ))}
    </div>
  )
}

const boxStyle: React.CSSProperties = {
  background: 'white',
  padding: 24,
  borderRadius: 18,
  border: '1px solid #ddd',
  marginBottom: 24,
}

const cardStyle: React.CSSProperties = {
  padding: 16,
  borderRadius: 14,
  border: '1px solid #ddd',
  marginBottom: 12,
  background: '#fafafa',
}