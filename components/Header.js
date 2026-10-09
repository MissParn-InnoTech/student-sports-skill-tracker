'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { ClipboardList, BarChart3, LayoutDashboard, Users, GraduationCap } from 'lucide-react';

const LINKS = [
  { href: '/', label: 'กรอกคะแนน', icon: ClipboardList },
  { href: '/course', label: 'คอร์สพิเศษ', icon: GraduationCap },
  { href: '/report', label: 'รายงานรายห้อง', icon: BarChart3 },
  { href: '/admin', label: 'รายงานผู้บริหาร', icon: LayoutDashboard },
  { href: '/admin/students', label: 'จัดการนักเรียน', icon: Users },
];

export default function Header() {
  const pathname = usePathname();
  return (
    <header className="no-print sticky top-0 z-30 bg-gradient-to-r from-brand-ink via-brand-dark to-brand text-white shadow-md border-b-[3px] border-gold">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 ring-2 ring-gold/70 p-1">
            <Image src="/logo-act-transparent.png" alt="ACT Sport Center" width={40} height={40} className="h-full w-full object-contain" priority />
          </span>
          <div>
            <h1 className="text-[15px] sm:text-base font-semibold tracking-tight leading-tight">Student Sports Skill Tracker</h1>
            <p className="text-[11px] sm:text-xs text-white/70 leading-tight">ระบบติดตามทักษะกีฬาของนักเรียน</p>
          </div>
        </div>
        <nav className="flex items-center gap-1 flex-wrap">
          {LINKS.map((l) => {
            const Icon = l.icon;
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={
                  'flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-medium whitespace-nowrap transition ' +
                  (active
                    ? 'bg-white text-brand-ink shadow-sm'
                    : 'text-white/85 hover:bg-white/10 hover:text-white')
                }
              >
                <Icon className="h-4 w-4" strokeWidth={2.25} />
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
