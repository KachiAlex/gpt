import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, CheckCircle } from 'lucide-react';
import InviteGenerator from '../components/InviteGenerator';

export default function MEOfficerNew() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <div className="bg-surface border-b border-border">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate(-1)}
                className="p-2 hover:bg-hoverbg rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-muted" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-ink">Invite an M&E Officer</h1>
                <p className="text-muted">They set their own password — no shared credentials</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-4 py-2 text-ink bg-hoverbg hover:bg-track rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="bg-surface rounded-lg shadow-sm border border-border p-6">
            <div className="flex items-center space-x-3 mb-6">
              <ShieldCheck className="h-5 w-5 text-soft-fg" />
              <h2 className="text-lg font-semibold text-ink">Generate invite link</h2>
            </div>

            <InviteGenerator role="ME_OFFICER" notePlaceholder="e.g. for the monitoring team" />
          </div>

          <div className="bg-surface rounded-lg shadow-sm border border-border p-6">
            <h2 className="text-lg font-semibold text-ink mb-4">What happens next</h2>
            <ol className="space-y-3 text-sm text-muted">
              {[
                'Send the link to the officer.',
                'They open it, enter their name, optional department/title, and set their own password.',
                'They can log in immediately — the link works once and then expires.',
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 flex-none mt-0.5" />
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
