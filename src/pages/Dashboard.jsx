import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, FileText, Folder, Activity, HardHat } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { dashboardAPI, projectAPI } from '../services/api';
import StatTile from '../components/ui/StatTile';
import StatusPill from '../components/ui/StatusPill';
import ProgressBar from '../components/ui/ProgressBar';
import { statusKey, statusLabel, fmtNairaCompact, fmtNaira, fmtAgo, areaLabel, areasLabel, currency } from '../utils/statusMap';

export default function Dashboard() {
  const { user, canAccessAdminFeatures } = useAuth();
  const [stats, setStats] = useState(null);
  const [projects, setProjects] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      dashboardAPI.getStats().catch(() => null),
      projectAPI.getAll({ limit: 5 }).catch(() => null),
      dashboardAPI.getRecentActivity().catch(() => null),
    ]).then(([statsRes, projRes, actRes]) => {
      if (!isMounted) return;
      setStats(statsRes?.data?.stats || null);
      const list = projRes?.data?.projects || [];
      list.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
      setProjects(list.slice(0, 5));
      setActivities(actRes?.data?.activities?.slice(0, 6) || []);
      setLoading(false);
    });
    return () => { isMounted = false; };
  }, []);

  const isEmpty = stats && stats.total === 0;
  const lgaCount = stats?.lgaCount ?? 17;

  const statusBars = stats
    ? ['COMPLETED', 'IN_PROGRESS', 'NEAR_COMPLETION', 'DELAYED', 'NOT_STARTED', 'ON_HOLD', 'CANCELLED']
        .map((s) => ({ key: s, label: statusLabel(s), n: stats.byStatus?.[s] || 0 }))
        .filter((s) => s.n > 0 || stats.total === 0)
    : [];
  const maxBar = Math.max(1, ...statusBars.map((s) => s.n));

  return (
    <div className="flex flex-col gap-7 animate-fade-in">
      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="mt-1 text-muted text-base">
            Welcome back, {user?.firstName || 'Admin'}. Here is where projects stand today.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link to="/reports" className="btn-secondary">
            <FileText className="w-[18px] h-[18px]" strokeWidth={1.75} />
            Generate report
          </Link>
          {canAccessAdminFeatures() && (
            <Link to="/projects/new" className="btn-primary">
              <Plus className="w-[18px] h-[18px]" strokeWidth={2.25} />
              New project
            </Link>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-[18px]">
        <StatTile
          label="Total projects"
          value={stats ? String(stats.total) : '…'}
          note={isEmpty ? 'No projects yet' : `Across ${lgaCount} ${areasLabel()}`}
          icon={Folder}
        />
        <StatTile
          label="Active projects"
          value={stats ? String((stats.byStatus?.IN_PROGRESS || 0) + (stats.byStatus?.NEAR_COMPLETION || 0)) : '…'}
          note={isEmpty ? 'Nothing in progress' : 'In progress or near completion'}
          icon={Activity}
        />
        <StatTile
          label="Total budget"
          value={stats ? fmtNairaCompact(stats.totalBudget) : '…'}
          note={isEmpty ? 'No budgets recorded' : 'Allocated to all projects'}
          icon={() => <span className="font-extrabold text-lg">{currency()}</span>}
        />
        <StatTile
          label="Contractors"
          value={stats ? String(stats.contractors?.total || 0) : '…'}
          note={isEmpty ? 'None registered' : `${stats?.contractors?.verified || 0} verified`}
          icon={HardHat}
        />
      </div>

      {/* First-run empty state */}
      {isEmpty && (
        <section className="bg-surface border-[1.5px] border-dashed border-border rounded-[18px] px-8 py-14 text-center">
          <span className="w-[60px] h-[60px] rounded-2xl bg-soft text-soft-fg inline-flex items-center justify-center">
            <Folder className="w-[30px] h-[30px]" strokeWidth={1.75} />
          </span>
          <h2 className="mt-[18px] mb-0 font-bold text-2xl">Start by adding your first project</h2>
          <p className="mt-2 mb-0 mx-auto max-w-[520px] text-muted text-base">
            Charts, budgets and the public portal fill in as soon as projects exist. Three steps get you running.
          </p>
          <div className="mt-7 mx-auto max-w-[760px] grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
            {[
              ['1', 'Add a contractor', 'Register and verify who will deliver the work.', '/contractors/new'],
              ['2', 'Create the project', `Set the ${areaLabel()}, budget, dates and milestones.`, '/projects/new'],
              ['3', 'Add an M&E officer', 'So submissions can be reviewed and published.', '/me-officers/new'],
            ].map(([n, t, d]) => (
              <div key={n} className="border border-border rounded-[14px] p-[18px]">
                <div className="text-[13px] font-bold text-soft-fg">{n}</div>
                <div className="mt-0.5 font-semibold">{t}</div>
                <div className="text-sm text-muted">{d}</div>
              </div>
            ))}
          </div>
          <Link to="/projects/new" className="btn-primary mt-7 min-h-[48px] px-6">
            Create first project
          </Link>
        </section>
      )}

      {/* Data panels */}
      {!isEmpty && (
        <div className="flex flex-wrap gap-6 items-start">
          {/* Left column */}
          <div className="flex-[3_1_520px] min-w-0 flex flex-col gap-6">
            {/* Projects by status */}
            <section className="bg-surface border border-border rounded-2xl p-6">
              <h2 className="section-title">Projects by status</h2>
              <div className="mt-[18px] flex flex-col gap-3.5">
                {statusBars.map((s) => (
                  <div key={s.key} className="flex items-center gap-3.5">
                    <span className="flex-none w-[120px] text-[14.5px] text-muted">{s.label}</span>
                    <div className="flex-1 h-[14px] rounded-full bg-track overflow-hidden">
                      <div
                        className={`h-full rounded-full bar-${statusKey(s.key)}`}
                        style={{ width: `${Math.round((s.n / maxBar) * 100)}%` }}
                      />
                    </div>
                    <span className="flex-none w-9 text-right font-bold">{s.n}</span>
                  </div>
                ))}
                {statusBars.length === 0 && <p className="text-muted text-sm m-0">No data yet.</p>}
              </div>
            </section>

            {/* Recent projects table */}
            <section className="bg-surface border border-border rounded-2xl py-2 overflow-hidden">
              <div className="flex items-center justify-between px-6 pt-4 pb-2.5">
                <h2 className="section-title">Recent projects</h2>
                <Link to="/projects" className="min-h-[44px] flex items-center font-semibold text-soft-fg">View all</Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] border-collapse text-[15px]">
                  <thead>
                    <tr className="text-left text-muted text-[13px] tracking-wide uppercase">
                      <th className="px-6 py-2.5 font-semibold">Project</th>
                      <th className="px-3 py-2.5 font-semibold">{areaLabel()}</th>
                      <th className="px-3 py-2.5 font-semibold">Status</th>
                      <th className="px-3 py-2.5 font-semibold text-right">Budget</th>
                      <th className="pl-3 pr-6 py-2.5 font-semibold w-[130px]">Progress</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projects.map((p) => (
                      <tr key={p.id} className="border-t border-border hover:bg-hoverbg cursor-pointer" onClick={() => {}}>
                        <td className="px-6 py-3.5 font-semibold">
                          <Link to={`/projects/${p.id}`} className="hover:underline">{p.name}</Link>
                        </td>
                        <td className="px-3 py-3.5 text-muted">{p.lga}</td>
                        <td className="px-3 py-3.5"><StatusPill status={p.status} /></td>
                        <td className="px-3 py-3.5 text-right font-semibold whitespace-nowrap">{fmtNaira(p.allocatedBudget || p.budget)}</td>
                        <td className="pl-3 pr-6 py-3.5">
                          <div className="flex items-center gap-2">
                            <ProgressBar progress={p.progress} status={p.status} height={7} className="flex-1" />
                            <span className="text-[13px] text-muted w-[34px] text-right">{p.progress}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          {/* Right column */}
          <div className="flex-[2_1_300px] min-w-0 flex flex-col gap-6">
            {/* Needs attention */}
            <section className="bg-surface border border-border rounded-2xl px-6 py-[22px]">
              <h2 className="section-title">Needs attention</h2>
              <div className="mt-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-[15px] text-muted">Submissions awaiting review</span>
                  <span className="font-extrabold text-xl">{stats?.submissions?.pending ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[15px] text-muted">Delayed projects</span>
                  <span className="font-extrabold text-xl text-red-800 dark:text-red-300">{stats?.projects?.delayed ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[15px] text-muted">Contractors pending verification</span>
                  <span className="font-extrabold text-xl">{(stats?.contractors?.total || 0) - (stats?.contractors?.verified || 0)}</span>
                </div>
              </div>
            </section>

            {/* Recent activity */}
            <section className="bg-surface border border-border rounded-2xl px-6 py-[22px]">
              <h2 className="section-title">Recent activity</h2>
              <div className="mt-4 flex flex-col gap-4">
                {activities.length === 0 ? (
                  <p className="text-muted text-sm m-0">No activity yet.</p>
                ) : activities.map((a) => (
                  <div key={a.id} className="flex items-start gap-3">
                    <span className="flex-none w-8 h-8 rounded-full bg-soft text-soft-fg flex items-center justify-center text-[11px] font-bold">
                      {a.type === 'submission' ? 'CN' : 'PJ'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="m-0 text-sm text-ink">{a.description || a.title}</p>
                      <p className="m-0 text-xs text-muted mt-0.5">{fmtAgo(a.timestamp)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
