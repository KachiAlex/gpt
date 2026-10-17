import LoadingSpinner from './LoadingSpinner';

export default function PageLoader({ text = 'Loading...' }) {
 return (
 <div className="min-h-screen bg-bg flex items-center justify-center">
 <div className="text-center">
 <LoadingSpinner size="xl" />
 <p className="mt-4 text-lg text-muted">{text}</p>
 </div>
 </div>
 );
}

