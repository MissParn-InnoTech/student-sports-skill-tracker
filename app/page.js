'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { apiGet, apiPost } from '@/lib/apiClient';
import { LEVEL_NAMES, initials } from '@/lib/levelMeta';
import { SPORT_IMAGES } from '@/lib/sportImages';
import { getActorName, setActorName } from '@/lib/currentUser';
import { Search, RefreshCw, Sparkles, Save, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

export default function CoachInputPage() {
  const [cfg, setCfg] = useState(null);
  const sportScrollRef = useRef(null);
  const [year, setYear] = useState('');
  const [className, setClassName] = useState('');
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
        setClassName(data.classes[0] || '');
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
    if (!actor || !actor.trim()) {
      showToast('กรุณากรอกรหัสประจำตัวครูผู้บันทึกก่อนบันทึกคะแนน', 'err');
      return;
    }
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
      const result = await apiPost('/api/scores', { scores, actor: actor.trim() });
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
            'fixed top-4 right-4 z-50 max-w-sm rounded-xl px-4 py-3 text-white font-semibold shadow-lg ' +
            (toastMsg.kind === 'err' ? 'bg-red-600' : 'bg-emerald-600')
          }
        >
          {toastMsg.msg}
        </div>
      )}

      <div className="bg-surface rounded-3xl border border-black/5 shadow-sm p-4 sm:p-5 mb-5">
        <h2 className="font-semibold text-ink/80 mb-3">เลือกปีการศึกษา ชั้นเรียน และกีฬา</h2>

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
              className="flex gap-3 overflow-x-auto scroll-smooth pb-2 -mx-1 px-1"
            >
              {cfg.sports.map((s) => {
              const selected = sport === s.name;
              return (
                <button
                  key={s.name}
                  type="button"
                  onClick={() => setSport(s.name)}
                  className={
                    'relative flex-shrink-0 w-32 sm:w-36 rounded-2xl border-2 overflow-hidden text-center transition ' +
                    (selected
                      ? 'border-brand ring-2 ring-gold/50 shadow-md -translate-y-0.5'
                      : 'border-black/5 hover:border-brand/30 hover:-translate-y-0.5 hover:shadow-sm')
                  }
                >
                  {selected && (
                    <span className="absolute top-1.5 right-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-white text-[11px] font-bold shadow">
                      ✓
                    </span>
                  )}
                  <div className="w-full h-40 sm:h-48 bg-gradient-to-b from-gold/15 to-brand/5 overflow-hidden">
                    {SPORT_IMAGES[s.name] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={SPORT_IMAGES[s.name]} alt={s.name} className="w-full h-full object-contain" />
                    )}
                  </div>
                  <div
                    className={
                      'text-[11px] sm:text-xs font-semibold px-1 py-1.5 leading-tight ' +
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

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
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
          <Field label="ผู้บันทึก (รหัสประจำตัวครู) *">
            <input
              className={'input' + (!actor.trim() ? ' border-red-300 focus:border-red-400' : '')}
              placeholder="กรอกรหัสประจำตัวครู"
              required
              value={actor}
              onChange={(e) => handleActorChange(e.target.value)}
            />
          </Field>
          <button onClick={loadRoster} disabled={busy} className="btn-primary px-4 py-2.5 text-sm">
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
              <span className="text-sm text-ink/50">พบนักเรียน {roster.length} คน</span>
            </div>
            <div className="overflow-auto rounded-2xl border border-black/5 max-h-[65vh]">
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
                          {r.isCarryOver ? (
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
            <p className="text-xs text-ink/50 mt-3">
              <span className="inline-block w-3 h-3 rounded bg-green-200 border border-green-500 align-middle mr-1"></span>
              ระดับสูงขึ้นจากแต้มตั้งต้น
              <span className="inline-block w-3 h-3 rounded bg-yellow-200 border border-yellow-500 align-middle ml-4 mr-1"></span>
              ระดับต่ำลงจากแต้มตั้งต้น
              <span className="ml-4">
                คลิก <b className="text-ink/70">ชื่อนักเรียน</b> เพื่อดู Dashboard รายบุคคล
              </span>
            </p>
          </div>

          <div className="bg-surface rounded-3xl border border-black/5 shadow-sm p-4 sm:p-5">
            <h2 className="font-semibold text-ink/80 mb-3">เกณฑ์ระดับ 6 Level</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1 text-sm text-ink/70">
              {[1, 2, 3, 4, 5, 6].map((lv) => (
                <div key={lv}>
                  <b className="text-ink">
                    Level {lv} ({LEVEL_NAMES[lv]})
                  </b>
                </div>
              ))}
            </div>
          </div>

          <div className="fixed bottom-0 inset-x-0 bg-surface/95 backdrop-blur border-t border-black/5 shadow-[0_-4px_20px_rgba(0,0,0,.08)] px-4 sm:px-6 py-3 flex items-center gap-4 z-30">
            <div className="flex-1 text-sm text-ink/70">พร้อมบันทึกคะแนน {roster.length} คน</div>
            <button
              onClick={handleSave}
              disabled={busy}
              className="btn-primary px-5 py-2.5 text-sm"
            >
              <Save className="h-4 w-4" strokeWidth={2.25} />
              บันทึกคะแนนทั้งหมด
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
