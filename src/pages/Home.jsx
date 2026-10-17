import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Landmark, Shield, Search, ArrowRight, HardHat, ClipboardCheck, Eye } from 'lucide-react';
import { publicAPI } from '../services/api';
import LGATileMap from '../components/ui/LGATileMap';
import StatusPill from '../components/ui/StatusPill';
import ProgressBar from '../components/ui/ProgressBar';
import { categoryLabel, fmtNaira, fmtNairaCompact } from '../utils/statusMap';

const steps = [
  { icon: HardHat, title: 'Contractors report progress', text: 'Each milestone is submitted with notes and documents.' },
  { icon: ClipboardCheck, title: 'M&E officers verify', text: 'Monitoring officers approve or reject each submission, with comments.' },
  { icon: Eye, title: 'Everyone can see the result', text: 'Verified progress, budgets and dates are published for the public.' },
];

const audiences = [
  { title: 'Citizens', text: 'Browse projects in your LGA without an account.', link: '/public', cta: 'Open the portal' },
  { title: 'Contractors', text: 'Log in to submit milestones, upload documents and track reviews.', link: '/login', cta: 'Contractor login' },
  { title: 'Government staff', text: 'Manage projects and contractors, review submissions and generate reports.', link: '/login', cta: 'Staff login' },
];

