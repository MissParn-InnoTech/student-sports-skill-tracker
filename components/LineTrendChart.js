'use client';

import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend } from 'chart.js';
import { SKILL_COLORS } from '@/lib/levelMeta';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

/**
 * LineTrendChart: แนวโน้มระดับแต่ละทักษะข้ามหลายรอบการประเมิน
 * rounds: [{ year, sport, levels: {skill:level} }] เรียงตามเวลาแล้ว
 * skills: ชื่อทักษะที่จะพล็อต (มักเป็นทักษะของกีฬาปัจจุบัน)
 */
export default function LineTrendChart({ rounds, skills }) {
  const labels = rounds.map((r) => r.year + (r.sport ? ' (' + r.sport + ')' : ''));
  const datasets = skills.map((skill, i) => ({
    label: skill,
    data: rounds.map((r) => r.levels[skill] ?? null),
    borderColor: SKILL_COLORS[i % SKILL_COLORS.length],
    backgroundColor: SKILL_COLORS[i % SKILL_COLORS.length],
    spanGaps: true,
    tension: 0.25,
  }));

  const data = { labels, datasets };
  const options = {
    responsive: true,
    maintainAspectRatio: true,
    scales: {
      y: { min: 0, max: 6, ticks: { stepSize: 1 } },
      x: { ticks: { autoSkip: false } },
    },
    plugins: {
      legend: { position: 'bottom' },
    },
  };
  return <Line data={data} options={options} />;
}
