'use client'

import { Component, type ReactNode } from 'react'
import * as Sentry from '@sentry/nextjs'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (Sentry.isInitialized()) {
      Sentry.captureException(error, {
        extra: { componentStack: errorInfo.componentStack },
      })
    }
  }

  handleReset = () => {
    this.setState({ hasError: false })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#e74c3c]/10">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#e74c3c" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <div className="text-base font-medium text-drift-text">Something went wrong</div>
          <p className="text-xs text-drift-text3">An unexpected error occurred. Try refreshing.</p>
          <button
            onClick={this.handleReset}
            className="rounded-xl border border-drift-gold/20 bg-drift-gold-bg px-5 py-2.5 text-xs font-semibold text-drift-gold"
          >
            Try Again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
