'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/apiClient';
import { UserPlus, Search, Pencil, Trash2, Loader2 } from 'lucide-react';

function Field({ label, children, className = '' }) {
  return (
    <label className={'flex flex-col gap-1 text-xs font-semibold text-slate-500 ' + className}>
      {label}
      {children}
    </label>
  );
}

function StepHeader({ step, icon: Icon, children, className = 'mb-1' }) {
  return (
    <h2 className={'flex items-center gap-2 font-semibold text-slate-700 ' + className}>
      {step ? (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-white">{step}</span>
      ) : (
        <Icon className="h-4 w-4 text-slate-400" strokeWidth={2.25} />
      )}
      {children}
    </h2>
  );
}

const STATUS_LABELS = {
  Active: 'ใช้งานอยู่',
  Inactive: 'ไม่ใช้งาน',
  Graduated: 'จบการศึกษาแล้ว',
};

const emptyForm = { id: '', name: '', className: '', currentAcademicYear: '', assignedSport: '' };

export default function ManageStudentsPage() {
  const [students, setStudents] = useState(null);
  const [sportOptions, setSportOptions] = useState([]);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);

  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [addForm, setAddForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(emptyForm);

  const [yearForm, setYearForm] = useState({ year: '', className: '' });

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkForm, setBulkForm] = useState({ className: '', assignedSport: '' });

  function showToast(msg, kind = 'ok') {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 3500);
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
      await apiPost('/api/admin/students', { ...addForm, currentAcademicYear: Number(addForm.currentAcademicYear) });
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
    if (!confirm(`ลบ "${s.name}" (${s.id}) ออกจากระบบถาวร?\n\nจะลบประวัติผลประเมินกีฬาทั้งหมดของนักเรียนคนนี้ไปด้วย และกู้คืนไม่ได้\n\nถ้าแค่ต้องการหยุดใช้งาน แนะนำกด "ตั้งไม่ใช้งาน" แทน`)) return;
    try {
      setBusy(true);
      await apiDelete(`/api/admin/students/${encodeURIComponent(s.id)}`);
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
    if (!confirm(`ตั้งค่าปีการศึกษาปัจจุบันเป็น ${yearForm.year} ให้${scope}?\n\n(จะไม่เลื่อนชั้น/เปลี่ยนห้องให้อัตโนมัติ ใช้ส่วน "จัดห้อง + กำหนดกีฬา" ด้านล่างเพื่อย้ายห้อง/กำหนดกีฬาเอง)`)) return;
    try {
      setBusy(true);
      const result = await apiPost('/api/admin/academic-year', {
        year: Number(yearForm.year),
        className: yearForm.className || undefined,
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
    if (!confirm(`${parts.join(' และ ')} ให้นักเรียนที่เลือกไว้ ${selectedIds.size} คน?`)) return;

    try {
      setBusy(true);
      const body = { studentIds: [...selectedIds] };
      if (bulkForm.className) body.className = bulkForm.className;
      if (bulkForm.assignedSport) body.assignedSport = bulkForm.assignedSport;
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

  if (error) return <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">{error}</div>;

  return (
    <div className="space-y-5">
      {toast && (
        <div
          className={
            'fixed top-4 right-4 z-50 rounded-lg px-4 py-2.5 text-sm font-semibold shadow-lg ' +
            (toast.kind === 'err' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white')
          }
        >
          {toast.msg}
        </div>
      )}

      {/* ตั้งค่ารายปีการศึกษา */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
        <StepHeader step={1}>ตั้งค่าปีการศึกษาใหม่</StepHeader>
        <p className="text-xs text-slate-500 mb-3">
          เมื่อขึ้นปีการศึกษาใหม่ ใช้ฟอร์มนี้อัปเดต &quot;ปีการศึกษาปัจจุบัน&quot; ของนักเรียนที่ใช้งานอยู่ก่อน ระบบจะ<span className="font-semibold">ไม่เลื่อนชั้น/ย้ายห้องให้อัตโนมัติ</span> —
          ไปที่ขั้นที่ 2 ด้านล่างเพื่อจัดห้องใหม่และกำหนดกีฬาของปีนี้
        </p>
        <form onSubmit={handleAdvanceYear} className="flex flex-wrap items-end gap-3">
          <Field label="ปีการศึกษาใหม่ (พ.ศ.)">
            <input
              className="input w-36"
              type="number"
              required
              value={yearForm.year}
              onChange={(e) => setYearForm((f) => ({ ...f, year: e.target.value }))}
              placeholder="เช่น 2570"
            />
          </Field>
          <Field label="เฉพาะห้อง (เว้นว่าง = ทุกคน)">
            <select className="input w-44" value={yearForm.className} onChange={(e) => setYearForm((f) => ({ ...f, className: e.target.value }))}>
              <option value="">ทุกห้อง (นักเรียน Active ทั้งหมด)</option>
              {classes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <button type="submit" disabled={busy} className="bg-brand hover:bg-brand-dark text-white font-semibold rounded-lg px-4 py-2 text-sm disabled:opacity-50">
            ตั้งค่าปีการศึกษา
          </button>
        </form>
      </div>

      {/* จัดห้อง + กำหนดกีฬา (bulk) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
        <StepHeader step={2}>จัดห้อง + กำหนดกีฬาประจำปีนี้ (ทำทีละหลายคน)</StepHeader>
        <p className="text-xs text-slate-500 mb-3">
          ติ๊กเลือกนักเรียนในตารางด้านล่าง (กรองด้วยห้องเดิมก่อนก็ได้) แล้วระบุห้องใหม่ และ/หรือ ชนิดกีฬาที่จะให้เล่นในปีการศึกษานี้ — เว้นช่องไหนว่างไว้ = ไม่แก้ไขค่านั้น
          กีฬาที่กำหนดเป็นเพียงค่า default สำหรับตอนกรอกคะแนน ไม่ใช่ผลประเมินจริง
        </p>
        <form onSubmit={handleBulkAssign} className="flex flex-wrap items-end gap-3">
          <Field label="ย้ายไปห้อง (เว้นว่าง = ไม่เปลี่ยน)">
            <input className="input w-40" placeholder="เช่น ม.5/4" value={bulkForm.className} onChange={(e) => setBulkForm((f) => ({ ...f, className: e.target.value }))} />
          </Field>
          <Field label="กีฬาประจำปีนี้ (เว้นว่าง = ไม่เปลี่ยน)">
            <select className="input w-56" value={bulkForm.assignedSport} onChange={(e) => setBulkForm((f) => ({ ...f, assignedSport: e.target.value }))}>
              <option value="">— ไม่เปลี่ยนแปลง —</option>
              {sportOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          <button type="submit" disabled={busy} className="bg-brand hover:bg-brand-dark text-white font-semibold rounded-lg px-4 py-2 text-sm disabled:opacity-50">
            ใช้กับนักเรียนที่เลือก ({selectedIds.size} คน)
          </button>
        </form>
      </div>

      {/* เพิ่มนักเรียนใหม่ */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
        <StepHeader icon={UserPlus} className="mb-3">เพิ่มนักเรียนใหม่</StepHeader>
        <form onSubmit={handleAdd} className="grid grid-cols-2 sm:grid-cols-6 gap-3 items-end">
          <Field label="เลขประจำตัว">
            <input className="input" required value={addForm.id} onChange={(e) => setAddForm((f) => ({ ...f, id: e.target.value }))} />
          </Field>
          <Field label="ชื่อ-นามสกุล" className="col-span-2 sm:col-span-1">
            <input className="input" required value={addForm.name} onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))} />
          </Field>
          <Field label="ชั้นเรียน">
            <input className="input" required placeholder="เช่น ม.4/4" value={addForm.className} onChange={(e) => setAddForm((f) => ({ ...f, className: e.target.value }))} />
          </Field>
          <Field label="ปีการศึกษา">
            <input
              className="input"
              type="number"
              required
              value={addForm.currentAcademicYear}
              onChange={(e) => setAddForm((f) => ({ ...f, currentAcademicYear: e.target.value }))}
            />
          </Field>
          <Field label="กีฬา (ไม่บังคับ)">
            <select className="input" value={addForm.assignedSport} onChange={(e) => setAddForm((f) => ({ ...f, assignedSport: e.target.value }))}>
              <option value="">—</option>
              {sportOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          <button type="submit" disabled={busy} className="bg-brand hover:bg-brand-dark text-white font-semibold rounded-lg px-4 py-2 text-sm disabled:opacity-50">
            เพิ่มนักเรียน
          </button>
        </form>
      </div>

      {/* ตาราง + ตัวกรอง */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <Field label="ค้นหา (ชื่อ/เลขประจำตัว)">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input className="input w-56 pl-8" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="พิมพ์เพื่อค้นหา..." />
            </div>
          </Field>
          <Field label="ชั้นเรียน">
            <select className="input w-40" value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
              <option value="">ทุกห้อง</option>
              {classes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="สถานะ">
            <select className="input w-40" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">ทุกสถานะ</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 ml-auto self-center">
            {students ? (
              `เลือกอยู่ ${selectedIds.size} คน · แสดง ${filtered.length} / ${students.length} คน`
            ) : (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                กำลังโหลด...
              </>
            )}
          </div>
        </div>

        <div className="overflow-x-auto -mx-4 sm:-mx-5 px-4 sm:px-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                <th className="py-2 pr-3">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && filtered.every((s) => selectedIds.has(s.id))}
                    onChange={toggleSelectAllFiltered}
                  />
                </th>
                <th className="py-2 pr-3">เลขประจำตัว</th>
                <th className="py-2 pr-3">ชื่อ-นามสกุล</th>
                <th className="py-2 pr-3">ชั้นเรียน</th>
                <th className="py-2 pr-3">ปีการศึกษา</th>
                <th className="py-2 pr-3">กีฬาประจำปีนี้</th>
                <th className="py-2 pr-3">สถานะ</th>
                <th className="py-2 pr-3 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const isEditing = editingId === s.id;
                return (
                  <tr key={s.id} className="border-b border-slate-100 align-middle">
                    <td className="py-2 pr-3">
                      <input type="checkbox" checked={selectedIds.has(s.id)} onChange={() => toggleSelect(s.id)} />
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs text-slate-600">{s.id}</td>
                    <td className="py-2 pr-3">
                      {isEditing ? (
                        <input className="input w-full" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
                      ) : (
                        s.name
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      {isEditing ? (
                        <input className="input w-28" value={editForm.className} onChange={(e) => setEditForm((f) => ({ ...f, className: e.target.value }))} />
                      ) : (
                        s.className
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      {isEditing ? (
                        <input
                          className="input w-24"
                          type="number"
                          value={editForm.currentAcademicYear}
                          onChange={(e) => setEditForm((f) => ({ ...f, currentAcademicYear: e.target.value }))}
                        />
                      ) : (
                        s.currentAcademicYear
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      {isEditing ? (
                        <select className="input w-44" value={editForm.assignedSport} onChange={(e) => setEditForm((f) => ({ ...f, assignedSport: e.target.value }))}>
                          <option value="">—</option>
                          {sportOptions.map((sp) => (
                            <option key={sp} value={sp}>
                              {sp}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-slate-600">{s.assignedSport || '—'}</span>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      {isEditing ? (
                        <select className="input w-32" value={editForm.status} onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}>
                          {Object.entries(STATUS_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>
                              {v}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span
                          className={
                            'text-xs font-semibold px-2 py-0.5 rounded-full ' +
                            (s.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500')
                          }
                        >
                          {STATUS_LABELS[s.status] || s.status}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-right whitespace-nowrap">
                      {isEditing ? (
                        <>
                          <button onClick={() => saveEdit(s.id)} disabled={busy} className="text-xs font-semibold text-emerald-600 hover:underline mr-3">
                            บันทึก
                          </button>
                          <button onClick={() => setEditingId(null)} className="text-xs font-semibold text-slate-400 hover:underline">
                            ยกเลิก
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(s)} className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline mr-3">
                            <Pencil className="h-3.5 w-3.5" />
                            แก้ไข
                          </button>
                          <button onClick={() => handleDelete(s)} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-red-600 hover:underline">
                            <Trash2 className="h-3.5 w-3.5" />
                            ลบ
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && students && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    ไม่พบนักเรียนตามเงื่อนไขที่เลือก
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
