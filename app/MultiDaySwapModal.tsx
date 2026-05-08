'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { format, parseISO } from 'date-fns';

interface Props {
  selectedDates: string[];
  myProfile: any;
  eligibleStaff: any[];
  onClose: () => void;
  onUpdate: () => Promise<void>;
}

export default function MultiDaySwapModal({ selectedDates, myProfile, eligibleStaff, onClose, onUpdate }: Props) {
  const [selectedPerson, setSelectedPerson] = useState<any | null>(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!selectedPerson) return;
    setLoading(true);
    await supabase.from('shift_requests').insert(
      selectedDates.map(date => ({
        user_id: myProfile.id,
        target_user_id: selectedPerson.id,
        date,
        type: 'swap',
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
      <div className="relative w-full max-w-md bg-white rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tighter">Request Swap</h2>
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-1">{selectedDates.length} {selectedDates.length === 1 ? 'day' : 'days'} selected</p>
          </div>
          <button onClick={onClose} className="p-2 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all"><X size={18} /></button>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {[...selectedDates].sort().map(d => (
            <span key={d} className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-emerald-700">
              {format(parseISO(d), 'EEE, MMM d')}
            </span>
          ))}
        </div>

        <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest mb-4">
          Select someone available for all selected days
        </p>

        <div className="space-y-2 mb-6 max-h-52 overflow-y-auto pr-1">
          {eligibleStaff.length === 0 ? (
            <div className="py-10 text-center border-2 border-dashed border-gray-100 rounded-[2rem]">
              <p className="text-xs font-black text-gray-300 uppercase tracking-widest">No one available for all selected days</p>
            </div>
          ) : eligibleStaff.map(s => (
            <button key={s.id} onClick={() => setSelectedPerson(selectedPerson?.id === s.id ? null : s)}
              className={`w-full text-left p-4 border-2 rounded-2xl font-black uppercase text-sm flex justify-between items-center transition-all ${selectedPerson?.id === s.id ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-white border-gray-100 hover:border-blue-200'}`}
            >
              {s.full_name}
              {selectedPerson?.id === s.id && <span className="text-[10px] tracking-widest">Selected ✓</span>}
            </button>
          ))}
        </div>

        {selectedPerson && (
          <textarea value={reason} onChange={e => setReason(e.target.value)}
            placeholder="Message to them (optional)" rows={2}
            className="w-full p-4 bg-gray-50 rounded-2xl text-sm text-gray-900 placeholder:text-gray-400 resize-none outline-none mb-4"
          />
        )}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-4 bg-gray-100 rounded-xl font-black text-[10px] uppercase text-gray-400">Cancel</button>
          <button onClick={handleSubmit} disabled={!selectedPerson || loading}
            className="flex-1 py-4 bg-blue-600 rounded-xl font-black text-[10px] uppercase text-white shadow-xl disabled:bg-gray-300 transition-all"
          >
            {loading ? 'Sending...' : 'Send Request'}
          </button>
        </div>
      </div>
    </div>
  );
}
