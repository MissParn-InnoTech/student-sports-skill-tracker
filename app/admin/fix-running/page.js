'use client';

import { useEffect, useState } from 'react';
import { apiGet, apiPost } from '@/lib/apiClient';
import { getActorName } from '@/lib/currentUser';
import { Loader2, ShieldAlert, CheckCircle2, Wrench } from 'lucide-react';

const nf = new Intl.NumberFormat('th-TH');
const fmt = (n) => nf.format(n || 0);
const fmtDate = (ts) => (ts ? new Date(ts).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' }) : '—');

const ACTION_LABEL = {
  move: 'ย้าย',
  removeDuplicate: 'ลบแถวซ้ำ (มีผลกีฬาที่ถูกต้องระดับเดียวกันอยู่แล้ว)',
  skipLevelMismatch: 'ข้าม (มีผลกีฬาที่ถูกต้องอยู่แล้วแต่ระดับไม่ตรงกัน)',
  skip: 'ข้าม',
};

export default function FixRunningPage() {
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [chosen, setChosen] = useState({ confirmed: true, centralOnly: false, prevOnly: false });
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setReport(await apiGet('/api/admin/fix-running-sport'));
      } catch (e) {
        setError(e.message);
      }
    })();
  }, []);

  const apply = async () => {
    setBusy(true);
    setError('');
    try {
      const groups = Object.keys(chosen).filter((k) => chosen[k]);
      const r = await apiPost('/api/admin/fix-running-sport', { confirm: confirmText.trim(), groups, actor: getActorName() || undefined });
      setResult(r);
      setReport(r.report);
      setConfirmText('');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!report && !error) return (
    <div className="flex items-center justify-center gap-2 text-slate-400 py-20">
      <Loader2 className="h-4 w-4 animate-spin" />
      กำลังตรวจสอบ...
    </div>
  );

  const selectedGroups = report ? report.groups.filter((g) => g.movable && chosen[g.key]) : [];
  const willMove = selectedGroups.reduce((a, g) => a + g.move, 0);
  const willRemove = selectedGroups.reduce((a, g) => a + g.removeDuplicate, 0);

  return (
    <div className="max-w-4xl">
      <h1 className="flex items-center gap-2 text-lg font-semibold text-slate-800 mb-1">
        <Wrench className="h-5 w-5 text-brand" />
        แก้ผลประเมินที่บันทึกผิดเป็น &ldquo;วิ่ง (Running)&rdquo;
      </h1>
      <p className="text-xs text-slate-500 mb-4 leading-relaxed">
        หน้านี้แสดงรายงานตรวจสอบก่อน ยังไม่แก้ข้อมูลใด ๆ จนกว่าจะพิมพ์ยืนยันและกดปุ่มด้านล่าง
        ทุกแถวที่ถูกแก้จะถูกสำเนาไว้ในตาราง skill_logs_sport_fix_backup ก่อนเสมอ
      </p>

      {error ? <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm mb-4">{error}</div> : null}

      {result ? (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl p-4 text-sm mb-4">
          <div className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-4 w-4" />แก้ไขเรียบร้อย</div>
          ย้ายกลับกีฬาที่ถูกต้อง {fmt(result.moved)} รายการ · ลบแถวซ้ำ {fmt(result.duplicatesRemoved)} รายการ
        </div>
      ) : null}

      {report ? (
        <>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 mb-4 text-sm text-slate-600 leading-relaxed">
            <div className="text-2xl font-bold text-slate-800 tabular-nums">{fmt(report.total)} รายการ</div>
            <div>ผลประเมินที่บันทึกเป็น &ldquo;{report.wrongSport}&rdquo; ของนักเรียน {fmt(report.students)} คน</div>
            {report.total > 0 ? (
              <ul className="mt-2 text-xs text-slate-500 space-y-0.5">
                <li>ปีการศึกษา: {report.byYear.map((y) => y.academicYear + ' (' + fmt(y.count) + ')').join(', ')}</li>
                <li>ช่วงเวลาที่บันทึก: {fmtDate(report.firstRecordedTs)} ถึง {fmtDate(report.lastRecordedTs)}</li>
                {report.coachNotes.map((n) => (
                  <li key={n.note}>หมายเหตุในแถว: &ldquo;{n.note}&rdquo; ({fmt(n.count)})</li>
                ))}
              </ul>
            ) : null}
            {!report.centralSynced ? (
              <div className="mt-3 flex gap-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 p-3 text-xs">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                ยังไม่มีข้อมูล Central_Scores ในเว็บ จึงตรวจได้จากกีฬาปีก่อนหน้าแหล่งเดียว แนะนำให้ส่ง Central_Scores จากชีตก่อน
                เพื่อให้ตรวจยืนยันได้สองแหล่ง แล้วเปิดหน้านี้ใหม่
              </div>
            ) : null}
          </div>

          {report.groups.filter((g) => g.count > 0).map((g) => (
            <div key={g.key} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 mb-4">
              <label className="flex items-start gap-3">
                {g.movable ? (
                  <input type="checkbox" className="mt-1 h-4 w-4" checked={!!chosen[g.key]} onChange={(e) => setChosen((c) => ({ ...c, [g.key]: e.target.checked }))} />
                ) : (
                  <span className="mt-0.5 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500 whitespace-nowrap">ไม่แก้</span>
                )}
                <span>
                  <span className="font-semibold text-slate-700">{g.label}</span>
                  <span className="block text-sm text-slate-500">
                    {fmt(g.count)} รายการ
                    {g.movable ? ' · จะย้าย ' + fmt(g.move) + ' · ลบแถวซ้ำ ' + fmt(g.removeDuplicate) + ' · ข้ามเพราะระดับไม่ตรง ' + fmt(g.skipLevelMismatch) : ' · ต้องตรวจด้วยมือ'}
                  </span>
                </span>
              </label>
              {g.byTarget.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {g.byTarget.map((t) => (
                    <span key={t.sport} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">→ {t.sport} <b className="tabular-nums">{fmt(t.count)}</b></span>
                  ))}
                </div>
              ) : null}
              <details className="mt-3">
                <summary className="cursor-pointer text-xs text-slate-500">ดูตัวอย่าง {fmt(g.examples.length)} รายการแรก</summary>
                <div className="overflow-auto mt-2">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="text-left text-slate-400 border-b border-slate-200">
                        <th className="py-1 pr-3">รหัส</th>
                        <th className="py-1 pr-3">ชื่อ</th>
                        <th className="py-1 pr-3">ปี</th>
                        <th className="py-1 pr-3">ระดับ</th>
                        <th className="py-1 pr-3">Central_Scores</th>
                        <th className="py-1 pr-3">ปีก่อนหน้า</th>
                        <th className="py-1">การดำเนินการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.examples.map((e, i) => (
                        <tr key={i} className="border-b border-slate-100 last:border-0 text-slate-600">
                          <td className="py-1 pr-3 tabular-nums">{e.studentId}</td>
                          <td className="py-1 pr-3 whitespace-nowrap">{e.studentName}</td>
                          <td className="py-1 pr-3 tabular-nums">{e.academicYear}</td>
                          <td className="py-1 pr-3 tabular-nums">{e.level}</td>
                          <td className="py-1 pr-3">{e.central.join(', ') || '—'}</td>
                          <td className="py-1 pr-3">{e.prev.join(', ') || '—'}</td>
                          <td className="py-1">{ACTION_LABEL[e.action]}{e.target && e.action === 'move' ? ' → ' + e.target : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </div>
          ))}

          {report.total === 0 ? (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl p-4 text-sm">
              ไม่มีผลประเมินที่บันทึกเป็น &ldquo;{report.wrongSport}&rdquo; เหลืออยู่ในระบบ
            </div>
          ) : (
            <div className="bg-white rounded-2xl border-2 border-brand/30 shadow-sm p-4 sm:p-5">
              <div className="font-semibold text-slate-700 mb-1">ยืนยันการแก้ข้อมูล</div>
              <p className="text-sm text-slate-600 mb-3">
                กลุ่มที่เลือกจะย้าย <b>{fmt(willMove)}</b> รายการ และลบแถวซ้ำ <b>{fmt(willRemove)}</b> รายการ
                พิมพ์คำว่า <b>ย้าย</b> ในช่องด้านล่างเพื่อยืนยัน
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <input className="input w-40" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="พิมพ์ ย้าย" />
                <button
                  onClick={apply}
                  disabled={busy || confirmText.trim() !== 'ย้าย' || willMove + willRemove === 0}
                  className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-[13px] font-medium text-white hover:bg-brand-dark disabled:opacity-40"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />}
                  แก้ข้อมูลตามกลุ่มที่เลือก
                </button>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
