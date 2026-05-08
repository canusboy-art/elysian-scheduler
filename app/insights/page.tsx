'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import {
  format, parseISO, getDay, startOfMonth, endOfMonth,
  eachDayOfInterval, differenceInDays, addMonths, subMonths, addDays
} from 'date-fns';
import { ChevronLeft, ChevronRight, CalendarDays, Flame, MessageSquare, UserCheck } from 'lucide-react';

// ── US Federal Holidays ──────────────────────────────────────────
function nthWeekday(year: number, month: number, weekday: number, nth: number) {
  const d = new Date(year, month, 1);
  let count = 0;
  while (d.getMonth() === month) {
    if (d.getDay() === weekday) { count++; if (count === nth) return new Date(d); }
    d.setDate(d.getDate() + 1);
  }
  return null;
}
function lastWeekday(year: number, month: number, weekday: number) {
  const d = new Date(year, month + 1, 0);
  while (d.getDay() !== weekday) d.setDate(d.getDate() - 1);
  return new Date(d);
}
function getUSHolidays(year: number): { name: string; date: string }[] {
  const fmt = (d: Date | null) => d ? format(d, 'yyyy-MM-dd') : '';
  return [
    { name: "New Year's Day",       date: fmt(new Date(year, 0, 1)) },
    { name: 'MLK Day',              date: fmt(nthWeekday(year, 0, 1, 3)) },
    { name: "Presidents' Day",      date: fmt(nthWeekday(year, 1, 1, 3)) },
    { name: 'Memorial Day',         date: fmt(lastWeekday(year, 4, 1)) },
    { name: 'Juneteenth',           date: fmt(new Date(year, 5, 19)) },
    { name: 'Independence Day',     date: fmt(new Date(year, 6, 4)) },
    { name: 'Labor Day',            date: fmt(nthWeekday(year, 8, 1, 1)) },
    { name: 'Columbus Day',         date: fmt(nthWeekday(year, 9, 1, 2)) },
    { name: 'Veterans Day',         date: fmt(new Date(year, 10, 11)) },
    { name: 'Thanksgiving',         date: fmt(nthWeekday(year, 10, 4, 4)) },
    { name: 'Christmas',            date: fmt(new Date(year, 11, 25)) },
  ].filter(h => h.date !== '');
}

// ── Helpers ──────────────────────────────────────────────────────
function getStaffForDate(dateStr: string, roster: any[], overrides: any[]) {
  const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const dayName = days[getDay(new Date(dateStr + 'T12:00:00'))];
  let base = roster.filter(s => s[`works_${dayName}`]);
  overrides.filter(o => o.date === dateStr).forEach(ov => {
    if (ov.replaced_staff_id) base = base.filter(s => s.id !== ov.replaced_staff_id);
    const p = roster.find(r => r.id === ov.staff_id);
    if (p && !base.find(s => s.id === p.id)) base.push(p);
  });
  return base;
}

function maxConsecutiveDays(staffId: string, dates: string[], roster: any[], overrides: any[]) {
  let max = 0, run = 0;
  let prevDate: Date | null = null;
  for (const d of dates) {
    const working = getStaffForDate(d, roster, overrides).some(s => s.id === staffId);
    if (working) {
      const cur = new Date(d + 'T12:00:00');
      if (prevDate && differenceInDays(cur, prevDate) === 1) run++;
      else run = 1;
      max = Math.max(max, run);
      prevDate = cur;
    } else {
      prevDate = null;
    }
  }
  return max;
}

