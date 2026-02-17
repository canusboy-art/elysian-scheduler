'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { ChevronLeft, UserPlus, X, Trash2 } from 'lucide-react';
import Link from 'next/link';

function RosterContent() {
  const searchParams = useSearchParams();
  const currentMonth = searchParams.get('m') || ''; // Read current viewing month

  const [roster, setRoster] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const fetchRoster = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').order('full_name', { ascending: true });
    if (data) setRoster(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchRoster(); }, [fetchRoster]);

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

  const deleteStaff = async (staffId: string) => {
    if (!confirm("Permanently remove this personnel?")) return;
    const { error } = await supabase.from('profiles').delete().eq('id', staffId);
    if (!error) fetchRoster();
  };

  const addStaff = async () => {
    if (!newName.trim()) return;
    setIsSaving(true);
    const { error } = await supabase.from('profiles').insert([{ 
      full_name: newName.trim(), is_pt: true, is_ot: false, is_st: false, is_prn: false,
      works_mon: true, works_tue: true, works_wed: true, works_thu: true, works_fri: true, works_sat: false, works_sun: false
    }]);
    if (!error) { setNewName(''); setShowAddModal(false); fetchRoster(); }
    setIsSaving(false);
  };

  if (loading) return <div className="h-screen flex items-center justify-center font-black uppercase text-2xl tracking-tighter">Syncing Roster...</div>;

  return (
    <main className="h-screen w-full bg-gray-50 flex flex-col overflow-hidden text-black font-sans isolate">
      <header className="h-24 flex-none border-b flex justify-between items-center px-12 bg-white">
        <div className="flex items-center gap-8">
          {/* Include current month in the return path */}
          <Link 
            href={`/?m=${currentMonth}`} 
            className="p-3 bg-gray-50 rounded-2xl border hover:bg-white transition-all active:scale-95 shadow-sm"
          >
            <ChevronLeft size={20} />
          </Link>
          <h1 className="text-3xl font-black uppercase tracking-tighter">Master Roster</h1>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-blue-700 active:scale-95 transition-all"
        >
          <UserPlus size={16} className="mr-2 inline" /> Enroll Staff
        </button>
      </header>

      <div className="flex-1 p-8 overflow-hidden bg-gray-50/50">
        <div className="h-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-fr">
          {roster.map(staff => (
            <div key={staff.id} className="bg-white rounded-[2rem] border border-gray-200 p-6 flex flex-col justify-between shadow-sm transition-all hover:shadow-lg relative overflow-hidden group">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center text-white font-black text-sm">{staff.full_name[0]}</div>
                    <span className="font-black text-sm uppercase tracking-tight truncate max-w-[140px]">{staff.full_name}</span>
                  </div>
                  <button onClick={() => deleteStaff(staff.id)} className="text-gray-200 hover:text-red-500 transition-colors p-1"><Trash2 size={16} /></button>
                </div>
                <div className="flex gap-1">
                  <button onClick={(e) => handleToggle(e, staff.id, 'is_pt', staff.is_pt)} className={`flex-1 py-1.5 text-[9px] font-black rounded-lg border-2 transition-all ${staff.is_pt ? 'bg-blue-600 text-white border-blue-700' : 'text-gray-300 border-gray-100'}`}>PT</button>
                  <button onClick={(e) => handleToggle(e, staff.id, 'is_ot', staff.is_ot)} className={`flex-1 py-1.5 text-[9px] font-black rounded-lg border-2 transition-all ${staff.is_ot ? 'bg-purple-600 text-white border-purple-700' : 'text-gray-300 border-gray-100'}`}>OT</button>
                  <button onClick={(e) => handleToggle(e, staff.id, 'is_st', staff.is_st)} className={`flex-1 py-1.5 text-[9px] font-black rounded-lg border-2 transition-all ${staff.is_st ? 'bg-emerald-600 text-white border-emerald-700' : 'text-gray-300 border-gray-100'}`}>ST</button>
                  <button onClick={(e) => handleToggle(e, staff.id, 'is_prn', staff.is_prn)} className={`flex-1 py-1.5 text-[9px] font-black rounded-lg border-2 transition-all ${staff.is_prn ? 'bg-amber-100 border-amber-500 text-amber-700' : 'bg-white border-green-500 text-green-700'}`}>{staff.is_prn ? 'PRN' : 'PERM'}</button>
                </div>
              </div>

              <div className="pt-4 border-t flex justify-between gap-1">
                {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => {
                  const isActive = staff[`works_${day}`];
                  return (
                    <button 
                      key={day} 
                      onClick={(e) => handleToggle(e, staff.id, `works_${day}`, isActive)} 
                      className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase transition-all ${isActive ? 'bg-gray-900 text-white shadow-md' : 'bg-gray-50 text-gray-200 border-gray-50'}`}
                    >
                      {day[0]}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => !isSaving && setShowAddModal(false)} />
          <div className="relative w-full max-w-sm bg-white rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in-95">
            <h2 className="text-2xl font-black uppercase mb-6 tracking-tighter">Enroll Staff</h2>
            <input 
              autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Full Name"
              className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-black text-md mb-6 focus:ring-4 focus:ring-blue-100 transition-all outline-none"
              onKeyDown={(e) => e.key === 'Enter' && addStaff()}
            />
            <div className="flex gap-3">
              <button onClick={() => setShowAddModal(false)} className="flex-1 py-4 bg-gray-100 rounded-xl font-black text-[10px] uppercase text-gray-400">Cancel</button>
              <button onClick={addStaff} disabled={isSaving} className="flex-1 py-4 bg-gray-900 rounded-xl font-black text-[10px] uppercase text-white shadow-xl disabled:bg-gray-400">
                {isSaving ? 'Saving...' : 'Enroll'}
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