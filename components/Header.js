'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useRef } from 'react';
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
  const navRef = useRef(null);

  // มือถือ: เลื่อนแถบเมนูให้เห็นเมนูของหน้าปัจจุบันเสมอ
  useEffect(() => {
    const el = navRef.current?.querySelector('[aria-current="page"]');
    el?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [pathname]);
  return (
    <header className="no-print sticky top-0 z-30 bg-gradient-to-r from-brand-ink via-brand-dark to-brand text-white shadow-md border-b-[3px] border-gold">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-1.5 sm:gap-3 sm:px-6 pt-2 sm:py-3">
        <div className="flex items-center gap-2.5 px-4 sm:px-0">
          <span className="flex h-9 w-9 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-full bg-white/10 ring-2 ring-gold/70 p-1">
            <Image src="/logo-act-transparent.png" alt="ACT Sport Center" width={40} height={40} className="h-full w-full object-contain" priority />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-[15px] sm:text-base font-semibold tracking-tight leading-tight">Student Sports Skill Tracker</h1>
            <p className="truncate text-xs text-white/70 leading-tight">ระบบติดตามทักษะกีฬาของนักเรียน</p>
          </div>
        </div>
        {/* มือถือ: เมนูเป็นแถวเดียวเลื่อนซ้าย-ขวาได้ (ไม่ซ้อนหลายบรรทัดจนกินครึ่งจอ) · จอใหญ่: เรียงตามเดิม */}
        <nav
          ref={navRef}
          aria-label="เมนูหลัก"
          className="no-scrollbar flex items-center gap-1 overflow-x-auto px-3 pb-2 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0"
        >
          {LINKS.map((l) => {
            const Icon = l.icon;
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? 'page' : undefined}
                className={
                  'flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm sm:text-[13px] font-medium whitespace-nowrap transition ' +
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
