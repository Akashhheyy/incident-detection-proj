import React from "react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error("React error boundary caught an error:", error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    const { hasError } = this.state;
    const { children } = this.props;

    if (hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
          <div className="max-w-md w-full bg-slate-900/80 border border-slate-800 rounded-2xl p-6 text-center space-y-3">
            <h1 className="text-lg font-semibold">Something went wrong</h1>
            <p className="text-sm text-slate-400">
              The dashboard encountered an unexpected error. You can try
              reloading the page, and if the problem persists, check that the
              backend server is running.
            </p>
            <button
              type="button"
              onClick={this.handleReload}
              className="mt-2 inline-flex items-center justify-center rounded-full bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium px-4 py-2 transition-colors"
            >
              Reload dashboard
            </button>
          </div>
        </div>
      );
    }

    return children;
  }
}

export default ErrorBoundary;

