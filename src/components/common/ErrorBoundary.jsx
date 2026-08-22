import { Component } from 'react'

export class ErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="error-page">
          <h1>Something went wrong</h1>
          <p>Please refresh the page to try again.</p>
        </main>
      )
    }

    return this.props.children
  }
}