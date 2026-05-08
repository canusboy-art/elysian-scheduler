'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { ChevronLeft, UserPlus, Trash2, Mail, KeyRound, CheckCircle2, Pencil, X } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function RosterContent() {
  const searchParams = useSearchParams();
  const currentMonth = searchParams.get('m') || '';
  const { profile: myProfile } = useAuth();
  const isManager = myProfile?.role === 'scheduler';

  const [roster, setRoster] = useState<any[]>([]);
  const [settings, setSettings] = useState({ min_pt_weekday: 1, min_ot_weekday: 1, min_st_weekday: 1, min_pt_weekend: 1, min_ot_weekend: 1, min_st_weekend: 1 });
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'cards' | 'schedule'>('cards');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [accountModal, setAccountModal] = useState<{ staff: any; mode: 'invite' | 'create' } | null>(null);
  const [accountEmail, setAccountEmail] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [accountError, setAccountError] = useState('');
  const [accountSaving, setAccountSaving] = useState(false);
  const [editModal, setEditModal] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [editSaving, setEditSaving] = useState(false);

  const fetchRoster = useCallback(async () => {
    const [{ data }, { data: settingsData }] = await Promise.all([
      supabase.from('profiles').select('*').order('full_name', { ascending: true }),
      supabase.from('settings').select('*').maybeSingle(),
    ]);
    if (data) setRoster(data);
    if (settingsData) setSettings(settingsData);
    setLoading(false);
  }, []);

  useEffect(() => { fetchRoster(); }, [fetchRoster]);

  const updateSetting = async (field: string, value: number) => {
    setSettings(s => ({ ...s, [field]: value }));
    await supabase.from('settings').update({ [field]: value }).eq('id', 1);
  };

  const handleToggle = async (e: React.MouseEvent, staffId: string, field: string, currentValue: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    let updateData: any = { [field]: !currentValue };
    if (field === 'is_pt' && !currentValue) updateData = { is_pt: true, is_ot: false, is_st: false };
    else if (field === 'is_ot' && !currentValue) updateData = { is_ot: true, is_pt: false, is_st: false };
    else if (field === 'is_st' && !currentValue) updateData = { is_st: true, is_pt: false, is_ot: false };
    else if (['is_pt', 'is_ot', 'is_st'].includes(field) && currentValue) return;
    const { error } = await supabase.from('profiles').update(updateData).eq('id', staffId);
    if (!error) fetchRoster();
  };

  const handleDayToggle = async (staffId: string, day: string, currentValue: boolean) => {
    const { error } = await supabase.from('profiles').update({ [`works_${day}`]: !currentValue }).eq('id', staffId);
    if (!error) fetchRoster();
  };

  const deleteStaff = async (staffId: string) => {
    if (!confirm("Permanently remove this personnel?")) return;
    const { error } = await supabase.from('profiles').delete().eq('id', staffId);
    if (!error) fetchRoster();
  };

  const addStaff = async () => {
    if (!newName.trim()) return;
    setIsSaving(true);
    const { data: inserted, error } = await supabase.from('profiles').insert([{
      full_name: newName.trim(), email: newEmail.trim() || null,
      is_pt: true, is_ot: false, is_st: false, is_prn: false,
      works_mon: true, works_tue: true, works_wed: true, works_thu: true, works_fri: true, works_sat: false, works_sun: false,
    }]).select().single();

    if (!error && inserted && newEmail.trim() && newPassword.trim()) {
      await fetch('/api/auth/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail.trim(), password: newPassword.trim(), staffId: inserted.id }),
      });
    }

    if (!error) { setNewName(''); setNewEmail(''); setNewPassword(''); setShowAddModal(false); fetchRoster(); }
    setIsSaving(false);
  };

  const openEditModal = (staff: any) => {
    setEditForm({
      full_name: staff.full_name || '',
      email: staff.email || '',
      is_pt: staff.is_pt ?? true,
      is_ot: staff.is_ot ?? false,
      is_st: staff.is_st ?? false,
      is_prn: staff.is_prn ?? false,
      works_mon: staff.works_mon ?? true,
      works_tue: staff.works_tue ?? true,
      works_wed: staff.works_wed ?? true,
      works_thu: staff.works_thu ?? true,
      works_fri: staff.works_fri ?? true,
      works_sat: staff.works_sat ?? false,
      works_sun: staff.works_sun ?? false,
    });
    setEditModal(staff);
  };

  const handleEditSave = async () => {
    if (!editForm.full_name.trim()) return;
    setEditSaving(true);
    await supabase.from('profiles').update({
      full_name: editForm.full_name.trim(),
      email: editForm.email.trim() || null,
      is_pt: editForm.is_pt,
      is_ot: editForm.is_ot,
      is_st: editForm.is_st,
      is_prn: editForm.is_prn,
      works_mon: editForm.works_mon,
      works_tue: editForm.works_tue,
      works_wed: editForm.works_wed,
      works_thu: editForm.works_thu,
      works_fri: editForm.works_fri,
      works_sat: editForm.works_sat,
      works_sun: editForm.works_sun,
    }).eq('id', editModal.id);
    setEditModal(null);
    fetchRoster();
    setEditSaving(false);
  };

  const openAccountModal = (staff: any, mode: 'invite' | 'create') => {
    setAccountEmail(staff.email || '');
    setAccountPassword('');
    setAccountError('');
    setAccountModal({ staff, mode });
  };

  const handleAccountSubmit = async () => {
    if (!accountEmail.trim()) { setAccountError('Email is required.'); return; }
    if (accountModal!.mode === 'create' && !accountPassword.trim()) { setAccountError('Password is required.'); return; }
    setAccountSaving(true);
    setAccountError('');

    const endpoint = accountModal!.mode === 'invite' ? '/api/auth/invite' : '/api/auth/create-user';
    const body: any = { email: accountEmail, staffId: accountModal!.staff.id };
    if (accountModal!.mode === 'create') body.password = accountPassword;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();

    if (json.error) { setAccountError(json.error); }
    else { setAccountModal(null); fetchRoster(); }
    setAccountSaving(false);
  };

  if (loading) return <div className="h-screen flex items-center justify-center font-black uppercase text-2xl tracking-tighter">Syncing Roster...</div>;

  const pts = roster.filter(s => s.is_pt);
  const ots = roster.filter(s => s.is_ot);
  const sts = roster.filter(s => s.is_st);
  const groups = [
    { label: 'Physical Therapy', list: pts, color: 'text-blue-600', dot: 'bg-blue-600', row: 'hover:bg-blue-50/30' },
    { label: 'Occupational Therapy', list: ots, color: 'text-purple-600', dot: 'bg-purple-600', row: 'hover:bg-purple-50/30' },
    { label: 'Speech Therapy', list: sts, color: 'text-emerald-600', dot: 'bg-emerald-600', row: 'hover:bg-emerald-50/30' },
  ];

  return (
    <main className="h-screen w-full bg-gray-50 flex flex-col overflow-hidden text-black font-sans isolate">
      <header className="h-24 flex-none border-b flex justify-between items-center px-12 bg-white">
        <div className="flex items-center gap-8">
          <Link href={`/?m=${currentMonth}`} className="p-3 bg-gray-50 rounded-2xl border hover:bg-white transition-all active:scale-95 shadow-sm">
            <ChevronLeft size={20} />
          </Link>
          <h1 className="text-3xl font-black uppercase tracking-tighter">Master Roster</h1>
          <div className="flex items-center bg-gray-100 rounded-2xl p-1 gap-1 ml-4">
            <button onClick={() => setView('cards')} className={`px-5 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${view === 'cards' ? 'bg-white shadow text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}>Staff Cards</button>
            <button onClick={() => setView('schedule')} className={`px-5 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${view === 'schedule' ? 'bg-white shadow text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}>Weekly Schedule</button>
          </div>
        </div>
        {isManager && (
          <button onClick={() => setShowAddModal(true)} className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-blue-700 active:scale-95 transition-all">
            <UserPlus size={16} className="mr-2 inline" /> Enroll Staff
          </button>
        )}
      </header>

      {view === 'cards' ? (
        <div className="flex-1 p-8 overflow-y-auto bg-gray-50/50">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {roster.map(staff => (
              <div key={staff.id} className="bg-white rounded-[2rem] border border-gray-200 p-6 flex flex-col justify-between shadow-sm transition-all hover:shadow-lg relative overflow-hidden group">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center text-white font-black text-sm">{staff.full_name[0]}</div>
                      <div>
                        <span className="font-black text-sm uppercase tracking-tight truncate max-w-[140px] block">{staff.full_name}</span>
                        {staff.email && <span className="text-[9px] text-gray-400 font-medium">{staff.email}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {staff.auth_user_id
                        ? <CheckCircle2 size={14} className="text-green-500" />
                        : isManager && (
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openAccountModal(staff, 'invite')} title="Send invite email" className="p-1.5 rounded-lg bg-gray-50 hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-all"><Mail size={13} /></button>
                            <button onClick={() => openAccountModal(staff, 'create')} title="Create account with password" className="p-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-all"><KeyRound size={13} /></button>
                          </div>
                        )
                      }
                      {isManager && <button onClick={() => openEditModal(staff)} className="p-1 text-gray-200 hover:text-blue-500 transition-colors" title="Edit"><Pencil size={14} /></button>}
                      {isManager && <button onClick={() => deleteStaff(staff.id)} className="p-1 text-gray-200 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={(e) => handleToggle(e, staff.id, 'is_pt', staff.is_pt)} className={`flex-1 py-1.5 text-[9px] font-black rounded-lg border-2 transition-all ${staff.is_pt ? 'bg-blue-600 text-white border-blue-700' : 'text-gray-300 border-gray-100'}`}>PT</button>
                    <button onClick={(e) => handleToggle(e, staff.id, 'is_ot', staff.is_ot)} className={`flex-1 py-1.5 text-[9px] font-black rounded-lg border-2 transition-all ${staff.is_ot ? 'bg-purple-600 text-white border-purple-700' : 'text-gray-300 border-gray-100'}`}>OT</button>
                    <button onClick={(e) => handleToggle(e, staff.id, 'is_st', staff.is_st)} className={`flex-1 py-1.5 text-[9px] font-black rounded-lg border-2 transition-all ${staff.is_st ? 'bg-emerald-600 text-white border-emerald-700' : 'text-gray-300 border-gray-100'}`}>ST</button>
                    <button onClick={(e) => handleToggle(e, staff.id, 'is_prn', staff.is_prn)} className={`flex-1 py-1.5 text-[9px] font-black rounded-lg border-2 transition-all ${staff.is_prn ? 'bg-amber-100 border-amber-500 text-amber-700' : 'bg-white border-green-500 text-green-700'}`}>{staff.is_prn ? 'PRN' : 'PERM'}</button>
                  </div>
                </div>
                <div className="pt-4 border-t flex justify-between gap-1">
                  {DAYS.map((day) => {
                    const isActive = staff[`works_${day}`];
                    return (
                      <button key={day} onClick={(e) => handleToggle(e, staff.id, `works_${day}`, isActive)} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase transition-all ${isActive ? 'bg-gray-900 text-white shadow-md' : 'bg-gray-50 text-gray-200'}`}>
                        {day[0]}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 p-8 overflow-y-auto bg-gray-50/50">
          <div className="bg-white rounded-[2rem] border border-gray-200 shadow-sm overflow-hidden">
            <div className="grid grid-cols-[1fr_repeat(7,_56px)] border-b bg-gray-50">
              <div className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Staff</div>
              {DAY_LABELS.map((d, i) => (
                <div key={d} className={`py-4 text-center text-[10px] font-black uppercase tracking-widest ${i < 5 ? 'text-gray-500' : 'text-gray-300'}`}>{d}</div>
              ))}
            </div>
            {groups.map((group) => (
              <div key={group.label}>
                <div className={`px-6 py-3 text-[9px] font-black uppercase tracking-[0.3em] ${group.color} bg-gray-50/60 border-b border-t`}>{group.label}</div>
                {group.list.map((staff, idx) => (
                  <div key={staff.id} className={`grid grid-cols-[1fr_repeat(7,_56px)] items-center transition-all ${group.row} ${idx < group.list.length - 1 ? 'border-b border-gray-50' : ''}`}>
                    <div className="px-6 py-4 flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full flex-none ${group.dot}`} />
                      <span className="font-black text-sm uppercase tracking-tight">{staff.full_name}</span>
                      {staff.is_prn && <span className="text-[8px] font-black uppercase bg-amber-100 text-amber-600 px-2 py-0.5 rounded-md">PRN</span>}
                      {staff.auth_user_id && <CheckCircle2 size={12} className="text-green-400 ml-1" />}
                    </div>
                    {DAYS.map((day) => {
                      const isActive = staff[`works_${day}`];
                      return (
                        <div key={day} className="flex items-center justify-center py-3">
                          <button onClick={() => handleDayToggle(staff.id, day, isActive)} className={`w-8 h-8 rounded-xl transition-all active:scale-90 ${isActive ? `${group.dot} shadow-sm` : 'bg-gray-100 hover:bg-gray-200'}`} />
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {isManager && (
            <div className="mt-6 bg-white rounded-[2rem] border border-gray-200 shadow-sm p-8">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-8">Staffing Minimums Per Day</h3>
              <div className="flex gap-12">
                {[
                  { label: 'Weekday', fields: ['min_pt_weekday', 'min_ot_weekday', 'min_st_weekday'] },
                  { label: 'Weekend', fields: ['min_pt_weekend', 'min_ot_weekend', 'min_st_weekend'] },
                ].map(({ label, fields }) => (
                  <div key={label}>
                    <p className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-300 mb-4">{label}</p>
                    <div className="flex gap-4">
                      {fields.map((field, i) => (
                        <div key={field} className="flex flex-col items-center gap-2">
                          <span className={`text-[10px] font-black uppercase tracking-widest ${['text-blue-600', 'text-purple-600', 'text-emerald-600'][i]}`}>{['PT', 'OT', 'ST'][i]}</span>
                          <input type="number" min={0} value={settings[field as keyof typeof settings]} onChange={(e) => updateSetting(field, parseInt(e.target.value) || 0)} className="w-16 text-center p-3 bg-gray-50 border border-gray-100 rounded-2xl font-black text-xl focus:ring-4 focus:ring-blue-100 transition-all outline-none" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Enroll modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => !isSaving && setShowAddModal(false)} />
          <div className="relative w-full max-w-sm bg-white rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in-95">
            <h2 className="text-2xl font-black uppercase mb-2 tracking-tighter">Enroll Staff</h2>
            <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-6">Email + password are optional — you can add them later.</p>
            <div className="space-y-3 mb-6">
              <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Full Name"
                className="w-full p-4 bg-gray-100 rounded-2xl font-black text-sm text-gray-900 placeholder:text-gray-400 focus:ring-4 focus:ring-blue-100 transition-all outline-none" />
              <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="Email (optional)"
                className="w-full p-4 bg-gray-100 rounded-2xl font-black text-sm text-gray-900 placeholder:text-gray-400 focus:ring-4 focus:ring-blue-100 transition-all outline-none" />
              {newEmail.trim() && (
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Password"
                  className="w-full p-4 bg-gray-100 rounded-2xl font-black text-sm text-gray-900 placeholder:text-gray-400 focus:ring-4 focus:ring-blue-100 transition-all outline-none" />
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowAddModal(false); setNewName(''); setNewEmail(''); setNewPassword(''); }} className="flex-1 py-4 bg-gray-100 rounded-xl font-black text-[10px] uppercase text-gray-400">Cancel</button>
              <button onClick={addStaff} disabled={isSaving} className="flex-1 py-4 bg-gray-900 rounded-xl font-black text-[10px] uppercase text-white shadow-xl disabled:bg-gray-400">{isSaving ? 'Saving...' : 'Enroll'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => !editSaving && setEditModal(null)} />
          <div className="relative w-full max-w-sm bg-white rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black uppercase tracking-tighter">Edit Staff</h2>
              <button onClick={() => setEditModal(null)} className="p-2 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all"><X size={18} /></button>
            </div>

            <div className="space-y-3 mb-6">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Full Name</p>
                <input value={editForm.full_name} onChange={e => setEditForm((f: any) => ({ ...f, full_name: e.target.value }))}
                  className="w-full p-4 bg-gray-100 rounded-2xl font-black text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:ring-4 focus:ring-blue-100 transition-all" />
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Email</p>
                <input type="email" value={editForm.email} onChange={e => setEditForm((f: any) => ({ ...f, email: e.target.value }))}
                  className="w-full p-4 bg-gray-100 rounded-2xl font-black text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:ring-4 focus:ring-blue-100 transition-all" />
              </div>
            </div>

            <div className="mb-6">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-3">Discipline</p>
              <div className="flex gap-2">
                {[{ key: 'is_pt', label: 'PT', active: 'bg-blue-600 text-white' }, { key: 'is_ot', label: 'OT', active: 'bg-purple-600 text-white' }, { key: 'is_st', label: 'ST', active: 'bg-emerald-600 text-white' }].map(d => (
                  <button key={d.key} onClick={() => setEditForm((f: any) => ({ ...f, is_pt: d.key === 'is_pt', is_ot: d.key === 'is_ot', is_st: d.key === 'is_st' }))}
                    className={`flex-1 py-2 rounded-xl font-black text-[10px] uppercase border-2 transition-all ${editForm[d.key] ? d.active + ' border-transparent' : 'text-gray-300 border-gray-100'}`}>
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-3">Employment</p>
              <div className="flex gap-2">
                {[{ val: false, label: 'Permanent' }, { val: true, label: 'PRN' }].map(e => (
                  <button key={String(e.val)} onClick={() => setEditForm((f: any) => ({ ...f, is_prn: e.val }))}
                    className={`flex-1 py-2 rounded-xl font-black text-[10px] uppercase border-2 transition-all ${editForm.is_prn === e.val ? 'bg-gray-900 text-white border-transparent' : 'text-gray-300 border-gray-100'}`}>
                    {e.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-8">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-3">Working Days</p>
              <div className="flex gap-1.5">
                {DAYS.map(day => (
                  <button key={day} onClick={() => setEditForm((f: any) => ({ ...f, [`works_${day}`]: !f[`works_${day}`] }))}
                    className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase transition-all ${editForm[`works_${day}`] ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-300'}`}>
                    {day[0]}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setEditModal(null)} className="flex-1 py-4 bg-gray-100 rounded-xl font-black text-[10px] uppercase text-gray-400">Cancel</button>
              <button onClick={handleEditSave} disabled={editSaving} className="flex-1 py-4 bg-gray-900 rounded-xl font-black text-[10px] uppercase text-white shadow-xl disabled:bg-gray-400">
                {editSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Account modal */}
      {accountModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => !accountSaving && setAccountModal(null)} />
          <div className="relative w-full max-w-sm bg-white rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center gap-3 mb-2">
              {accountModal.mode === 'invite' ? <Mail size={20} className="text-blue-600" /> : <KeyRound size={20} className="text-gray-700" />}
              <h2 className="text-2xl font-black uppercase tracking-tighter">
                {accountModal.mode === 'invite' ? 'Send Invite' : 'Create Account'}
              </h2>
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-8">{accountModal.staff.full_name}</p>
            <div className="space-y-3">
              <input autoFocus type="email" value={accountEmail} onChange={(e) => setAccountEmail(e.target.value)} placeholder="Email address" className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-black text-sm focus:ring-4 focus:ring-blue-100 transition-all outline-none" />
              {accountModal.mode === 'create' && (
                <input type="password" value={accountPassword} onChange={(e) => setAccountPassword(e.target.value)} placeholder="Temporary password" className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-black text-sm focus:ring-4 focus:ring-blue-100 transition-all outline-none" />
              )}
            </div>
            {accountModal.mode === 'invite' && <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest mt-3">They will receive an email with a link to set their password.</p>}
            {accountError && <p className="text-red-500 text-xs font-black mt-3">{accountError}</p>}
            <div className="flex gap-3 mt-6">
              <button onClick={() => setAccountModal(null)} className="flex-1 py-4 bg-gray-100 rounded-xl font-black text-[10px] uppercase text-gray-400">Cancel</button>
              <button onClick={handleAccountSubmit} disabled={accountSaving} className="flex-1 py-4 bg-gray-900 rounded-xl font-black text-[10px] uppercase text-white shadow-xl disabled:bg-gray-400">
                {accountSaving ? 'Saving...' : accountModal.mode === 'invite' ? 'Send Invite' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function RosterPage() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center font-black uppercase text-2xl">Loading Roster...</div>}>
      <RosterContent />
    </Suspense>
  );
}
