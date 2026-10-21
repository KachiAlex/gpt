export default function SystemTab() {
  return (
    <div className="space-y-6">
      <div className="card">
        <h3 className="text-lg font-semibold text-ink mb-6">System Information</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Application Version:</span>
            <span className="font-medium">v1.0.0</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Last Updated:</span>
            <span className="font-medium">January 15, 2024</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Database Version:</span>
            <span className="font-medium">PostgreSQL 15.2</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Server Status:</span>
            <span className="flex items-center">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
              Online
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
