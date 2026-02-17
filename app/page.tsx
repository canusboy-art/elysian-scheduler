'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { 
  format, startOfMonth, endOfMonth, eachDayOfInterval, subMonths, addMonths, 
  isSameDay, isSameMonth, startOfWeek, endOfWeek, parseISO, getDay, addDays 
} from 'date-fns';
import { ChevronLeft, ChevronRight, Activity, CheckCircle2, Target } from 'lucide-react';
import DayDetailPanel from './DayDetailPanel';
import Link from 'next/link';

function CalendarContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const monthParam = searchParams.get('m');
  const referenceDate = monthParam ? parseISO(monthParam) : new Date();

  const [shifts, setShifts] = useState<any[]>([]);
  const [roster, setRoster] = useState<any[]>([]);
  const [overrides, setOverrides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const { data: shiftData } = await supabase.from('shifts').select('*');
    const { data: staffData } = await supabase.from('profiles').select('*');
    const { data: overrideData } = await supabase.from('day_assignments').select('*');
    
    setShifts(shiftData || []);
    setRoster(staffData || []);
    setOverrides(overrideData || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getStaffForDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00');
    const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const dayName = days[getDay(date)]; 
    
    let baseStaff = roster.filter((staff: any) => staff[`works_${dayName}`]);
    const dayOverrides = overrides.filter(o => o.date === dateStr);
    
    if (dayOverrides.length > 0) {
      dayOverrides.forEach(ov => {
        if (ov.replaced_staff_id) {
          baseStaff = baseStaff.filter(s => s.id !== ov.replaced_staff_id);
        }
        const newPerson = roster.find(r => r.id === ov.staff_id);
        if (newPerson && !baseStaff.find(s => s.id === newPerson.id)) {
          baseStaff.push(newPerson);
        }
      });
    }
    return baseStaff;
  };

  const navigateMonth = (direction: 'next' | 'prev' | 'today') => {
    let newDate = new Date();
    if (direction === 'next') newDate = addMonths(referenceDate, 1);
    if (direction === 'prev') newDate = subMonths(referenceDate, 1);
    router.push(`/?m=${format(newDate, 'yyyy-MM-dd')}`);
  };

  const getDisplayDays = () => {
    const start = startOfWeek(startOfMonth(referenceDate));
    const days = eachDayOfInterval({ start, end: addDays(start, 41) });
    return days.map(d => format(d, 'yyyy-MM-dd'));
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-white font-black uppercase text-3xl italic tracking-tighter">Syncing Archive...</div>;

  return (
    <main className="flex h-screen w-full bg-white overflow-hidden text-black font-sans isolate">
      <section className="w-[72%] h-full flex flex-col border-r border-gray-100">
        <header className="h-20 flex-none border-b flex justify-between items-center px-10 bg-white">
          <div className="flex items-center gap-10">
            <h1 className="text-2xl font-black italic tracking-tighter border-l-8 border-blue-600 pl-4 uppercase">Elysian Scheduler</h1>
            <nav className="flex gap-6 ml-6 border-l-2 pl-8">
              <Link href={`/roster?m=${format(referenceDate, 'yyyy-MM-dd')}`} className="text-[10px] font-black uppercase text-gray-400 hover:text-blue-600 transition-all">Manage Master Roster</Link>
            </nav>
          </div>
          <div className="flex items-center gap-6">
            <button onClick={() => navigateMonth('today')} className="flex items-center gap-2 px-5 py-2 bg-blue-50 text-blue-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-100 transition-all active:scale-95"><Target size={14} /> Today</button>
            <div className="flex items-center bg-gray-50 rounded-2xl p-1 border">
              <button onClick={() => navigateMonth('prev')} className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all"><ChevronLeft size={18} /></button>
              <span className="text-[11px] font-black uppercase tracking-[0.2em] px-6 min-w-[160px] text-center">{format(referenceDate, 'MMMM yyyy')}</span>
              <button onClick={() => navigateMonth('next')} className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all"><ChevronRight size={18} /></button>
            </div>
          </div>
        </header>

        <div className="flex-1 p-4 bg-gray-50/20 overflow-hidden flex flex-col">
          <div className="grid grid-cols-7 h-8 mb-2 flex-none">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">{day}</div>
            ))}
          </div>
          <div className="flex-1 grid grid-cols-7 grid-rows-6 gap-2 h-full">
            {getDisplayDays().map((dateStr) => {
              const scheduledStaff = getStaffForDate(dateStr);
              const isToday = isSameDay(new Date(dateStr + 'T12:00:00'), new Date());
              const isCurrentMonth = isSameMonth(new Date(dateStr + 'T12:00:00'), referenceDate);
              const hasOverride = overrides.some(o => o.date === dateStr);
              
              const ptCount = scheduledStaff.filter(s => s.is_pt).length;
              const otCount = scheduledStaff.filter(s => s.is_ot).length;
              const stCount = scheduledStaff.filter(s => s.is_st).length;

              return (
                <div key={dateStr} onClick={() => setSelectedDate(dateStr)} className={`border-2 transition-all cursor-pointer bg-white relative rounded-[1.2rem] p-3 flex flex-col items-center justify-center gap-1 ${dateStr === selectedDate ? 'ring-4 ring-blue-500/10 border-blue-600 shadow-xl z-10' : 'border-gray-50 hover:border-blue-200'} ${isToday ? 'bg-blue-50/40 border-blue-200' : ''} ${!isCurrentMonth ? 'opacity-20 grayscale' : 'opacity-100'}`}>
                  <span className={`text-[11px] font-black uppercase absolute top-3 left-3 leading-none ${isToday ? 'text-blue-600' : 'text-gray-300'}`}>{format(new Date(dateStr + 'T12:00:00'), 'd')}</span>
                  {hasOverride && <div className="absolute top-3 right-3 w-1.5 h-1.5 bg-blue-600 rounded-full shadow-glow" />}
                  <div className="flex flex-col gap-1 w-full max-w-[75px]">
                    <div className={`flex justify-between px-2 py-1 rounded-md border font-black text-[8px] ${ptCount === 0 ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-700'}`}><span>PT</span> <span>{ptCount}</span></div>
                    <div className={`flex justify-between px-2 py-1 rounded-md border font-black text-[8px] ${otCount === 0 ? 'bg-red-50 text-red-500' : 'bg-purple-50 text-purple-700'}`}><span>OT</span> <span>{otCount}</span></div>
                    <div className={`flex justify-between px-2 py-1 rounded-md border font-black text-[8px] ${stCount === 0 ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-700'}`}><span>ST</span> <span>{stCount}</span></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <aside className="w-[28%] h-full flex flex-col bg-white border-l shadow-2xl relative z-20">
        <header className="h-20 flex-none p-6 border-b flex justify-between items-center bg-gray-900 text-white"><h2 className="text-md font-black uppercase tracking-widest flex items-center gap-3"><Activity size={22} className="text-blue-400" /> Triage</h2></header>
        <div className="flex-1 p-6 flex flex-col items-center justify-center text-gray-300 gap-4 opacity-40"><CheckCircle2 size={60} /><p className="text-xs font-black uppercase tracking-widest">Balanced</p></div>
      </aside>

      {selectedDate && (
        <DayDetailPanel 
          shift={shifts.find(s => s.date === selectedDate) || { date: selectedDate }} 
          scheduledStaff={getStaffForDate(selectedDate)} 
          allStaff={roster || []} // Fallback to empty array
          onClose={() => setSelectedDate(null)} 
          onUpdate={() => fetchData()} 
        />
      )}
    </main>
  );
}

export default function CommandCenter() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center font-black uppercase text-2xl tracking-tighter">Loading Archive...</div>}>
      <CalendarContent />
    </Suspense>
  );
}