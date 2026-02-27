'use client';
import { useEffect, useRef, useState } from 'react';

export type ComboboxOption = { value: string; label: string };

type ComboboxProps = {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
};

export default function Combobox({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  className,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const selectedLabel = options.find((o) => o.value === value)?.label ?? placeholder ?? '—';

  const [emptyOption, ...rest] = options;
  const filtered = rest.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={containerRef} className={`relative ${className ?? ''}`}>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setSearch('');
        }}
        className="field flex w-full items-center justify-between text-left"
      >
        <span className={value ? '' : 'text-admin-muted'}>{selectedLabel}</span>
        <span className="ml-2 text-admin-muted">▾</span>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-admin-line bg-[#0E172A] shadow-xl">
          <div className="p-2">
            <input
              autoFocus
              className="field"
              placeholder={searchPlaceholder ?? 'Поиск...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {emptyOption && (
              <button
                type="button"
                onClick={() => {
                  onChange(emptyOption.value);
                  setOpen(false);
                  setSearch('');
                }}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-[#192640] ${value === emptyOption.value ? 'text-admin-accent' : ''}`}
              >
                {emptyOption.label}
              </button>
            )}
            {filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                  setSearch('');
                }}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-[#192640] ${value === o.value ? 'text-admin-accent' : ''}`}
              >
                {o.label}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-2 text-sm text-admin-muted">Ничего не найдено</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
