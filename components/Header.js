'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: '📝 กรอกคะแนน' },
  { href: '/report', label: '📊 รายงานรายห้อง' },
  { href: '/admin', label: '📈 ภาพรวมระบบ' },
];

export default function Header() {
  const pathname = usePathname();
  return (
    <header className="no-print bg-gradient-to-r from-teal-700 to-teal-500 text-white px-4 sm:px-6 pt-4 pb-3 shadow">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight">Student Sports Skill Tracker</h1>
          <p className="text-xs sm:text-sm text-white/80">ระบบติดตามทักษะกีฬาของนักเรียน</p>
        </div>
        <nav className="flex items-center gap-2 flex-wrap">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={
                'flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold whitespace-nowrap transition ' +
                (pathname === l.href ? 'bg-white/30' : 'bg-white/15 hover:bg-white/25')
              }
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