export default function Home() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState(null);
  const [lgaCounts, setLgaCounts] = useState({});
  const [featured, setFeatured] = useState([]);

  useEffect(() => {
    publicAPI.getStats()
      .then((res) => setStats(res.data?.stats || null))
      .catch(() => {});
    publicAPI.getProjectsByLGA()
      .then((res) => {
        const counts = {};
        (res.data?.projectsByLGA || []).forEach((g) => { counts[g.lga] = g.count; });
        setLgaCounts(counts);
      })
      .catch(() => {});
    publicAPI.getProjects({ limit: 3 })
      .then((res) => setFeatured(res.data?.projects || []))
      .catch(() => {});
  }, []);

  const submitSearch = (e) => {
    e.preventDefault();
    navigate(search.trim() ? `/public?search=${encodeURIComponent(search.trim())}` : '/public');
  };

  const statItems = [
    { value: stats ? String(stats.totalProjects) : '—', label: 'Projects tracked' },
    { value: String(Object.keys(lgaCounts).length || 17), label: 'Local government areas' },
    { value: stats ? fmtNairaCompact(stats.totalBudget) : '—', label: 'Public funds tracked' },
    { value: stats ? String(stats.completedProjects) : '—', label: 'Completed projects' },
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans text-base leading-relaxed">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <Link to="/" aria-label="Abia Project Tracker home" className="flex items-center gap-3">
            <span className="w-[42px] h-[42px] rounded-xl bg-abia-800 text-white flex items-center justify-center">
              <Landmark className="w-6 h-6" strokeWidth={1.75} />
            </span>
            <span className="flex flex-col leading-tight">
              <span className="font-extrabold text-lg text-abia-900">Abia Project Tracker</span>
              <span className="text-xs text-slate-500 font-medium">Public accountability for Abia State</span>
            </span>
          </Link>
          <nav aria-label="Primary" className="hidden md:flex items-center gap-7 text-[15px] font-medium text-slate-700">
            <Link to="/public" className="hover:text-abia-700">Projects</Link>
            <a href="#lgas" className="hover:text-abia-700">By LGA</a>
            <a href="#how" className="hover:text-abia-700">How it works</a>
            <a href="#audiences" className="hover:text-abia-700">For contractors</a>
          </nav>
          <div className="flex items-center gap-2.5">
            <Link to="/login" className="min-h-[44px] inline-flex items-center px-[18px] border-[1.5px] border-abia-700 rounded-[10px] text-abia-700 font-semibold text-[15px]">
              Log in
            </Link>
            <Link to="/public" className="min-h-[44px] inline-flex items-center px-[18px] bg-abia-700 rounded-[10px] text-white font-semibold text-[15px]">
              View projects
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-abia-900 text-white">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8 pt-20 pb-[88px] flex flex-wrap items-center gap-14">
          <div className="flex-1 min-w-0 basis-[460px]">
            <div className="inline-flex items-center gap-2 text-[13px] font-semibold text-abia-200 bg-abia-500/[.18] px-3.5 py-1.5 rounded-full">
              <Shield className="w-4 h-4" />
              Every project, every naira, every LGA
            </div>
            <h1 className="mt-5 font-extrabold text-[40px] md:text-[56px] leading-[1.06] tracking-[-0.02em]">
              See how public money is building Abia
            </h1>
            <p className="mt-5 text-[19px] leading-relaxed text-abia-200 max-w-[520px]">
              Search any government project in the state, check its budget and progress, and see who is delivering it.
            </p>
            <form onSubmit={submitSearch} className="mt-8 flex flex-wrap gap-2.5 max-w-[560px]">
              <label htmlFor="hero-search" className="sr-only">Search projects</label>
              <div className="flex-1 basis-[280px] relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  id="hero-search"
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by project, LGA or contractor"
                  className="w-full h-[54px] rounded-xl bg-white pl-[46px] pr-4 text-base text-slate-900"
                />
              </div>
              <button type="submit" className="min-h-[54px] px-[26px] rounded-xl bg-abia-500 text-abia-950 text-base font-bold">
                Search
              </button>
            </form>
            <div className="mt-5 flex flex-wrap gap-2.5 items-center text-sm text-abia-200">
              <span>Popular:</span>
              {['Roads', 'Water', 'Health centres', 'Schools'].map((t) => (
                <Link key={t} to={`/public?search=${encodeURIComponent(t)}`} className="px-3 py-[5px] border border-abia-400 rounded-full text-abia-100 hover:bg-white/10">
                  {t}
                </Link>
              ))}
            </div>
          </div>

          <div id="lgas" className="flex-1 min-w-0 basis-[440px]">
            <LGATileMap counts={lgaCounts} />
          </div>
        </div>
      </section>

      {/* Live stats */}
      <section className="bg-white border-b border-slate-200">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8 py-9 grid grid-cols-2 md:grid-cols-4 gap-8">
          {statItems.map((s) => (
            <div key={s.label}>
              <div className="font-extrabold text-[38px] leading-none text-abia-900">{s.value}</div>
              <div className="mt-1.5 text-[15px] text-slate-500">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Recently updated projects */}
      {featured.length > 0 && (
        <section>
          <div className="max-w-[1200px] mx-auto px-6 lg:px-8 pt-20 pb-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="m-0 font-extrabold text-[34px] tracking-[-0.01em] text-abia-900">Recently updated projects</h2>
                <p className="mt-1.5 text-slate-500 text-[17px]">Progress reports reviewed by M&amp;E officers appear here first.</p>
              </div>
              <Link to="/public" className="inline-flex items-center gap-1.5 min-h-[44px] font-semibold text-abia-700">
                See all projects <ArrowRight className="w-[18px] h-[18px]" />
              </Link>
            </div>
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
              {featured.map((p) => (
                <Link
                  key={p.id}
                  to={`/public?project=${p.id}`}
                  className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col gap-3.5 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between gap-2.5">
                    <span className="text-[13px] font-semibold text-abia-800 bg-abia-100 px-2.5 py-[3px] rounded-full">{p.lga}</span>
                    <StatusPill status={p.status} />
                  </div>
                  <h3 className="m-0 font-bold text-[19px] leading-snug">{p.name}</h3>
                  <div className="text-[14.5px] text-slate-500">
                    {categoryLabel(p.category)}{p.contractor?.companyName ? ` · ${p.contractor.companyName}` : ''}
                  </div>
                  <ProgressBar progress={p.progress} status={p.status} showLabel />
                  <div className="font-extrabold text-[22px] text-abia-900">{fmtNaira(p.budget)}</div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* How it works */}
      <section id="how">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8 py-[72px]">
          <h2 className="m-0 font-extrabold text-[34px] tracking-[-0.01em] text-abia-900 max-w-[640px]">
            From contract to completion, in the open
          </h2>
          <div className="mt-9 grid grid-cols-1 md:grid-cols-3 gap-6">
            {steps.map((s, i) => (
              <div key={s.title} className="bg-white border border-slate-200 rounded-2xl p-7">
                <span className="w-12 h-12 rounded-xl bg-abia-100 text-abia-700 flex items-center justify-center">
                  <s.icon className="w-6 h-6" strokeWidth={1.75} />
                </span>
                <div className="mt-1.5 text-[13px] font-bold text-abia-700 tracking-wider">STEP {i + 1}</div>
                <h3 className="mt-1 mb-0 font-bold text-xl">{s.title}</h3>
                <p className="mt-2 mb-0 text-slate-500 text-base">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Audiences */}
      <section id="audiences" className="bg-white border-y border-slate-200">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8 py-[72px] grid grid-cols-1 md:grid-cols-3 gap-6">
          {audiences.map((a) => (
            <div key={a.title} className="border border-slate-200 rounded-2xl p-7 flex flex-col gap-2.5">
              <h3 className="m-0 font-bold text-[21px] text-abia-900">{a.title}</h3>
              <p className="m-0 text-slate-500">{a.text}</p>
              <Link to={a.link} className="mt-auto min-h-[44px] inline-flex items-center gap-1.5 font-semibold text-abia-700">
                {a.cta} <ArrowRight className="w-[18px] h-[18px]" />
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-abia-950 text-abia-200">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8 pt-14 pb-8 flex flex-wrap gap-10 justify-between">
          <div className="flex-1 basis-[300px] max-w-[400px]">
            <div className="font-extrabold text-xl text-white">Abia Project Tracker</div>
            <p className="mt-2.5 text-[15px]">
              Tracking publicly funded projects across the 17 local government areas of Abia State.
            </p>
          </div>
          <div className="flex flex-wrap gap-14 text-[15px]">
            <div className="flex flex-col gap-2.5">
              <span className="text-white font-semibold">Explore</span>
              <Link to="/public" className="hover:text-white">All projects</Link>
              <a href="#lgas" className="hover:text-white">By LGA</a>
              <a href="#how" className="hover:text-white">How it works</a>
            </div>
            <div className="flex flex-col gap-2.5">
              <span className="text-white font-semibold">Accounts</span>
              <Link to="/login" className="hover:text-white">Log in</Link>
              <Link to="/login" className="hover:text-white">Contractor access</Link>
            </div>
            <div className="flex flex-col gap-2.5">
              <span className="text-white font-semibold">Contact</span>
              <span>Government Secretariat, Umuahia</span>
              <span>info@gpt-system.gov</span>
            </div>
          </div>
        </div>
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8 pb-8 text-sm text-abia-300">
          © 2026 Kreatix Technologies
        </div>
      </footer>
    </div>
  );
}
