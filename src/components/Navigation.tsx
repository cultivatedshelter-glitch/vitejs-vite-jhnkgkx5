import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Button } from './Button'
import './Navigation.css'

export function Navigation() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  return (
    <nav className="nav">
      <div className="nav-container">
        <Link to="/" className="nav-logo">
          <div className="nav-logo-icon">
            <svg
              width="32"
              height="32"
              viewBox="0 0 32 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M16 2L4 10V22L16 30L28 22V10L16 2Z"
                fill="var(--cedar-brown-600)"
              />
              <path
                d="M16 8L10 12V20L16 24L22 20V12L16 8Z"
                fill="var(--pacific-blue-500)"
              />
            </svg>
          </div>
          <span className="nav-logo-text">CedarConnect</span>
        </Link>

        <div className="nav-links">
          {user ? (
            <>
              {profile?.user_type === 'agent' && (
                <>
                  <Link to="/agent/dashboard" className="nav-link">
                    Dashboard
                  </Link>
                  <Link to="/agent/submit-lead" className="nav-link">
                    Submit Lead
                  </Link>
                </>
              )}
              {profile?.user_type === 'contractor' && (
                <>
                  <Link to="/contractor/dashboard" className="nav-link">
                    Dashboard
                  </Link>
                  <Link to="/contractor/profile" className="nav-link">
                    Profile
                  </Link>
                </>
              )}
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                Sign Out
              </Button>
            </>
          ) : (
            <>
              <Link to="/login" className="nav-link">
                Sign In
              </Link>
              <Link to="/signup">
                <Button variant="primary" size="sm">
                  Get Started
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
