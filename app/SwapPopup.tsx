'use client';

import { useState } from 'react';
import { ArrowLeftRight, Check, X, Clock } from 'lucide-react';
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
  const [loading, setLoading] = useState<string | null>(null);
  const [groupIndex, setGroupIndex] = useState(0);
  const [confirm, setConfirm] = useState<'accept' | 'decline' | null>(null);

  // Group swaps by requester
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
  const sortedDates = [...group].sort((a, b) => a.date.localeCompare(b.date));

  const nextGroup = () => {
    if (groupIndex < grouped.length - 1) setGroupIndex(i => i + 1);
    else onDismiss();
  };

  const handleAccept = async () => {
    setLoading('accept');
    await supabase.from('day_assignments').insert(
      group.map(swap => ({
        date: swap.date,
        staff_id: myProfile.id,
        replaced_staff_id: swap.user_id,
      }))
    );
    await supabase.from('shift_requests').update({ status: 'approved' })
      .in('id', group.map(s => s.id));
    await onUpdate();
    nextGroup();
    setLoading(null);
  };

  const handleDecline = async () => {
    setLoading('decline');
    await supabase.from('shift_requests').update({ status: 'denied' })
      .in('id', group.map(s => s.id));
    await onUpdate();
    nextGroup();
    setLoading(null);
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 isolate">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />
      <div className="relative w-full max-w-sm bg-white rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in-95">
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

        <div className="bg-gray-50 rounded-[1.5rem] p-5 mb-5 space-y-2">
          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">From</p>
          <p className="font-black text-lg uppercase tracking-tight">{requester?.full_name || 'Unknown'}</p>
          {group[0].reason && <p className="text-xs text-gray-500 italic">"{group[0].reason}"</p>}
        </div>

        <div className="mb-5">
          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">
            {sortedDates.length === 1 ? 'Day requested' : `${sortedDates.length} days requested`}
          </p>
          <div className="flex flex-wrap gap-2">
            {sortedDates.map(s => (
              <span key={s.date} className="px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-xl text-[10px] font-black uppercase text-blue-700">
                {format(parseISO(s.date), 'EEE, MMM d')}
              </span>
            ))}
          </div>
        </div>

        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-6">
          Accepting means you will cover {requester?.full_name?.split(' ')[0]} on {sortedDates.length === 1 ? 'this day' : 'all these days'}.
        </p>

        <div className="flex flex-col gap-2">
          {confirm ? (
            <div className="space-y-2">
              <p className="text-center text-[10px] font-black uppercase tracking-widest text-gray-500">
                {confirm === 'accept' ? 'Accept this swap?' : 'Decline this swap?'}
              </p>
              <div className="flex gap-2">
                <button onClick={() => setConfirm(null)} className="flex-1 py-4 bg-gray-100 rounded-xl font-black text-[10px] uppercase text-gray-400">
                  No, go back
                </button>
                <button
                  onClick={() => { setConfirm(null); confirm === 'accept' ? handleAccept() : handleDecline(); }}
                  disabled={!!loading}
                  className={`flex-1 py-4 rounded-xl font-black text-[10px] uppercase text-white disabled:bg-gray-300 ${confirm === 'accept' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-500 hover:bg-red-600'}`}
                >
                  {loading ? 'Saving...' : 'Yes, confirm'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setConfirm('decline')} className="flex-1 py-4 bg-gray-100 hover:bg-red-50 hover:text-red-600 rounded-xl font-black text-[10px] uppercase text-gray-500 flex items-center justify-center gap-2 transition-all">
                <X size={13} /> Decline
              </button>
              <button onClick={() => setConfirm('accept')} className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 rounded-xl font-black text-[10px] uppercase text-white flex items-center justify-center gap-2 transition-all">
                <Check size={13} /> Accept
              </button>
            </div>
          )}
          {!confirm && (
            <button onClick={nextGroup} className="w-full py-3 text-[9px] font-black uppercase tracking-widest text-gray-300 hover:text-gray-500 flex items-center justify-center gap-2 transition-colors">
              <Clock size={11} /> Decide Later
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
