import { Component, type ErrorInfo, type ReactNode } from 'react';

interface AdminErrorBoundaryProps {
  children: ReactNode;
}

interface AdminErrorBoundaryState {
  error: Error | null;
}

/** Prevents admin runtime errors from turning the whole panel into a blank page. */
export class AdminErrorBoundary extends Component<AdminErrorBoundaryProps, AdminErrorBoundaryState> {
  state: AdminErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): AdminErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Admin panel error', error, errorInfo);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="admin-error-page">
          <h1>Admin panel could not render this page</h1>
          <p>{this.state.error.message}</p>
          <button type="button" onClick={() => this.setState({ error: null })}>
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
