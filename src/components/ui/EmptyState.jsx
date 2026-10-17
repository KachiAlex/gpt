import { Folder } from 'lucide-react';

// Empty-state pattern: icon tile, one-line title, one sentence, one action.
export default function EmptyState({ icon: Icon = Folder, title, message, action, actionLabel }) {
  return (
    <div className="empty-state">
      <span className="w-14 h-14 rounded-2xl bg-soft text-soft-fg inline-flex items-center justify-center">
        <Icon className="w-7 h-7" />
      </span>
      <h2 className="mt-4 mb-0 font-bold text-[22px] text-ink">{title}</h2>
      {message && <p className="mt-1.5 mb-0 mx-auto text-muted max-w-md">{message}</p>}
      {action && actionLabel && (
        <button type="button" onClick={action} className="btn-primary mt-5">
          {actionLabel}
        </button>
      )}
    </div>
  );
}
