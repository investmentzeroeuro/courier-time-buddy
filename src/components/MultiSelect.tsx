import { useState, useRef, useEffect } from "react";

interface Props {
  label: string;
  items: string[];
  value: string[];
  onChange: (val: string[]) => void;
  allLabel: string;
  formatItem?: (item: string) => string;
  countLabel?: (n: number) => string;
}

export function MultiSelect({
  label,
  items,
  value,
  onChange,
  allLabel,
  formatItem,
  countLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const isAll = value.length === 0 || value.length === items.length;

  const toggleAll = () => {
    onChange(isAll ? ["__none__"] : []);
  };

  const toggle = (item: string) => {
    const current = isAll ? [...items] : value.filter((v) => v !== "__none__");
    if (current.includes(item)) {
      const next = current.filter((v) => v !== item);
      onChange(next.length === 0 ? ["__none__"] : next);
    } else {
      const next = [...current, item];
      onChange(next.length >= items.length ? [] : next);
    }
  };

  const selected = value.filter((v) => v !== "__none__");
  const display = isAll
    ? allLabel
    : selected.length === 0
      ? "Brak wyboru"
      : selected.length === 1
        ? (formatItem ? formatItem(selected[0]) : selected[0])
        : countLabel
          ? countLabel(selected.length)
          : `${selected.length} wybranych`;

  return (
    <div className="flex items-center gap-3 relative" ref={ref}>
      <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">
        {label}:
      </label>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between gap-2 w-[220px] px-3 py-2 text-sm rounded-md border border-input bg-card hover:bg-accent/50 transition-colors text-left"
      >
        <span className="truncate">{display}</span>
        <svg className="w-4 h-4 opacity-50 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 w-[240px] max-h-[300px] overflow-auto bg-popover border border-border rounded-lg shadow-lg">
          <div
            onClick={toggleAll}
            className={`px-3 py-2 text-sm cursor-pointer hover:bg-accent/30 flex items-center gap-2 ${isAll ? "font-semibold text-primary" : ""}`}
          >
            <span className={`w-4 h-4 rounded border flex items-center justify-center text-xs ${isAll ? "bg-primary text-primary-foreground border-primary" : "border-input"}`}>
              {isAll && "✓"}
            </span>
            {allLabel}
          </div>
          {items.map((item) => {
            const checked = isAll || selected.includes(item);
            return (
              <div
                key={item}
                onClick={() => toggle(item)}
                className="px-3 py-2 text-sm cursor-pointer hover:bg-accent/30 flex items-center gap-2"
              >
                <span className={`w-4 h-4 rounded border flex items-center justify-center text-xs ${checked ? "bg-primary text-primary-foreground border-primary" : "border-input"}`}>
                  {checked && "✓"}
                </span>
                {formatItem ? formatItem(item) : item}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
