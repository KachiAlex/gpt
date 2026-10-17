import { TrendingUp, TrendingDown } from 'lucide-react';
import clsx from 'clsx';

export default function StatsCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend, 
  trendValue,
  color = 'blue'
}) {
  const isPositiveTrend = trend === 'up';
  
  const colorClasses = {
    blue: 'bg-gradient-to-br from-blue-500 to-blue-600 text-white',
    green: 'bg-gradient-to-br from-green-500 to-green-600 text-white',
    yellow: 'bg-gradient-to-br from-yellow-400 to-yellow-500 text-white',
    red: 'bg-gradient-to-br from-red-500 to-red-600 text-white',
    purple: 'bg-gradient-to-br from-purple-500 to-purple-600 text-white',
    orange: 'bg-gradient-to-br from-orange-500 to-orange-600 text-white',
  };

  const accentBorders = {
    blue: 'border-l-4 border-blue-500',
    green: 'border-l-4 border-green-500',
    yellow: 'border-l-4 border-yellow-500',
    red: 'border-l-4 border-red-500',
    purple: 'border-l-4 border-purple-500',
    orange: 'border-l-4 border-orange-500',
  };

  return (
    <div className={clsx('card relative overflow-hidden group', accentBorders[color])}>
      {/* Gradient background effect */}
      <div className={clsx('absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8 rounded-full opacity-10 blur-3xl', 
        color === 'blue' ? 'bg-blue-500' :
        color === 'green' ? 'bg-green-500' :
        color === 'yellow' ? 'bg-yellow-500' :
        color === 'red' ? 'bg-red-500' :
        color === 'orange' ? 'bg-orange-500' :
        'bg-purple-500'
      )}></div>
      
      <div className="relative flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-widest">{title}</p>
          <div className={clsx('p-2 rounded-lg shadow-lg transform group-hover:scale-110 transition-transform duration-300', colorClasses[color])}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        
        <div className="flex flex-col">
          <div className="flex items-baseline flex-wrap gap-1.5 mb-1.5">
            <p className="text-4xl font-extrabold text-gray-900 dark:text-gray-100 leading-none">{value}</p>
            {trendValue && (
              <div className={clsx(
                'flex items-center text-[10px] font-bold px-2 py-0.5 rounded-md whitespace-nowrap',
                isPositiveTrend ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200' : 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200'
              )}>
                {isPositiveTrend ? (
                  <TrendingUp className="h-3 w-3 mr-0.5" />
                ) : (
                  <TrendingDown className="h-3 w-3 mr-0.5" />
                )}
                {trendValue}
              </div>
            )}
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 font-medium mt-1">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}
