import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Input } from '../components/Input'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import './Auth.css'

export function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) throw authError

      if (data.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('user_type')
          .eq('id', data.user.id)
          .maybeSingle()

        if (profile?.user_type === 'agent') {
          navigate('/agent/dashboard')
        } else if (profile?.user_type === 'contractor') {
          navigate('/contractor/dashboard')
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
            <h2>Welcome Back</h2>
            <p>Sign in to your CedarConnect account</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
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
            />

            {error && <div className="error-message">{error}</div>}

            <Button type="submit" variant="primary" fullWidth disabled={loading}>
              {loading ? 'Signing In...' : 'Sign In'}
            </Button>
          </form>

          <div className="auth-footer">
            Don't have an account?{' '}
            <a href="/signup" className="auth-link">
              Sign up
            </a>
          </div>
        </Card>
      </div>
    </div>
  )
}
