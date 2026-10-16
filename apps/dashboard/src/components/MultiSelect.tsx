import { useEffect, useRef, useState } from "react";

interface Props {
  label: string;
  options: { value: string; label: string; count?: number }[];
  selected: string[];
  onChange: (v: string[]) => void;
}

export function MultiSelect({ label, options, selected, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const toggle = (v: string) =>
    onChange(selected.includes(v) ? selected.filter((s) => s !== v) : [...selected, v]);

  return (
    <div className="relative font-mono" ref={ref}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`flex h-9 items-center gap-2 rounded-lg border px-3 text-xs transition ${
          selected.length
            ? "border-emerald-300/60 bg-emerald-400/15 text-emerald-200"
            : "border-white/12 bg-black/35 text-[#faf6e8]/80 hover:border-white/30 hover:text-[#faf6e8]"
        }`}
      >
        <span>{label}</span>
        {selected.length > 0 && (
          <span className="rounded bg-[#faf6e8] px-1.5 py-0.2 text-[10px] font-bold text-[#111513]">
            {selected.length}
          </span>
        )}
        <svg className="h-3.5 w-3.5 opacity-60" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
          <path d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" />
        </svg>
      </button>
      {open && (
        <div
          role="listbox"
          aria-multiselectable
          className="scroll-thin absolute z-40 mt-1.5 max-h-80 w-64 overflow-auto rounded-xl border border-white/15 bg-[#0e1512]/95 p-1.5 shadow-2xl backdrop-blur-xl"
        >
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="mb-1 w-full rounded-lg px-2 py-1 text-left text-[11px] text-emerald-300 hover:bg-white/10"
            >
              Clear selection
            </button>
          )}
          {options.map((o) => (
            <label
              key={o.value}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-[#faf6e8]/85 hover:bg-white/10"
            >
              <input
                type="checkbox"
                className="accent-emerald-400"
                checked={selected.includes(o.value)}
                onChange={() => toggle(o.value)}
              />
              <span className="flex-1 truncate">{o.label}</span>
              {o.count !== undefined && <span className="text-[11px] text-[#faf6e8]/45">{o.count}</span>}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
