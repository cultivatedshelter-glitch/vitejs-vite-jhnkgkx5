import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Input } from '../components/Input'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import './CompleteProfile.css'

export function AgentCompleteProfile() {
  const navigate = useNavigate()
  const { user, refreshProfile } = useAuth()
  const [companyName, setCompanyName] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (!user) throw new Error('No user found')

      const { error: agentError } = await supabase.from('agents').insert({
        user_id: user.id,
        company_name: companyName,
        phone: phone,
      })

      if (agentError) throw agentError

      await refreshProfile()
      navigate('/agent/dashboard')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="complete-profile-page">
      <div className="complete-profile-container">
        <Card>
          <div className="complete-profile-header">
            <h2>Complete Your Agent Profile</h2>
            <p>Tell us a bit more about yourself to get started</p>
          </div>

          <form onSubmit={handleSubmit} className="complete-profile-form">
            <Input
              id="companyName"
              label="Company Name"
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
              placeholder="Pacific Realty Group"
            />

            <Input
              id="phone"
              label="Phone Number"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              placeholder="(555) 123-4567"
            />

            {error && <div className="error-message">{error}</div>}

            <Button type="submit" variant="primary" fullWidth disabled={loading}>
              {loading ? 'Saving...' : 'Complete Profile'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
