'use client';

import { Radar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

/** RadarChart: ระดับทักษะของ 1 รอบการประเมิน (skills: string[], levels: {skill:level}) */
export default function RadarChart({ skills, levels, label, color = '#C81E3A' }) {
  const data = {
    labels: skills,
    datasets: [
      {
        label,
        data: skills.map((s) => levels[s] || 0),
        backgroundColor: color + '33',
        borderColor: color,
        pointBackgroundColor: color,
      },
    ],
  };
  const options = {
    responsive: true,
    maintainAspectRatio: true,
    scales: {
      r: {
        min: 0,
        max: 6,
        ticks: { stepSize: 1, backdropColor: 'transparent' },
        pointLabels: { font: { size: 11 } },
      },
    },
    plugins: {
      legend: { display: false },
    },
  };
  return <Radar data={data} options={options} />;
}
