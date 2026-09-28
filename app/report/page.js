'use client';

import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/apiClient';

export default function ClassReportPage() {
  const [cfg, setCfg] = useState(null);
  const [year, setYear] = useState('');
  const [className, setClassName] = useState('');
  const [sport, setSport] = useState('');
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const data = await apiGet('/api/initial-data');
      setCfg(data);
      setYear(String(data.defaultYear || data.years[0] || ''));
      setClassName(data.classes[0] || '');
    })();
  }, []);

  async function loadReport() {
    if (!year || !className) {
      setError('กรุณาเลือกปีการศึกษาและชั้นเรียนให้ครบ');
      return;
    }
    try {
      setBusy(true);
      setError('');
      const data = await apiGet(
        `/api/class-report?year=${encodeURIComponent(year)}&class=${encodeURIComponent(className)}&sport=${encodeURIComponent(sport)}`
      );
      setReport(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function printClassReport() {
    if (!report) return;
    const d = report;
    const isAllSports = !d.sport;
    const today = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
    let headCols = '';
    let rowsHtml = '';

    if (isAllSports) {
      headCols = '<th style="padding:4px 8px;border:1px solid #cbd5e1">กีฬา</th><th style="padding:4px 8px;border:1px solid #cbd5e1">เฉลี่ย</th>';
      rowsHtml = d.rows
        .map(
          (r, i) =>
            `<tr><td style="padding:4px 8px;border:1px solid #cbd5e1">${i + 1}</td>` +
            `<td style="padding:4px 8px;border:1px solid #cbd5e1;text-align:left">${r.studentName}</td>` +
            `<td style="padding:4px 8px;border:1px solid #cbd5e1">${r.sport || '-'}</td>` +
            `<td style="padding:4px 8px;border:1px solid #cbd5e1">${r.hasData ? r.average.toFixed(1) : '-'}</td></tr>`
        )
        .join('');
    } else {
      headCols = d.skills.map((s) => `<th style="padding:4px 8px;border:1px solid #cbd5e1">${s}</th>`).join('') +
        '<th style="padding:4px 8px;border:1px solid #cbd5e1">เฉลี่ย</th>';
      rowsHtml = d.rows
        .map((r, i) => {
          const cells = d.skills.map((s) => `<td style="padding:4px 8px;border:1px solid #cbd5e1">${r.levels[s] ?? '-'}</td>`).join('');
          return (
            `<tr><td style="padding:4px 8px;border:1px solid #cbd5e1">${i + 1}</td>` +
            `<td style="padding:4px 8px;border:1px solid #cbd5e1;text-align:left">${r.studentName}</td>` +
            cells +
            `<td style="padding:4px 8px;border:1px solid #cbd5e1">${r.hasData ? r.average.toFixed(1) : '-'}</td></tr>`
          );
        })
        .join('');
    }

    const printEl = document.getElementById('printReport');
    printEl.innerHTML = `
      <div style="font-family:sans-serif;color:#1f2937">
        <h2 style="text-align:center;font-size:18px;margin:0 0 12px">รายงานสรุปผลรายห้อง</h2>
        <div style="margin-bottom:10px;font-size:12.5px">
          <b>ชั้นเรียน:</b> ${d.className} &nbsp; <b>ปีการศึกษา:</b> ${d.academicYear} &nbsp;
          <b>ชนิดกีฬา:</b> ${isAllSports ? 'ทุกกีฬา' : d.sport} &nbsp; <b>วันที่พิมพ์:</b> ${today}
        </div>
        <div style="margin-bottom:10px;font-size:12.5px">
          ประเมินแล้ว ${d.evaluatedCount} / ${d.totalCount} คน &nbsp;|&nbsp; ค่าเฉลี่ยห้อง <b>${d.classAverage.toFixed(1)} / 6</b>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead><tr style="background:#f1f5f9">
            <th style="padding:4px 8px;border:1px solid #cbd5e1">#</th>
            <th style="padding:4px 8px;border:1px solid #cbd5e1;text-align:left">นักเรียน</th>
            ${headCols}
          </tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    `;
    window.print();
  }

  if (!cfg) return <div className="text-center text-slate-400 py-20">กำลังโหลด...</div>;

  const isAllSports = report && !report.sport;

  return (
    <div>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 mb-5">
        <h2 className="font-semibold text-slate-700 mb-3">รายงานสรุปผลรายห้อง</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
          <Field label="ปีการศึกษา">
            <select className="input" value={year} onChange={(e) => setYear(e.target.value)}>
              {cfg.years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </Field>
          <Field label="ชั้นเรียน">
            <select className="input" value={className} onChange={(e) => setClassName(e.target.value)}>
              {cfg.classes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="ประเภทกีฬา" className="col-span-2 md:col-span-1">
            <select className="input" value={sport} onChange={(e) => setSport(e.target.value)}>
              <option value="">🏆 ทุกกีฬา (All Sports)</option>
              {cfg.sports.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <button
            onClick={loadReport}
            disabled={busy}
            className="col-span-2 md:col-span-1 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-semibold rounded-lg px-4 py-2 text-sm transition"
          >
            📊 ดูรายงาน
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm mb-5">{error}</div>}

      {report && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="text-sm text-slate-600">
              ประเมินแล้ว <b>{report.evaluatedCount}</b> / {report.totalCount} คน &nbsp;|&nbsp; ค่าเฉลี่ยห้อง{' '}
              <b>{report.classAverage.toFixed(1)} / 6</b>
            </div>
            <button
              onClick={printClassReport}
              className="bg-slate-700 hover:bg-slate-800 text-white font-semibold rounded-lg px-4 py-2 text-sm transition"
            >
              🖨️ พิมพ์ PDF
            </button>
          </div>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-slate-400 border-b border-slate-200">
                  <th className="py-2 pr-3">#</th>
                  <th className="py-2 pr-3">นักเรียน</th>
                  {isAllSports ? (
                    <>
                      <th className="py-2 pr-3">กีฬา</th>
                      <th className="py-2 pr-3">เฉลี่ย</th>
                    </>
                  ) : (
                    <>
                      {report.skills.map((s) => (
                        <th key={s} className="py-2 pr-3 text-center">
                          {s}
                        </th>
                      ))}
                      <th className="py-2 pr-3">เฉลี่ย</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r, i) => (
                  <tr key={r.studentId} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-3 text-slate-400">{i + 1}</td>
                    <td className="py-2 pr-3 font-medium">{r.studentName}</td>
                    {isAllSports ? (
                      <>
                        <td className="py-2 pr-3">{r.sport || '-'}</td>
                        <td className="py-2 pr-3 font-semibold">{r.hasData ? r.average.toFixed(1) : '-'}</td>
                      </>
                    ) : (
                      <>
                        {report.skills.map((s) => (
                          <td key={s} className="py-2 pr-3 text-center">
                            {r.levels[s] ?? '-'}
                          </td>
                        ))}
                        <td className="py-2 pr-3 font-semibold">{r.hasData ? r.average.toFixed(1) : '-'}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div id="printReport"></div>
    </div>
  );
}

function Field({ label, children, className = '' }) {
  return (
    <label className={'flex flex-col gap-1 text-xs font-semibold text-slate-500 ' + className}>
      {label}
      {children}
    </label>
  );
}
