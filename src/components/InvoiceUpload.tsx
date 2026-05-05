import React, { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function InvoiceUpload({ onUploaded }: { onUploaded?: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [vendorName, setVendorName] = useState('')
  const [propertyAddress, setPropertyAddress] = useState('')
  const [uploading, setUploading] = useState(false)

  async function uploadInvoice() {
    if (!file) {
      alert('Choose a PDF invoice first.')
      return
    }

    setUploading(true)

    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-')
      const path = `invoices/${Date.now()}-${safeName}`

      const { error: uploadError } = await supabase.storage
        .from('invoices')
        .upload(path, file)

      if (uploadError) throw uploadError

      const { data: publicUrlData } = supabase.storage
        .from('invoices')
        .getPublicUrl(path)

      const { error: insertError } = await supabase.from('invoices').insert({
        file_name: file.name,
        file_url: publicUrlData.publicUrl,
        storage_path: path,
        vendor_name: vendorName,
        property_address: propertyAddress,
        extraction_status: 'pending',
      })

      if (insertError) throw insertError

      alert('Invoice uploaded.')
      setFile(null)
      setVendorName('')
      setPropertyAddress('')
      onUploaded?.()
    } catch (err: any) {
      console.error(err)
      alert(err.message || 'Invoice upload failed.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div style={cardStyle}>
      <h2>Upload Invoice PDF</h2>

      <input
        style={inputStyle}
        placeholder="Vendor name"
        value={vendorName}
        onChange={(e) => setVendorName(e.target.value)}
      />

      <input
        style={inputStyle}
        placeholder="Property address"
        value={propertyAddress}
        onChange={(e) => setPropertyAddress(e.target.value)}
      />

      <input
        style={inputStyle}
        type="file"
        accept="application/pdf"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />

      <button style={buttonStyle} onClick={uploadInvoice} disabled={uploading}>
        {uploading ? 'Uploading...' : 'Upload Invoice'}
      </button>
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

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: 12,
  marginBottom: 12,
  borderRadius: 10,
  border: '1px solid #ccc',
}

const buttonStyle: React.CSSProperties = {
  background: '#0f542d',
  color: 'white',
  padding: '12px 16px',
  border: 'none',
  borderRadius: 10,
  fontWeight: 700,
  cursor: 'pointer',
}