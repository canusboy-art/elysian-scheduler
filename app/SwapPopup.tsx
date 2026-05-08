'use client';

import { useState } from 'react';
import { ArrowLeftRight, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { format, parseISO } from 'date-fns';

interface Props {
  pendingSwaps: any[];
  roster: any[];
  myProfile: any;
  onDismiss: () => void;
  onUpdate: () => Promise<void>;
}

export default function SwapPopup({ pendingSwaps, roster, myProfile, onDismiss, onUpdate }: Props) {
  const [groupIndex, setGroupIndex] = useState(0);
  const [loadingDay, setLoadingDay] = useState<string | null>(null);
  const [confirmDay, setConfirmDay] = useState<{ id: string; action: 'accept' | 'decline' } | null>(null);
  const [dayStatuses, setDayStatuses] = useState<Record<string, string>>({});

  const grouped = Object.values(
    pendingSwaps.reduce((acc: any, swap: any) => {
      if (!acc[swap.user_id]) acc[swap.user_id] = [];
      acc[swap.user_id].push(swap);
      return acc;
    }, {})
  ) as any[][];

  const group = grouped[groupIndex];
  if (!group) return null;

  const requester = roster.find(r => r.id === group[0].user_id);
  const sortedDays = [...group].sort((a, b) => a.date.localeCompare(b.date));

  const nextGroup = async () => {
    await onUpdate();
    if (groupIndex < grouped.length - 1) setGroupIndex(i => i + 1);
    else onDismiss();
  };

  const decideDay = async (swap: any, action: 'accept' | 'decline') => {
    setLoadingDay(swap.id);
    setConfirmDay(null);
    if (action === 'accept') {
      await supabase.from('day_assignments').insert([{
        date: swap.date,
        staff_id: myProfile.id,
        replaced_staff_id: swap.user_id,
      }]);
    }
    await supabase.from('shift_requests').update({
      status: action === 'accept' ? 'approved' : 'denied',
    }).eq('id', swap.id);
    const newStatuses: Record<string, string> = { ...dayStatuses, [String(swap.id)]: action === 'accept' ? 'approved' : 'denied' };
    setDayStatuses(newStatuses);
    setLoadingDay(null);
    // Move on if all days decided
    const allDecided = group.every((s: any) => newStatuses[String(s.id)]);
    if (allDecided) await nextGroup();
  };

  const pendingCount = sortedDays.filter(s => !dayStatuses[s.id]).length;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 isolate">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />
      <div className="relative w-full max-w-sm bg-white rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-2xl flex items-center justify-center">
              <ArrowLeftRight size={18} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tighter leading-none">Swap Request</h2>
              {grouped.length > 1 && (
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-0.5">{groupIndex + 1} of {grouped.length}</p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-gray-50 rounded-[1.5rem] p-4 mb-5 space-y-1">
          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">From</p>
          <p className="font-black text-lg uppercase tracking-tight">{requester?.full_name || 'Unknown'}</p>
          {group[0].reason && <p className="text-xs text-gray-500 italic">"{group[0].reason}"</p>}
        </div>

        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-3">
          Decide per day — {pendingCount} remaining
        </p>

        <div className="space-y-2 mb-6">
          {sortedDays.map(swap => {
            const decided = dayStatuses[swap.id];
            const isConfirming = confirmDay?.id === swap.id;
            const isLoading = loadingDay === swap.id;
            return (
              <div key={swap.id} className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${decided === 'approved' ? 'bg-green-50 border-green-200' : decided === 'denied' ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
                <span className="text-[11px] font-black uppercase tracking-widest text-gray-700">
                  {format(parseISO(swap.date), 'EEE, MMM d')}
                </span>
                {decided ? (
                  <span className={`text-[9px] font-black uppercase ${decided === 'approved' ? 'text-green-600' : 'text-red-500'}`}>
                    {decided === 'approved' ? '✓ Accepted' : '✕ Declined'}
                  </span>
                ) : isConfirming ? (
                  <div className="flex gap-1 items-center">
                    <span className="text-[9px] font-black text-gray-400 uppercase mr-1">Sure?</span>
                    <button onClick={() => setConfirmDay(null)} className="px-2.5 py-1.5 bg-white border border-gray-200 rounded-xl font-black text-[9px] uppercase text-gray-400">No</button>
                    <button
                      onClick={() => decideDay(swap, confirmDay.action)}
                      disabled={!!isLoading}
                      className={`px-2.5 py-1.5 rounded-xl font-black text-[9px] uppercase text-white ${confirmDay.action === 'accept' ? 'bg-blue-600' : 'bg-red-500'}`}
                    >Yes</button>
                  </div>
                ) : (
                  <div className="flex gap-1">
                    <button
                      onClick={() => setConfirmDay({ id: swap.id, action: 'decline' })}
                      disabled={!!isLoading}
                      className="px-2.5 py-1.5 bg-white border border-gray-200 rounded-xl font-black text-[9px] uppercase text-gray-400 hover:text-red-500 hover:border-red-200 transition-all"
                    >✕</button>
                    <button
                      onClick={() => setConfirmDay({ id: swap.id, action: 'accept' })}
                      disabled={!!isLoading}
                      className="px-2.5 py-1.5 bg-blue-600 text-white rounded-xl font-black text-[9px] uppercase hover:bg-blue-700 transition-all"
                    >✓</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button onClick={nextGroup} className="w-full py-3 text-[9px] font-black uppercase tracking-widest text-gray-300 hover:text-gray-500 flex items-center justify-center gap-2 transition-colors">
          <Clock size={11} /> Decide Later
        </button>
      </div>
    </div>
  );
}
