import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Input } from '../components/Input'
import { Textarea } from '../components/Textarea'
import { Select } from '../components/Select'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import './CompleteProfile.css'

const SERVICE_OPTIONS = [
  { value: '', label: 'Select services...' },
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

const RADIUS_OPTIONS = [
  { value: '10', label: '10 miles' },
  { value: '20', label: '20 miles' },
  { value: '30', label: '30 miles' },
  { value: '40', label: '40 miles' },
  { value: '50', label: '50 miles' },
]

export function ContractorCompleteProfile() {
  const navigate = useNavigate()
  const { user, refreshProfile } = useAuth()
  const [companyName, setCompanyName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [zipCode, setZipCode] = useState('')
  const [serviceRadius, setServiceRadius] = useState('20')
  const [bio, setBio] = useState('')
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [portfolioUrls, setPortfolioUrls] = useState(['', '', ''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleServiceToggle = (service: string) => {
    if (service === '') return

    setSelectedServices((prev) =>
      prev.includes(service)
        ? prev.filter((s) => s !== service)
        : [...prev, service]
    )
  }

  const handlePortfolioChange = (index: number, value: string) => {
    const newUrls = [...portfolioUrls]
    newUrls[index] = value
    setPortfolioUrls(newUrls)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (!user) throw new Error('No user found')
      if (selectedServices.length === 0) {
        throw new Error('Please select at least one service')
      }

      const validPortfolioUrls = portfolioUrls.filter((url) => url.trim() !== '')

      const { error: contractorError } = await supabase.from('contractors').insert({
        user_id: user.id,
        company_name: companyName,
        phone: phone,
        email: email,
        zip_code: zipCode,
        service_radius: parseInt(serviceRadius),
        bio: bio,
        services: selectedServices,
        portfolio_images: validPortfolioUrls,
      })

      if (contractorError) throw contractorError

      await refreshProfile()
      navigate('/contractor/dashboard')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="complete-profile-page">
      <div className="complete-profile-container complete-profile-wide">
        <Card>
          <div className="complete-profile-header">
            <h2>Complete Your Contractor Profile</h2>
            <p>Showcase your expertise to attract quality leads</p>
          </div>

          <form onSubmit={handleSubmit} className="complete-profile-form">
            <div className="form-section">
              <h4>Company Information</h4>
              <div className="form-grid">
                <Input
                  id="companyName"
                  label="Company Name"
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                  placeholder="Cedar Construction LLC"
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

                <Input
                  id="email"
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="contact@cedarconst.com"
                />
              </div>
            </div>

            <div className="form-section">
              <h4>Service Area</h4>
              <div className="form-grid">
                <Input
                  id="zipCode"
                  label="Zip Code"
                  type="text"
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value)}
                  required
                  placeholder="98101"
                  helperText="Your primary service location"
                />

                <Select
                  id="serviceRadius"
                  label="Service Radius"
                  value={serviceRadius}
                  onChange={(e) => setServiceRadius(e.target.value)}
                  options={RADIUS_OPTIONS}
                  required
                  helperText="Maximum distance you'll travel"
                />
              </div>
            </div>

            <div className="form-section">
              <h4>Services Offered</h4>
              <div className="services-grid">
                {SERVICE_OPTIONS.filter((opt) => opt.value !== '').map((service) => (
                  <label key={service.value} className="service-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedServices.includes(service.value)}
                      onChange={() => handleServiceToggle(service.value)}
                    />
                    <span>{service.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <Textarea
              id="bio"
              label="About Your Company"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell agents about your experience, expertise, and what makes your company stand out..."
              helperText="Highlight your specialties and years of experience"
            />

            <div className="form-section">
              <h4>Portfolio Images</h4>
              <p className="form-section-description">
                Add up to 3 URLs of your best work
              </p>
              {portfolioUrls.map((url, index) => (
                <Input
                  key={index}
                  id={`portfolio-${index}`}
                  label={`Image URL ${index + 1}`}
                  type="url"
                  value={url}
                  onChange={(e) => handlePortfolioChange(index, e.target.value)}
                  placeholder="https://example.com/image.jpg"
                />
              ))}
            </div>

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
