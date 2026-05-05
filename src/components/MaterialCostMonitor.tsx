import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type MaterialCost = {
  id: string
  material_name: string
  category: string | null
  unit: string | null
  current_price: number | null
  previous_price: number | null
  percent_change: number | null
  source: string | null
  region: string | null
  updated_at: string
}

export default function MaterialCostMonitor() {
  const [materials, setMaterials] = useState<MaterialCost[]>([])
  const [materialName, setMaterialName] = useState('')
  const [category, setCategory] = useState('')
  const [unit, setUnit] = useState('')
  const [currentPrice, setCurrentPrice] = useState('')
  const [source, setSource] = useState('')
  const [loading, setLoading] = useState(false)
  const [updating, setUpdating] = useState(false)

  async function loadMaterials() {
    setLoading(true)

    const { data, error } = await supabase
      .from('material_costs')
      .select('*')
      .order('updated_at', { ascending: false })

    if (error) {
      alert(error.message)
    } else {
      setMaterials(data || [])
    }

    setLoading(false)
  }

  async function updateMaterialCostsNow() {
    setUpdating(true)

    const { data, error } = await supabase.functions.invoke('update-material-costs', {
      body: {},
    })

    if (error) {
      console.error(error)
      alert('Material update failed: ' + error.message)
      setUpdating(false)
      return
    }

    console.log('Material update result:', data)
    alert('Material costs updated.')
    await loadMaterials()
    setUpdating(false)
  }

  async function addMaterial() {
    if (!materialName || !currentPrice) {
      alert('Material name and price are required.')
      return
    }

    const { error } = await supabase.from('material_costs').insert({
      material_name: materialName,
      category,
      unit,
      current_price: Number(currentPrice),
      source,
      region: 'Portland / Lake Oswego',
    })

    if (error) {
      alert(error.message)
      return
    }

    setMaterialName('')
    setCategory('')
    setUnit('')
    setCurrentPrice('')
    setSource('')
    loadMaterials()
  }

  useEffect(() => {
    loadMaterials()
  }, [])

  return (
    <div style={cardStyle}>
      <h2>Material Cost Monitor</h2>
      <p>
        Track manual material costs and pull weekly market data from your automation
        function.
      </p>

      <div style={buttonRowStyle}>
        <button style={buttonStyle} onClick={updateMaterialCostsNow} disabled={updating}>
          {updating ? 'Updating Market Costs...' : 'Update Material Costs Now'}
        </button>

        <button style={outlineButtonStyle} onClick={loadMaterials} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      <hr style={dividerStyle} />

      <h3>Add Manual Material Cost</h3>

      <input
        style={inputStyle}
        placeholder="Material name, ex: 2x4 lumber"
        value={materialName}
        onChange={(e) => setMaterialName(e.target.value)}
      />

      <input
        style={inputStyle}
        placeholder="Category, ex: lumber"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
      />

      <input
        style={inputStyle}
        placeholder="Unit, ex: each / sq ft / sheet"
        value={unit}
        onChange={(e) => setUnit(e.target.value)}
      />

      <input
        style={inputStyle}
        placeholder="Current price"
        value={currentPrice}
        onChange={(e) => setCurrentPrice(e.target.value)}
      />

      <input
        style={inputStyle}
        placeholder="Source, ex: Home Depot / supplier / RSMeans"
        value={source}
        onChange={(e) => setSource(e.target.value)}
      />

      <button style={buttonStyle} onClick={addMaterial}>
        Add Material Cost
      </button>

      <div style={{ marginTop: 24 }}>
        {materials.length === 0 && (
          <p>No material costs yet. Click “Update Material Costs Now” or add one manually.</p>
        )}

        {materials.map((item) => {
          const dollarChange =
            item.previous_price && item.current_price
              ? item.current_price - item.previous_price
              : null

          return (
            <div key={item.id} style={itemStyle}>
              <strong>{item.material_name}</strong>

              <p>
                {item.category || 'Uncategorized'} • {item.unit || 'unit not set'}
              </p>

              <p>Current: {formatPrice(item.current_price)}</p>
              <p>Previous: {formatPrice(item.previous_price)}</p>

              <p>
                Change:{' '}
                {dollarChange === null
                  ? 'No previous price'
                  : `${dollarChange >= 0 ? '+' : ''}${dollarChange.toFixed(2)}`}
              </p>

              <p>
                Percent change:{' '}
                {item.percent_change === null || item.percent_change === undefined
                  ? 'Not calculated'
                  : `${item.percent_change >= 0 ? '+' : ''}${item.percent_change.toFixed(2)}%`}
              </p>

              <p>Source: {item.source || 'Not entered'}</p>
              <p>Region: {item.region || 'Not set'}</p>
              <p style={smallTextStyle}>Updated: {item.updated_at}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function formatPrice(value: number | null) {
  if (value === null || value === undefined) return 'Not set'
  return `$${value}`
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

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: 12,
  marginBottom: 12,
  borderRadius: 10,
  border: '1px solid #ccc',
  boxSizing: 'border-box',
}

const buttonRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap',
  marginBottom: 16,
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

const outlineButtonStyle: React.CSSProperties = {
  background: 'white',
  color: '#0f542d',
  padding: '10px 14px',
  border: '1px solid #0f542d',
  borderRadius: 10,
  fontWeight: 700,
  cursor: 'pointer',
}

const dividerStyle: React.CSSProperties = {
  border: 'none',
  borderTop: '1px solid #ddd',
  margin: '20px 0',
}

const smallTextStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#666',
}