// Flat KPI tile per the redesign: optional soft-tint icon chip top-right,
// 34px bold value, 13.5px muted note.
export default function StatTile({ label, value, note, icon: Icon }) {
  return (
    <div className="bg-surface border border-border rounded-2xl px-[22px] py-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted font-medium">{label}</span>
        {Icon && (
          <span className="w-[38px] h-[38px] rounded-[10px] bg-soft text-soft-fg flex items-center justify-center">
            <Icon className="w-5 h-5" />
          </span>
        )}
      </div>
      <div className="mt-2.5 font-extrabold text-[34px] leading-none">{value}</div>
      {note && <div className="mt-1.5 text-[13.5px] text-muted">{note}</div>}
    </div>
  );
}
