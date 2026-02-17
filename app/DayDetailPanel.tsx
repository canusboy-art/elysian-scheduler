'use client';

import { useState } from 'react';
import { X, StickyNote, Activity, RefreshCcw, ArrowRightLeft } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

interface Props {
  shift: any;
  scheduledStaff: any[];
  allStaff: any[];
  onClose: () => void;
  onUpdate: () => void;
}

export default function DayDetailPanel({ shift, scheduledStaff, allStaff, onClose, onUpdate }: Props) {
  const [loading, setLoading] = useState(false);
  const [showReplaceModal, setShowReplaceModal] = useState<any | null>(null);

  async function resetDay() {
    if (!confirm("Reset to Master Roster? This will remove all manual swaps for this day.")) return;
    setLoading(true);
    await supabase.from('day_assignments').delete().eq('date', shift.date);
    onUpdate();
    setLoading(false);
  }

  async function handleSwap(replacedId: string, newId: string) {
    setLoading(true);
    const { error } = await supabase.from('day_assignments').insert([{
      date: shift.date,
      staff_id: newId,
      replaced_staff_id: replacedId
    }]);
    
    if (!error) {
      setShowReplaceModal(null);
      onUpdate();
    }
    setLoading(false);
  }

  // Group staff by discipline
  const pts = (scheduledStaff || []).filter(s => s.is_pt);
  const ots = (scheduledStaff || []).filter(s => s.is_ot);
  const sts = (scheduledStaff || []).filter(s => s.is_st);

  /**
   * FILTER LOGIC:
   * Only show staff from allStaff who:
   * 1. Are NOT already working that day
   * 2. Share the same discipline as the person being replaced
   */
  const getEligibleReplacements = (targetStaff: any) => {
    return (allStaff || []).filter(s => {
      const isAlreadyWorking = (scheduledStaff || []).some(ss => ss.id === s.id);
      const matchesDiscipline = 
        (targetStaff.is_pt && s.is_pt) || 
        (targetStaff.is_ot && s.is_ot) || 
        (targetStaff.is_st && s.is_st);
      
      return !isAlreadyWorking && matchesDiscipline;
    });
  };

  return (
    <div className="fixed inset-0 z-[999] flex justify-end isolate">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />
      
      <div className="relative w-full max-w-xl bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 border-l">
        <header className="p-10 border-b bg-gray-900 text-white flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-black uppercase tracking-tighter leading-none">Daily Roster</h2>
            <p className="text-[10px] font-black text-blue-400 uppercase mt-3 tracking-[0.3em]">{shift.date}</p>
          </div>
          <div className="flex gap-4">
            <button onClick={resetDay} disabled={loading} className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-[10px] font-black uppercase transition-all disabled:opacity-50">
              <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} /> Reset Day
            </button>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-all"><X size={32} /></button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-10 space-y-12">
          {[
            { title: 'Physical Therapy', list: pts, color: 'text-blue-600', icon: 'P', bg: 'bg-blue-600' },
            { title: 'Occupational Therapy', list: ots, color: 'text-purple-600', icon: 'O', bg: 'bg-purple-600' },
            { title: 'Speech Therapy', list: sts, color: 'text-emerald-600', icon: 'S', bg: 'bg-emerald-600' }
          ].map((group) => (
            <section key={group.title} className="space-y-5">
              <h3 className={`text-xs font-black uppercase tracking-[0.3em] flex items-center gap-3 ${group.color}`}>
                <Activity size={18} /> {group.title}
              </h3>
              <div className="grid grid-cols-1 gap-3">
                {group.list.map(staff => (
                  <div key={staff.id} className="flex items-center justify-between p-5 bg-gray-50 rounded-[1.5rem] border border-gray-100 group transition-all hover:bg-white hover:shadow-md">
                    <div className="flex items-center gap-4">
                      <div className={`w-8 h-8 ${group.bg} rounded-xl flex items-center justify-center text-white font-black text-[10px]`}>{group.icon}</div>
                      <span className="font-black text-sm uppercase tracking-tight">{staff.full_name}</span>
                    </div>
                    <button 
                      onClick={() => setShowReplaceModal(staff)}
                      className="opacity-0 group-hover:opacity-100 flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 shadow-sm rounded-xl text-[9px] font-black uppercase text-gray-400 hover:text-blue-600 hover:border-blue-100 transition-all active:scale-95"
                    >
                      <ArrowRightLeft size={12} /> Replace
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* SWAP MODAL OVERLAY */}
        {showReplaceModal && (
          <div className="absolute inset-0 z-[1000] bg-white flex flex-col p-12 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start mb-12">
              <div>
                <h3 className="text-3xl font-black uppercase tracking-tighter">Swap Personnel</h3>
                <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mt-3">
                  Replacing {showReplaceModal.is_pt ? 'PT' : showReplaceModal.is_ot ? 'OT' : 'ST'}: {showReplaceModal.full_name}
                </p>
              </div>
              <button onClick={() => setShowReplaceModal(null)} className="p-3 bg-gray-50 hover:bg-gray-100 rounded-2xl transition-all"><X size={24} /></button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-4 custom-scrollbar">
              <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest mb-6">Eligible replacements in Archive</p>
              
              {getEligibleReplacements(showReplaceModal).length === 0 ? (
                <div className="py-20 text-center border-2 border-dashed border-gray-100 rounded-[2rem]">
                  <p className="text-xs font-black text-gray-300 uppercase tracking-widest">No other {showReplaceModal.is_pt ? 'PTs' : showReplaceModal.is_ot ? 'OTs' : 'STs'} available</p>
                </div>
              ) : (
                getEligibleReplacements(showReplaceModal).map(s => (
                  <button 
                    key={s.id} 
                    disabled={loading}
                    onClick={() => handleSwap(showReplaceModal.id, s.id)}
                    className="w-full text-left p-6 bg-white hover:bg-blue-50 border-2 border-gray-50 hover:border-blue-100 rounded-[2rem] font-black uppercase text-sm flex justify-between items-center group transition-all"
                  >
                    <span className="group-hover:text-blue-600 transition-colors">{s.full_name}</span>
                    <span className="text-[10px] text-blue-600 opacity-0 group-hover:opacity-100 tracking-widest transition-all">Select →</span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}