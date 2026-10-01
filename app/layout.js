import './globals.css';
import { Mitr } from 'next/font/google';
import Header from '@/components/Header';

const mitr = Mitr({
  subsets: ['thai', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-mitr',
  display: 'swap',
});

export const metadata = {
  title: 'Student Sports Skill Tracker',
  description: 'ระบบติดตามทักษะกีฬาของนักเรียน',
};

export default function RootLayout({ children }) {
  return (
    <html lang="th" className={mitr.variable}>
      <body className="bg-paper text-ink text-[15px] antialiased">
        <Header />
        <main className="max-w-7xl mx-auto px-3 sm:px-6 py-5 pb-16">{children}</main>
        {/* มาสคอต ACT ตกแต่งมุมล่างขวา — ไม่บังการใช้งาน (pointer-events-none) และ
            z-index ต่ำกว่าแถบ "บันทึกคะแนนทั้งหมด" (z-30 ใน app/page.js) ที่ fixed อยู่ด้านล่างเหมือนกัน */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://i.postimg.cc/fyHD1qrX/Yellow-White-Modern-Professional-Resume-5.png"
          alt=""
          aria-hidden="true"
          className="hidden sm:block fixed bottom-0 right-2 sm:right-4 z-10 pointer-events-none select-none w-24 sm:w-32 md:w-40 h-auto drop-shadow-md"
        />
      </body>
    </html>
  );
}
