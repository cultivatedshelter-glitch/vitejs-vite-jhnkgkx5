import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import Phase1Experience from './Phase1Experience'
import './index.css'

const showLegacyApp = import.meta.env.DEV && new URLSearchParams(window.location.search).get('legacy') === '1'
const fixtureMode = import.meta.env.DEV && new URLSearchParams(window.location.search).get('fixture') === '1'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {showLegacyApp ? <App /> : <Phase1Experience fixtureMode={fixtureMode} />}
  </React.StrictMode>
)
