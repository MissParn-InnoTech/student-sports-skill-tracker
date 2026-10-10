'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { BookOpen, ChevronDown } from 'lucide-react';
import { guideFor } from '@/lib/guides';

// แถบคู่มือการใช้งานประจำหน้า — ย่อ/ขยายได้ อยู่ใต้แถบเมนูของทุกหน้า และไม่ถูกพิมพ์ไปกับรายงาน
export default function GuideBar() {
  const pathname = usePathname();
  const guide = guideFor(pathname);
  const [open, setOpen] = useState(false);

  // เปลี่ยนหน้าแล้วให้ย่อกลับ จะได้ไม่บังเนื้อหาของหน้าใหม่
  useEffect(() => { setOpen(false); }, [pathname]);

  if (!guide) return null;

  return (
    <section className="no-print mb-4 rounded-2xl border border-black/5 border-l-[3px] border-l-brand bg-surface shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="page-guide"
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left"
      >
        <BookOpen className="h-4 w-4 shrink-0 text-brand" strokeWidth={2.25} />
        <span className="text-sm font-semibold text-ink">คู่มือการใช้งานหน้านี้</span>
        {!open && <span className="hidden min-w-0 truncate text-[13px] text-ink/55 sm:inline">· {guide.what}</span>}
        <ChevronDown className={'ml-auto h-4 w-4 shrink-0 text-ink/50 transition-transform ' + (open ? 'rotate-180' : '')} />
      </button>
      {open && (
        <div id="page-guide" className="px-4 pb-4 pl-10 text-sm leading-relaxed text-ink">
          <p className="max-w-[70ch] text-ink/70">{guide.what}</p>
          {guide.steps?.length > 0 && (
            <>
              <p className="mt-3 text-xs font-semibold tracking-wide text-brand">ขั้นตอน</p>
              <ol className="max-w-[70ch] list-decimal space-y-0.5 pl-5">
                {guide.steps.map((t, i) => <li key={i}>{t}</li>)}
              </ol>
            </>
          )}
          {guide.tips?.length > 0 && (
            <>
              <p className="mt-3 text-xs font-semibold tracking-wide text-brand">ข้อควรรู้</p>
              <ul className="max-w-[70ch] list-disc space-y-0.5 pl-5">
                {guide.tips.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  );
}
