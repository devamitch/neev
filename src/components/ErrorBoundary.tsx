import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorMessage = "An unexpected error occurred.";
      try {
        if (this.state.error?.message) {
          const parsed = JSON.parse(this.state.error.message);
          if (parsed.error) {
            errorMessage = parsed.error;
          }
        }
      } catch (e) {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-bg text-text-ink font-body p-6">
          <div className="bg-surface-hi p-8 rounded-[18px] max-w-md w-full shadow-sm border-l-4 border-terracotta">
            <h2 className="font-serif text-2xl mb-4 text-terracotta">Something went wrong</h2>
            <p className="text-sm text-text-body mb-6 leading-relaxed">
              {errorMessage}
            </p>
            <button
              className="bg-sage text-surface-hi px-6 py-3 rounded-sm text-sm font-medium hover:bg-sage-dim transition-colors"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
