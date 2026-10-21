import { Component, type ErrorInfo, type ReactNode } from 'react';
import { adminErrorCopy, isAdminModuleLoadError, recoverAdminError } from '../utils/module-load-error';

interface AdminErrorBoundaryProps {
  children: ReactNode;
  inline?: boolean;
}

interface AdminErrorBoundaryState {
  error: Error | null;
  confirmReload: boolean;
}

/** Prevents admin runtime errors from turning the whole panel into a blank page. */
export class AdminErrorBoundary extends Component<AdminErrorBoundaryProps, AdminErrorBoundaryState> {
  state: AdminErrorBoundaryState = {
    error: null,
    confirmReload: false,
  };

  static getDerivedStateFromError(error: Error): AdminErrorBoundaryState {
    return { error, confirmReload: false };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Admin panel error', error, errorInfo);
  }

  /** Reloads stale bundles only after explicit confirmation; ordinary rendering errors can retry in place. */
  handleRetry = (): void => {
    if (isAdminModuleLoadError(this.state.error)) this.setState({ confirmReload: true });
    else this.setState({ error: null, confirmReload: false });
  };

  /** The inline confirmation can be cancelled without unmounting or changing any form field. */
  handleReload = (): void => {
    recoverAdminError(this.state.error, {
      confirmReload: () => this.state.confirmReload,
      reload: () => window.location.reload(),
      retry: () => this.setState({ error: null, confirmReload: false }),
    });
  };

  render() {
    if (this.state.error) {
      const copy = adminErrorCopy(window.location.pathname);
      const loadError = isAdminModuleLoadError(this.state.error);
      const title = loadError ? this.props.inline ? copy.editorTitle : copy.pageTitle : copy.genericTitle;
      return (
        <div className={this.props.inline ? 'admin-error-panel' : 'admin-error-page'} dir={copy.direction} role="alert">
          {this.props.inline ? <h3>{title}</h3> : <h1>{title}</h1>}
          <p>{loadError ? copy.loadDescription : copy.runtimeDescription}</p>
          {this.props.inline && loadError && <p>{copy.inlineDescription}</p>}
          {this.state.confirmReload ? <div className="admin-error-confirm" role="group" aria-label={copy.reloadWarning}>
            <p>{copy.reloadWarning}</p>
            <div><button type="button" onClick={this.handleReload}>{copy.confirmReload}</button>
              <button type="button" autoFocus onClick={() => this.setState({ confirmReload: false })}>{copy.cancel}</button></div>
          </div> : <button type="button" onClick={this.handleRetry}>
            {loadError ? copy.reload : copy.retry}
          </button>}
        </div>
      );
    }

    return this.props.children;
  }
}
