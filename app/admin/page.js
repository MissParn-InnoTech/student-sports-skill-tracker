'use client';

import { useEffect, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';
import { apiGet } from '@/lib/apiClient';
import {
  Users, Medal, School, ClipboardCheck, GraduationCap, BarChart2, Layers, ShieldAlert, Lightbulb,
  Loader2, RefreshCw, Printer, Database, CheckCircle2, Grid3x3, Target,
} from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const BRAND = '#c81e3a';
const GOLD = '#e8a13a';
const MUTED = '#cbd5e1';
// PL = เทา (ยังไม่จัดระดับ) · L1–L6 ไล่จากอ่อนไปเข้ม
const LEVEL_COLORS = ['#cbd5e1', '#f6c9cf', '#ee9aa6', '#e2647a', '#c81e3a', '#8f1227', '#3a0e18'];

const nf = new Intl.NumberFormat('th-TH');
const fmt = (n) => (n === null || n === undefined ? '—' : nf.format(n));
const fmtPct = (n) => (n === null || n === undefined ? '—' : n.toLocaleString('th-TH', { maximumFractionDigits: 1 }) + '%');

function formatDateTimeTh(ts) {
  if (!ts) return 'ยังไม่เคยซิงก์';
  return new Date(ts).toLocaleString('th-TH', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok',
  }) + ' น.';
}

const sportLabel = (s) => (s.name ? s.name.replace(/\s*\(.*\)$/, '') + ' (' + s.code + ')' : s.code);

function KpiCard({ icon: Icon, value, label, sub }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 break-inside-avoid">
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
  return <section className={'bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 mb-5 break-inside-avoid ' + className}>{children}</section>;
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

const TONE = {
  info: 'border-slate-200 bg-white',
  good: 'border-emerald-200 bg-emerald-50',
  warn: 'border-amber-200 bg-amber-50',
  alert: 'border-red-200 bg-red-50',
};

const th = 'py-2 px-2 text-right whitespace-nowrap';
const td = 'py-2 px-2 text-right tabular-nums whitespace-nowrap';

const baseOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  plugins: { legend: { display: false }, tooltip: { callbacks: {} } },
};

