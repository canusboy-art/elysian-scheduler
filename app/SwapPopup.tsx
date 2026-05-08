'use client';

import { useState } from 'react';
import { ArrowLeftRight, Check, X, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { format } from 'date-fns';

interface Props {
  pendingSwaps: any[];
  roster: any[];
  myProfile: any;
  onDismiss: () => void;
  onUpdate: () => void;
}

export default function SwapPopup({ pendingSwaps, roster, myProfile, onDismiss, onUpdate }: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const [index, setIndex] = useState(0);

  const swap = pendingSwaps[index];
  if (!swap) return null;

  const requester = roster.find(r => r.id === swap.user_id);

  const next = () => {
    if (index < pendingSwaps.length - 1) setIndex(i => i + 1);
    else onDismiss();
  };

  const handleAccept = async () => {
    setLoading('accept');
    await supabase.from('day_assignments').insert([{
      date: swap.date,
      staff_id: myProfile.id,
      replaced_staff_id: swap.user_id,
    }]);
    await supabase.from('shift_requests').update({ status: 'approved' }).eq('id', swap.id);
    await onUpdate();
    next();
    setLoading(null);
  };

  const handleDecline = async () => {
    setLoading('decline');
    await supabase.from('shift_requests').update({ status: 'denied' }).eq('id', swap.id);
    await onUpdate();
    next();
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
              {pendingSwaps.length > 1 && (
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-0.5">{index + 1} of {pendingSwaps.length}</p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-gray-50 rounded-[1.5rem] p-5 mb-6 space-y-1">
          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">From</p>
          <p className="font-black text-lg uppercase tracking-tight">{requester?.full_name || 'Unknown'}</p>
          <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">
            {format(new Date(swap.date + 'T12:00:00'), 'EEEE, MMMM d')}
          </p>
          {swap.reason && <p className="text-xs text-gray-500 italic pt-1">"{swap.reason}"</p>}
        </div>

        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-6">
          If you accept, you will work on {format(new Date(swap.date + 'T12:00:00'), 'MMM d')} in place of {requester?.full_name?.split(' ')[0]}.
        </p>

        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <button onClick={handleDecline} disabled={!!loading}
              className="flex-1 py-4 bg-gray-100 hover:bg-red-50 hover:text-red-600 rounded-xl font-black text-[10px] uppercase text-gray-500 flex items-center justify-center gap-2 transition-all"
            >
              <X size={13} /> Decline
            </button>
            <button onClick={handleAccept} disabled={!!loading}
              className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 rounded-xl font-black text-[10px] uppercase text-white flex items-center justify-center gap-2 transition-all disabled:bg-gray-300"
            >
              <Check size={13} /> {loading === 'accept' ? 'Saving...' : 'Accept'}
            </button>
          </div>
          <button onClick={next} className="w-full py-3 text-[9px] font-black uppercase tracking-widest text-gray-300 hover:text-gray-500 flex items-center justify-center gap-2 transition-colors">
            <Clock size={11} /> Decide Later
          </button>
        </div>
      </div>
    </div>
  );
}
