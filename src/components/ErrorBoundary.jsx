import { Component } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

class ErrorBoundary extends Component {
 constructor(props) {
 super(props);
 this.state = {
 hasError: false,
 error: null,
 errorInfo: null,
 };
 }

 static getDerivedStateFromError() {
 // Update state so the next render will show the fallback UI
 return { hasError: true };
 }

 componentDidCatch(error, errorInfo) {
 // Log error details
 console.error('ErrorBoundary caught an error:', error, errorInfo);
 
 this.setState({
 error,
 errorInfo,
 });

 // You can also log the error to an error reporting service here
 // Example: logErrorToService(error, errorInfo);
 }

 handleReset = () => {
 this.setState({
 hasError: false,
 error: null,
 errorInfo: null,
 });
 };

 handleGoHome = () => {
 window.location.href = '/';
 };

 render() {
 if (this.state.hasError) {
 return (
 <div className="min-h-screen bg-bg flex items-center justify-center p-4">
 <div className="max-w-2xl w-full">
 <div className="bg-surface rounded-lg shadow-sm p-8">
 {/* Icon */}
 <div className="flex justify-center mb-6">
 <div className="w-20 h-20 bg-red-100 dark:bg-red-950/50 rounded-full flex items-center justify-center">
 <AlertTriangle className="w-10 h-10 text-red-700 dark:text-red-400" />
 </div>
 </div>

 {/* Title */}
 <h1 className="text-3xl font-bold text-ink text-center mb-4">
 Oops! Something went wrong
 </h1>

 {/* Description */}
 <p className="text-muted text-center mb-8">
 We're sorry for the inconvenience. An unexpected error has occurred.
 Please try refreshing the page or return to the home page.
 </p>

 {/* Error Details (Development Only) */}
 {import.meta.env.DEV && this.state.error && (
 <div className="mb-8 bg-bg rounded-lg p-4 border border-border">
 <h3 className="text-sm font-semibold text-ink mb-2">
 Error Details (Development Mode):
 </h3>
 <div className="text-xs text-red-700 dark:text-red-400 font-mono overflow-auto max-h-40">
 <p className="font-bold mb-2">{this.state.error.toString()}</p>
 {this.state.errorInfo && (
 <pre className="whitespace-pre-wrap">
 {this.state.errorInfo.componentStack}
 </pre>
 )}
 </div>
 </div>
 )}

 {/* Actions */}
 <div className="flex flex-col sm:flex-row gap-4 justify-center">
 <button
 onClick={this.handleReset}
 className="btn-primary flex items-center justify-center space-x-2"
 >
 <RefreshCw className="w-4 h-4" />
 <span>Try Again</span>
 </button>
 <button
 onClick={this.handleGoHome}
 className="btn-secondary flex items-center justify-center space-x-2"
 >
 <Home className="w-4 h-4" />
 <span>Go to Home</span>
 </button>
 </div>

 {/* Help Text */}
 <div className="mt-8 pt-8 border-t border-border">
 <p className="text-sm text-muted text-center">
 If this problem persists, please contact support at{' '}
 <a 
 href="mailto:support@gpt-system.gov" 
 className="text-soft-fg hover:text-soft-fg font-medium"
 >
 support@gpt-system.gov
 </a>
 </p>
 </div>
 </div>
 </div>
 </div>
 );
 }

 return this.props.children;
 }
}

export default ErrorBoundary;

