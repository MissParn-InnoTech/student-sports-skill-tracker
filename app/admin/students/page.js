'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/apiClient';
import { getActorName, setActorName } from '@/lib/currentUser';
import {
  UserPlus, Search, Pencil, Trash2, Loader2, User, Users, UserCheck, School, Medal,
  RefreshCw, X, Check, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  CheckCircle2, AlertCircle, AlertTriangle, CalendarCog, FilterX,
} from 'lucide-react';

const nf = new Intl.NumberFormat('th-TH');
const PAGE_SIZES = [25, 50, 100];

const STATUS_LABELS = {
  Active: 'ใช้งานอยู่',
  Inactive: 'ไม่ใช้งาน',
  Graduated: 'จบการศึกษาแล้ว',
};

const STATUS_STYLES = {
  Active: { pill: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', dot: 'bg-emerald-500' },
  Inactive: { pill: 'bg-slate-50 text-slate-600 ring-slate-500/20', dot: 'bg-slate-400' },
  Graduated: { pill: 'bg-amber-50 text-amber-800 ring-amber-600/20', dot: 'bg-amber-500' },
};

const BTN_PRIMARY =
  'inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand px-4 py-2.5 sm:py-2 text-sm font-semibold text-white shadow-sm transition ' +
  'hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
const BTN_SECONDARY =
  'inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 sm:py-2 text-sm font-semibold text-slate-700 shadow-sm transition ' +
  'hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
const CARD = 'rounded-2xl border border-slate-200 bg-white shadow-sm';

const emptyForm = { id: '', name: '', className: '', currentAcademicYear: '', assignedSport: '' };

function Field({ label, hint, children, className = '' }) {
  return (
    <label className={'flex flex-col gap-1.5 text-xs font-semibold text-slate-600 ' + className}>
      <span>
        {label}
        {hint ? <span className="ml-1 font-normal text-slate-400">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

function SectionHeader({ step, icon: Icon, title, description }) {
  return (
    <div className="flex items-start gap-3">
      {step ? (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand text-sm font-bold text-white">{step}</span>
      ) : (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
          <Icon className="h-4 w-4" strokeWidth={2.25} />
        </span>
      )}
      <div className="min-w-0">
        <h2 className="font-semibold leading-tight text-slate-800">{title}</h2>
        {description ? <p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p> : null}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, value, label, sub }) {
  return (
    <div className={CARD + ' flex items-center gap-2.5 sm:gap-3 p-3.5 sm:p-4'}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
        <Icon className="h-5 w-5" strokeWidth={2.25} />
      </span>
      <div className="min-w-0">
        <div className="text-xl font-bold leading-tight tabular-nums text-slate-800">{value}</div>
        <div className="truncate text-xs text-slate-500">{label}</div>
        {sub ? <div className="truncate text-xs text-slate-400">{sub}</div> : null}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const st = STATUS_STYLES[status] || STATUS_STYLES.Inactive;
  return (
    <span className={'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ' + st.pill}>
      <span className={'h-1.5 w-1.5 rounded-full ' + st.dot} />
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function PagerButton({ onClick, disabled, label, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex h-10 w-10 sm:h-8 sm:w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function ConfirmDialog({ dialog, onClose }) {
  useEffect(() => {
    if (!dialog) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialog, onClose]);

  if (!dialog) return null;
  const danger = dialog.tone === 'danger';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => onClose(false)}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span className={'flex h-10 w-10 shrink-0 items-center justify-center rounded-full ' + (danger ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600')}>
            <AlertTriangle className="h-5 w-5" strokeWidth={2.25} />
          </span>
          <div className="min-w-0">
            <h3 id="confirm-title" className="font-semibold text-slate-800">{dialog.title}</h3>
            <div className="mt-1.5 space-y-1.5 text-sm leading-relaxed text-slate-600">
              {dialog.lines.map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className={BTN_SECONDARY} onClick={() => onClose(false)}>
            ยกเลิก
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => onClose(true)}
            className={danger ? BTN_PRIMARY.replace('bg-brand ', 'bg-red-600 ').replace('hover:bg-brand-dark', 'hover:bg-red-700') : BTN_PRIMARY}
          >
            {dialog.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ManageStudentsPage() {
  const [students, setStudents] = useState(null);
  const [sportOptions, setSportOptions] = useState([]);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState(null);

  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(emptyForm);

  const [yearForm, setYearForm] = useState({ year: '', className: '' });

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkForm, setBulkForm] = useState({ className: '', assignedSport: '' });

  const [actor, setActor] = useState(() => getActorName());

  function handleActorChange(value) {
    setActor(value);
    setActorName(value);
  }

  function showToast(msg, kind = 'ok') {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 3500);
  }

  // แทน window.confirm — คืนค่า Promise<boolean>
  function ask(options) {
    return new Promise((resolve) => setDialog({ ...options, resolve }));
  }

  function closeDialog(result) {
    setDialog((d) => {
      if (d) d.resolve(result);
      return null;
    });
  }

  async function loadStudents() {
    try {
      setBusy(true);
      const data = await apiGet('/api/admin/students');
      setStudents(data);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    loadStudents();
    (async () => {
      try {
        const cfg = await apiGet('/api/initial-data');
        setSportOptions((cfg.sports || []).map((s) => s.name));
      } catch {
        // ไม่ critical ถ้าโหลดรายชื่อกีฬาไม่สำเร็จ - ฟอร์มจะแค่ไม่มี dropdown ตัวเลือก
      }
    })();
  }, []);

  const classes = useMemo(
    () => [...new Set((students || []).map((s) => s.className).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'th', { numeric: true })),
    [students]
  );

  const stats = useMemo(() => {
    const list = students || [];
    const active = list.filter((s) => s.status === 'Active');
    return {
      total: list.length,
      active: active.length,
      withSport: active.filter((s) => s.assignedSport).length,
    };
  }, [students]);

  const filtered = useMemo(() => {
    if (!students) return [];
    const q = search.trim().toLowerCase();
    return students.filter((s) => {
      if (classFilter && s.className !== classFilter) return false;
      if (statusFilter && s.status !== statusFilter) return false;
      if (q && !(s.id.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [students, search, classFilter, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * pageSize;
  const pageRows = filtered.slice(pageStart, pageStart + pageSize);

  const hasFilter = Boolean(search || classFilter || statusFilter);
  const selectedInFiltered = useMemo(() => filtered.reduce((n, s) => n + (selectedIds.has(s.id) ? 1 : 0), 0), [filtered, selectedIds]);
  const allFilteredSelected = filtered.length > 0 && selectedInFiltered === filtered.length;

  function updateFilter(setter, value) {
    setter(value);
    setPage(1);
  }

  function clearFilters() {
    setSearch('');
    setClassFilter('');
    setStatusFilter('');
    setPage(1);
  }

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllFiltered() {
    setSelectedIds((prev) => {
      const allSelected = filtered.length > 0 && filtered.every((s) => prev.has(s.id));
      if (allSelected) return new Set();
      return new Set(filtered.map((s) => s.id));
    });
  }

  async function handleAdd(e) {
    e.preventDefault();
    try {
      setBusy(true);
      await apiPost('/api/admin/students', { ...addForm, currentAcademicYear: Number(addForm.currentAcademicYear), actor: actor || undefined });
      showToast(`เพิ่มนักเรียน ${addForm.name} เรียบร้อย`);
      setAddForm(emptyForm);
      await loadStudents();
    } catch (e2) {
      showToast(e2.message, 'err');
    } finally {
      setBusy(false);
    }
  }

  function startEdit(s) {
    setEditingId(s.id);
    setEditForm({ name: s.name, className: s.className, currentAcademicYear: s.currentAcademicYear, assignedSport: s.assignedSport || '', status: s.status });
  }

  async function saveEdit(id) {
    try {
      setBusy(true);
      await apiPatch(`/api/admin/students/${encodeURIComponent(id)}`, {
        ...editForm,
        currentAcademicYear: Number(editForm.currentAcademicYear),
        actor: actor || undefined,
      });
      showToast('บันทึกการแก้ไขเรียบร้อย');
      setEditingId(null);
      await loadStudents();
    } catch (e) {
      showToast(e.message, 'err');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(s) {
    const ok = await ask({
      tone: 'danger',
      title: `ลบ "${s.name}" (${s.id}) ออกจากระบบถาวร?`,
      lines: [
        'ประวัติผลประเมินกีฬาทั้งหมดของนักเรียนคนนี้จะถูกลบไปด้วย และกู้คืนไม่ได้',
        'ถ้าแค่ต้องการหยุดใช้งาน แนะนำกด "แก้ไข" แล้วเปลี่ยนสถานะเป็น "ไม่ใช้งาน" แทน',
      ],
      confirmLabel: 'ลบถาวร',
    });
    if (!ok) return;
    try {
      setBusy(true);
      const qs = actor ? `?actor=${encodeURIComponent(actor)}` : '';
      await apiDelete(`/api/admin/students/${encodeURIComponent(s.id)}${qs}`);
      showToast(`ลบ ${s.name} ออกจากระบบแล้ว`);
      await loadStudents();
    } catch (e) {
      showToast(e.message, 'err');
    } finally {
      setBusy(false);
    }
  }

  async function handleAdvanceYear(e) {
    e.preventDefault();
    const scope = yearForm.className ? `เฉพาะห้อง ${yearForm.className}` : 'นักเรียนที่ใช้งานอยู่ทุกคน';
    const ok = await ask({
      title: `ตั้งค่าปีการศึกษาปัจจุบันเป็น ${yearForm.year}?`,
      lines: [
        `มีผลกับ${scope} และมีผลกับข้อมูลจริงทันที`,
        'ระบบจะไม่เลื่อนชั้น/เปลี่ยนห้องให้อัตโนมัติ ใช้ขั้นที่ 2 เพื่อย้ายห้อง/กำหนดกีฬาเอง',
      ],
      confirmLabel: 'ยืนยันตั้งค่าปีการศึกษา',
    });
    if (!ok) return;
    try {
      setBusy(true);
      const result = await apiPost('/api/admin/academic-year', {
        year: Number(yearForm.year),
        className: yearForm.className || undefined,
        actor: actor || undefined,
      });
      showToast(`ตั้งค่าปีการศึกษา ${result.year} ให้นักเรียน ${result.updatedCount} คนเรียบร้อย`);
      setYearForm({ year: '', className: '' });
      await loadStudents();
    } catch (e) {
      showToast(e.message, 'err');
    } finally {
      setBusy(false);
    }
  }

  async function handleBulkAssign(e) {
    e.preventDefault();
    if (selectedIds.size === 0) {
      showToast('กรุณาเลือกนักเรียนอย่างน้อย 1 คนในตารางด้านล่างก่อน', 'err');
      return;
    }
    if (!bulkForm.className && !bulkForm.assignedSport) {
      showToast('กรุณาระบุห้องเรียนใหม่ และ/หรือ กีฬาที่ต้องการตั้งค่า', 'err');
      return;
    }
    const parts = [];
    if (bulkForm.className) parts.push(`ย้ายไปห้อง "${bulkForm.className}"`);
    if (bulkForm.assignedSport) parts.push(`กำหนดกีฬาเป็น "${bulkForm.assignedSport}"`);
    const ok = await ask({
      title: `อัปเดตนักเรียนที่เลือกไว้ ${nf.format(selectedIds.size)} คน?`,
      lines: [parts.join(' และ ')],
      confirmLabel: 'ยืนยัน',
    });
    if (!ok) return;

    try {
      setBusy(true);
      const body = { studentIds: [...selectedIds] };
      if (bulkForm.className) body.className = bulkForm.className;
      if (bulkForm.assignedSport) body.assignedSport = bulkForm.assignedSport;
      if (actor) body.actor = actor;
      const result = await apiPost('/api/admin/students/bulk-assign', body);
      showToast(`อัปเดตนักเรียน ${result.updatedCount} คนเรียบร้อย`);
      setBulkForm({ className: '', assignedSport: '' });
      setSelectedIds(new Set());
      await loadStudents();
    } catch (e) {
      showToast(e.message, 'err');
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">โหลดข้อมูลนักเรียนไม่สำเร็จ</p>
          <p className="mt-0.5 break-words">{error}</p>
        </div>
        <button type="button" onClick={loadStudents} className={BTN_SECONDARY}>
          <RefreshCw className="h-4 w-4" />
          ลองใหม่
        </button>
      </div>
    );
  }

  const loading = students === null;

  return (
    <div className="space-y-5">
      {toast && (
        <div
          role="status"
          className={
            'fixed inset-x-4 sm:left-auto sm:right-4 top-28 sm:top-24 z-50 flex sm:max-w-sm items-start gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ' +
            (toast.kind === 'err' ? 'bg-red-600' : 'bg-emerald-600')
          }
        >
          {toast.kind === 'err' ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>{toast.msg}</span>
        </div>
      )}

      <ConfirmDialog dialog={dialog} onClose={closeDialog} />

      {/* หัวหน้า + ผู้บันทึก (เก็บไว้ที่เครื่องนี้ ใช้บันทึกลง Audit Log ทุกครั้งที่แก้ไข/บันทึกข้อมูล) */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-800 sm:text-2xl">จัดการนักเรียน</h1>
          <p className="mt-1 text-sm text-slate-500">ตั้งปีการศึกษา จัดห้อง กำหนดกีฬา และดูแลทะเบียนรายชื่อนักเรียน</p>
        </div>
        <div className="flex w-full flex-wrap items-end gap-2 sm:w-auto">
          <Field label="ผู้บันทึก/แก้ไขข้อมูล" hint="(บันทึกลง Audit Log)" className="min-w-0 flex-1 sm:w-64 sm:flex-none">
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="input w-full !pl-9"
                placeholder="ชื่อ/อีเมลผู้ดูแลระบบ"
                value={actor}
                onChange={(e) => handleActorChange(e.target.value)}
              />
            </div>
          </Field>
          <button type="button" onClick={loadStudents} disabled={busy} className={BTN_SECONDARY} title="โหลดข้อมูลล่าสุด">
            <RefreshCw className={'h-4 w-4 ' + (busy ? 'animate-spin' : '')} />
            รีเฟรช
          </button>
        </div>
      </div>

      {/* สรุปภาพรวม */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <StatCard icon={Users} value={loading ? '—' : nf.format(stats.total)} label="นักเรียนทั้งหมด" />
        <StatCard
          icon={UserCheck}
          value={loading ? '—' : nf.format(stats.active)}
          label="ใช้งานอยู่"
          sub={loading ? null : `ไม่ใช้งาน/จบแล้ว ${nf.format(stats.total - stats.active)} คน`}
        />
        <StatCard icon={School} value={loading ? '—' : nf.format(classes.length)} label="ห้องเรียน" />
        <StatCard
          icon={Medal}
          value={loading ? '—' : nf.format(stats.withSport)}
          label="กำหนดกีฬาแล้ว"
          sub={loading ? null : `ยังไม่กำหนด ${nf.format(stats.active - stats.withSport)} คน`}
        />
      </div>

      {/* ขั้นที่ 1 + ขั้นที่ 2 */}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className={CARD + ' flex flex-col p-4 sm:p-5'}>
          <SectionHeader
            step={1}
            title="ตั้งค่าปีการศึกษาใหม่"
            description={
              <>
                เมื่อขึ้นปีการศึกษาใหม่ ใช้ฟอร์มนี้อัปเดต &quot;ปีการศึกษาปัจจุบัน&quot; ของนักเรียนที่ใช้งานอยู่ก่อน ระบบจะ
                <span className="font-semibold text-slate-700">ไม่เลื่อนชั้น/ย้ายห้องให้อัตโนมัติ</span> — จัดห้องใหม่และกำหนดกีฬาของปีนี้ได้ในขั้นที่ 2
              </>
            }
          />
          <form onSubmit={handleAdvanceYear} className="mt-4 flex flex-1 flex-wrap items-end gap-3">
            <Field label="ปีการศึกษาใหม่ (พ.ศ.)" className="w-full sm:w-36">
              <input
                className="input w-full"
                type="number"
                required
                value={yearForm.year}
                onChange={(e) => setYearForm((f) => ({ ...f, year: e.target.value }))}
                placeholder="เช่น 2570"
              />
            </Field>
            <Field label="เฉพาะห้อง" hint="(เว้นว่าง = ทุกคน)" className="min-w-0 flex-1">
              <select className="input w-full" value={yearForm.className} onChange={(e) => setYearForm((f) => ({ ...f, className: e.target.value }))}>
                <option value="">ทุกห้อง (นักเรียน Active ทั้งหมด)</option>
                {classes.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <button type="submit" disabled={busy} className={BTN_PRIMARY + ' w-full sm:w-auto'}>
              <CalendarCog className="h-4 w-4" />
              ตั้งค่าปีการศึกษา
            </button>
          </form>
        </section>

        <section className={CARD + ' flex flex-col p-4 sm:p-5'}>
          <SectionHeader
            step={2}
            title="จัดห้อง + กำหนดกีฬาประจำปีนี้"
            description="ติ๊กเลือกนักเรียนในตารางด้านล่าง (กรองด้วยห้องเดิมก่อนก็ได้) แล้วระบุห้องใหม่ และ/หรือ ชนิดกีฬาของปีนี้ — ช่องที่เว้นว่างจะไม่ถูกแก้ไข กีฬาที่กำหนดเป็นค่าตั้งต้นตอนกรอกคะแนน ไม่ใช่ผลประเมิน"
          />
          <form onSubmit={handleBulkAssign} className="mt-4 flex flex-1 flex-wrap items-end gap-3">
            <Field label="ย้ายไปห้อง" hint="(ว่าง = ไม่เปลี่ยน)" className="w-full sm:w-40">
              <input className="input w-full" placeholder="เช่น ม.5/4" value={bulkForm.className} onChange={(e) => setBulkForm((f) => ({ ...f, className: e.target.value }))} />
            </Field>
            <Field label="กีฬาประจำปีนี้" hint="(ว่าง = ไม่เปลี่ยน)" className="min-w-0 flex-1">
              <select className="input w-full" value={bulkForm.assignedSport} onChange={(e) => setBulkForm((f) => ({ ...f, assignedSport: e.target.value }))}>
                <option value="">— ไม่เปลี่ยนแปลง —</option>
                {sportOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <button type="submit" disabled={busy} className={BTN_PRIMARY + ' w-full sm:w-auto'}>
              <Check className="h-4 w-4" />
              ใช้กับนักเรียนที่เลือก ({nf.format(selectedIds.size)} คน)
            </button>
          </form>
        </section>
      </div>

      {/* ทะเบียนรายชื่อ: ตัวกรอง + เพิ่มนักเรียน + ตาราง */}
      <section className={CARD + ' overflow-hidden'}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3.5 sm:px-5">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
              <Users className="h-4 w-4" strokeWidth={2.25} />
            </span>
            <div>
              <h2 className="font-semibold leading-tight text-slate-800">รายชื่อนักเรียน</h2>
              <p className="flex items-center gap-1.5 text-xs text-slate-500">
                {loading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    กำลังโหลด...
                  </>
                ) : (
                  `แสดง ${nf.format(filtered.length)} จาก ${nf.format(students.length)} คน`
                )}
              </p>
            </div>
          </div>
          <button type="button" onClick={() => setShowAdd((v) => !v)} aria-expanded={showAdd} className={showAdd ? BTN_SECONDARY : BTN_PRIMARY}>
            {showAdd ? <X className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
            {showAdd ? 'ปิดฟอร์ม' : 'เพิ่มนักเรียนใหม่'}
          </button>
        </div>

        {showAdd && (
          <form onSubmit={handleAdd} className="border-b border-slate-200 bg-slate-50/70 px-4 py-4 sm:px-5">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <UserPlus className="h-4 w-4 text-brand" strokeWidth={2.25} />
              เพิ่มนักเรียนใหม่
            </p>
            <div className="grid grid-cols-2 items-end gap-3 lg:grid-cols-[9rem_minmax(0,1fr)_8rem_8rem_13rem_auto]">
              <Field label="เลขประจำตัว">
                <input className="input w-full" required value={addForm.id} onChange={(e) => setAddForm((f) => ({ ...f, id: e.target.value }))} />
              </Field>
              <Field label="ชื่อ-นามสกุล">
                <input className="input w-full" required value={addForm.name} onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))} />
              </Field>
              <Field label="ชั้นเรียน">
                <input className="input w-full" required placeholder="เช่น ม.4/4" value={addForm.className} onChange={(e) => setAddForm((f) => ({ ...f, className: e.target.value }))} />
              </Field>
              <Field label="ปีการศึกษา">
                <input
                  className="input w-full"
                  type="number"
                  required
                  placeholder="เช่น 2569"
                  value={addForm.currentAcademicYear}
                  onChange={(e) => setAddForm((f) => ({ ...f, currentAcademicYear: e.target.value }))}
                />
              </Field>
              <Field label="กีฬา" hint="(ไม่บังคับ)">
                <select className="input w-full" value={addForm.assignedSport} onChange={(e) => setAddForm((f) => ({ ...f, assignedSport: e.target.value }))}>
                  <option value="">—</option>
                  {sportOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
              <button type="submit" disabled={busy} className={BTN_PRIMARY}>
                <UserPlus className="h-4 w-4" />
                เพิ่มนักเรียน
              </button>
            </div>
          </form>
        )}

        {/* ตัวกรอง */}
        <div className="flex flex-wrap items-end gap-3 px-4 py-4 sm:px-5">
          <Field label="ค้นหา" hint="(ชื่อ/เลขประจำตัว)" className="w-full sm:w-72">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className="input w-full !pl-9" value={search} onChange={(e) => updateFilter(setSearch, e.target.value)} placeholder="พิมพ์เพื่อค้นหา..." />
            </div>
          </Field>
          <Field label="ชั้นเรียน" className="min-w-0 flex-1 sm:w-40 sm:flex-none">
            <select className="input w-full" value={classFilter} onChange={(e) => updateFilter(setClassFilter, e.target.value)}>
              <option value="">ทุกห้อง</option>
              {classes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="สถานะ" className="min-w-0 flex-1 sm:w-44 sm:flex-none">
            <select className="input w-full" value={statusFilter} onChange={(e) => updateFilter(setStatusFilter, e.target.value)}>
              <option value="">ทุกสถานะ</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          {hasFilter && (
            <button type="button" onClick={clearFilters} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700">
              <FilterX className="h-4 w-4" />
              ล้างตัวกรอง
            </button>
          )}
        </div>

        {/* แถบสถานะการเลือก */}
        {selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-y border-brand/15 bg-brand/5 px-4 py-2.5 text-sm sm:px-5">
            <span className="font-semibold text-brand-dark">เลือกอยู่ {nf.format(selectedIds.size)} คน</span>
            <span className="text-xs text-slate-500">ระบุห้องใหม่/กีฬาในขั้นที่ 2 ด้านบน แล้วกด “ใช้กับนักเรียนที่เลือก”</span>
            <button type="button" onClick={() => setSelectedIds(new Set())} className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800">
              <X className="h-3.5 w-3.5" />
              ล้างการเลือก
            </button>
          </div>
        )}

        <p className="sm:hidden px-4 pb-2 text-xs text-slate-400">เลื่อนตารางไปทางขวาเพื่อดูคอลัมน์ทั้งหมด →</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-y border-slate-200 bg-slate-50 text-left text-xs font-semibold text-slate-500">
                <th className="w-10 py-2.5 pl-4 pr-2 sm:pl-5">
                  <input
                    type="checkbox"
                    className="h-4 w-4 cursor-pointer accent-brand align-middle"
                    aria-label="เลือกนักเรียนทั้งหมดตามตัวกรอง"
                    title={`เลือกทั้งหมดตามตัวกรอง (${nf.format(filtered.length)} คน)`}
                    checked={allFilteredSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = selectedInFiltered > 0 && !allFilteredSelected;
                    }}
                    onChange={toggleSelectAllFiltered}
                  />
                </th>
                <th className="px-3 py-2.5">เลขประจำตัว</th>
                <th className="px-3 py-2.5">ชื่อ-นามสกุล</th>
                <th className="px-3 py-2.5">ชั้นเรียน</th>
                <th className="px-3 py-2.5">ปีการศึกษา</th>
                <th className="px-3 py-2.5">กีฬาประจำปีนี้</th>
                <th className="px-3 py-2.5">สถานะ</th>
                <th className="py-2.5 pl-3 pr-4 text-right sm:pr-5">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading &&
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={8} className="px-4 py-3 sm:px-5">
                      <div className="h-4 animate-pulse rounded bg-slate-100" />
                    </td>
                  </tr>
                ))}
              {pageRows.map((s) => {
                const isEditing = editingId === s.id;
                const isSelected = selectedIds.has(s.id);
                return (
                  <tr key={s.id} className={'align-middle transition-colors ' + (isEditing ? 'bg-amber-50/60' : isSelected ? 'bg-brand/5' : 'hover:bg-slate-50')}>
                    <td className="py-2.5 pl-4 pr-2 sm:pl-5">
                      <input
                        type="checkbox"
                        className="h-4 w-4 cursor-pointer accent-brand align-middle"
                        aria-label={`เลือก ${s.name}`}
                        checked={isSelected}
                        onChange={() => toggleSelect(s.id)}
                      />
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[13px] tabular-nums text-slate-500">{s.id}</td>
                    <td className="px-3 py-2.5 font-medium text-slate-800">
                      {isEditing ? (
                        <input className="input w-full min-w-40" aria-label="ชื่อ-นามสกุล" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
                      ) : (
                        s.name
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-700">
                      {isEditing ? (
                        <input className="input w-28" aria-label="ชั้นเรียน" value={editForm.className} onChange={(e) => setEditForm((f) => ({ ...f, className: e.target.value }))} />
                      ) : (
                        s.className
                      )}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-slate-700">
                      {isEditing ? (
                        <input
                          className="input w-24"
                          type="number"
                          aria-label="ปีการศึกษา"
                          value={editForm.currentAcademicYear}
                          onChange={(e) => setEditForm((f) => ({ ...f, currentAcademicYear: e.target.value }))}
                        />
                      ) : (
                        s.currentAcademicYear
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {isEditing ? (
                        <select className="input w-44" aria-label="กีฬาประจำปีนี้" value={editForm.assignedSport} onChange={(e) => setEditForm((f) => ({ ...f, assignedSport: e.target.value }))}>
                          <option value="">—</option>
                          {sportOptions.map((sp) => (
                            <option key={sp} value={sp}>
                              {sp}
                            </option>
                          ))}
                        </select>
                      ) : s.assignedSport ? (
                        <span className="text-slate-700">{s.assignedSport}</span>
                      ) : (
                        <span className="text-xs text-slate-400">ยังไม่กำหนด</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {isEditing ? (
                        <select className="input w-36" aria-label="สถานะ" value={editForm.status} onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}>
                          {Object.entries(STATUS_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>
                              {v}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <StatusBadge status={s.status} />
                      )}
                    </td>
                    <td className="whitespace-nowrap py-2.5 pl-3 pr-4 text-right sm:pr-5">
                      {isEditing ? (
                        <div className="inline-flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => saveEdit(s.id)}
                            disabled={busy}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                          >
                            <Check className="h-3.5 w-3.5" />
                            บันทึก
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                          >
                            ยกเลิก
                          </button>
                        </div>
                      ) : (
                        <div className="inline-flex gap-1">
                          <button
                            type="button"
                            onClick={() => startEdit(s)}
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-2 sm:px-2 sm:py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-brand/10 hover:text-brand"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            แก้ไข
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(s)}
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-2 sm:px-2 sm:py-1.5 text-xs font-semibold text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            ลบ
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-14 text-center">
                    <Search className="mx-auto h-8 w-8 text-slate-300" />
                    <p className="mt-2 font-medium text-slate-600">ไม่พบนักเรียนตามเงื่อนไขที่เลือก</p>
                    {hasFilter && (
                      <button type="button" onClick={clearFilters} className="mt-2 text-sm font-semibold text-brand hover:underline">
                        ล้างตัวกรอง
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* แบ่งหน้า — เว้นที่ด้านขวาไว้ให้มาสคอตมุมล่างขวา */}
        {!loading && filtered.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-200 px-4 py-3 text-xs text-slate-500 sm:px-5 sm:pr-48">
            <span className="tabular-nums">
              รายการที่ {nf.format(pageStart + 1)}–{nf.format(pageStart + pageRows.length)} จาก {nf.format(filtered.length)}
            </span>
            <label className="flex items-center gap-2">
              แถวต่อหน้า
              <select
                className="input !w-auto !py-1 !text-xs"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
              >
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-center gap-1.5">
              <PagerButton onClick={() => setPage(1)} disabled={currentPage === 1} label="หน้าแรก">
                <ChevronsLeft className="h-4 w-4" />
              </PagerButton>
              <PagerButton onClick={() => setPage(currentPage - 1)} disabled={currentPage === 1} label="หน้าก่อนหน้า">
                <ChevronLeft className="h-4 w-4" />
              </PagerButton>
              <span className="px-2 font-medium tabular-nums text-slate-700">
                หน้า {nf.format(currentPage)} / {nf.format(pageCount)}
              </span>
              <PagerButton onClick={() => setPage(currentPage + 1)} disabled={currentPage === pageCount} label="หน้าถัดไป">
                <ChevronRight className="h-4 w-4" />
              </PagerButton>
              <PagerButton onClick={() => setPage(pageCount)} disabled={currentPage === pageCount} label="หน้าสุดท้าย">
                <ChevronsRight className="h-4 w-4" />
              </PagerButton>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