export default function ExecutiveReportPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    // ให้กราฟใช้ฟอนต์เดียวกับหน้าเว็บ
    ChartJS.defaults.font.family = getComputedStyle(document.body).fontFamily;
    ChartJS.defaults.color = '#64748b';
  }, []);

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

  const ex = data.executive;
  const src = data.sources || {};
  const t = ex.totals;
  const a = ex.assessment;

  const header = (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-800">รายงานผู้บริหาร: ภาพรวมทักษะกีฬานักเรียน</h1>
        <p className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <Database className="h-3.5 w-3.5 text-slate-400" />
          แหล่งข้อมูล: Google Sheet Master_Sports_System
          {['Student_Register', 'Central_Scores', 'Course_Register'].map((tab) => (
            <span key={tab} className="whitespace-nowrap">
              <span className="text-slate-300 mr-1.5">|</span>
              <span className="font-semibold text-slate-600">{tab}</span> {formatDateTimeTh(src[tab]?.lastSyncedTs)}
            </span>
          ))}
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

  if (!src.Student_Register?.synced) {
    return (
      <div>
        {header}
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl p-5 text-sm leading-relaxed">
          <div className="font-semibold mb-1">ยังไม่มีข้อมูลจากแท็บ Student_Register</div>
          รายงานนี้ใช้ข้อมูลที่ส่งมาจาก Google Sheet เท่านั้น กรุณาเปิด Master_Sports_System แล้วเลือกเมนู
          <span className="font-semibold"> &ldquo;📊 ภาพรวมเว็บ&rdquo; &gt; &ldquo;ส่งข้อมูลทั้งหมดไปรายงานผู้บริหาร&rdquo; </span>
          จากนั้นกด &ldquo;โหลดใหม่&rdquo; ที่หน้านี้
        </div>
      </div>
    );
  }

  const sports = ex.bySport;
  const sportChart = {
    labels: sports.map(sportLabel),
    datasets: [{ data: sports.map((s) => s.count), backgroundColor: BRAND, borderRadius: 4, barThickness: 16 }],
  };
  const sportChartOptions = {
    ...baseOptions,
    indexAxis: 'y',
    scales: { x: { grid: { color: '#f1f5f9' }, beginAtZero: true }, y: { grid: { display: false } } },
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (c) => ' ' + fmt(c.parsed.x) + ' คน (' + fmtPct(sports[c.dataIndex].sharePct) + ')' } },
    },
  };

  const gradeChart = {
    labels: ex.byGrade.map((g) => g.grade),
    datasets: [
      { label: 'ห้อง 1–8', data: ex.byGrade.map((g) => g.numbered), backgroundColor: BRAND, borderRadius: 3 },
      { label: 'ห้อง A–E', data: ex.byGrade.map((g) => g.lettered), backgroundColor: GOLD, borderRadius: 3 },
    ],
  };
  const stackedOptions = {
    ...baseOptions,
    scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, grid: { color: '#f1f5f9' }, beginAtZero: true } },
    plugins: {
      legend: { display: true, position: 'bottom', labels: { boxWidth: 12, boxHeight: 12 } },
      tooltip: { callbacks: { label: (c) => ' ' + c.dataset.label + ': ' + fmt(c.parsed.y) + ' คน' } },
    },
  };

  const levelChart = {
    labels: ex.levelDistribution.map((l) => l.level),
    datasets: [{ data: ex.levelDistribution.map((l) => l.count), backgroundColor: LEVEL_COLORS, borderRadius: 4 }],
  };
  const levelChartOptions = {
    ...baseOptions,
    scales: { x: { grid: { display: false } }, y: { grid: { color: '#f1f5f9' }, beginAtZero: true } },
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (c) => ' ' + fmt(c.parsed.y) + ' คน (' + fmtPct(ex.levelDistribution[c.dataIndex].pct) + ')' } },
    },
  };

  const mixChart = {
    labels: sports.map((s) => s.code),
    datasets: ex.levels.map((lv, i) => ({
      label: lv,
      data: sports.map((s) => (s.count ? Math.round((s.levels[i] / s.count) * 1000) / 10 : 0)),
      backgroundColor: LEVEL_COLORS[i],
      barThickness: 14,
    })),
  };
  const mixChartOptions = {
    ...baseOptions,
    indexAxis: 'y',
    scales: {
      x: { stacked: true, max: 100, grid: { color: '#f1f5f9' }, ticks: { callback: (v) => v + '%' } },
      y: { stacked: true, grid: { display: false } },
    },
    plugins: {
      legend: { display: true, position: 'bottom', labels: { boxWidth: 12, boxHeight: 12 } },
      tooltip: {
        callbacks: {
          label: (c) => ' ' + c.dataset.label + ': ' + fmt(sports[c.dataIndex].levels[c.datasetIndex]) + ' คน (' + fmtPct(c.parsed.x) + ')',
        },
      },
    },
  };

  const heatMax = Math.max(1, ...ex.byGrade.flatMap((g) => g.bySport));
  const barH = Math.max(220, sports.length * 28 + 40);

  return (
    <div>
      {header}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        <KpiCard icon={Users} value={fmt(t.students)} label="นักเรียนทั้งหมด" sub={'ประถม ' + fmt(t.primary) + ' · มัธยมต้น ' + fmt(t.secondary)} />
        <KpiCard icon={School} value={fmt(t.classCount)} label="ห้องเรียน" sub={fmt(t.gradeCount) + ' ระดับชั้น'} />
        <KpiCard icon={Medal} value={fmt(t.sportCount)} label="วิชากีฬา" sub={a.centralSynced ? 'อยู่ในระบบลงคะแนน ' + fmt(t.sportCount - a.sportsNotInCentral.length) + ' วิชา' : null} />
        <KpiCard icon={ClipboardCheck} value={a.centralSynced ? fmtPct(a.assessedPctOfCentral) : '—'} label="ความคืบหน้าการประเมิน" sub={a.centralSynced ? fmt(a.assessed) + ' จาก ' + fmt(a.centralRecords) + ' รายการ' : 'ยังไม่ซิงก์ Central_Scores'} />
        <KpiCard icon={GraduationCap} value={src.Course_Register?.synced ? fmt(ex.course.enrolled) : '—'} label="ลงคอร์สพิเศษแล้ว (คน)" sub={src.Course_Register?.synced ? 'จาก ' + fmt(ex.course.rows) + ' คนในทะเบียนคอร์ส' : 'ยังไม่ซิงก์ Course_Register'} />
      </div>

      <Card>
        <SectionTitle icon={Lightbulb}>ข้อสังเกตสำคัญ</SectionTitle>
        <div className="grid md:grid-cols-2 gap-2.5">
          {ex.insights.map((it, i) => (
            <div key={i} className={'rounded-xl border px-3.5 py-2.5 ' + (TONE[it.tone] || TONE.info)}>
              <div className="text-[13px] font-semibold text-slate-700">{it.title}</div>
              <div className="text-[13px] text-slate-600 leading-relaxed mt-0.5">{it.text}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-x-4">
        <Card>
          <SectionTitle icon={BarChart2} note="จำนวนนักเรียนตามวิชากีฬาที่ลงทะเบียน (Student_Register)">
            นักเรียนตามวิชากีฬา
          </SectionTitle>
          <div style={{ height: barH }}>
            <Bar data={sportChart} options={sportChartOptions} />
          </div>
        </Card>
        <Card>
          <SectionTitle icon={School} note={'ห้อง 1–8 รวม ' + fmt(t.numberedRooms) + ' คน (' + fmtPct(t.numberedRoomsPct) + ') · ห้อง A–E รวม ' + fmt(t.letteredRooms) + ' คน (' + fmtPct(t.letteredRoomsPct) + ')'}>
            นักเรียนตามระดับชั้น
          </SectionTitle>
          <div style={{ height: barH }}>
            <Bar data={gradeChart} options={stackedOptions} />
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-x-4">
        <Card>
          <SectionTitle icon={Layers} note="LV.เดิม ของนักเรียนทั้งโรงเรียน · PL = เตรียมความพร้อม (ยังไม่จัดระดับ)">
            การกระจายระดับทักษะ
          </SectionTitle>
          <div style={{ height: barH }}>
            <Bar data={levelChart} options={levelChartOptions} />
          </div>
        </Card>
        <Card>
          <SectionTitle icon={Layers} note="สัดส่วนระดับทักษะภายในแต่ละวิชา (รวมเป็น 100%)">
            ระดับทักษะแยกตามวิชากีฬา
          </SectionTitle>
          <div style={{ height: barH }}>
            <Bar data={mixChart} options={mixChartOptions} />
          </div>
        </Card>
      </div>

      <Card>
        <SectionTitle icon={Grid3x3} note="จำนวนนักเรียนในแต่ละระดับชั้นและวิชา · สีเข้ม = จำนวนมาก">
          ตารางไขว้ระดับชั้น × วิชากีฬา
        </SectionTitle>
        <div className="overflow-auto">
          <table className="min-w-full text-xs border-separate border-spacing-0.5">
            <thead>
              <tr className="text-slate-400 font-semibold">
                <th className="py-1.5 pr-2 text-left">ระดับชั้น</th>
                {ex.sportCodes.map((c) => <th key={c} className="py-1.5 px-1 text-center min-w-[40px]">{c}</th>)}
                <th className="py-1.5 pl-2 text-right">รวม</th>
              </tr>
            </thead>
            <tbody>
              {ex.byGrade.map((g) => (
                <tr key={g.grade}>
                  <td className="py-1.5 pr-2 font-semibold text-slate-700 whitespace-nowrap">{g.grade}</td>
                  {g.bySport.map((n, i) => {
                    const k = n / heatMax;
                    return (
                      <td
                        key={i}
                        className="py-1.5 px-1 text-center tabular-nums rounded-md"
                        style={{ backgroundColor: n ? 'rgba(200,30,58,' + (0.08 + k * 0.82).toFixed(2) + ')' : '#f8fafc', color: k > 0.5 ? '#fff' : n ? '#3a0e18' : '#cbd5e1', printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
                      >
                        {n ? fmt(n) : '·'}
                      </td>
                    );
                  })}
                  <td className="py-1.5 pl-2 text-right font-semibold text-slate-700 tabular-nums">{fmt(g.count)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold text-slate-700">
                <td className="py-1.5 pr-2">รวม</td>
                {sports.map((s) => <td key={s.code} className="py-1.5 px-1 text-center tabular-nums">{fmt(s.count)}</td>)}
                <td className="py-1.5 pl-2 text-right tabular-nums">{fmt(t.students)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <Card>
        <SectionTitle icon={Target} note="นักเรียนตามทะเบียน เทียบกับรายการในแท็บ Central_Scores · ประเมินแล้ว = กรอก LV.ใหม่ แล้ว">
          ความคืบหน้าการประเมินรายวิชา
        </SectionTitle>
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-xs font-semibold text-slate-400 border-b border-slate-200">
                <th className="py-2 pr-2 text-left">วิชา</th>
                <th className={th}>นักเรียน</th>
                <th className={th}>สัดส่วน</th>
                <th className={th}>พ้นระดับ PL</th>
                <th className={th}>ในระบบลงคะแนน</th>
                <th className={th}>ประเมินแล้ว</th>
                <th className="py-2 px-2 text-left min-w-[150px]">ความคืบหน้า</th>
              </tr>
            </thead>
            <tbody>
              {sports.map((s) => (
                <tr key={s.code} className="border-b border-slate-100">
                  <td className="py-2 pr-2 text-slate-700 whitespace-nowrap">
                    <span className="inline-block min-w-[38px] rounded-md bg-slate-100 px-1.5 py-0.5 text-center text-[11px] font-semibold text-slate-500 mr-2">{s.code}</span>
                    {s.name || <span className="text-slate-400">ยังไม่มีชื่อในแท็บ &ldquo;รหัส&rdquo;</span>}
                  </td>
                  <td className={td + ' font-semibold text-slate-700'}>{fmt(s.count)}</td>
                  <td className={td + ' text-slate-500'}>{fmtPct(s.sharePct)}</td>
                  <td className={td + ' text-slate-600'}>{fmtPct(s.beyondPLPct)}</td>
                  <td className={td + ' text-slate-600'}>{s.inCentral ? fmt(s.centralRecords) : <span className="text-amber-600">ยังไม่มี</span>}</td>
                  <td className={td + ' text-slate-600'}>{s.inCentral ? fmt(s.assessed) : '—'}</td>
                  <td className="py-2 px-2">
                    {s.inCentral ? (
                      <div className="flex items-center gap-2">
                        <ProgressBar pct={s.assessedPct} />
                        <span className="w-12 text-right text-xs tabular-nums text-slate-500">{fmtPct(s.assessedPct)}</span>
                      </div>
                    ) : <span className="text-xs text-slate-400">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold text-slate-700 border-t-2 border-slate-200">
                <td className="py-2 pr-2">รวมทั้งหมด</td>
                <td className={td}>{fmt(t.students)}</td>
                <td className={td}>100%</td>
                <td className={td}>{fmtPct(100 - (ex.levelDistribution[0]?.pct || 0))}</td>
                <td className={td}>{a.centralSynced ? fmt(a.centralRecords) : '—'}</td>
                <td className={td}>{a.centralSynced ? fmt(a.assessed) : '—'}</td>
                <td className="py-2 px-2">
                  {a.centralSynced ? (
                    <div className="flex items-center gap-2">
                      <ProgressBar pct={a.assessedPctOfCentral} />
                      <span className="w-12 text-right text-xs tabular-nums">{fmtPct(a.assessedPctOfCentral)}</span>
                    </div>
                  ) : null}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        {a.centralSynced && a.comparable > 0 ? (
          <p className="text-xs text-slate-500 mt-3">
            เลื่อนระดับ {fmt(a.levelUp)} จาก {fmt(a.comparable)} รายการที่เทียบได้ ({fmtPct(a.levelUpPct)})
            {a.avgScore !== null ? ' · คะแนนรวมเฉลี่ย ' + a.avgScore.toLocaleString('th-TH', { maximumFractionDigits: 2 }) : ''}
          </p>
        ) : null}
      </Card>

      <div className="grid lg:grid-cols-2 gap-x-4">
        <Card>
          <SectionTitle icon={GraduationCap} note="จากแท็บ Course_Register · นับเฉพาะแถวที่ระบุประเภทคอร์สแล้ว">
            คอร์สพิเศษ
          </SectionTitle>
          {!src.Course_Register?.synced ? (
            <p className="text-sm text-slate-500">ยังไม่มีข้อมูลจากแท็บ Course_Register</p>
          ) : ex.course.enrolled === 0 ? (
            <p className="text-sm text-slate-500">ยังไม่มีนักเรียนที่ระบุประเภทคอร์ส (จาก {fmt(ex.course.rows)} คน)</p>
          ) : (
            <div className="space-y-2">
              {ex.course.byType.map((c) => (
                <div key={c.type} className="flex items-center gap-3">
                  <div className="w-32 text-sm text-slate-700">{c.type}</div>
                  <ProgressBar pct={(c.count / ex.course.enrolled) * 100} tone="bg-gold" />
                  <div className="w-16 text-right text-sm tabular-nums font-semibold text-slate-700">{fmt(c.count)} คน</div>
                </div>
              ))}
              <p className="text-xs text-slate-500 pt-1">
                ระบุคอร์สแล้ว {fmt(ex.course.enrolled)} จาก {fmt(ex.course.rows)} คน ({fmtPct(ex.course.enrolledPct)}) · ส่งรายชื่อให้ครูแล้ว {fmt(ex.course.sent)} คน
                {ex.course.bySport.length ? ' · วิชา: ' + ex.course.bySport.map((s) => s.code + ' ' + fmt(s.count)).join(', ') : ''}
              </p>
            </div>
          )}
        </Card>

        <Card>
          <SectionTitle icon={ShieldAlert} note="ตรวจจากแท็บ Student_Register">
            คุณภาพข้อมูล
          </SectionTitle>
          {ex.dataQuality.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              ไม่พบปัญหา: ทุกแถวมีรหัสประจำตัว ชั้น/ห้อง รหัสวิชา และระดับที่ถูกต้อง
            </div>
          ) : (
            <ul className="space-y-2">
              {ex.dataQuality.map((q) => (
                <li key={q.key} className="text-sm text-slate-700">
                  {q.label} <span className="font-semibold text-amber-600">{fmt(q.count)} {q.unit}</span>
                  {q.detail ? <div className="text-xs text-slate-500 mt-0.5">{q.detail}</div> : null}
                </li>
              ))}
              {(data.dataQuality || []).length ? (
                <li className="text-sm text-slate-700">
                  แท็บ Central_Scores มีจุดที่ควรตรวจ{' '}
                  <span className="font-semibold text-amber-600">{fmt(data.dataQuality.reduce((n, q) => n + q.count, 0))} แถว</span>
                  <div className="text-xs text-slate-500 mt-0.5">{data.dataQuality.map((q) => q.label + ' ' + fmt(q.count)).join(' · ')}</div>
                </li>
              ) : null}
            </ul>
          )}
        </Card>
      </div>

      <p className="text-[11px] text-slate-400 leading-relaxed">
        ตัวเลขทั้งหมดคำนวณจากข้อมูลที่ส่งมาจาก Google Sheet ณ เวลาซิงก์ล่าสุดของแต่ละแท็บ หากแก้ไขชีตหลังจากนั้น
        ให้ส่งข้อมูลใหม่จากเมนู &ldquo;📊 ภาพรวมเว็บ&rdquo; ในชีตก่อน · เพศ: ชาย {fmt(t.male)} คน ({fmtPct(t.malePct)}) หญิง {fmt(t.female)} คน ({fmtPct(t.femalePct)})
      </p>
    </div>
  );
}
