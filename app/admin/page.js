'use client';

import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/apiClient';

function timeAgoTh(ts) {
  if (!ts) return '—';
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return 'เมื่อสักครู่';
  const m = Math.floor(diffSec / 60);
  if (m < 60) return m + ' นาทีที่แล้ว';
  const h = Math.floor(m / 60);
  if (h < 24) return h + ' ชั่วโมงที่แล้ว';
  const d = Math.floor(h / 24);
  if (d < 30) return d + ' วันที่แล้ว';
  return new Date(ts).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
}

function KpiCard({ icon, value, label }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-2xl font-bold text-slate-800 leading-tight">{value}</div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}

export default function AdminOverviewPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const d = await apiGet('/api/overview');
        setData(d);
      } catch (e) {
        setError(e.message);
      }
    })();
  }, []);

  if (error) return <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">{error}</div>;
  if (!data) return <div className="text-center text-slate-400 py-20">กำลังโหลด...</div>;

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        <KpiCard icon="👥" value={data.totalActiveStudents} label="นักเรียน Active" />
        <KpiCard icon="🏅" value={data.bySportLatest.length} label="ชนิดกีฬาที่กำลังเล่นอยู่" />
        <KpiCard icon="📝" value={data.totalEvaluationRounds} label="รอบการประเมินสะสม" />
        <KpiCard icon="🏆" value={data.sportAnalytics?.totalMaxAchievers ?? 0} label="นักเรียนที่ถึง Level สูงสุดแล้ว (สะสม)" />
        <KpiCard icon="🕒" value={timeAgoTh(data.lastActivityTs)} label="กิจกรรมล่าสุด" />
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-5">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
          <h2 className="font-semibold text-slate-700 mb-3">สัดส่วนกีฬาที่นักเรียนเล่นอยู่ตอนนี้</h2>
          {data.bySportLatest.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">ยังไม่มีข้อมูลการประเมิน</p>
          ) : (
            data.bySportLatest.map((s) => {
              const pct = data.totalActiveStudents ? Math.round((s.count / data.totalActiveStudents) * 100) : 0;
              return (
                <div key={s.sport} className="flex items-center gap-3 text-sm py-1.5">
                  <div className="w-40 truncate text-slate-600">{s.sport}</div>
                  <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
                    <div className="h-full bg-teal-500 rounded-full" style={{ width: Math.max(pct, 4) + '%' }} />
                  </div>
                  <div className="w-10 text-right font-semibold text-slate-700">{s.count}</div>
                </div>
              );
            })
          )}
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
          <h2 className="font-semibold text-slate-700 mb-3">จำนวนนักเรียน Active ต่อห้อง</h2>
          {data.byClass.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">ยังไม่มีข้อมูลชั้นเรียน</p>
          ) : (
            data.byClass.map((c) => (
              <div key={c.className} className="flex items-center justify-between text-sm py-1.5 border-b border-slate-100 last:border-0">
                <span className="text-slate-600">{c.className}</span>
                <span className="font-semibold text-slate-700">{c.count} คน</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 mb-5">
        <h2 className="font-semibold text-slate-700 mb-1">Executive Dashboard: Retention Rate &amp; Time-to-Level-Up ต่อกีฬา</h2>
        <p className="text-xs text-slate-400 mb-3">
          Retention Rate = % ของนักเรียนที่เรียนกีฬานั้นจน &ldquo;ถึง Level สูงสุด&rdquo; เทียบกับที่ย้ายไปกีฬาอื่นกลางคัน (ไม่นับคนที่ยังเรียนอยู่และยังสรุปผลไม่ได้)
          · Avg รอบ/เลเวล = จำนวน &ldquo;รอบการประเมิน&rdquo; เฉลี่ยที่ใช้ต่อการเลื่อนขึ้น 1 Level (ประเมินจากรอบที่บันทึกจริง ไม่ใช่จำนวนคาบเรียน)
        </p>
        {(!data.sportAnalytics || data.sportAnalytics.bySport.length === 0) ? (
          <p className="text-sm text-slate-400 py-4 text-center">ยังไม่มีข้อมูลเพียงพอสำหรับวิเคราะห์</p>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-slate-400 border-b border-slate-200">
                  <th className="py-2 pr-3">กีฬา</th>
                  <th className="py-2 pr-3 text-center">Retention Rate</th>
                  <th className="py-2 pr-3 text-center">ถึง Level สูงสุด</th>
                  <th className="py-2 pr-3 text-center">ย้ายกลางคัน</th>
                  <th className="py-2 pr-3 text-center">กำลังเรียนอยู่</th>
                  <th className="py-2 text-center">Avg รอบ/เลเวล (TLU)</th>
                </tr>
              </thead>
              <tbody>
                {data.sportAnalytics.bySport.map((s) => (
                  <tr key={s.sport} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-3 text-slate-700">{s.sport}</td>
                    <td className="py-2 pr-3 text-center font-semibold">
                      {s.retentionRate === null ? <span className="text-slate-300 font-normal">—</span> : s.retentionRate + '%'}
                    </td>
                    <td className="py-2 pr-3 text-center text-emerald-600 font-semibold">{s.graduated}</td>
                    <td className="py-2 pr-3 text-center text-amber-600">{s.switchedAway}</td>
                    <td className="py-2 pr-3 text-center text-slate-400">{s.stillActive}</td>
                    <td className="py-2 text-center">
                      {s.avgRoundsPerLevel === null ? <span className="text-slate-300">—</span> : s.avgRoundsPerLevel + ' รอบ/เลเวล'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
        <h2 className="font-semibold text-slate-700 mb-3">กิจกรรมล่าสุด (Audit Log)</h2>
        {data.recentActivity.length === 0 ? (
          <div className="text-sm text-slate-400 py-6 text-center">ยังไม่มีประวัติการบันทึก</div>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-slate-400 border-b border-slate-200">
                  <th className="py-2 pr-3">เมื่อไหร่</th>
                  <th className="py-2 pr-3">ผู้บันทึก</th>
                  <th className="py-2 pr-3">กีฬา</th>
                  <th className="py-2 pr-3">ปี</th>
                  <th className="py-2">รายละเอียด</th>
                </tr>
              </thead>
              <tbody>
                {data.recentActivity.map((a, i) => (
                  <tr key={i} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-3 text-slate-500 whitespace-nowrap">{timeAgoTh(a.ts)}</td>
                    <td className="py-2 pr-3 text-slate-700">{a.actor}</td>
                    <td className="py-2 pr-3 text-slate-600">{a.sport}</td>
                    <td className="py-2 pr-3 text-slate-600">{a.academicYear}</td>
                    <td className="py-2 text-slate-500">{a.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
