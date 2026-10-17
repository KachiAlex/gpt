import LoadingSpinner from './LoadingSpinner';

export default function PageLoader({ text = 'Loading...' }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <LoadingSpinner size="xl" />
        <p className="mt-4 text-lg text-gray-600">{text}</p>
      </div>
    </div>
  );
}

