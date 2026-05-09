import { Link } from 'react-router-dom'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import './Home.css'

export function Home() {
  return (
    <div className="home">
      <section className="hero">
        <div className="hero-content">
          <div className="hero-badge">Trusted in the Pacific Northwest</div>
          <h1 className="hero-title">
            Connect Agents with
            <br />
            <span className="hero-highlight">Trusted Contractors</span>
          </h1>
          <p className="hero-description">
            CedarConnect bridges the gap between real estate agents and qualified
            local contractors, streamlining project matching with precision and care.
          </p>
          <div className="hero-cta">
            <Link to="/signup?type=agent">
              <Button variant="primary" size="lg">
                I'm an Agent
              </Button>
            </Link>
            <Link to="/signup?type=contractor">
              <Button variant="secondary" size="lg">
                I'm a Contractor
              </Button>
            </Link>
          </div>
        </div>
        <div className="hero-image">
          <div className="hero-image-placeholder">
            <svg
              viewBox="0 0 400 300"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect width="400" height="300" fill="var(--pacific-blue-50)" />
              <path
                d="M150 80L200 40L250 80V140L200 180L150 140V80Z"
                fill="var(--cedar-brown-400)"
              />
              <path
                d="M200 40L250 80L300 60L250 20L200 40Z"
                fill="var(--cedar-brown-600)"
              />
              <path
                d="M100 140L150 100L200 140V200L150 240L100 200V140Z"
                fill="var(--pacific-blue-300)"
              />
              <circle cx="320" cy="180" r="40" fill="var(--forest-green-400)" />
              <circle cx="80" cy="220" r="30" fill="var(--forest-green-500)" />
            </svg>
          </div>
        </div>
      </section>

      <section className="benefits">
        <div className="benefits-header">
          <h2>Why Choose CedarConnect</h2>
          <p className="benefits-subtitle">
            Built for the unique needs of the Pacific Northwest market
          </p>
        </div>

        <div className="benefits-grid">
          <Card>
            <div className="benefit-icon">
              <svg
                width="48"
                height="48"
                viewBox="0 0 48 48"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle cx="24" cy="24" r="20" fill="var(--pacific-blue-100)" />
                <path
                  d="M24 14L28 22H20L24 14Z"
                  fill="var(--pacific-blue-600)"
                />
                <rect
                  x="18"
                  y="22"
                  width="12"
                  height="12"
                  fill="var(--pacific-blue-600)"
                />
              </svg>
            </div>
            <h3>Precision Matching</h3>
            <p>
              Smart zip code-based matching ensures you connect with contractors
              within your service area, up to 50 miles radius.
            </p>
          </Card>

          <Card>
            <div className="benefit-icon">
              <svg
                width="48"
                height="48"
                viewBox="0 0 48 48"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle cx="24" cy="24" r="20" fill="var(--cedar-brown-100)" />
                <circle cx="24" cy="20" r="6" fill="var(--cedar-brown-600)" />
                <path
                  d="M14 34C14 28 18 26 24 26C30 26 34 28 34 34"
                  stroke="var(--cedar-brown-600)"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <h3>Vetted Professionals</h3>
            <p>
              Every contractor showcases their portfolio, services, and expertise,
              helping agents make informed decisions.
            </p>
          </Card>

          <Card>
            <div className="benefit-icon">
              <svg
                width="48"
                height="48"
                viewBox="0 0 48 48"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle cx="24" cy="24" r="20" fill="var(--forest-green-100)" />
                <path
                  d="M18 24L22 28L30 20"
                  stroke="var(--forest-green-600)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h3>Simple Process</h3>
            <p>
              Submit a lead in minutes. Get matched with qualified contractors
              instantly. Focus on closing deals, not searching.
            </p>
          </Card>
        </div>
      </section>

      <section className="how-it-works">
        <h2>How It Works</h2>
        <div className="steps">
          <div className="step">
            <div className="step-number">1</div>
            <h4>Create Your Profile</h4>
            <p>
              Sign up as an agent or contractor and complete your professional
              profile in minutes.
            </p>
          </div>
          <div className="step-arrow">→</div>
          <div className="step">
            <div className="step-number">2</div>
            <h4>Submit or Browse</h4>
            <p>
              Agents submit project details. Contractors receive relevant leads
              in their service area.
            </p>
          </div>
          <div className="step-arrow">→</div>
          <div className="step">
            <div className="step-number">3</div>
            <h4>Connect & Close</h4>
            <p>
              Review matches, connect directly, and get projects moving forward
              seamlessly.
            </p>
          </div>
        </div>
      </section>

      <section className="cta-section">
        <div className="cta-card">
          <h2>Ready to Get Started?</h2>
          <p>
            Join the growing network of agents and contractors building better
            communities across the Pacific Northwest.
          </p>
          <div className="cta-buttons">
            <Link to="/signup?type=agent">
              <Button variant="primary" size="lg">
                Sign Up as Agent
              </Button>
            </Link>
            <Link to="/signup?type=contractor">
              <Button variant="secondary" size="lg">
                Sign Up as Contractor
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
