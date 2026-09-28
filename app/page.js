'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiGet, apiPost } from '@/lib/apiClient';
import { LEVEL_NAMES, initials } from '@/lib/levelMeta';

export default function CoachInputPage() {
  const [cfg, setCfg] = useState(null);
  const [year, setYear] = useState('');
  const [className, setClassName] = useState('');
  const [sport, setSport] = useState('');
  const [roster, setRoster] = useState(null); // ผลจาก /api/roster
  const [gridValues, setGridValues] = useState({}); // { studentId: { skillName: level } }
  const [notes, setNotes] = useState({}); // { studentId: note }
  const [actor, setActor] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [toastMsg, setToastMsg] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setBusy(true);
        const data = await apiGet('/api/initial-data');
        setCfg(data);
        setYear(String(data.defaultYear || data.years[0] || ''));
        setClassName(data.classes[0] || '');
        setSport(data.sports[0]?.name || '');
      } catch (e) {
        setError(e.message);
      } finally {
        setBusy(false);
      }
    })();
  }, []);

  const sportObj = useMemo(() => cfg?.sports.find((s) => s.name === sport), [cfg, sport]);

  function showToast(msg, kind = 'ok') {
    setToastMsg({ msg, kind });
    setTimeout(() => setToastMsg(null), 3000);
  }

  async function loadRoster() {
    if (!year || !className || !sport) {
      showToast('กรุณาเลือกปีการศึกษา ชั้นเรียน และกีฬาให้ครบ', 'err');
      return;
    }
    try {
      setBusy(true);
      setError('');
      const data = await apiGet(
        `/api/roster?year=${encodeURIComponent(year)}&class=${encodeURIComponent(className)}&sport=${encodeURIComponent(sport)}`
      );
      setRoster(data);
      const initGrid = {};
      data.forEach((r) => {
        initGrid[r.studentId] = {};
        r.skills.forEach((s) => {
          initGrid[r.studentId][s.skillName] = s.startingLevel;
        });
      });
      setGridValues(initGrid);
      setNotes({});
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function setLevel(studentId, skillName, level) {
    setGridValues((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], [skillName]: Number(level) },
    }));
  }

  async function handleSave() {
    if (!roster || roster.length === 0) return;
    const scores = [];
    roster.forEach((r) => {
      r.skills.forEach((s) => {
        scores.push({
          academicYear: Number(year),
          studentId: r.studentId,
          studentName: r.studentName,
          selectedSport: sport,
          skillName: s.skillName,
          finalLevel: gridValues[r.studentId]?.[s.skillName] ?? s.startingLevel,
          coachNotes: notes[r.studentId] || '',
        });
      });
    });
    try {
      setBusy(true);
      const result = await apiPost('/api/scores', { scores, actor: actor || undefined });
      showToast('บันทึกสำเร็จ ' + result.rowsSaved + ' แถว');
      await loadRoster(); // โหลดใหม่เพื่อให้เห็นค่าล่าสุดต่อยอด
    } catch (e) {
      showToast(e.message, 'err');
    } finally {
      setBusy(false);
    }
  }

  if (!cfg) {
    return <div className="text-center text-slate-400 py-20">{error || 'กำลังโหลดข้อมูลระบบ...'}</div>;
  }

  return (
    <div>
      {toastMsg && (
        <div
          className={
            'fixed top-4 right-4 z-50 max-w-sm rounded-xl px-4 py-3 text-white font-semibold shadow-lg ' +
            (toastMsg.kind === 'err' ? 'bg-red-600' : 'bg-emerald-600')
          }
        >
          {toastMsg.msg}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 mb-5">
        <h2 className="font-semibold text-slate-700 mb-3">เลือกปีการศึกษา ชั้นเรียน และกีฬา</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
          <Field label="ปีการศึกษา">
            <select className="input" value={year} onChange={(e) => setYear(e.target.value)}>
              {cfg.years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
              {!cfg.years.includes(Number(year)) && year && <option value={year}>{year}</option>}
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
              {cfg.sports.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="ผู้บันทึก (ไม่บังคับ)" className="col-span-2 md:col-span-1">
            <input
              className="input"
              placeholder="ชื่อ/อีเมลโค้ช"
              value={actor}
              onChange={(e) => setActor(e.target.value)}
            />
          </Field>
          <button
            onClick={loadRoster}
            disabled={busy}
            className="col-span-2 md:col-span-1 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-semibold rounded-lg px-4 py-2 text-sm transition"
          >
            🔍 ค้นหารายชื่อ
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm mb-5">{error}</div>}

      {roster && (
        <>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 mb-5">
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="text-sm text-slate-500">พบนักเรียน {roster.length} คน</span>
            </div>
            <div className="overflow-auto rounded-xl border border-slate-200 max-h-[65vh]">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs font-semibold text-slate-500">
                    <th className="p-2 border-b border-slate-200">นักเรียน</th>
                    {sportObj?.skills.map((sk) => (
                      <th key={sk} className="p-2 border-b border-slate-200 text-center">
                        {sk}
                      </th>
                    ))}
                    <th className="p-2 border-b border-slate-200">หมายเหตุ</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map((r) => (
                    <tr key={r.studentId} className="border-b border-slate-100 last:border-0">
                      <td className="p-2 align-top whitespace-nowrap">
                        <Link href={`/dashboard/${r.studentId}`} className="font-semibold text-teal-700 hover:underline">
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-teal-100 text-teal-700 text-xs font-bold mr-1.5 align-middle">
                            {initials(r.studentName)}
                          </span>
                          {r.studentName}
                        </Link>
                        <div className="text-xs mt-0.5">
                          {r.isCarryOver ? (
                            <span className="inline-block bg-emerald-100 text-emerald-700 rounded px-1.5 py-0.5">🔄 ต่อยอด</span>
                          ) : r.previousSport ? (
                            <span className="inline-block bg-amber-100 text-amber-700 rounded px-1.5 py-0.5" title={'เดิมเล่น ' + r.previousSport}>
                              🆕 เปลี่ยนกีฬา
                            </span>
                          ) : (
                            <span className="inline-block bg-purple-100 text-purple-700 rounded px-1.5 py-0.5">🆕 นักเรียนใหม่</span>
                          )}
                        </div>
                      </td>
                      {r.skills.map((s) => {
                        const current = gridValues[r.studentId]?.[s.skillName] ?? s.startingLevel;
                        const diffClass =
                          current > s.startingLevel ? 'bg-green-50' : current < s.startingLevel ? 'bg-yellow-50' : '';
                        return (
                          <td key={s.skillName} className={'p-1 text-center ' + diffClass}>
                            <select
                              className="rounded border border-slate-300 text-sm px-1.5 py-1 w-full max-w-[90px]"
                              value={current}
                              onChange={(e) => setLevel(r.studentId, s.skillName, e.target.value)}
                              title={'เริ่มต้น: Level ' + s.startingLevel}
                            >
                              {[1, 2, 3, 4, 5, 6].map((lv) => (
                                <option key={lv} value={lv}>
                                  {lv} - {LEVEL_NAMES[lv]}
                                </option>
                              ))}
                            </select>
                          </td>
                        );
                      })}
                      <td className="p-1">
                        <input
                          className="rounded border border-slate-300 text-sm px-2 py-1 w-full min-w-[140px]"
                          placeholder="หมายเหตุโค้ช"
                          value={notes[r.studentId] || ''}
                          onChange={(e) => setNotes((prev) => ({ ...prev, [r.studentId]: e.target.value }))}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500 mt-3">
              <span className="inline-block w-3 h-3 rounded bg-green-200 border border-green-500 align-middle mr-1"></span>
              ระดับสูงขึ้นจากแต้มตั้งต้น
              <span className="inline-block w-3 h-3 rounded bg-yellow-200 border border-yellow-500 align-middle ml-4 mr-1"></span>
              ระดับต่ำลงจากแต้มตั้งต้น
              <span className="ml-4">
                คลิก <b>ชื่อนักเรียน</b> เพื่อดู Dashboard รายบุคคล
              </span>
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
            <h2 className="font-semibold text-slate-700 mb-3">เกณฑ์ระดับ 6 Level</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1 text-sm">
              {[1, 2, 3, 4, 5, 6].map((lv) => (
                <div key={lv}>
                  <b>
                    Level {lv} ({LEVEL_NAMES[lv]})
                  </b>
                </div>
              ))}
            </div>
          </div>

          <div className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 shadow-[0_-4px_12px_rgba(0,0,0,.06)] px-4 sm:px-6 py-3 flex items-center gap-4 z-30">
            <div className="flex-1 text-sm text-slate-700">พร้อมบันทึกคะแนน {roster.length} คน</div>
            <button
              onClick={handleSave}
              disabled={busy}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold rounded-lg px-5 py-2.5 text-sm transition whitespace-nowrap"
            >
              💾 บันทึกคะแนนทั้งหมด
            </button>
          </div>
        </>
      )}
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
