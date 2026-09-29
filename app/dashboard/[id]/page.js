'use client';

import { useEffect, useState, use as usePromise } from 'react';
import Link from 'next/link';
import { apiGet } from '@/lib/apiClient';
import RadarChart from '@/components/RadarChart';
import LineTrendChart from '@/components/LineTrendChart';
import { LEVEL_NAMES } from '@/lib/levelMeta';
import { Printer, Loader2, ArrowLeft } from 'lucide-react';

const SCHOOL_INFO = { nameTh: 'โรงเรียนตัวอย่างพัฒนา', nameEn: 'Sample Development School', logoText: 'LOGO' };

export default function DashboardPage({ params }) {
  const { id } = usePromise(params);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const d = await apiGet(`/api/students/${encodeURIComponent(id)}/dashboard`);
        setData(d);
      } catch (e) {
        setError(e.message);
      }
    })();
  }, [id]);

  if (error) return <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">{error}</div>;
  if (!data) return (
    <div className="flex items-center justify-center gap-2 text-slate-400 py-20">
      <Loader2 className="h-4 w-4 animate-spin" />
      กำลังโหลด...
    </div>
  );

  const { student, rounds, gradeTimeline } = data;
  const sorted = [...rounds].sort((a, b) => a.year - b.year || a.ts - b.ts);
  const latest = sorted[sorted.length - 1] || null;
  const latestSkills = latest ? Object.keys(latest.levels) : [];

  function printReportCard() {
    const printEl = document.getElementById('printReport');
    const today = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
    const skillRows = latestSkills
      .map(
        (sk) =>
          `<tr><td style="padding:4px 8px;border:1px solid #cbd5e1">${sk}</td>` +
          `<td style="padding:4px 8px;border:1px solid #cbd5e1;text-align:center">${latest.levels[sk]}</td>` +
          `<td style="padding:4px 8px;border:1px solid #cbd5e1">${LEVEL_NAMES[latest.levels[sk]] || ''}</td></tr>`
      )
      .join('');

    const timelineRows = gradeTimeline
      ? gradeTimeline
          .map((g) => {
            const vals = g.round ? Object.values(g.round.levels) : [];
            const avg = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : '-';
            return (
              `<tr><td style="padding:3px 8px;border:1px solid #cbd5e1;font-weight:bold">${g.gradeLabel}</td>` +
              `<td style="padding:3px 8px;border:1px solid #cbd5e1;text-align:center">${g.year}</td>` +
              `<td style="padding:3px 8px;border:1px solid #cbd5e1">${g.round ? g.round.sport : '-'}</td>` +
              `<td style="padding:3px 8px;border:1px solid #cbd5e1;text-align:center">${g.round ? avg + ' / 6' : '-'}</td></tr>`
            );
          })
          .join('')
      : '';

    const timelineSection = gradeTimeline
      ? `
        <h3 style="font-size:13.5px;margin:0 0 8px">ประวัติผลการประเมินตั้งแต่เริ่มเรียนจนถึงปัจจุบัน</h3>
        <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:20px">
          <thead><tr style="background:#f1f5f9">
            <th style="padding:3px 8px;border:1px solid #cbd5e1;text-align:left">ระดับชั้น</th>
            <th style="padding:3px 8px;border:1px solid #cbd5e1">ปีการศึกษา</th>
            <th style="padding:3px 8px;border:1px solid #cbd5e1;text-align:left">กีฬา</th>
            <th style="padding:3px 8px;border:1px solid #cbd5e1">ระดับเฉลี่ย</th>
          </tr></thead>
          <tbody>${timelineRows}</tbody>
        </table>
      `
      : '';

    printEl.innerHTML = `
      <div style="font-family:sans-serif;color:#1f2937">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #C81E3A;padding-bottom:10px;margin-bottom:14px">
          <div>
            <div style="font-weight:bold;font-size:16px">${SCHOOL_INFO.nameTh}</div>
            <div style="font-size:12px;color:#64748b">${SCHOOL_INFO.nameEn}</div>
          </div>
          <div style="width:56px;height:56px;border-radius:50%;background:#C81E3A;color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold">${SCHOOL_INFO.logoText}</div>
        </div>
        <h2 style="text-align:center;font-size:18px;margin:0 0 12px">รายงานผลการประเมินทักษะกีฬา (Report Card)</h2>
        <div style="font-size:13px;margin-bottom:10px">
          <b>ชื่อ-สกุล:</b> ${student.name} &nbsp; <b>รหัส:</b> ${student.id} &nbsp; <b>ชั้นเรียน:</b> ${student.className}
        </div>
        <div style="font-size:13px;margin-bottom:14px">
          <b>ปีการศึกษา:</b> ${latest.year} &nbsp; <b>กีฬา:</b> ${latest.sport} &nbsp; <b>วันที่พิมพ์:</b> ${today}
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:12.5px;margin-bottom:16px">
          <thead><tr style="background:#f1f5f9">
            <th style="padding:4px 8px;border:1px solid #cbd5e1;text-align:left">ทักษะ</th>
            <th style="padding:4px 8px;border:1px solid #cbd5e1">Level</th>
            <th style="padding:4px 8px;border:1px solid #cbd5e1;text-align:left">คำอธิบาย</th>
          </tr></thead>
          <tbody>${skillRows}</tbody>
        </table>
        ${timelineSection}
        <div style="font-size:12.5px;margin-bottom:30px"><b>ความเห็นโค้ช:</b> ${latest.note || '-'}</div>
        <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-top:40px">
          <div>ลงชื่อ ................................... โค้ชผู้ประเมิน</div>
          <div>ลงชื่อ ................................... ผู้ปกครอง</div>
        </div>
      </div>
    `;
    window.print();
  }

  return (
    <div>
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-brand hover:underline">
        <ArrowLeft className="h-3.5 w-3.5" />
        กลับหน้ากรอกคะแนน
      </Link>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 my-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-800">{student.name}</h1>
          <p className="text-sm text-slate-500">
            รหัส {student.id} · ชั้นเรียน {student.className} · สถานะ {student.status}
          </p>
        </div>
        {latest && (
          <button
            onClick={printReportCard}
            className="inline-flex items-center gap-1.5 bg-brand hover:bg-brand-dark text-white font-semibold rounded-lg px-4 py-2 text-sm transition"
          >
            <Printer className="h-4 w-4" strokeWidth={2.25} />
            พิมพ์ Report Card (PDF)
          </button>
        )}
      </div>

      {!latest && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-xl p-4 text-sm">
          ยังไม่มีประวัติการประเมินของนักเรียนคนนี้
        </div>
      )}

      {latest && (
        <div className="grid md:grid-cols-2 gap-4 mb-5">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
            <h2 className="font-semibold text-slate-700 mb-3">
              ระดับทักษะล่าสุด — {latest.sport} (ปี {latest.year})
            </h2>
            <div className="max-w-xs mx-auto">
              <RadarChart skills={latestSkills} levels={latest.levels} label={latest.year + ' ' + latest.sport} />
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
            <h2 className="font-semibold text-slate-700 mb-3">แนวโน้มพัฒนาการ ({latest.sport})</h2>
            <LineTrendChart
              rounds={sorted.filter((r) => r.sport === latest.sport)}
              skills={latestSkills}
            />
          </div>
        </div>
      )}

      {gradeTimeline ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
          <h2 className="font-semibold text-slate-700 mb-1">ประวัติผลการประเมินตั้งแต่เริ่มเรียนจนถึงปัจจุบัน</h2>
          <p className="text-xs text-slate-400 mb-3">
            ไล่ตามระดับชั้น {gradeTimeline[0].gradeLabel}–{gradeTimeline[gradeTimeline.length - 1].gradeLabel} ปีไหนไม่มีข้อมูลการประเมินจะเว้นว่างไว้
          </p>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-slate-400 border-b border-slate-200">
                  <th className="py-2 pr-3">ระดับชั้น</th>
                  <th className="py-2 pr-3">ปีการศึกษา</th>
                  <th className="py-2 pr-3">กีฬา</th>
                  <th className="py-2 pr-3">ระดับเฉลี่ย</th>
                  <th className="py-2">หมายเหตุ</th>
                </tr>
              </thead>
              <tbody>
                {gradeTimeline.map((g) => {
                  const vals = g.round ? Object.values(g.round.levels) : [];
                  const avg = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : null;
                  return (
                    <tr key={g.gradeLabel} className="border-b border-slate-100 last:border-0">
                      <td className="py-2 pr-3 font-semibold text-slate-700">{g.gradeLabel}</td>
                      <td className="py-2 pr-3 text-slate-500">{g.year}</td>
                      <td className="py-2 pr-3">{g.round ? g.round.sport : <span className="text-slate-300">—</span>}</td>
                      <td className="py-2 pr-3 font-semibold">{avg ? avg + ' / 6' : <span className="text-slate-300 font-normal">—</span>}</td>
                      <td className="py-2 text-slate-500">{g.round ? g.round.note || '-' : <span className="text-slate-300">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
          <h2 className="font-semibold text-slate-700 mb-3">ประวัติการประเมินทั้งหมด</h2>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-slate-400 border-b border-slate-200">
                  <th className="py-2 pr-3">ปีการศึกษา</th>
                  <th className="py-2 pr-3">กีฬา</th>
                  <th className="py-2 pr-3">ระดับเฉลี่ย</th>
                  <th className="py-2">หมายเหตุ</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r, i) => {
                  const vals = Object.values(r.levels);
                  const avg = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : '-';
                  return (
                    <tr key={i} className="border-b border-slate-100 last:border-0">
                      <td className="py-2 pr-3">{r.year}</td>
                      <td className="py-2 pr-3">{r.sport}</td>
                      <td className="py-2 pr-3 font-semibold">{avg} / 6</td>
                      <td className="py-2 text-slate-500">{r.note || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div id="printReport"></div>
    </div>
  );
}
