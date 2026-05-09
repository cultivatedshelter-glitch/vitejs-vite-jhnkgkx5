import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Button } from '../components/Button'
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
}

interface Match {
  id: string
  contractor: {
    company_name: string
    phone: string
    email: string
    bio: string
    portfolio_images: string[]
  }
}

interface LeadWithMatches extends Lead {
  matches: Match[]
}

export function AgentDashboard() {
  const { user, profile } = useAuth()
  const [leads, setLeads] = useState<LeadWithMatches[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchLeads = async () => {
      if (!user) return

      const { data: agentData } = await supabase
        .from('agents')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!agentData) return

      const { data: leadsData } = await supabase
        .from('leads')
        .select(
          `
          *,
          matches (
            id,
            contractor:contractors (
              company_name,
              phone,
              email,
              bio,
              portfolio_images
            )
          )
        `
        )
        .eq('agent_id', agentData.id)
        .order('created_at', { ascending: false })

      if (leadsData) {
        setLeads(leadsData as unknown as LeadWithMatches[])
      }

      setLoading(false)
    }

    fetchLeads()
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
            <p>Manage your leads and contractor matches</p>
          </div>
          <Link to="/agent/submit-lead">
            <Button variant="primary">Submit New Lead</Button>
          </Link>
        </div>

        {leads.length === 0 ? (
          <Card>
            <div className="empty-state">
              <h3>No leads yet</h3>
              <p>Submit your first lead to start connecting with contractors</p>
              <Link to="/agent/submit-lead">
                <Button variant="primary">Submit a Lead</Button>
              </Link>
            </div>
          </Card>
        ) : (
          <div className="leads-list">
            {leads.map((lead) => (
              <Card key={lead.id}>
                <div className="lead-card">
                  <div className="lead-header">
                    <div>
                      <h3>{lead.job_type}</h3>
                      <p className="lead-address">{lead.property_address}</p>
                    </div>
                    <div className="lead-badge">{lead.status}</div>
                  </div>

                  <div className="lead-details">
                    <div className="lead-detail">
                      <span className="label">Budget:</span>
                      <span>{lead.budget}</span>
                    </div>
                    <div className="lead-detail">
                      <span className="label">Timeline:</span>
                      <span>{lead.timeline}</span>
                    </div>
                    <div className="lead-detail">
                      <span className="label">Zip Code:</span>
                      <span>{lead.property_zip_code}</span>
                    </div>
                  </div>

                  {lead.description && (
                    <p className="lead-description">{lead.description}</p>
                  )}

                  <div className="matches-section">
                    <h4>
                      Matched Contractors ({lead.matches?.length || 0})
                    </h4>
                    {lead.matches && lead.matches.length > 0 ? (
                      <div className="matches-grid">
                        {lead.matches.map((match) => (
                          <div key={match.id} className="contractor-match">
                            <h5>{match.contractor.company_name}</h5>
                            <p className="contractor-bio">
                              {match.contractor.bio?.substring(0, 150)}
                              {match.contractor.bio?.length > 150 ? '...' : ''}
                            </p>
                            <div className="contractor-contact">
                              <a href={`tel:${match.contractor.phone}`}>
                                {match.contractor.phone}
                              </a>
                              <a href={`mailto:${match.contractor.email}`}>
                                {match.contractor.email}
                              </a>
                            </div>
                            {match.contractor.portfolio_images &&
                              match.contractor.portfolio_images.length > 0 && (
                                <div className="portfolio-preview">
                                  {match.contractor.portfolio_images
                                    .slice(0, 3)
                                    .map((url, idx) => (
                                      <img
                                        key={idx}
                                        src={url}
                                        alt={`Portfolio ${idx + 1}`}
                                        className="portfolio-thumb"
                                      />
                                    ))}
                                </div>
                              )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="no-matches">
                        No contractors matched for this project yet
                      </p>
                    )}
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
