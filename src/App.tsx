import { useState } from 'react'
import { supabase } from './supabase'

export default function App() {
  const [address, setAddress] = useState('')

  async function handleSubmit() {
    const trimmed = address.trim()

    if (!trimmed) {
      alert('Please enter a property address')
      return
    }

    const { error } = await supabase.from('properties').insert([
      { address: trimmed },
    ])

    if (error) {
      alert(error.message)
      console.log(error)
    } else {
      alert('Saved to database ✅')
      setAddress('')
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0b0b0b',
        color: 'white',
        fontFamily: 'Arial, sans-serif',
        padding: 40,
      }}
    >
      <h1 style={{ fontSize: 28, marginTop: 0 }}>
        Shelter<span style={{ color: '#22c55e' }}>Prep</span>
      </h1>

      <p style={{ color: '#aaa', marginBottom: 30 }}>
        Pre-listing coordination, scope, and reporting
      </p>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button style={tab}>New Property</button>
        <button style={tab}>My Listings</button>
        <button style={tab}>Reports</button>
      </div>

      <div
        style={{
          background: '#111',
          borderRadius: 12,
          padding: 20,
          maxWidth: 500,
        }}
      >
        <h3 style={{ marginTop: 0 }}>New Property</h3>

        <input
          placeholder="Property Address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          style={input}
        />

        <button style={button} onClick={handleSubmit}>
          Submit Property
        </button>
      </div>
    </div>
  )
}

const tab = {
  background: '#1f1f1f',
  color: 'white',
  padding: '10px 14px',
  borderRadius: 8,
  border: 'none',
  cursor: 'pointer',
}

const input = {
  width: '100%',
  padding: 12,
  marginTop: 10,
  marginBottom: 15,
  borderRadius: 8,
  border: '1px solid #333',
  background: '#000',
  color: 'white',
}

const button = {
  background: '#22c55e',
  color: 'white',
  padding: '10px 16px',
  borderRadius: 8,
  border: 'none',
  cursor: 'pointer',
}