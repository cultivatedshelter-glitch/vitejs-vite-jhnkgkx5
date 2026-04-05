import { useState, FormEvent, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Input } from '../components/Input'
import { Textarea } from '../components/Textarea'
import { Select } from '../components/Select'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import './SubmitLead.css'

const PROJECT_TYPE_OPTIONS = [
  { value: '', label: 'Select project type...' },
  { value: 'General Contracting', label: 'General Contracting' },
  { value: 'Remodeling', label: 'Remodeling' },
  { value: 'Roofing', label: 'Roofing' },
  { value: 'Plumbing', label: 'Plumbing' },
  { value: 'Electrical', label: 'Electrical' },
  { value: 'HVAC', label: 'HVAC' },
  { value: 'Landscaping', label: 'Landscaping' },
  { value: 'Painting', label: 'Painting' },
  { value: 'Flooring', label: 'Flooring' },
  { value: 'Carpentry', label: 'Carpentry' },
]

const BUDGET_OPTIONS = [
  { value: '', label: 'Select budget range...' },
  { value: 'Under $5,000', label: 'Under $5,000' },
  { value: '$5,000 - $10,000', label: '$5,000 - $10,000' },
  { value: '$10,000 - $25,000', label: '$10,000 - $25,000' },
  { value: '$25,000 - $50,000', label: '$25,000 - $50,000' },
  { value: '$50,000 - $100,000', label: '$50,000 - $100,000' },
  { value: 'Over $100,000', label: 'Over $100,000' },
]

const TIMELINE_OPTIONS = [
  { value: '', label: 'Select timeline...' },
  { value: 'ASAP', label: 'ASAP' },
  { value: 'Within 1 month', label: 'Within 1 month' },
  { value: '1-3 months', label: '1-3 months' },
  { value: '3-6 months', label: '3-6 months' },
  { value: '6+ months', label: '6+ months' },
  { value: 'Flexible', label: 'Flexible' },
]

export function SubmitLead() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [agentId, setAgentId] = useState<string | null>(null)
  const [propertyAddress, setPropertyAddress] = useState('')
  const [zipCode, setZipCode] = useState('')
  const [projectType, setProjectType] = useState('')
  const [budget, setBudget] = useState('')
  const [timeline, setTimeline] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchAgentId = async () => {
      if (!user) return

      const { data } = await supabase
        .from('agents')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (data) {
        setAgentId(data.id)
      }
    }

    fetchAgentId()
  }, [user])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (!agentId) throw new Error('Agent profile not found')

      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .insert({
          agent_id: agentId,
          property_address: propertyAddress,
          property_zip_code: zipCode,
          job_type: projectType,
          budget: budget,
          timeline: timeline,
          description: description,
          status: 'open',
        })
        .select()
        .single()

      if (leadError) throw leadError

      const { data: contractors } = await supabase
        .from('contractors')
        .select('*')

      if (contractors) {
        const matches = contractors.filter((contractor) => {
          if (!contractor.services.includes(projectType)) return false

          const distance = calculateDistance(zipCode, contractor.zip_code)
          return distance <= contractor.service_radius
        })

        if (matches.length > 0) {
          const matchInserts = matches.map((contractor) => ({
            lead_id: lead.id,
            contractor_id: contractor.id,
            status: 'pending',
          }))

          await supabase.from('matches').insert(matchInserts)
        }
      }

      navigate('/agent/dashboard')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="submit-lead-page">
      <div className="submit-lead-container">
        <Card>
          <div className="submit-lead-header">
            <h2>Submit a New Lead</h2>
            <p>Find the perfect contractor for your client's project</p>
          </div>

          <form onSubmit={handleSubmit} className="submit-lead-form">
            <div className="form-section">
              <h4>Property Information</h4>
              <Input
                id="propertyAddress"
                label="Property Address"
                type="text"
                value={propertyAddress}
                onChange={(e) => setPropertyAddress(e.target.value)}
                required
                placeholder="123 Cedar St, Seattle, WA"
              />

              <Input
                id="zipCode"
                label="Zip Code"
                type="text"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                required
                placeholder="98101"
                helperText="Used to match with nearby contractors"
              />
            </div>

            <div className="form-section">
              <h4>Project Details</h4>
              <Select
                id="projectType"
                label="Project Type"
                value={projectType}
                onChange={(e) => setProjectType(e.target.value)}
                options={PROJECT_TYPE_OPTIONS}
                required
              />

              <div className="form-grid">
                <Select
                  id="budget"
                  label="Budget Range"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  options={BUDGET_OPTIONS}
                  required
                />

                <Select
                  id="timeline"
                  label="Timeline"
                  value={timeline}
                  onChange={(e) => setTimeline(e.target.value)}
                  options={TIMELINE_OPTIONS}
                  required
                />
              </div>

              <Textarea
                id="description"
                label="Project Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide details about the project scope, specific requirements, and any important considerations..."
                helperText="The more details, the better the match"
              />
            </div>

            {error && <div className="error-message">{error}</div>}

            <Button type="submit" variant="primary" fullWidth disabled={loading}>
              {loading ? 'Finding Contractors...' : 'Submit Lead'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}

function calculateDistance(zip1: string, zip2: string): number {
  const zip1Num = parseInt(zip1.substring(0, 3))
  const zip2Num = parseInt(zip2.substring(0, 3))
  const diff = Math.abs(zip1Num - zip2Num)
  return diff * 10
}
