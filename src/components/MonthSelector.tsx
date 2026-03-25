'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

interface MonthSelectorProps {
  month: string; // '2026-04'
  onChange: (month: string) => void;
}

export default function MonthSelector({ month, onChange }: MonthSelectorProps) {
  const [year, mon] = month.split('-').map(Number);

  const navigate = (direction: -1 | 1) => {
    let newMonth = mon + direction;
    let newYear = year;
    if (newMonth < 1) { newMonth = 12; newYear--; }
    if (newMonth > 12) { newMonth = 1; newYear++; }
    onChange(`${newYear}-${String(newMonth).padStart(2, '0')}`);
  };

  return (
    <div className="flex items-center gap-1 sm:gap-2">
      <button
        onClick={() => navigate(-1)}
        className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 active:bg-gray-200"
      >
        <ChevronLeft size={20} />
      </button>
      <span className="text-sm sm:text-lg font-semibold text-gray-900 min-w-[100px] sm:min-w-[120px] text-center whitespace-nowrap">
        {year}년 {mon}월
      </span>
      <button
        onClick={() => navigate(1)}
        className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 active:bg-gray-200"
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
}
