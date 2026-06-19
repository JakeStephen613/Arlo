import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = {};

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-screen items-center justify-center text-center">
          <div>
            <p className="text-lg font-medium">Something went wrong</p>
            <p className="text-sm text-gray-500 mt-1">Please refresh the page</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
