import clsx from 'clsx';
import { statusKey } from '../../utils/statusMap';

// Progress bar whose fill follows the project status colour.
export default function ProgressBar({ progress = 0, status, height = 8, showLabel = false, className }) {
  const pct = Math.max(0, Math.min(100, Number(progress) || 0));
  return (
    <div className={className}>
      {showLabel && (
        <div className="flex justify-between text-sm text-muted">
          <span>Progress</span>
          <span className="font-semibold text-ink">{pct}%</span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={`Progress ${pct} percent`}
        className="mt-1.5 rounded-full bg-track overflow-hidden"
        style={{ height }}
      >
        <div
          className={clsx('h-full rounded-full', `bar-${statusKey(status)}`)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
