'use client';

import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/apiClient';
import {
  Users, Medal, ClipboardCheck, TrendingUp, PieChart, BarChart2, Layers, ShieldAlert,
  Loader2, RefreshCw, Printer, ChevronDown, ChevronRight, Database, CheckCircle2,
} from 'lucide-react';

const nf = new Intl.NumberFormat('th-TH');
const fmt = (n) => (n === null || n === undefined ? '—' : nf.format(n));
const fmtPct = (n) => (n === null || n === undefined ? '—' : n.toLocaleString('th-TH', { maximumFractionDigits: 1 }) + '%');

function formatDateTimeTh(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('th-TH', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok',
  }) + ' น.';
}

function KpiCard({ icon: Icon, value, label, sub }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-brand mb-2">
        <Icon className="h-[18px] w-[18px]" strokeWidth={2.25} />
      </div>
      <div className="text-2xl font-bold text-slate-800 leading-tight tabular-nums">{value}</div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
      {sub ? <div className="text-[11px] text-slate-400 mt-1 leading-snug">{sub}</div> : null}
    </div>
  );
}

function Card({ children, className = '' }) {
  return <section className={'bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 mb-5 ' + className}>{children}</section>;
}

function SectionTitle({ icon: Icon, children, note }) {
  return (
    <div className="mb-3">
      <h2 className="flex items-center gap-2 font-semibold text-slate-700">
        <Icon className="h-4 w-4 text-slate-400" strokeWidth={2.25} />
        {children}
      </h2>
      {note ? <p className="text-xs text-slate-400 mt-1 leading-relaxed">{note}</p> : null}
    </div>
  );
}

function ProgressBar({ pct, tone = 'bg-brand' }) {
  const w = Math.min(100, Math.max(0, pct || 0));
  return (
    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
      <div className={'h-full rounded-full ' + tone} style={{ width: w + '%' }} />
    </div>
  );
}

const th = 'py-2 px-2 text-right whitespace-nowrap';
const td = 'py-2 px-2 text-right tabular-nums whitespace-nowrap';

