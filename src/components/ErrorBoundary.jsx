import React from 'react'
import { Link } from 'react-router-dom'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[totsan] render error:', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <section className="section min-h-screen flex items-center bg-soft">
        <div className="container-page max-w-2xl text-center">
          <div className="eyebrow">Totsan</div>
          <h1 className="h-section mt-3">Нещо прекъсна зареждането.</h1>
          <p className="text-muted mt-3">
            Страницата не се зареди правилно, но приложението вече не остава на празен бял екран.
          </p>
          <div className="mt-6 flex justify-center gap-3 flex-wrap">
            <button className="btn btn-primary" onClick={() => window.location.reload()}>Презареди</button>
            <Link to="/" className="btn btn-ghost">Към началото</Link>
          </div>
        </div>
      </section>
    )
  }
}