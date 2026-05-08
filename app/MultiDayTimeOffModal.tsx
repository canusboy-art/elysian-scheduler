'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { format, parseISO } from 'date-fns';

interface Props {
  selectedDates: string[];
  myProfile: any;
  onClose: () => void;
  onUpdate: () => Promise<void>;
}

export default function MultiDayTimeOffModal({ selectedDates, myProfile, onClose, onUpdate }: Props) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    await supabase.from('shift_requests').insert(
      selectedDates.map(date => ({
        user_id: myProfile.id,
        date,
        type: 'petition_off',
        status: 'pending',
        reason: reason || null,
      }))
    );
    await onUpdate();
    onClose();
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-6 isolate">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in-95">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tighter">Request Time Off</h2>
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-1">{selectedDates.length} {selectedDates.length === 1 ? 'day' : 'days'} selected</p>
          </div>
          <button onClick={onClose} className="p-2 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all"><X size={18} /></button>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {[...selectedDates].sort().map(d => (
            <span key={d} className="px-3 py-1.5 bg-orange-50 border border-orange-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-orange-700">
              {format(parseISO(d), 'EEE, MMM d')}
            </span>
          ))}
        </div>

        <textarea value={reason} onChange={e => setReason(e.target.value)}
          placeholder="Reason (optional)" rows={3}
          className="w-full p-4 bg-gray-50 rounded-2xl text-sm text-gray-900 placeholder:text-gray-400 resize-none outline-none focus:ring-4 focus:ring-orange-100 transition-all mb-3"
        />
        <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest mb-6">These will be sent to your scheduler for approval.</p>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-4 bg-gray-100 rounded-xl font-black text-[10px] uppercase text-gray-400">Cancel</button>
          <button onClick={handleSubmit} disabled={loading}
            className="flex-1 py-4 bg-orange-500 rounded-xl font-black text-[10px] uppercase text-white shadow-xl disabled:bg-gray-300 transition-all"
          >
            {loading ? 'Sending...' : 'Submit Request'}
          </button>
        </div>
      </div>
    </div>
  );
}
