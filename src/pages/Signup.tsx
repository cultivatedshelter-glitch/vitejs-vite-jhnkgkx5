import { useState, FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Input } from '../components/Input'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import './Auth.css'

export function Signup() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [userType, setUserType] = useState<'agent' | 'contractor'>(
    (searchParams.get('type') as 'agent' | 'contractor') || 'agent'
  )
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      })

      if (authError) throw authError

      if (authData.user) {
        const { error: profileError } = await supabase.from('profiles').insert({
          id: authData.user.id,
          email: email,
          full_name: fullName,
          user_type: userType,
        })

        if (profileError) throw profileError

        if (userType === 'agent') {
          navigate('/agent/complete-profile')
        } else {
          navigate('/contractor/complete-profile')
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <Card>
          <div className="auth-header">
            <h2>Create Your Account</h2>
            <p>Join CedarConnect and start connecting today</p>
          </div>

          <div className="user-type-toggle">
            <button
              type="button"
              className={`toggle-btn ${userType === 'agent' ? 'active' : ''}`}
              onClick={() => setUserType('agent')}
            >
              I'm an Agent
            </button>
            <button
              type="button"
              className={`toggle-btn ${userType === 'contractor' ? 'active' : ''}`}
              onClick={() => setUserType('contractor')}
            >
              I'm a Contractor
            </button>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <Input
              id="fullName"
              label="Full Name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              placeholder="John Doe"
            />

            <Input
              id="email"
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="john@example.com"
            />

            <Input
              id="password"
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              helperText="Minimum 6 characters"
            />

            {error && <div className="error-message">{error}</div>}

            <Button type="submit" variant="primary" fullWidth disabled={loading}>
              {loading ? 'Creating Account...' : 'Create Account'}
            </Button>
          </form>

          <div className="auth-footer">
            Already have an account?{' '}
            <a href="/login" className="auth-link">
              Sign in
            </a>
          </div>
        </Card>
      </div>
    </div>
  )
}
