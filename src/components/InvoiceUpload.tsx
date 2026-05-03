import React, { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function InvoiceUpload() {
  const [file, setFile] = useState<File | null>(null)
  const [vendorName, setVendorName] = useState('')
  const [propertyAddress, setPropertyAddress] = useState('')
  const [uploading, setUploading] = useState(false)

  async function handleUpload() {
    if (!file) {
      alert('Choose a PDF invoice first.')
      return
    }

    setUploading(true)

    try {
      const filePath = `invoices/${Date.now()}-${file.name}`

      const { error: uploadError } = await supabase.storage
        .from('invoices')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data } = supabase.storage
        .from('invoices')
        .getPublicUrl(filePath)

      const fileUrl = data.publicUrl

      const { error: insertError } = await supabase.from('invoices').insert({
        file_name: file.name,
        file_url: fileUrl,
        storage_path: filePath,
        vendor_name: vendorName,
        property_address: propertyAddress,
        extraction_status: 'pending',
      })

      if (insertError) throw insertError

      alert('Invoice uploaded successfully.')
      setFile(null)
      setVendorName('')
      setPropertyAddress('')
    } catch (error: any) {
      alert(error.message || 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div style={boxStyle}>
      <h2>Upload Invoice PDF</h2>

      <input
        placeholder="Vendor name"
        value={vendorName}
        onChange={(e) => setVendorName(e.target.value)}
        style={inputStyle}
      />

      <input
        placeholder="Property address"
        value={propertyAddress}
        onChange={(e) => setPropertyAddress(e.target.value)}
        style={inputStyle}
      />

      <input
        type="file"
        accept="application/pdf"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        style={inputStyle}
      />

      <button onClick={handleUpload} disabled={uploading} style={buttonStyle}>
        {uploading ? 'Uploading...' : 'Upload Invoice'}
      </button>
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

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: 12,
  marginBottom: 12,
  borderRadius: 10,
  border: '1px solid #ccc',
}

const buttonStyle: React.CSSProperties = {
  background: '#4c3b2f',
  color: 'white',
  padding: '12px 16px',
  border: 'none',
  borderRadius: 10,
  cursor: 'pointer',
}