export default function AdminOverviewPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [openGrades, setOpenGrades] = useState({});

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await apiGet('/api/overview');
        if (cancelled) return;
        setData(d);
        setError('');
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const load = () => {
    setLoading(true);
    setReloadKey((k) => k + 1);
  };

  if (error) return <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">{error}</div>;
  if (!data) return (
    <div className="flex items-center justify-center gap-2 text-slate-400 py-20">
      <Loader2 className="h-4 w-4 animate-spin" />
      กำลังโหลด...
    </div>
  );

  const t = data.totals;
  const header = (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-800">รายงานภาพรวมระบบ</h1>
        <p className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-1.5">
          <Database className="h-3.5 w-3.5 text-slate-400" />
          แหล่งข้อมูล: Google Sheet Master_Sports_System แท็บ <span className="font-semibold text-slate-600">Central_Scores</span>
          <span className="text-slate-300">|</span>
          ซิงก์ล่าสุด: {data.synced ? formatDateTimeTh(data.lastSyncedTs) : 'ยังไม่เคยซิงก์'}
        </p>
      </div>
      <div className="no-print flex items-center gap-2">
        <button onClick={load} disabled={loading} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-[13px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60">
          <RefreshCw className={'h-4 w-4 ' + (loading ? 'animate-spin' : '')} />
          โหลดใหม่
        </button>
        <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3.5 py-2 text-[13px] font-medium text-white hover:bg-brand-dark">
          <Printer className="h-4 w-4" />
          พิมพ์รายงาน
        </button>
      </div>
    </div>
  );

  if (!data.synced) {
    return (
      <div>
        {header}
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl p-5 text-sm leading-relaxed">
          <div className="font-semibold mb-1">ยังไม่มีข้อมูลจากแท็บ Central_Scores</div>
          หน้านี้แสดงเฉพาะข้อมูลที่ซิงก์มาจากแท็บ Central_Scores เท่านั้น และจะไม่แสดงตัวเลขจากแหล่งอื่นแทน
          กรุณาเปิด Google Sheet Master_Sports_System แล้วเลือกเมนู
          <span className="font-semibold"> &ldquo;📊 ภาพรวมเว็บ&rdquo; &gt; &ldquo;ส่ง Central_Scores ไปหน้าภาพรวม&rdquo; </span>
          จากนั้นกด &ldquo;โหลดใหม่&rdquo; ที่หน้านี้
        </div>
      </div>
    );
  }

  const maxLevel = Math.max(1, ...data.levelDistribution.map((l) => Math.max(l.oldCount, l.newCount)));
  const issueTotal = data.dataQuality.reduce((a, q) => a + q.count, 0);

  return (
    <div>
      {header}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        <KpiCard icon={ClipboardCheck} value={fmt(t.records)} label="รายการลงทะเบียน (แถว)" sub="1 แถว = นักเรียน 1 คนใน 1 วิชา" />
        <KpiCard icon={Users} value={fmt(t.uniqueStudents)} label="นักเรียน (ไม่นับซ้ำ)" sub={'จาก ' + fmt(t.classCount) + ' ห้องเรียน'} />
        <KpiCard icon={Medal} value={fmt(t.sportCount)} label="วิชากีฬา" />
        <KpiCard icon={CheckCircle2} value={fmtPct(t.assessedPct)} label="ความคืบหน้าการประเมิน" sub={fmt(t.assessed) + ' จาก ' + fmt(t.records) + ' รายการกรอก LV.ใหม่ แล้ว'} />
        <KpiCard icon={TrendingUp} value={t.comparable ? fmtPct(t.levelUpPct) : '—'} label="อัตราเลื่อนระดับ" sub={t.comparable ? fmt(t.levelUp) + ' จาก ' + fmt(t.comparable) + ' รายการที่ประเมินแล้ว' : 'ยังไม่มีรายการที่ประเมินแล้ว'} />
      </div>

      {t.assessed === 0 ? (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl p-4 text-sm mb-5 leading-relaxed">
          ยังไม่มีรายการใดในแท็บ Central_Scores ที่กรอก LV.ใหม่ ตัวเลขผลการประเมิน (ระดับใหม่ การเลื่อนระดับ คะแนนเฉลี่ย)
          จึงยังว่าง รายงานนี้แสดงได้เฉพาะจำนวนผู้ลงทะเบียนและระดับเดิม
        </div>
      ) : null}

      <Card>
        <SectionTitle icon={PieChart} note="สัดส่วน = รายการของวิชานั้นเทียบกับรายการทั้งหมด · ประเมินแล้ว = กรอก LV.ใหม่ แล้ว · เลื่อนระดับ/คงเดิม/ลดระดับ เทียบ LV.ใหม่ กับ LV.เดิม เฉพาะรายการที่มีครบทั้งสองค่า">
          สรุปตามวิชากีฬา
        </SectionTitle>
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-xs font-semibold text-slate-400 border-b border-slate-200">
                <th className="py-2 pr-2 text-left">วิชา</th>
                <th className={th}>ลงทะเบียน</th>
                <th className={th}>สัดส่วน</th>
                <th className={th}>ประเมินแล้ว</th>
                <th className="py-2 px-2 text-left min-w-[140px]">ความคืบหน้า</th>
                <th className={th}>เลื่อนระดับ</th>
                <th className={th}>คงเดิม</th>
                <th className={th}>ลดระดับ</th>
                <th className={th}>คะแนนเฉลี่ย</th>
              </tr>
            </thead>
            <tbody>
              {data.bySport.map((s) => (
                <tr key={s.code} className="border-b border-slate-100">
                  <td className="py-2 pr-2 text-slate-700 whitespace-nowrap">
                    <span className="inline-block min-w-[38px] rounded-md bg-slate-100 px-1.5 py-0.5 text-center text-[11px] font-semibold text-slate-500 mr-2">{s.code}</span>
                    {s.name}
                  </td>
                  <td className={td + ' font-semibold text-slate-700'}>{fmt(s.records)}</td>
                  <td className={td + ' text-slate-500'}>{fmtPct(s.sharePct)}</td>
                  <td className={td + ' text-slate-600'}>{fmt(s.assessed)}</td>
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-2">
                      <ProgressBar pct={s.assessedPct} />
                      <span className="w-12 text-right text-xs tabular-nums text-slate-500">{fmtPct(s.assessedPct)}</span>
                    </div>
                  </td>
                  <td className={td + ' text-emerald-600'}>{s.comparable ? fmt(s.levelUp) : '—'}</td>
                  <td className={td + ' text-slate-500'}>{s.comparable ? fmt(s.levelSame) : '—'}</td>
                  <td className={td + ' text-amber-600'}>{s.comparable ? fmt(s.levelDown) : '—'}</td>
                  <td className={td + ' text-slate-600'}>{s.avgScore === null ? '—' : s.avgScore.toLocaleString('th-TH', { maximumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold text-slate-700 border-t-2 border-slate-200">
                <td className="py-2 pr-2">รวมทั้งหมด</td>
                <td className={td}>{fmt(t.records)}</td>
                <td className={td}>100%</td>
                <td className={td}>{fmt(t.assessed)}</td>
                <td className="py-2 px-2">
                  <div className="flex items-center gap-2">
                    <ProgressBar pct={t.assessedPct} />
                    <span className="w-12 text-right text-xs tabular-nums">{fmtPct(t.assessedPct)}</span>
                  </div>
                </td>
                <td className={td}>{t.comparable ? fmt(t.levelUp) : '—'}</td>
                <td className={td}>{t.comparable ? fmt(t.levelSame) : '—'}</td>
                <td className={td}>{t.comparable ? fmt(t.levelDown) : '—'}</td>
                <td className={td}>{t.avgScore === null ? '—' : t.avgScore.toLocaleString('th-TH', { maximumFractionDigits: 2 })}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-x-4">
        <Card>
          <SectionTitle icon={Layers} note={'LV.เดิม กรอกแล้ว ' + fmt(data.levelOldFilled) + ' รายการ · LV.ใหม่ กรอกแล้ว ' + fmt(data.levelNewFilled) + ' รายการ (PL = ยังไม่ผ่านระดับ 1)'}>
            การกระจายระดับทักษะ
          </SectionTitle>
          <div className="flex items-center gap-4 text-xs text-slate-500 mb-2">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-slate-400" />LV.เดิม</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-brand" />LV.ใหม่</span>
          </div>
          {data.levelDistribution.map((l) => (
            <div key={l.level} className="flex items-center gap-3 py-1.5 border-b border-slate-100 last:border-0">
              <div className="w-8 text-sm font-semibold text-slate-600">{l.level}</div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full bg-slate-400" style={{ width: (l.oldCount / maxLevel) * 100 + '%' }} />
                  </div>
                  <span className="w-12 text-right text-xs tabular-nums text-slate-500">{fmt(l.oldCount)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full bg-brand" style={{ width: (l.newCount / maxLevel) * 100 + '%' }} />
                  </div>
                  <span className="w-12 text-right text-xs tabular-nums font-semibold text-slate-700">{fmt(l.newCount)}</span>
                </div>
              </div>
            </div>
          ))}
        </Card>

        <Card>
          <SectionTitle icon={BarChart2} note="กดที่ระดับชั้นเพื่อดูรายห้อง · ชื่อห้องที่มีช่องว่างเกิน (เช่น “ป.2/ B”) ถูกรวมเป็นห้องเดียวกันแล้ว">
            สรุปตามระดับชั้นและห้องเรียน
          </SectionTitle>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-xs font-semibold text-slate-400 border-b border-slate-200">
                  <th className="py-2 pr-2 text-left">ระดับชั้น / ห้อง</th>
                  <th className={th}>ลงทะเบียน</th>
                  <th className={th}>ประเมินแล้ว</th>
                  <th className={th}>คืบหน้า</th>
                </tr>
              </thead>
              {data.byGrade.map((g) => {
                const open = !!openGrades[g.grade];
                return (
                  <tbody key={g.grade}>
                    <tr className="border-b border-slate-100 cursor-pointer hover:bg-slate-50" onClick={() => setOpenGrades((o) => ({ ...o, [g.grade]: !o[g.grade] }))}>
                      <td className="py-2 pr-2 font-semibold text-slate-700 whitespace-nowrap">
                        <span className="no-print inline-block align-middle mr-1 text-slate-400">
                          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </span>
                        {g.grade} <span className="font-normal text-xs text-slate-400">({fmt(g.classes.length)} ห้อง)</span>
                      </td>
                      <td className={td + ' font-semibold text-slate-700'}>{fmt(g.records)}</td>
                      <td className={td + ' text-slate-600'}>{fmt(g.assessed)}</td>
                      <td className={td + ' text-slate-500'}>{fmtPct(g.assessedPct)}</td>
                    </tr>
                    {g.classes.map((c) => (
                      <tr key={c.className} className={'border-b border-slate-100 text-slate-500 ' + (open ? '' : 'hidden print:table-row')}>
                        <td className="py-1.5 pr-2 pl-7">{c.className}</td>
                        <td className={td}>{fmt(c.records)}</td>
                        <td className={td}>{fmt(c.assessed)}</td>
                        <td className={td}>{fmtPct(c.assessedPct)}</td>
                      </tr>
                    ))}
                  </tbody>
                );
              })}
              <tfoot>
                <tr className="font-semibold text-slate-700 border-t-2 border-slate-200">
                  <td className="py-2 pr-2">รวมทั้งหมด</td>
                  <td className={td}>{fmt(t.records)}</td>
                  <td className={td}>{fmt(t.assessed)}</td>
                  <td className={td}>{fmtPct(t.assessedPct)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      </div>

      <Card>
        <SectionTitle icon={ShieldAlert} note="ตรวจจากทุกแถวของแท็บ Central_Scores · เลขแถวคือเลขแถวจริงในชีต · แสดงตัวอย่างไม่เกิน 20 แถวต่อประเภท">
          คุณภาพข้อมูล
        </SectionTitle>
        {data.dataQuality.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            ไม่พบปัญหา: ทุกแถวมีรหัสประจำตัว ชั้น/ห้อง รหัสวิชา และระดับที่ถูกต้อง ไม่มีรายการซ้ำ
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-slate-600">พบ {fmt(issueTotal)} จุดที่ควรตรวจสอบในชีต</p>
            {data.dataQuality.map((q) => (
              <details key={q.key} className="rounded-xl border border-slate-200 px-3 py-2">
                <summary className="cursor-pointer text-sm text-slate-700">
                  {q.label} <span className="font-semibold text-amber-600">{fmt(q.count)} แถว</span>
                </summary>
                <div className="overflow-auto mt-2">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="text-left text-slate-400 border-b border-slate-200">
                        <th className="py-1 pr-3">แถว</th>
                        <th className="py-1 pr-3">รหัส</th>
                        <th className="py-1 pr-3">ชื่อ</th>
                        <th className="py-1 pr-3">ห้อง</th>
                        <th className="py-1 pr-3">วิชา</th>
                        <th className="py-1">รายละเอียด</th>
                      </tr>
                    </thead>
                    <tbody>
                      {q.examples.map((e, i) => (
                        <tr key={i} className="border-b border-slate-100 last:border-0 text-slate-600">
                          <td className="py-1 pr-3 tabular-nums">{e.rowNo}</td>
                          <td className="py-1 pr-3 tabular-nums">{e.studentId || '—'}</td>
                          <td className="py-1 pr-3 whitespace-nowrap">{e.name || '—'}</td>
                          <td className="py-1 pr-3">{e.className || '—'}</td>
                          <td className="py-1 pr-3">{e.sportCode || '—'}</td>
                          <td className="py-1">{e.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            ))}
          </div>
        )}
      </Card>

      <p className="text-[11px] text-slate-400 leading-relaxed">
        ตัวเลขทั้งหมดในหน้านี้คำนวณจากแท็บ Central_Scores ณ เวลาที่ซิงก์ล่าสุด ({formatDateTimeTh(data.lastSyncedTs)})
        หากแก้ไขชีตหลังจากนั้น ให้ส่งข้อมูลใหม่จากเมนู &ldquo;📊 ภาพรวมเว็บ&rdquo; ในชีตก่อน
        {t.blankRowsSkipped ? ' · ข้ามแถวว่าง ' + fmt(t.blankRowsSkipped) + ' แถว' : ''}
      </p>
    </div>
  );
}
