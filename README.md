# Student Sports Skill Tracker (Next.js + PostgreSQL)

ระบบติดตามระดับทักษะกีฬานักเรียน — ย้ายจาก Google Apps Script + Google Sheets เดิม
มาเป็นเว็บแอป Next.js ที่รันบน [Vercel](https://vercel.com) และเก็บข้อมูลจริงใน PostgreSQL
(ไม่พึ่ง Google Sheets อีกต่อไป)

## ฟีเจอร์หลัก

- **กรอกคะแนน** (`/`) — เลือกปีการศึกษา/ชั้นเรียน/ชนิดกีฬา แล้วกรอกระดับทักษะ (1-6) ของนักเรียนทั้งห้อง
  ระบบจะดึง **Starting Level** จากปีก่อนหน้าอัตโนมัติ (carry-over ถ้าเล่นกีฬาเดิม, เริ่ม Level 1 ใหม่ถ้าเปลี่ยนกีฬาหรือเป็นนักเรียนใหม่)
- **Dashboard รายบุคคล** (`/dashboard/[id]`) — กราฟ Radar + กราฟแนวโน้มพัฒนาการ, ประวัติทุกปี, พิมพ์ Report Card เป็น PDF
- **รายงานรายห้อง** (`/report`) — สรุปคะแนนทั้งห้อง (แยกกีฬา หรือดูรวมทุกกีฬา), พิมพ์ PDF
- **ภาพรวมระบบ** (`/admin`) — KPI, สัดส่วนกีฬา, จำนวนนักเรียนต่อห้อง, Audit Log กิจกรรมล่าสุด

## สถาปัตยกรรม

- **Next.js 16** (App Router) + React 19 + Tailwind CSS v4
- **Prisma ORM** + **PostgreSQL** (ตาราง `students`, `skill_logs`, `audit_log`)
- ค่าคงที่ชนิดกีฬา/ทักษะ/คำอธิบาย Level (เดิมคือแท็บ System_Config) เก็บเป็น static config ที่ `lib/sportsConfig.js`
  ไม่ทำเป็นตาราง DB เพราะแทบไม่เปลี่ยนบ่อย
- Business logic หลัก (คำนวณ Starting Level / carry-over) อยู่ใน `lib/skillLogic.js` เป็น pure function
  แยกจาก DB โดยเฉพาะ ทดสอบได้ด้วย `node lib/__tests__/skillLogic.test.mjs`

> **หมายเหตุสำหรับผู้ที่รันงานนี้ต่อในแซนด์บ็อกซ์ปิด (เช่น environment นี้):** เครือข่ายในนี้บล็อกโดเมน
> `binaries.prisma.sh` ที่ Prisma CLI ต้องใช้โหลด engine binary สำหรับคำสั่ง `generate`/`migrate`/`validate`
> จึงตรวจสอบ Prisma แบบ end-to-end ในนี้ไม่ได้ (ทดสอบแล้วล้มเหลวทั้ง 3 คำสั่ง) — แต่ **Vercel และเครื่องทั่วไปที่มีอินเทอร์เน็ตปกติจะไม่เจอปัญหานี้**
> โค้ดฝั่ง business logic (`lib/skillLogic.js`) ได้ทดสอบแยกจนผ่านหมดแล้วโดยไม่พึ่ง Prisma

## Deploy บน Vercel (ขั้นตอนหลัก)

### 1. เตรียมฐานข้อมูล PostgreSQL

เลือกอย่างใดอย่างหนึ่ง:
- **Vercel Postgres** (สร้างจากแท็บ Storage ในโปรเจกต์ Vercel) — สะดวกสุด เพราะ env var ต่อให้อัตโนมัติ
- [Neon](https://neon.tech) หรือ [Supabase](https://supabase.com) — มี free tier, ใช้งานร่วมกับ Vercel ได้ดี

คัดลอก connection string ไว้ (รูปแบบ `postgresql://USER:PASSWORD@HOST:5432/DBNAME?sslmode=require`)

### 2. Push โค้ดขึ้น GitHub แล้ว Import เข้า Vercel

1. Import repository นี้ที่ [vercel.com/new](https://vercel.com/new)
2. Framework Preset จะตรวจพบ Next.js อัตโนมัติ
3. ในหน้า **Environment Variables** ใส่:
   - `POSTGRES_URL` = connection string จากขั้นตอนที่ 1
4. ก่อน deploy ครั้งแรก ให้ตั้งค่า **Build Command** เป็น:
   ```
   prisma generate && prisma migrate deploy && next build
   ```
   (หรือรัน `npx prisma migrate deploy` เองครั้งเดียวจากเครื่องที่ต่ออินเทอร์เน็ตได้ปกติ โดยตั้ง `POSTGRES_URL`
   ให้ชี้ไปที่ฐานข้อมูลจริงก่อน แล้วค่อยปล่อยให้ Vercel build แค่ `next build` ตามปกติ)
5. กด Deploy

### 3. ใส่ข้อมูลตัวอย่าง (ไม่บังคับ แต่แนะนำให้ลองระบบ)

รันจากเครื่อง local ที่ตั้ง `POSTGRES_URL` ชี้ไปที่ฐานข้อมูลจริงแล้ว:

```bash
npx prisma db seed
```

จะได้ข้อมูลตัวอย่าง 3 นักเรียนปีปัจจุบัน (TEST001-003) และ demo เลื่อนชั้น/ย้ายห้อง/เปลี่ยนกีฬาข้ามปี 5 ปี (STU001-003, ปี 2565-2569)

## รันในเครื่อง local (สำหรับพัฒนาต่อ)

```bash
npm install
cp .env.example .env   # แก้ POSTGRES_URL ให้ชี้ไปที่ Postgres ของตัวเอง
npx prisma generate
npx prisma migrate dev --name init
npx prisma db seed      # ไม่บังคับ
npm run dev
```

เปิด http://localhost:3000

## รันเทสต์ business logic (ไม่ต้องมี DB)

```bash
node lib/__tests__/skillLogic.test.mjs
```

## สิ่งที่ต่างจากเวอร์ชัน Google Apps Script เดิม

- ไม่มี Google Sheets แล้ว — ข้อมูลทั้งหมดอยู่ใน PostgreSQL จริง เปิดดู/query ได้อิสระกว่า
- ไม่มีปัญหาการชนกันของ concurrent write แบบ spreadsheet row-position (Postgres transaction จัดการให้)
- ช่อง "ผู้บันทึก" (actor) ในหน้ากรอกคะแนนตอนนี้เป็นช่องกรอกข้อความอิสระ (ยังไม่มีระบบ login จริง) —
  ถ้าต้องการยืนยันตัวตนจริง แนะนำเพิ่ม [NextAuth](https://authjs.dev) พร้อม Google provider ในอนาคต
- Report Card PDF ของนักเรียนรายบุคคล เวอร์ชันนี้แสดงตารางข้อมูล แต่ยังไม่ฝังรูปกราฟ Radar ลงในหน้าพิมพ์
  (เวอร์ชัน Apps Script เดิมมี) — เป็นจุดที่ลดทอนไว้ก่อนเพื่อความเร็ว แก้เพิ่มได้ภายหลังถ้าต้องการ
