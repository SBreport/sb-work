'use client';

import { useState, useRef, useEffect } from 'react';

interface Option {
  value: string;
  label: string;
}

interface InlineSelectCellProps {
  value: string;
  options: Option[];
  onSave: (value: string) => Promise<void> | void;
  displayClassName?: string;
  placeholder?: string;
  renderDisplay?: (value: string, label: string) => React.ReactNode;
}

export default function InlineSelectCell({
  value,
  options,
  onSave,
  displayClassName = '',
  placeholder = '-',
  renderDisplay,
}: InlineSelectCellProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (editing && selectRef.current) {
      selectRef.current.focus();
    }
  }, [editing]);

  const handleChange = async (newVal: string) => {
    if (newVal !== value) {
      setSaving(true);
      await onSave(newVal);
      setSaving(false);
    }
    setEditing(false);
  };

  const currentOption = options.find(o => o.value === value);
  const displayLabel = currentOption?.label || placeholder;

  if (editing) {
    return (
      <select
        ref={selectRef}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={() => setEditing(false)}
        className="w-full px-1 py-1 border border-blue-400 rounded text-sm outline-none bg-blue-50"
        disabled={saving}
      >
        <option value="">선택안함</option>
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className={`cursor-pointer hover:bg-blue-50 rounded px-1.5 py-1 transition-colors inline-block ${displayClassName}`}
      title="클릭하여 변경"
    >
      {renderDisplay ? renderDisplay(value, displayLabel) : displayLabel}
    </span>
  );
}
