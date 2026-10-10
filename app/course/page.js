'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiGet, apiPost } from '@/lib/apiClient';
import { Loader2, Save } from 'lucide-react';

const LEVELS = ['PL', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6'];
const selectCls = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';

export default function CourseScoresPage() {
  const [filters, setFilters] = useState(null);
  const [year, setYear] = useState('');
  const [sport, setSport] = useState('');
  const [type, setType] = useState('');
  const [rows, setRows] = useState([]);
  const [edits, setEdits] = useState({});
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function load(y, s, t) {
    try {
      setBusy(true);
      setError('');
      const data = await apiGet(
        `/api/course-logs?year=${encodeURIComponent(y)}&sport=${encodeURIComponent(s)}&type=${encodeURIComponent(t)}`
      );
      setFilters(data.filters);
      setRows(data.rows);
      setEdits({});
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load('', '', '');
  }, []);

  function changeFilter(next) {
    const y = next.year !== undefined ? next.year : year;
    const s = next.sport !== undefined ? next.sport : sport;
    const t = next.type !== undefined ? next.type : type;
    setYear(y);
    setSport(s);
    setType(t);
    setMessage('');
    load(y, s, t);
  }

  function valueOf(row, field) {
    const e = edits[row.id];
    if (e && e[field] !== undefined) return e[field];
    const v = row[field];
    return v === null || v === undefined ? '' : String(v);
  }

  function setField(row, field, value) {
    setMessage('');
    setEdits((prev) => ({ ...prev, [row.id]: { ...prev[row.id], [field]: value } }));
  }

  const changedIds = Object.keys(edits);

  async function save() {
    try {
      setBusy(true);
      setError('');
      const entries = rows
        .filter((r) => edits[r.id])
        .map((r) => ({ id: r.id, levelNew: valueOf(r, 'levelNew'), totalScore: valueOf(r, 'totalScore') }));
      const result = await apiPost('/api/course-logs', { entries });
      setMessage('บันทึกแล้ว ' + result.saved + ' รายการ');
      await load(year, sport, type);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 mb-4">
        <h1 className="text-lg font-bold text-slate-800">กรอกคะแนนคอร์สพิเศษ</h1>
        <p className="text-sm text-slate-500 mt-1 mb-4 leading-relaxed">
          AFTER SCHOOL / OCTOBER / SUMMER — รายชื่อมาจากต้นขั้ว (แท็บ Course_Register) ใน Google Sheet และแยกจากคะแนนภาคปกติ
        </p>
        <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
          <label className="text-xs font-semibold text-slate-500">
            ปีการศึกษา
            <select className={selectCls + ' block mt-1 w-full sm:w-auto'} value={year} onChange={(e) => changeFilter({ year: e.target.value })}>
              <option value="">ทุกปี</option>
              {(filters?.years || []).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-500">
            รหัสวิชา
            <select className={selectCls + ' block mt-1 w-full sm:w-auto'} value={sport} onChange={(e) => changeFilter({ sport: e.target.value })}>
              <option value="">ทุกกีฬา</option>
              {(filters?.sportCodes || []).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="col-span-2 text-xs font-semibold text-slate-500 ">
            ประเภทคอร์ส
            <select className={selectCls + ' block mt-1 w-full sm:w-auto'} value={type} onChange={(e) => changeFilter({ type: e.target.value })}>
              <option value="">ทุกประเภท</option>
              {(filters?.courseTypes || []).map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
          <button
            onClick={save}
            disabled={busy || changedIds.length === 0}
            className="hidden sm:inline-flex items-center gap-1.5 bg-brand hover:bg-brand-dark disabled:opacity-40 text-white font-semibold rounded-lg px-4 py-2 text-sm transition ml-auto"
          >
            <Save className="h-4 w-4" strokeWidth={2.25} />
            บันทึก{changedIds.length ? ' (' + changedIds.length + ')' : ''}
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm mb-4">{error}</div>}
      {message && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl p-4 text-sm mb-4">{message}</div>}

      {busy && rows.length === 0 ? (
        <div className="flex items-center justify-center gap-2 text-slate-400 py-20">
          <Loader2 className="h-4 w-4 animate-spin" />
          กำลังโหลด...
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-xl p-4 text-sm">
          ยังไม่มีรายชื่อนักเรียนคอร์สพิเศษตามตัวกรองนี้ — รายชื่อจะขึ้นที่นี่หลังกรอกต้นขั้วในแท็บ Course_Register และตั้งค่าเชื่อมเว็บในชีตแล้ว
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
          <p className="text-xs text-slate-400 mb-3">{rows.length} รายการ</p>
          {/* มือถือ: การ์ดต่อรายการ กรอก LV.ใหม่/คะแนนได้เต็มความกว้างจอ */}
          <ul className="sm:hidden -mx-4 divide-y divide-slate-100 border-t border-slate-100">
            {rows.map((r) => (
              <li key={r.id} className={'px-4 py-3.5 ' + (edits[r.id] ? 'bg-amber-50/70' : '')}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-base font-semibold leading-snug text-slate-800">{r.studentName || '-'}</div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      <Link href={'/dashboard/' + encodeURIComponent(r.studentId)} className="font-medium text-brand">{r.studentId}</Link>
                      {' · '}{r.className || '-'} · ปี {r.academicYear}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{r.sportCode}</span>
                </div>
                <div className="mt-1.5 text-xs text-slate-500">
                  {r.courseType} · LV.เดิม <b className="text-slate-700">{r.levelOld || '-'}</b>
                </div>
                <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                  <label className="text-xs font-semibold text-slate-500">
                    LV.ใหม่
                    <select
                      className={selectCls + ' mt-1 block w-full'}
                      value={valueOf(r, 'levelNew')}
                      onChange={(e) => setField(r, 'levelNew', e.target.value)}
                    >
                      <option value="">—</option>
                      {LEVELS.map((lv) => (
                        <option key={lv} value={lv}>{lv}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-500">
                    คะแนนรวม (100)
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      max="100"
                      step="any"
                      className={selectCls + ' mt-1 block w-full'}
                      value={valueOf(r, 'totalScore')}
                      onChange={(e) => setField(r, 'totalScore', e.target.value)}
                    />
                  </label>
                </div>
              </li>
            ))}
          </ul>
          <div className="hidden sm:block overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-slate-400 border-b border-slate-200">
                  <th className="py-2 pr-3">รหัส</th>
                  <th className="py-2 pr-3">ชื่อ-นามสกุล</th>
                  <th className="py-2 pr-3">ชั้น/ห้อง</th>
                  <th className="py-2 pr-3">ปี</th>
                  <th className="py-2 pr-3">ประเภทคอร์ส</th>
                  <th className="py-2 pr-3">วิชา</th>
                  <th className="py-2 pr-3">LV.เดิม</th>
                  <th className="py-2 pr-3">LV.ใหม่</th>
                  <th className="py-2">คะแนนรวม (100)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={'border-b border-slate-100 last:border-0 ' + (edits[r.id] ? 'bg-amber-50/60' : '')}>
                    <td className="py-2 pr-3 text-slate-500">
                      <Link href={'/dashboard/' + encodeURIComponent(r.studentId)} className="text-brand hover:underline">{r.studentId}</Link>
                    </td>
                    <td className="py-2 pr-3 font-semibold text-slate-700">{r.studentName || '-'}</td>
                    <td className="py-2 pr-3">{r.className || '-'}</td>
                    <td className="py-2 pr-3 text-slate-500">{r.academicYear}</td>
                    <td className="py-2 pr-3">{r.courseType}</td>
                    <td className="py-2 pr-3">{r.sportCode}</td>
                    <td className="py-2 pr-3">{r.levelOld || '-'}</td>
                    <td className="py-2 pr-3">
                      <select
                        aria-label={'LV.ใหม่ ของ ' + r.studentId}
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
                        value={valueOf(r, 'levelNew')}
                        onChange={(e) => setField(r, 'levelNew', e.target.value)}
                      >
                        <option value="">—</option>
                        {LEVELS.map((lv) => (
                          <option key={lv} value={lv}>{lv}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2">
                      <input
                        aria-label={'คะแนนรวม ของ ' + r.studentId}
                        type="number"
                        min="0"
                        max="100"
                        step="any"
                        className="w-24 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
                        value={valueOf(r, 'totalScore')}
                        onChange={(e) => setField(r, 'totalScore', e.target.value)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* มือถือ: ปุ่มบันทึกติดขอบล่าง กดได้ทุกเมื่อโดยไม่ต้องเลื่อนกลับขึ้นไปด้านบน */}
      {rows.length > 0 && (
        <div className="sm:hidden fixed bottom-0 inset-x-0 z-30 flex items-center gap-3 border-t border-black/5 bg-white/95 px-4 pt-3 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,.08)] backdrop-blur">
          <div className="min-w-0 flex-1 text-sm leading-tight text-slate-600">
            {changedIds.length ? <>แก้ไขแล้ว <b className="text-slate-800">{changedIds.length}</b> รายการ</> : 'ยังไม่มีการแก้ไข'}
          </div>
          <button
            onClick={save}
            disabled={busy || changedIds.length === 0}
            className="btn-primary shrink-0 px-6 py-3 text-base"
          >
            <Save className="h-4 w-4" strokeWidth={2.25} />
            บันทึก
          </button>
        </div>
      )}
    </div>
  );
}
