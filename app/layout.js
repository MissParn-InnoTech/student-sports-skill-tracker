import './globals.css';
import Header from '@/components/Header';

export const metadata = {
  title: 'Student Sports Skill Tracker',
  description: 'ระบบติดตามทักษะกีฬาของนักเรียน',
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body className="bg-slate-100 text-slate-800 text-[15px] antialiased">
        <Header />
        <main className="max-w-7xl mx-auto px-3 sm:px-6 py-5 pb-16">{children}</main>
      </body>
    </html>
  );
}
