'use client';

import { useEffect, useState } from 'react';
import { X, ArrowLeftRight, UserMinus, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { format, parseISO, isBefore, startOfDay } from 'date-fns';

interface Props {
  dateStr: string;
  isWorkingThisDay: boolean;
  myProfile: any;
  scheduledStaff: any[];
  allStaff: any[];
  acceptedSwaps: any[];
  onClose: () => void;
  onUpdate: () => void;
}

export default function WorkerDayPanel({ dateStr, isWorkingThisDay, myProfile, scheduledStaff, allStaff, acceptedSwaps, onClose, onUpdate }: Props) {
  const [view, setView] = useState<'main' | 'timeoff' | 'swap'>('main');
  const [reason, setReason] = useState('');
  const [selectedPerson, setSelectedPerson] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [openShifts, setOpenShifts] = useState<any[]>([]);
  const [existingRequest, setExistingRequest] = useState<any | null>(null);
  const [mySlotNote, setMySlotNote] = useState<string | null>(null);

  useEffect(() => {
    const myDiscipline = myProfile.is_pt ? 'PT' : myProfile.is_ot ? 'OT' : 'ST';
    supabase.from('shifts').select('*').eq('date', dateStr).eq('status', 'vacant').eq('discipline', myDiscipline)
      .then(({ data }) => setOpenShifts(data || []));
    supabase.from('shift_requests').select('*')
      .eq('user_id', myProfile.id).eq('date', dateStr).in('status', ['pending', 'approved'])
      .then(({ data }) => setExistingRequest(data?.[0] || null));
    // Check if worker signed up for an open slot on this day
    supabase.from('shift_assignments').select('*').eq('user_id', myProfile.id)
      .then(async ({ data: assignments }) => {
        if (!assignments?.length) return;
        const { data: slots } = await supabase.from('shifts').select('*')
          .in('id', assignments.map(a => a.shift_id)).eq('date', dateStr);
        if (slots?.length) setMySlotNote(slots[0].admin_note || null);
      });
  }, [dateStr, myProfile.id]);

  const isPast = isBefore(parseISO(dateStr), startOfDay(new Date()));
  const coveringFor = acceptedSwaps.find(s => s.date === dateStr);
  const coveringPerson = coveringFor ? allStaff.find(s => s.id === coveringFor.user_id) : null;

  const eligibleSwaps = allStaff.filter(s => {
    const alreadyWorking = scheduledStaff.some(ss => ss.id === s.id);
    const matchesDiscipline = (myProfile.is_pt && s.is_pt) || (myProfile.is_ot && s.is_ot) || (myProfile.is_st && s.is_st);
    return !alreadyWorking && matchesDiscipline && s.id !== myProfile.id;
  });

  const handleTimeOffRequest = async () => {
    setLoading(true);
    await supabase.from('shift_requests').insert([{
      user_id: myProfile.id, date: dateStr, type: 'petition_off', status: 'pending', reason: reason || null,
    }]);
    await onUpdate();
    onClose();
    setLoading(false);
  };

  const handleSwapRequest = async () => {
    if (!selectedPerson) return;
    setLoading(true);
    await supabase.from('shift_requests').insert([{
      user_id: myProfile.id, target_user_id: selectedPerson.id,
      date: dateStr, type: 'swap', status: 'pending', reason: reason || null,
    }]);
    await onUpdate();
    onClose();
    setLoading(false);
  };

  const handleSignUp = async (shiftId: string) => {
    setLoading(true);
    await supabase.from('shift_assignments').insert([{ shift_id: shiftId, user_id: myProfile.id }]);
    await supabase.from('day_assignments').insert([{ date: dateStr, staff_id: myProfile.id, replaced_staff_id: null }]);
    await supabase.from('shifts').update({ status: 'filled' }).eq('id', shiftId);
    await onUpdate();
    onClose();
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[999] flex justify-end isolate">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 border-l">
        <header className="p-10 border-b bg-gray-900 text-white flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-black uppercase tracking-tighter leading-none">
              {format(new Date(dateStr + 'T12:00:00'), 'EEEE')}
            </h2>
            <p className="text-[10px] font-black text-blue-400 uppercase mt-3 tracking-[0.3em]">
              {format(new Date(dateStr + 'T12:00:00'), 'MMMM d, yyyy')}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-all"><X size={32} /></button>
        </header>

        {view === 'main' && (
          <div className="flex-1 p-10 space-y-4">
            {existingRequest && (
              <div className="p-5 bg-orange-50 border border-orange-100 rounded-[1.5rem]">
                <p className="text-xs font-black uppercase tracking-widest text-orange-600">
                  {existingRequest.type === 'petition_off' ? 'Time off request' : 'Swap request'} — {existingRequest.status}
                </p>
              </div>
            )}

            {isWorkingThisDay ? (
              <>
                <div className="p-5 bg-emerald-50 border border-emerald-100 rounded-[1.5rem] space-y-1">
                  <p className="text-xs font-black uppercase tracking-widest text-emerald-700">You are scheduled this day</p>
                  {coveringPerson && (
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">
                      Covering for {coveringPerson.full_name}
                    </p>
                  )}
                  {mySlotNote && (
                    <p className="text-xs text-emerald-600 italic border-t border-emerald-200 pt-2 mt-2">📋 {mySlotNote}</p>
                  )}
                </div>
                {!existingRequest && (
                  isPast ? (
                    <div className="p-5 bg-gray-50 border border-gray-100 rounded-[1.5rem]">
                      <p className="text-xs font-black uppercase tracking-widest text-gray-400">Requests cannot be made for past days</p>
                    </div>
                  ) : (
                    <>
                      <button onClick={() => setView('swap')} className="w-full p-6 bg-white border-2 border-gray-100 hover:border-blue-200 hover:bg-blue-50 rounded-[2rem] font-black uppercase text-sm flex items-center gap-4 transition-all group">
                        <ArrowLeftRight size={20} className="text-blue-400" />
                        <div className="text-left">
                          <p className="group-hover:text-blue-600 transition-colors">Request Swap</p>
                          <p className="text-[9px] text-gray-400 font-medium normal-case">Ask someone to cover your shift</p>
                        </div>
                      </button>
                      <button onClick={() => setView('timeoff')} className="w-full p-6 bg-white border-2 border-gray-100 hover:border-red-200 hover:bg-red-50 rounded-[2rem] font-black uppercase text-sm flex items-center gap-4 transition-all group">
                        <UserMinus size={20} className="text-red-400" />
                        <div className="text-left">
                          <p className="group-hover:text-red-600 transition-colors">Request Time Off</p>
                          <p className="text-[9px] text-gray-400 font-medium normal-case">Send to your scheduler for approval</p>
                        </div>
                      </button>
                    </>
                  )
                )}
              </>
            ) : (
              <>
                <div className="p-5 bg-gray-50 border border-gray-100 rounded-[1.5rem]">
                  <p className="text-xs font-black uppercase tracking-widest text-gray-400">You are not scheduled this day</p>
                </div>
                {isPast ? (
                    <div className="p-5 bg-gray-50 border border-gray-100 rounded-[1.5rem]">
                      <p className="text-xs font-black uppercase tracking-widest text-gray-400">Cannot sign up for past days</p>
                    </div>
                  ) : openShifts.length > 0 ? (
                  <div className="space-y-3">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Open Slots</p>
                    {openShifts.map(shift => (
                      <button key={shift.id} onClick={() => handleSignUp(shift.id)} disabled={loading}
                        className="w-full p-6 bg-white border-2 border-gray-100 hover:border-emerald-200 hover:bg-emerald-50 rounded-[2rem] font-black uppercase text-sm flex items-center justify-between transition-all group"
                      >
                        <div className="flex items-center gap-4">
                          <Plus size={20} className="text-emerald-500" />
                          <span>{shift.admin_note || 'Open Shift'}</span>
                        </div>
                        <span className="text-[10px] text-emerald-600 opacity-0 group-hover:opacity-100 tracking-widest">Sign Up →</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="py-20 text-center border-2 border-dashed border-gray-100 rounded-[2rem]">
                    <p className="text-xs font-black text-gray-300 uppercase tracking-widest">No open slots this day</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {view === 'timeoff' && (
          <div className="flex-1 p-10 flex flex-col">
            <button onClick={() => setView('main')} className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-8 text-left hover:text-gray-600 transition-colors">← Back</button>
            <h3 className="text-2xl font-black uppercase tracking-tighter mb-1">Request Time Off</h3>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-8">
              {format(new Date(dateStr + 'T12:00:00'), 'EEEE, MMMM d')}
            </p>
            <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason (optional)" rows={4}
              className="w-full p-4 bg-gray-50 rounded-2xl text-sm text-gray-900 placeholder:text-gray-400 resize-none outline-none focus:ring-4 focus:ring-blue-100 transition-all mb-3"
            />
            <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest mb-6">This will be reviewed by your scheduler.</p>
            <div className="flex gap-3 mt-auto">
              <button onClick={() => setView('main')} className="flex-1 py-4 bg-gray-100 rounded-xl font-black text-[10px] uppercase text-gray-400">Cancel</button>
              <button onClick={handleTimeOffRequest} disabled={loading} className="flex-1 py-4 bg-gray-900 rounded-xl font-black text-[10px] uppercase text-white shadow-xl disabled:bg-gray-300">
                {loading ? 'Sending...' : 'Submit Request'}
              </button>
            </div>
          </div>
        )}

        {view === 'swap' && (
          <div className="flex-1 p-10 flex flex-col overflow-hidden">
            <button onClick={() => setView('main')} className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-8 text-left hover:text-gray-600 transition-colors">← Back</button>
            <h3 className="text-2xl font-black uppercase tracking-tighter mb-1">Request Swap</h3>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
              {format(new Date(dateStr + 'T12:00:00'), 'EEEE, MMMM d')}
            </p>
            <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest mb-6">Select someone to cover your shift — they will be notified.</p>
            <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1">
              {eligibleSwaps.length === 0 ? (
                <div className="py-20 text-center border-2 border-dashed border-gray-100 rounded-[2rem]">
                  <p className="text-xs font-black text-gray-300 uppercase tracking-widest">No available staff to swap with</p>
                </div>
              ) : eligibleSwaps.map(s => (
                <button key={s.id} onClick={() => setSelectedPerson(selectedPerson?.id === s.id ? null : s)}
                  className={`w-full text-left p-5 border-2 rounded-[2rem] font-black uppercase text-sm flex justify-between items-center transition-all ${selectedPerson?.id === s.id ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-white border-gray-100 hover:border-blue-200'}`}
                >
                  {s.full_name}
                  {selectedPerson?.id === s.id && <span className="text-[10px] tracking-widest">Selected ✓</span>}
                </button>
              ))}
            </div>
            {selectedPerson && (
              <>
                <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Message to them (optional)" rows={2}
                  className="w-full p-4 bg-gray-50 rounded-2xl text-sm text-gray-900 placeholder:text-gray-400 resize-none outline-none mb-4"
                />
                <div className="flex gap-3">
                  <button onClick={() => setSelectedPerson(null)} className="flex-1 py-4 bg-gray-100 rounded-xl font-black text-[10px] uppercase text-gray-400">Cancel</button>
                  <button onClick={handleSwapRequest} disabled={loading} className="flex-1 py-4 bg-blue-600 rounded-xl font-black text-[10px] uppercase text-white shadow-xl disabled:bg-gray-300">
                    {loading ? 'Sending...' : 'Send Request'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
