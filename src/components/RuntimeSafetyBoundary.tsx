import React from 'react'

type RuntimeSafetyBoundaryProps = {
  children: React.ReactNode
  label: string
}

type RuntimeSafetyBoundaryState = {
  error: Error | null
}

export class RuntimeSafetyBoundary extends React.Component<RuntimeSafetyBoundaryProps, RuntimeSafetyBoundaryState> {
  state: RuntimeSafetyBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): RuntimeSafetyBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.warn(`${this.props.label} render failed; showing fallback instead of blanking the app.`, error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <section style={{
          border: '1px solid #d8c6a1',
          background: '#fff8e8',
          borderRadius: 8,
          padding: 16,
          color: '#4a3a1f',
        }}>
          <strong>{this.props.label} needs a refresh.</strong>
          <p style={{ margin: '8px 0 0', fontSize: 14 }}>
            Optional project data could not be rendered. The rest of Shelter Prep is still available.
          </p>
        </section>
      )
    }

    return this.props.children
  }
}
