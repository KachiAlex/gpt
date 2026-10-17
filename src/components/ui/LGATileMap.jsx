import { Link } from 'react-router-dom';

// Schematic tile map: one tile per area present in the data, intensity = project count.
// counts: { 'Area name': 12, ... } — from /api/public/projects-by-lga
export default function LGATileMap({ counts = {}, basePath = '/public' }) {
  const areas = Object.keys(counts).sort();
  const max = Math.max(1, ...Object.values(counts));
  const tileColor = (count) => {
    const r = count / max;
    if (r > 0.66) return { background: '#075985', color: '#ffffff' };
    if (r > 0.4) return { background: '#0284c7', color: '#ffffff' };
    if (r > 0.25) return { background: '#7dd3fc', color: '#082f49' };
    if (r > 0.15) return { background: '#bae6fd', color: '#082f49' };
    return { background: '#e0f2fe', color: '#075985' };
  };

  return (
    <div className="bg-white text-slate-900 rounded-[20px] p-6 shadow-[0_24px_48px_rgba(3,24,45,.35)]">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="m-0 font-bold text-lg">Projects by LGA</h2>
        <span className="text-xs text-slate-500">Schematic map, not to scale</span>
      </div>
      {areas.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No project areas yet — tiles appear once projects are added.</p>
      ) : (
      <div className="mt-4 grid grid-cols-4 sm:grid-cols-5 gap-2">
        {areas.map((name) => {
          const count = counts[name] || 0;
          return (
            <Link
              key={name}
              to={`${basePath}?lga=${encodeURIComponent(name)}`}
              className="min-h-[76px] rounded-[10px] p-2 pb-1.5 flex flex-col justify-between transition-transform hover:scale-[1.03]"
              style={tileColor(count)}
            >
              <span className="text-[11.5px] font-semibold leading-tight">{name}</span>
              <span className="text-xl font-extrabold leading-none">{count}</span>
            </Link>
          );
        })}
      </div>
      )}
      <div className="mt-4 flex items-center gap-2.5 text-xs text-slate-500">
        Fewer
        <span className="flex-1 h-2 rounded-full" style={{ background: 'linear-gradient(90deg,#e0f2fe,#0ea5e9,#0c4a6e)' }} />
        More projects
      </div>
    </div>
  );
}
