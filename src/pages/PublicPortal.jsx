import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, MapPin, ArrowRight, X, Landmark, FolderOpen } from 'lucide-react';
import clsx from 'clsx';
import { publicAPI } from '../services/api';
import StatusPill from '../components/ui/StatusPill';
import ProgressBar from '../components/ui/ProgressBar';
import { categoryLabel, fmtNaira, fmtNairaCompact, fmtDate, LGAS } from '../utils/statusMap';

const CATEGORIES = ['All', 'Transportation', 'Healthcare', 'Water & Sanitation', 'Education', 'Housing'];
const SORTS = [
  { id: 'recent', label: 'Recently updated' },
  { id: 'budget', label: 'Budget, high to low' },
  { id: 'progress', label: 'Progress, low to high' },
];

export default function PublicPortal() {
  const [params, setParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(params.get('search') || '');
  const [category, setCategory] = useState('All');
  const [lga, setLga] = useState(params.get('lga') || '');
  const [sort, setSort] = useState('recent');
  const [projects, setProjects] = useState([]);
  const [stats, setStats] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Deep links: ?lga= / ?search= update filters; ?project=<id> opens the detail modal
  useEffect(() => {
    const l = params.get('lga');
    const s = params.get('search');
    if (l !== null) setLga(l);
    if (s !== null) setSearchTerm(s);
  }, [params]);

  useEffect(() => {
    const pid = params.get('project');
    if (pid) {
      publicAPI.getProjectById(pid)
        .then((res) => res?.success && setSelected(res.data.project))
        .catch(() => {});
    }
  }, [params]);

  useEffect(() => {
    publicAPI.getStats().then((res) => setStats(res.data?.stats || null)).catch(() => {});
  }, []);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    const filters = {};
    if (category !== 'All') filters.category = category.toUpperCase().replace(/ & /g, '_AND_').replace(/ /g, '_');
    if (lga) filters.lga = lga;
    if (searchTerm.trim()) filters.search = searchTerm.trim();
    publicAPI.getProjects({ ...filters, limit: 50 })
      .then((res) => {
        if (res?.success && isMounted) setProjects(res.data?.projects || []);
      })
      .catch((e) => {
        if (isMounted) setError(e.message || 'Failed to load projects');
      })
      .finally(() => isMounted && setLoading(false));
    return () => { isMounted = false; };
  }, [category, lga, searchTerm]);

  const sorted = useMemo(() => {
    const list = [...projects];
    if (sort === 'budget') list.sort((a, b) => Number(b.budget || 0) - Number(a.budget || 0));
    if (sort === 'progress') list.sort((a, b) => Number(a.progress || 0) - Number(b.progress || 0));
    return list;
  }, [projects, sort]);

  const statTiles = [
    { label: 'Projects', value: stats ? String(stats.totalProjects) : '—' },
    { label: 'Total budget', value: stats ? fmtNairaCompact(stats.totalBudget) : '—' },
    { label: 'Completed', value: stats ? String(stats.completedProjects) : '—', color: 'text-green-700' },
    { label: 'Delayed', value: String(projects.filter((p) => p.status === 'DELAYED').length || (stats ? 0 : '—')), color: 'text-red-800' },
  ];

  const clearFilters = () => {
    setCategory('All');
    setLga('');
    setSearchTerm('');
    setParams({});
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-3">
            <span className="w-[42px] h-[42px] rounded-xl bg-abia-800 text-white flex items-center justify-center">
              <Landmark className="w-6 h-6" strokeWidth={1.75} />
            </span>
            <span className="font-extrabold text-lg text-abia-900">Abia Project Tracker</span>
          </Link>
          <div className="flex items-center gap-2.5">
            <Link to="/" className="min-h-[44px] inline-flex items-center px-3 font-medium text-slate-700">
              Home
            </Link>
            <Link to="/login" className="min-h-[44px] inline-flex items-center px-[18px] border-[1.5px] border-abia-700 rounded-[10px] text-abia-700 font-semibold text-[15px]">
              Log in
            </Link>
          </div>
        </div>
      </header>

      {/* Title + filters */}
      <section className="bg-white border-b border-slate-200">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8 pt-10 pb-8">
          <h1 className="m-0 font-extrabold text-[38px] tracking-[-0.015em] text-abia-900">Public transparency portal</h1>
          <p className="mt-2 text-slate-500 text-lg max-w-[640px]">
            Every publicly funded project in Abia State, with budgets and progress reviewed by M&amp;E officers.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <div className="flex-[3_1_320px] relative">
              <label htmlFor="pp-search" className="sr-only">Search projects</label>
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 pointer-events-none" />
              <input
                id="pp-search"
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by project, contractor or keyword"
                className="w-full h-[52px] border-[1.5px] border-slate-300 rounded-xl bg-white pl-[46px] pr-4 text-base text-slate-900"
              />
            </div>
            <div className="flex-1 basis-[200px]">
              <label htmlFor="pp-lga" className="sr-only">Local government area</label>
              <select
                id="pp-lga"
                value={lga}
                onChange={(e) => setLga(e.target.value)}
                className="w-full h-[52px] border-[1.5px] border-slate-300 rounded-xl bg-white px-3.5 text-base text-slate-900"
              >
                <option value="">All 17 LGAs</option>
                {LGAS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>

          <div role="group" aria-label="Filter by category" className="mt-4 flex flex-wrap gap-2.5">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={category === c}
                onClick={() => setCategory(c)}
                className={clsx(
                  'min-h-[44px] px-[18px] rounded-full text-[15px] font-semibold border-[1.5px] transition-colors',
                  category === c
                    ? 'bg-abia-700 border-abia-700 text-white'
                    : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400'
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </section>

      <main className="max-w-[1200px] mx-auto px-6 lg:px-8 pt-8 pb-20">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statTiles.map((s) => (
            <div key={s.label} className="bg-white border border-slate-200 rounded-[14px] px-5 py-[18px]">
              <div className="text-sm text-slate-500">{s.label}</div>
              <div className={clsx('mt-0.5 font-extrabold text-[28px]', s.color || 'text-abia-900')}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Count + sort */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <div className="text-base text-slate-700">
            <span className="font-bold text-slate-900">{sorted.length}</span> {sorted.length === 1 ? 'project' : 'projects'}
          </div>
          <div className="flex items-center gap-2 text-[15px] text-slate-500">
            <label htmlFor="pp-sort">Sort by</label>
            <select
              id="pp-sort"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="h-[44px] border-[1.5px] border-slate-300 rounded-[10px] bg-white px-3 text-[15px] text-slate-900"
            >
              {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
        </div>

        {error && (
          <div role="alert" className="mt-5 bg-red-50 border border-red-200 rounded-xl p-5 text-red-800 text-[15px]">
            {error}
          </div>
        )}

        {/* Grid / states */}
        {loading ? (
          <div className="mt-5 text-center py-16 text-slate-500">Loading projects…</div>
        ) : sorted.length === 0 ? (
          <div className="mt-5 bg-white border-[1.5px] border-dashed border-slate-300 rounded-2xl px-8 py-16 text-center">
            <span className="w-14 h-14 rounded-[14px] bg-abia-100 text-abia-700 inline-flex items-center justify-center">
              <FolderOpen className="w-7 h-7" strokeWidth={1.75} />
            </span>
            <h2 className="mt-4 mb-0 font-bold text-[22px]">No projects here yet</h2>
            <p className="mt-1.5 mb-0 mx-auto text-slate-500 max-w-[420px]">
              Nothing has been published for this category. Try another category, or clear your filters to see all projects.
            </p>
            <button type="button" onClick={clearFilters} className="mt-5 min-h-[46px] px-[22px] rounded-[10px] bg-abia-700 text-white text-base font-semibold">
              Clear filters
            </button>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {sorted.map((p) => (
              <article key={p.id} className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col gap-3.5">
                <div className="flex items-center justify-between gap-2.5">
                  <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-abia-800 bg-abia-100 px-2.5 py-[3px] rounded-full">
                    <MapPin className="w-[13px] h-[13px]" />
                    {p.lga}
                  </span>
                  <StatusPill status={p.status} />
                </div>
                <h2 className="m-0 font-bold text-[19px] leading-snug text-slate-900">{p.name}</h2>
                <div className="text-[14.5px] text-slate-500">
                  {categoryLabel(p.category)}{p.contractor?.companyName ? ` · ${p.contractor.companyName}` : ''}
                </div>
                <ProgressBar progress={p.progress} status={p.status} showLabel />
                <div className="flex items-end justify-between gap-2.5 mt-0.5">
                  <div>
                    <div className="text-[13px] text-slate-500">Budget</div>
                    <div className="font-extrabold text-[22px] text-abia-900">{fmtNaira(p.budget)}</div>
                  </div>
                  <div className="text-[13.5px] text-slate-500 text-right">
                    {fmtDate(p.startDate)}{p.expectedEndDate ? ` – ${fmtDate(p.expectedEndDate)}` : ''}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(p)}
                  className="min-h-[44px] inline-flex items-center gap-1.5 font-semibold text-abia-700 border-t border-slate-200 pt-2.5 text-left"
                >
                  View project details <ArrowRight className="w-4 h-4" />
                </button>
              </article>
            ))}
          </div>
        )}
      </main>

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-8">
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  <div className="flex flex-wrap items-center gap-2.5 mb-3">
                    <StatusPill status={selected.status} />
                    <span className="text-[13px] font-semibold text-abia-800 bg-abia-100 px-2.5 py-[3px] rounded-full">
                      {categoryLabel(selected.category)}
                    </span>
                  </div>
                  <h2 className="m-0 font-extrabold text-[28px] leading-tight text-abia-900">{selected.name}</h2>
                </div>
                <button onClick={() => setSelected(null)} className="w-11 h-11 rounded-xl text-slate-500 hover:bg-slate-100 flex items-center justify-center" aria-label="Close">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h3 className="font-bold text-base mb-2">Project description</h3>
                  <p className="text-slate-600 text-[15px]">{selected.description || 'No description provided.'}</p>
                </div>
                <div className="space-y-5">
                  <div className="space-y-2.5 text-[15px]">
                    {[
                      ['LGA', selected.lga],
                      ['Budget', fmtNaira(selected.budget)],
                      ['Contractor', selected.contractor?.companyName || '—'],
                      ['Start date', fmtDate(selected.startDate)],
                      ['Planned end', fmtDate(selected.expectedEndDate)],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-4">
                        <span className="text-slate-500">{k}</span>
                        <span className="font-semibold text-right">{v}</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-[15px]">
                      <span className="text-slate-500">Verified progress</span>
                      <span className="font-bold">{selected.progress}%</span>
                    </div>
                    <ProgressBar progress={selected.progress} status={selected.status} height={12} className="mt-2" />
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4">
                    <h4 className="font-semibold text-sm mb-1">Transparency note</h4>
                    <p className="text-sm text-slate-500">
                      This information is updated from contractor submissions verified by M&amp;E officers.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
