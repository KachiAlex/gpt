import clsx from 'clsx';
import { statusKey, statusLabel } from '../../utils/statusMap';

export default function StatusPill({ status, label, className }) {
  return (
    <span className={clsx(`status-${statusKey(status)}`, className)}>
      {label || statusLabel(status)}
    </span>
  );
}
