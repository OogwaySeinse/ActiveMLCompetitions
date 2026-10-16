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
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`flex h-9 items-center gap-2 rounded-lg border px-3 text-sm transition ${
          selected.length
            ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"
            : "border-slate-300 bg-white hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-500"
        }`}
      >
        {label}
        {selected.length > 0 && (
          <span className="rounded-full bg-indigo-600 px-1.5 text-xs font-semibold text-white">{selected.length}</span>
        )}
        <svg className="h-4 w-4 opacity-60" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
          <path d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" />
        </svg>
      </button>
      {open && (
        <div
          role="listbox"
          aria-multiselectable
          className="scroll-thin absolute z-30 mt-1 max-h-80 w-64 overflow-auto rounded-lg border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-700 dark:bg-slate-900"
        >
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="mb-1 w-full rounded px-2 py-1 text-left text-xs text-indigo-600 hover:bg-slate-100 dark:text-indigo-400 dark:hover:bg-slate-800"
            >
              Clear selection
            </button>
          )}
          {options.map((o) => (
            <label
              key={o.value}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <input
                type="checkbox"
                className="accent-indigo-600"
                checked={selected.includes(o.value)}
                onChange={() => toggle(o.value)}
              />
              <span className="flex-1 truncate">{o.label}</span>
              {o.count !== undefined && <span className="text-xs text-slate-500">{o.count}</span>}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

