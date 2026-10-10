'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { apiGet, apiPost } from '@/lib/apiClient';
import { LEVEL_NAMES, initials } from '@/lib/levelMeta';
import { SPORT_IMAGES } from '@/lib/sportImages';
import { getActorName, setActorName } from '@/lib/currentUser';
import { Search, RefreshCw, Sparkles, Save, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

const COURSE_TYPES = ['AFTER SCHOOL', 'OCTOBER', 'SUMMER'];

export default function CoachInputPage() {
  const [cfg, setCfg] = useState(null);
  const sportScrollRef = useRef(null);
  const [year, setYear] = useState('');
  const [course, setCourse] = useState(COURSE_TYPES[0]);
  const [sport, setSport] = useState('');
  const [roster, setRoster] = useState(null); // ผลจาก /api/roster
  const [gridValues, setGridValues] = useState({}); // { studentId: { skillName: level } }
  const [notes, setNotes] = useState({}); // { studentId: note }
  const [actor, setActor] = useState(() => getActorName());
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
        setSport(data.sports[0]?.name || '');
      } catch (e) {
        setError(e.message);
      } finally {
        setBusy(false);
      }
    })();
  }, []);

  function handleActorChange(value) {
    setActor(value);
    setActorName(value);
  }

  // แถบเลือกกีฬาเลื่อนแนวนอน: เมาส์/แทร็กแพดบางรุ่นส่งแต่ scroll แนวตั้ง (deltaY) มา
  // ไม่ส่ง deltaX เลยทำให้เลื่อนซ้าย-ขวาด้วยการ scroll ปกติไม่ได้ จึงแปลง deltaY -> scrollLeft เอง
  function handleSportWheel(e) {
    const el = sportScrollRef.current;
    if (!el) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    }
  }

  function scrollSports(dir) {
    const el = sportScrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 220, behavior: 'smooth' });
  }

  const sportObj = useMemo(() => cfg?.sports.find((s) => s.name === sport), [cfg, sport]);

  function showToast(msg, kind = 'ok') {
    setToastMsg({ msg, kind });
    setTimeout(() => setToastMsg(null), 3000);
  }

  async function loadRoster() {
    if (!year || !course || !sport) {
      showToast('กรุณาเลือกชนิดกีฬา ปีการศึกษา และคอร์สให้ครบ', 'err');
      return;
    }
    try {
      setBusy(true);
      setError('');
      const data = await apiGet(
        `/api/course-roster?year=${encodeURIComponent(year)}&course=${encodeURIComponent(course)}&sport=${encodeURIComponent(sport)}`
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
      const initNotes = {};
      data.forEach((r) => {
        if (r.note) initNotes[r.studentId] = r.note;
      });
      setNotes(initNotes);
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
    if (!actor || !actor.trim()) {
      showToast('กรุณากรอกรหัสประจำตัวครูผู้บันทึกก่อนบันทึกคะแนน', 'err');
      return;
    }
    const scores = [];
    roster.forEach((r) => {
      r.skills.forEach((s) => {
        scores.push({
          studentId: r.studentId,
          skillName: s.skillName,
          finalLevel: gridValues[r.studentId]?.[s.skillName] ?? s.startingLevel,
          coachNotes: notes[r.studentId] || '',
        });
      });
    });
    try {
      setBusy(true);
      const result = await apiPost('/api/course-roster', {
        academicYear: Number(year),
        courseType: course,
        sportName: sport,
        scores,
        actor: actor.trim(),
      });
      showToast('บันทึกสำเร็จ ' + result.rowsSaved + ' แถว');
      await loadRoster(); // โหลดใหม่เพื่อให้เห็นค่าล่าสุดต่อยอด
    } catch (e) {
      showToast(e.message, 'err');
    } finally {
      setBusy(false);
    }
  }

  if (!cfg) {
    return (
      <div className="flex items-center justify-center gap-2 text-ink/40 py-20">
        {!error && <Loader2 className="h-4 w-4 animate-spin" />}
        {error || 'กำลังโหลดข้อมูลระบบ...'}
      </div>
    );
  }

  return (
    <div>
      {toastMsg && (
        <div
          className={
            'fixed top-4 inset-x-4 sm:left-auto sm:right-4 z-50 sm:max-w-sm rounded-xl px-4 py-3 text-white font-semibold shadow-lg ' +
            (toastMsg.kind === 'err' ? 'bg-red-600' : 'bg-emerald-600')
          }
        >
          {toastMsg.msg}
        </div>
      )}

      <div className="bg-surface rounded-3xl border border-black/5 shadow-sm p-4 sm:p-5 mb-5">
        <h2 className="font-semibold text-ink/80 mb-3">เลือกชนิดกีฬา ปีการศึกษา และคอร์ส</h2>

        <div className="mb-4">
          <span className="block text-xs font-semibold text-ink/50 mb-2">ประเภทกีฬา</span>
          <div className="relative flex items-center gap-1">
            <button
              type="button"
              onClick={() => scrollSports(-1)}
              className="hidden sm:flex flex-shrink-0 items-center justify-center w-8 h-8 rounded-full border border-black/10 bg-white hover:bg-paper text-ink/50 shadow-sm"
              aria-label="เลื่อนซ้าย"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div
              ref={sportScrollRef}
              onWheel={handleSportWheel}
              className="no-scrollbar-mobile flex gap-2.5 sm:gap-3 overflow-x-auto scroll-smooth snap-x pb-2 -mx-4 px-4 sm:-mx-1 sm:px-1"
            >
              {cfg.sports.map((s) => {
              const selected = sport === s.name;
              return (
                <button
                  key={s.name}
                  type="button"
                  onClick={() => setSport(s.name)}
                  className={
                    'relative flex-shrink-0 snap-start w-[7.25rem] sm:w-36 rounded-2xl border-2 overflow-hidden text-center transition ' +
                    (selected
                      ? 'border-brand ring-2 ring-gold/50 shadow-md -translate-y-0.5'
                      : 'border-black/5 hover:border-brand/30 hover:-translate-y-0.5 hover:shadow-sm')
                  }
                >
                  {selected && (
                    <span className="absolute top-1.5 right-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-white text-xs font-bold shadow">
                      ✓
                    </span>
                  )}
                  <div className="w-full h-32 sm:h-48 bg-gradient-to-b from-gold/15 to-brand/5 overflow-hidden">
                    {SPORT_IMAGES[s.name] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={SPORT_IMAGES[s.name]} alt={s.name} className="w-full h-full object-contain" />
                    )}
                  </div>
                  <div
                    className={
                      'text-xs font-semibold px-1 py-2 sm:py-1.5 leading-tight ' +
                      (selected ? 'text-brand' : 'text-ink/60')
                    }
                  >
                    {s.name}
                  </div>
                </button>
              );
              })}
            </div>
            <button
              type="button"
              onClick={() => scrollSports(1)}
              className="hidden sm:flex flex-shrink-0 items-center justify-center w-8 h-8 rounded-full border border-black/10 bg-white hover:bg-paper text-ink/50 shadow-sm"
              aria-label="เลื่อนขวา"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-[1fr_1.7fr] md:grid-cols-4 gap-3 items-end">
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
          <Field label="คอร์ส">
            <select className="input" value={course} onChange={(e) => setCourse(e.target.value)}>
              {COURSE_TYPES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="ผู้บันทึก (รหัสประจำตัวครู) *" className="col-span-2 md:col-span-1">
            <input
              className={'input' + (!actor.trim() ? ' border-red-300 focus:border-red-400' : '')}
              placeholder="กรอกรหัสประจำตัวครู"
              required
              value={actor}
              onChange={(e) => handleActorChange(e.target.value)}
            />
          </Field>
          <button onClick={loadRoster} disabled={busy} className="btn-primary col-span-2 md:col-span-1 px-4 py-3 sm:py-2.5 text-base sm:text-sm">
            <Search className="h-4 w-4" strokeWidth={2.25} />
            ค้นหารายชื่อ
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm mb-5">{error}</div>}

      {roster && (
        <>
          <div className="bg-surface rounded-3xl border border-black/5 shadow-sm p-4 sm:p-5 mb-5">
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="text-sm text-ink/50">
                {roster.length > 0
                  ? 'พบนักเรียน ' + roster.length + ' คน'
                  : 'ยังไม่มีนักเรียนลงคอร์สนี้ในกีฬาและปีที่เลือก — รายชื่อมาจากต้นขั้ว (แท็บ Course_Register) ใน Google Sheet'}
              </span>
            </div>
            {/* มือถือ: การ์ดต่อนักเรียน 1 คน กรอกทุกทักษะได้โดยไม่ต้องเลื่อนตารางซ้าย-ขวา */}
            <ul className="sm:hidden space-y-3">
              {roster.map((r, idx) => (
                <li key={r.studentId} className="rounded-2xl border border-black/10 bg-white p-3.5 shadow-sm">
                  <div className="flex items-start gap-2.5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold/15 text-sm font-bold text-brand-dark">
                      {initials(r.studentName)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <Link href={`/dashboard/${r.studentId}`} className="block text-base font-semibold leading-snug text-brand">
                        {r.studentName}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                        {r.className && <span className="text-ink/60">{r.className}</span>}
                        <StatusBadge r={r} />
                      </div>
                    </div>
                    <span className="shrink-0 text-xs tabular-nums text-ink/40">{idx + 1}/{roster.length}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-x-2.5 gap-y-2.5">
                    {r.skills.map((s) => {
                      const current = gridValues[r.studentId]?.[s.skillName] ?? s.startingLevel;
                      const diffClass =
                        current > s.startingLevel
                          ? ' !border-green-500 !bg-green-50'
                          : current < s.startingLevel
                            ? ' !border-yellow-500 !bg-yellow-50'
                            : '';
                      return (
                        <label key={s.skillName} className="flex min-w-0 flex-col gap-1 text-xs font-semibold text-ink/60">
                          <span className="truncate">{s.skillName}</span>
                          <select
                            className={'input w-full' + diffClass}
                            value={current}
                            onChange={(e) => setLevel(r.studentId, s.skillName, e.target.value)}
                          >
                            {[1, 2, 3, 4, 5, 6].map((lv) => (
                              <option key={lv} value={lv}>
                                {lv} - {LEVEL_NAMES[lv]}
                              </option>
                            ))}
                          </select>
                        </label>
                      );
                    })}
                  </div>
                  <input
                    className="input mt-2.5 w-full"
                    placeholder="หมายเหตุโค้ช"
                    aria-label={'หมายเหตุโค้ช ของ ' + r.studentName}
                    value={notes[r.studentId] || ''}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [r.studentId]: e.target.value }))}
                  />
                </li>
              ))}
            </ul>

            <div className="hidden sm:block overflow-auto rounded-2xl border border-black/5 max-h-[65vh]">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-paper text-left text-xs font-semibold text-ink/50">
                    <th className="p-2 border-b border-black/5">นักเรียน</th>
                    {sportObj?.skills.map((sk) => (
                      <th key={sk} className="p-2 border-b border-black/5 text-center">
                        {sk}
                      </th>
                    ))}
                    <th className="p-2 border-b border-black/5">หมายเหตุ</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map((r) => (
                    <tr key={r.studentId} className="border-b border-black/5 last:border-0 hover:bg-paper/60 transition-colors">
                      <td className="p-2 align-top whitespace-nowrap">
                        <Link href={`/dashboard/${r.studentId}`} className="font-semibold text-brand hover:underline">
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gold/15 text-brand-dark text-xs font-bold mr-1.5 align-middle">
                            {initials(r.studentName)}
                          </span>
                          {r.studentName}
                        </Link>
                        <div className="text-xs mt-0.5">
                          {r.className && <span className="text-ink/50 mr-1.5">{r.className}</span>}
                          <StatusBadge r={r} />
                        </div>
                      </td>
                      {r.skills.map((s) => {
                        const current = gridValues[r.studentId]?.[s.skillName] ?? s.startingLevel;
                        const diffClass =
                          current > s.startingLevel ? 'bg-green-50' : current < s.startingLevel ? 'bg-yellow-50' : '';
                        return (
                          <td key={s.skillName} className={'p-1 text-center ' + diffClass}>
                            <select
                              className="input text-sm px-1.5 py-1 w-full max-w-[90px]"
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
                          className="input text-sm px-2 py-1 w-full min-w-[140px]"
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
            <div className="mt-3 flex flex-col gap-1.5 text-xs text-ink/60 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:text-ink/50">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 shrink-0 rounded border border-green-500 bg-green-200"></span>
                ระดับสูงขึ้นจากแต้มตั้งต้น
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 shrink-0 rounded border border-yellow-500 bg-yellow-200"></span>
                ระดับต่ำลงจากแต้มตั้งต้น
              </span>
              <span>
                <span className="sm:hidden">แตะ</span><span className="hidden sm:inline">คลิก</span> <b className="text-ink/70">ชื่อนักเรียน</b> เพื่อดู Dashboard รายบุคคล
              </span>
            </div>
          </div>

          <div className="bg-surface rounded-3xl border border-black/5 shadow-sm p-4 sm:p-5">
            <h2 className="font-semibold text-ink/80 mb-3">เกณฑ์ระดับ 6 Level</h2>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-4 sm:gap-x-6 gap-y-1.5 sm:gap-y-1 text-sm text-ink/70">
              {[1, 2, 3, 4, 5, 6].map((lv) => (
                <div key={lv}>
                  <b className="text-ink">
                    Level {lv} ({LEVEL_NAMES[lv]})
                  </b>
                </div>
              ))}
            </div>
          </div>

          <div className="fixed bottom-0 inset-x-0 bg-surface/95 backdrop-blur border-t border-black/5 shadow-[0_-4px_20px_rgba(0,0,0,.08)] px-4 sm:px-6 pt-3 pb-safe flex items-center gap-3 sm:gap-4 z-30">
            <div className="flex-1 min-w-0 text-sm leading-tight text-ink/70">พร้อมบันทึก<span className="hidden sm:inline">คะแนน</span> <b className="text-ink">{roster.length}</b> คน</div>
            <button
              onClick={handleSave}
              disabled={busy}
              className="btn-primary shrink-0 whitespace-nowrap px-5 py-3 sm:py-2.5 text-base sm:text-sm"
            >
              <Save className="h-4 w-4" strokeWidth={2.25} />
              บันทึกคะแนน<span className="hidden sm:inline">ทั้งหมด</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Field({ label, children, className = '' }) {
  return (
    <label className={'flex flex-col gap-1 text-xs font-semibold text-ink/50 ' + className}>
      {label}
      {children}
    </label>
  );
}

// ป้ายสถานะของนักเรียนในรายชื่อ (ใช้ทั้งในตารางจอใหญ่และการ์ดบนมือถือ)
function StatusBadge({ r }) {
  return r.saved ? (
  <span className="inline-flex items-center gap-1 bg-sky-100 text-sky-700 rounded px-1.5 py-0.5">
    <Save className="h-3 w-3" /> บันทึกแล้ว
  </span>
) : r.isCarryOver ? (
  <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 rounded px-1.5 py-0.5">
    <RefreshCw className="h-3 w-3" /> ต่อยอด
  </span>
) : r.previousSport ? (
  <span
    className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 rounded px-1.5 py-0.5"
    title={'เดิมเล่น ' + r.previousSport}
  >
    <Sparkles className="h-3 w-3" /> เปลี่ยนกีฬา
  </span>
) : (
  <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-700 rounded px-1.5 py-0.5">
    <Sparkles className="h-3 w-3" /> นักเรียนใหม่
  </span>
);
}
