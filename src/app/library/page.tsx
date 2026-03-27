'use client';

import { FolderOpen } from 'lucide-react';

export default function LibraryPage() {
  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <h2 className="text-lg font-bold text-gray-900 mb-6">자료실</h2>
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <FolderOpen size={48} strokeWidth={1.5} />
        <p className="mt-4 text-base font-medium">준비중</p>
        <p className="mt-1 text-sm">노션 데이터 연동 예정</p>
      </div>
    </div>
  );
}
