import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Card } from '../components/Card'
import './Dashboard.css'

interface Lead {
  id: string
  property_address: string
  property_zip_code: string
  job_type: string
  budget: string
  timeline: string
  description: string
  status: string
  created_at: string
  agent: {
    company_name: string
    phone: string
    profile: {
      full_name: string
      email: string
    }
  }
}

interface Match {
  id: string
  lead_id: string
  status: string
  created_at: string
  lead: Lead
}

export function ContractorDashboard() {
  const { user, profile } = useAuth()
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchMatches = async () => {
      if (!user) return

      const { data: contractorData } = await supabase
        .from('contractors')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!contractorData) return

      const { data: matchesData } = await supabase
        .from('matches')
        .select(
          `
          *,
          lead:leads (
            *,
            agent:agents (
              company_name,
              phone,
              profile:profiles (
                full_name,
                email
              )
            )
          )
        `
        )
        .eq('contractor_id', contractorData.id)
        .order('created_at', { ascending: false })

      if (matchesData) {
        setMatches(matchesData as unknown as Match[])
      }

      setLoading(false)
    }

    fetchMatches()
  }, [user])

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-container">
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-container">
        <div className="dashboard-header">
          <div>
            <h2>Welcome back, {profile?.full_name}</h2>
            <p>Review incoming leads from agents</p>
          </div>
        </div>

        {matches.length === 0 ? (
          <Card>
            <div className="empty-state">
              <h3>No leads yet</h3>
              <p>
                When agents submit projects matching your services and location,
                they'll appear here
              </p>
            </div>
          </Card>
        ) : (
          <div className="leads-list">
            {matches.map((match) => (
              <Card key={match.id}>
                <div className="lead-card">
                  <div className="lead-header">
                    <div>
                      <h3>{match.lead.job_type}</h3>
                      <p className="lead-address">{match.lead.property_address}</p>
                    </div>
                    <div className="lead-badge">
                      {new Date(match.created_at).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="lead-details">
                    <div className="lead-detail">
                      <span className="label">Budget:</span>
                      <span>{match.lead.budget}</span>
                    </div>
                    <div className="lead-detail">
                      <span className="label">Timeline:</span>
                      <span>{match.lead.timeline}</span>
                    </div>
                    <div className="lead-detail">
                      <span className="label">Zip Code:</span>
                      <span>{match.lead.property_zip_code}</span>
                    </div>
                  </div>

                  {match.lead.description && (
                    <div className="description-section">
                      <h4>Project Description</h4>
                      <p className="lead-description">{match.lead.description}</p>
                    </div>
                  )}

                  <div className="agent-section">
                    <h4>Agent Contact</h4>
                    <div className="agent-info">
                      <div>
                        <p className="agent-name">
                          {match.lead.agent.profile.full_name}
                        </p>
                        <p className="agent-company">
                          {match.lead.agent.company_name}
                        </p>
                      </div>
                      <div className="agent-contact">
                        <a href={`tel:${match.lead.agent.phone}`}>
                          {match.lead.agent.phone}
                        </a>
                        <a href={`mailto:${match.lead.agent.profile.email}`}>
                          {match.lead.agent.profile.email}
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
