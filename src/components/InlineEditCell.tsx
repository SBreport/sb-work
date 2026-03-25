'use client';

import { useState, useRef, useEffect } from 'react';

interface InlineEditCellProps {
  value: string | number;
  type?: 'text' | 'number';
  onSave: (value: string | number) => Promise<void> | void;
  className?: string;
  displayClassName?: string;
  placeholder?: string;
  min?: number;
}

export default function InlineEditCell({
  value,
  type = 'text',
  onSave,
  className = '',
  displayClassName = '',
  placeholder = '-',
  min,
}: InlineEditCellProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleSave = async () => {
    const newVal = type === 'number' ? Number(editValue) || 0 : editValue.trim();
    if (newVal !== value) {
      setSaving(true);
      await onSave(newVal);
      setSaving(false);
    }
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setEditValue(String(value));
      setEditing(false);
    } else if (e.key === 'Tab') {
      handleSave();
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={type}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        min={min}
        className={`w-full px-1.5 py-1 border border-blue-400 rounded text-sm outline-none bg-blue-50 ${className}`}
        disabled={saving}
      />
    );
  }

  const display = value === 0 && type === 'number' ? '0' : value || placeholder;

  return (
    <span
      onClick={() => { setEditValue(String(value)); setEditing(true); }}
      className={`cursor-pointer hover:bg-blue-50 rounded px-1.5 py-1 transition-colors inline-block min-w-[2rem] ${displayClassName}`}
      title="클릭하여 수정"
    >
      {display}
    </span>
  );
}
