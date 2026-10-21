const Toggle = ({ label, description, checked, onChange }) => (
  <label className="flex items-center justify-between">
    <div>
      <span className="text-sm font-medium text-ink">{label}</span>
      <p className="text-sm text-muted">{description}</p>
    </div>
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="rounded border-border text-soft-fg focus:ring-primary-500"
    />
  </label>
);

export default function NotificationsTab({ notifications, onChange }) {
  return (
    <div className="card">
      <h3 className="text-lg font-semibold text-ink mb-6">Notification Preferences</h3>
      <div className="space-y-6">
        <div>
          <h4 className="text-sm font-medium text-ink mb-3">Communication</h4>
          <div className="space-y-3">
            <Toggle label="Email Notifications" description="Receive notifications via email" checked={notifications.email} onChange={() => onChange('email')} />
            <Toggle label="SMS Notifications" description="Receive notifications via SMS" checked={notifications.sms} onChange={() => onChange('sms')} />
            <Toggle label="Push Notifications" description="Receive push notifications in browser" checked={notifications.push} onChange={() => onChange('push')} />
          </div>
        </div>
        <div className="border-t border-border pt-6">
          <h4 className="text-sm font-medium text-ink mb-3">Content</h4>
          <div className="space-y-3">
            <Toggle label="Report Updates" description="New reports and analytics" checked={notifications.reports} onChange={() => onChange('reports')} />
            <Toggle label="Project Deadlines" description="Upcoming project deadlines" checked={notifications.deadlines} onChange={() => onChange('deadlines')} />
            <Toggle label="Approval Requests" description="New items requiring approval" checked={notifications.approvals} onChange={() => onChange('approvals')} />
          </div>
        </div>
      </div>
    </div>
  );
}
