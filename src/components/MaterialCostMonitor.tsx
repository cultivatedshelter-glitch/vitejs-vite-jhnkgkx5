import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type MaterialCost = {
  id: string
  material_name: string
  category: string | null
  unit: string | null
  current_price: number | null
  previous_price: number | null
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
      <p>Phase 1: manual/API-ready material cost database.</p>

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

      <button style={{ ...buttonStyle, marginLeft: 10 }} onClick={loadMaterials}>
        {loading ? 'Loading...' : 'Refresh'}
      </button>

      <div style={{ marginTop: 20 }}>
        {materials.map((item) => {
          const change =
            item.previous_price && item.current_price
              ? item.current_price - item.previous_price
              : null

          return (
            <div key={item.id} style={itemStyle}>
              <strong>{item.material_name}</strong>
              <p>
                {item.category || 'Uncategorized'} • {item.unit || 'unit not set'}
              </p>
              <p>Current: ${item.current_price ?? 0}</p>
              <p>Previous: ${item.previous_price ?? 0}</p>
              <p>
                Change:{' '}
                {change === null
                  ? 'No previous price'
                  : `${change >= 0 ? '+' : ''}$${change.toFixed(2)}`}
              </p>
              <p>Source: {item.source || 'Not entered'}</p>
              <p>Region: {item.region || 'Not set'}</p>
            </div>
          )
        })}
      </div>
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
  padding: '10px 14px',
  border: 'none',
  borderRadius: 10,
  fontWeight: 700,
  cursor: 'pointer',
}