// ── Main Component ────────────────────────────────────────────────
function InsightsContent() {
  const { profile } = useAuth();
  const searchParams = useSearchParams();
  const monthParam = searchParams.get('m');
  const referenceDate = monthParam ? parseISO(monthParam + '-01') : new Date();

  const [roster, setRoster] = useState<any[]>([]);
  const [overrides, setOverrides] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [settings, setSettings] = useState({ min_prn_days: 4 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from('profiles').select('*'),
      supabase.from('day_assignments').select('*'),
      supabase.from('shift_requests').select('*'),
      supabase.from('settings').select('*').maybeSingle(),
    ]).then(([{ data: p }, { data: d }, { data: r }, { data: s }]) => {
      setRoster(p || []);
      setOverrides(d || []);
      setRequests(r || []);
      if (s) setSettings(s);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="h-screen flex items-center justify-center font-black uppercase text-2xl tracking-tighter">Loading Insights...</div>;
  if (profile?.role !== 'scheduler') return <div className="h-screen flex items-center justify-center font-black uppercase text-xl tracking-tighter text-gray-400">Schedulers Only</div>;

  const monthDates = eachDayOfInterval({
    start: startOfMonth(referenceDate),
    end: endOfMonth(referenceDate),
  }).map(d => format(d, 'yyyy-MM-dd'));

  const year = referenceDate.getFullYear();
  const holidays = getUSHolidays(year);

  // 1. Holiday coverage
  const holidayCoverage = holidays.map(h => ({
    ...h,
    staff: getStaffForDate(h.date, roster, overrides),
  }));

  // 2. Extended shifts (5+ consecutive days)
  const extendedShifts = roster
    .map(s => ({ ...s, maxRun: maxConsecutiveDays(s.id, monthDates, roster, overrides) }))
    .filter(s => s.maxRun >= 5)
    .sort((a, b) => b.maxRun - a.maxRun);

  // 3. Top requesters this month
  const monthStr = format(referenceDate, 'yyyy-MM');
  const monthRequests = requests.filter(r => r.date?.startsWith(monthStr) || r.created_at?.startsWith(monthStr));
  const requestCounts: Record<string, { swaps: number; timeoff: number; total: number }> = {};
  monthRequests.forEach(r => {
    if (!requestCounts[r.user_id]) requestCounts[r.user_id] = { swaps: 0, timeoff: 0, total: 0 };
    if (r.type === 'swap') requestCounts[r.user_id].swaps++;
    if (r.type === 'petition_off') requestCounts[r.user_id].timeoff++;
    requestCounts[r.user_id].total++;
  });
  const topRequesters = Object.entries(requestCounts)
    .map(([id, counts]) => ({ ...roster.find(s => s.id === id), ...counts }))
    .filter(s => s.full_name)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // 4. PRN utilization
  const prnStaff = roster.filter(s => s.is_prn);
  const prnUtilization = prnStaff.map(s => ({
    ...s,
    daysWorked: monthDates.filter(d => getStaffForDate(d, roster, overrides).some(ws => ws.id === s.id)).length,
  })).sort((a, b) => a.daysWorked - b.daysWorked);
  const underutilized = prnUtilization.filter(s => s.daysWorked < settings.min_prn_days);

  const monthNav = (dir: 'prev' | 'next') => {
    const newDate = dir === 'next' ? addMonths(referenceDate, 1) : subMonths(referenceDate, 1);
    window.history.pushState({}, '', `/insights?m=${format(newDate, 'yyyy-MM')}`);
    window.location.reload();
  };

  return (
    <main className="min-h-screen md:h-screen w-full bg-gray-50 text-black font-sans flex flex-col md:overflow-hidden">
      <header className="h-20 bg-white border-b flex items-center justify-between px-10">
        <div className="flex items-center gap-6">
          <Link href="/" className="p-3 bg-gray-50 rounded-2xl border hover:bg-white transition-all active:scale-95 shadow-sm">
            <ChevronLeft size={20} />
          </Link>
          <h1 className="text-2xl font-black uppercase tracking-tighter border-l-8 border-blue-600 pl-4">Staff Insights</h1>
        </div>
        <div className="flex items-center bg-gray-50 rounded-2xl p-1 border gap-1">
          <button onClick={() => monthNav('prev')} className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all"><ChevronLeft size={18} /></button>
          <span className="text-[11px] font-black uppercase tracking-[0.2em] px-6 min-w-[160px] text-center">{format(referenceDate, 'MMMM yyyy')}</span>
          <button onClick={() => monthNav('next')} className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all"><ChevronRight size={18} /></button>
        </div>
      </header>

      <div className="flex-1 md:overflow-hidden p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 md:grid-rows-2 gap-4">

        {/* Holiday Coverage */}
        <div className="bg-white rounded-[2rem] border border-gray-200 shadow-sm p-5 md:p-6 flex flex-col md:overflow-hidden">
          <div className="flex items-center gap-3 mb-4 flex-none">
            <div className="w-10 h-10 bg-red-50 rounded-2xl flex items-center justify-center"><CalendarDays size={18} className="text-red-500" /></div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest">Holiday Coverage</h2>
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{format(referenceDate, 'yyyy')} US Federal Holidays</p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto pr-1">
          {holidayCoverage.length === 0 ? (
            <p className="text-[10px] font-black uppercase text-gray-300 tracking-widest">No holidays this month</p>
          ) : (
            <div className="space-y-3">
              {holidayCoverage.map(h => (
                <div key={h.date} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-700">{h.name}</p>
                    <p className="text-[9px] font-black text-gray-400 uppercase">{format(parseISO(h.date), 'EEE, MMM d')}</p>
                  </div>
                  {h.staff.length === 0 ? (
                    <p className="text-[9px] font-black uppercase text-red-400 tracking-widest">No coverage</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {h.staff.map(s => (
                        <span key={s.id} className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide ${s.is_pt ? 'bg-blue-50 text-blue-700' : s.is_ot ? 'bg-purple-50 text-purple-700' : 'bg-emerald-50 text-emerald-700'}`}>
                          {s.full_name} · {s.is_pt ? 'PT' : s.is_ot ? 'OT' : 'ST'}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          </div>
        </div>

        {/* Extended Shifts */}
        <div className="bg-white rounded-[2rem] border border-gray-200 shadow-sm p-5 md:p-6 flex flex-col md:overflow-hidden">
          <div className="flex items-center gap-3 mb-4 flex-none">
            <div className="w-10 h-10 bg-orange-50 rounded-2xl flex items-center justify-center"><Flame size={18} className="text-orange-500" /></div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest">5+ Consecutive Days</h2>
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Staff working extended runs</p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto pr-1">
          {extendedShifts.length === 0 ? (
            <p className="text-[10px] font-black uppercase text-gray-300 tracking-widest">No extended runs this month</p>
          ) : (
            <div className="space-y-3">
              {extendedShifts.map(s => (
                <div key={s.id} className="flex items-center justify-between p-3 bg-orange-50 border border-orange-100 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-900 rounded-xl flex items-center justify-center text-white font-black text-xs">{s.full_name?.[0]}</div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-tight">{s.full_name}</p>
                      <p className="text-[9px] font-black text-gray-400 uppercase">{s.is_pt ? 'PT' : s.is_ot ? 'OT' : 'ST'}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-orange-600 bg-white border border-orange-200 px-3 py-1.5 rounded-xl">{s.maxRun} days</span>
                </div>
              ))}
            </div>
          )}
          </div>
        </div>

        {/* Top Requesters */}
        <div className="bg-white rounded-[2rem] border border-gray-200 shadow-sm p-5 md:p-6 flex flex-col md:overflow-hidden">
          <div className="flex items-center gap-3 mb-4 flex-none">
            <div className="w-10 h-10 bg-violet-50 rounded-2xl flex items-center justify-center"><MessageSquare size={18} className="text-violet-500" /></div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest">Top Requesters</h2>
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Swaps + time off this month</p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto pr-1">
          {topRequesters.length === 0 ? (
            <p className="text-[10px] font-black uppercase text-gray-300 tracking-widest">No requests this month</p>
          ) : (
            <div className="space-y-2">
              {topRequesters.map((s, i) => (
                <div key={s.id} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-100 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-gray-300 w-4">#{i + 1}</span>
                    <div>
                      <p className="text-xs font-black uppercase tracking-tight">{s.full_name}</p>
                      <p className="text-[9px] font-black text-gray-400 uppercase">{s.is_pt ? 'PT' : s.is_ot ? 'OT' : 'ST'}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {s.swaps > 0 && <span className="text-[9px] font-black uppercase px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-lg">{s.swaps} swap{s.swaps > 1 ? 's' : ''}</span>}
                    {s.timeoff > 0 && <span className="text-[9px] font-black uppercase px-2.5 py-1 bg-orange-50 text-orange-700 border border-orange-100 rounded-lg">{s.timeoff} off</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>
        </div>

        {/* PRN Utilization */}
        <div className="bg-white rounded-[2rem] border border-gray-200 shadow-sm p-5 md:p-6 flex flex-col md:overflow-hidden">
          <div className="flex items-center gap-3 mb-4 flex-none">
            <div className="w-10 h-10 bg-emerald-50 rounded-2xl flex items-center justify-center"><UserCheck size={18} className="text-emerald-500" /></div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest">PRN Utilization</h2>
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Min {settings.min_prn_days} days/month — set in roster</p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto pr-1">
          {prnStaff.length === 0 ? (
            <p className="text-[10px] font-black uppercase text-gray-300 tracking-widest">No PRN staff on roster</p>
          ) : (
            <div className="space-y-2">
              {prnUtilization.map(s => {
                const met = s.daysWorked >= settings.min_prn_days;
                return (
                  <div key={s.id} className={`flex items-center justify-between p-3 border rounded-2xl ${met ? 'bg-gray-50 border-gray-100' : 'bg-red-50 border-red-100'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white font-black text-xs ${s.is_pt ? 'bg-blue-600' : s.is_ot ? 'bg-purple-600' : 'bg-emerald-600'}`}>{s.full_name?.[0]}</div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-tight">{s.full_name}</p>
                        <p className="text-[9px] font-black text-gray-400 uppercase">{s.is_pt ? 'PT' : s.is_ot ? 'OT' : 'ST'} · PRN</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-[10px] font-black uppercase tracking-widest ${met ? 'text-emerald-600' : 'text-red-500'}`}>{s.daysWorked}/{settings.min_prn_days} days</p>
                      {!met && <p className="text-[9px] font-black text-red-400 uppercase">{settings.min_prn_days - s.daysWorked} short</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          </div>
        </div>

      </div>
    </main>
  );
}

export default function InsightsPage() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center font-black uppercase text-2xl tracking-tighter">Loading...</div>}>
      <InsightsContent />
    </Suspense>
  );
}
