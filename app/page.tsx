'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import {
  format, subMonths, addMonths,
  isSameDay, isSameMonth, startOfWeek, parseISO, getDay, addDays, eachDayOfInterval, startOfMonth
} from 'date-fns';
import { ChevronLeft, ChevronRight, Activity, CheckCircle2, Target, AlertTriangle, LogOut, Check, X } from 'lucide-react';
import DayDetailPanel from './DayDetailPanel';
import WorkerDayPanel from './WorkerDayPanel';
import SwapPopup from './SwapPopup';
import MultiDaySwapModal from './MultiDaySwapModal';
import MultiDayTimeOffModal from './MultiDayTimeOffModal';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

function getHolidayName(dateStr: string): string | null {
  const y = dateStr.slice(0, 4);
  const fixed: Record<string, string> = {
    [`${y}-01-01`]: "New Year's Day",
    [`${y}-06-19`]: 'Juneteenth',
    [`${y}-07-04`]: 'Independence Day',
    [`${y}-11-11`]: 'Veterans Day',
    [`${y}-12-25`]: 'Christmas',
  };
  if (fixed[dateStr]) return fixed[dateStr];
  // Floating: MLK (3rd Mon Jan), Presidents (3rd Mon Feb), Memorial (last Mon May),
  // Labor (1st Mon Sep), Thanksgiving (4th Thu Nov)
  const date = new Date(dateStr + 'T12:00:00');
  const m = date.getMonth(); const dow = date.getDay(); const d = date.getDate();
  if (m === 0 && dow === 1 && d >= 15 && d <= 21) return 'MLK Day';
  if (m === 1 && dow === 1 && d >= 15 && d <= 21) return "Presidents' Day";
  if (m === 4 && dow === 1 && d >= 25) return 'Memorial Day';
  if (m === 8 && dow === 1 && d <= 7) return 'Labor Day';
  if (m === 10 && dow === 4 && d >= 22 && d <= 28) return 'Thanksgiving';
  return null;
}

function CalendarContent() {
  const router = useRouter();
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const isScheduler = profile?.role === 'scheduler';
  const searchParams = useSearchParams();
  const monthParam = searchParams.get('m');
  const referenceDate = monthParam ? parseISO(monthParam) : new Date();

  const [shifts, setShifts] = useState<any[]>([]);
  const [roster, setRoster] = useState<any[]>([]);
  const [overrides, setOverrides] = useState<any[]>([]);
  const [settings, setSettings] = useState({ min_pt_weekday: 1, min_ot_weekday: 1, min_st_weekday: 1, min_pt_weekend: 1, min_ot_weekend: 1, min_st_weekend: 1 });
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [pendingSwaps, setPendingSwaps] = useState<any[]>([]);
  const [deniedSwaps, setDeniedSwaps] = useState<any[]>([]);
  const [acceptedSwaps, setAcceptedSwaps] = useState<any[]>([]);
  const [timeOffRequests, setTimeOffRequests] = useState<any[]>([]);
  const [myOutgoingRequests, setMyOutgoingRequests] = useState<any[]>([]);
  const [showSwapPopup, setShowSwapPopup] = useState(false);
  const [multiSelectedDates, setMultiSelectedDates] = useState<string[]>([]);
  const [showMultiSwapModal, setShowMultiSwapModal] = useState(false);
  const [showMultiTimeOffModal, setShowMultiTimeOffModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ id: string; action: string } | null>(null);
  const [showMobilePanel, setShowMobilePanel] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [authLoading, user, router]);

  const fetchData = useCallback(async () => {
    const [{ data: shiftData }, { data: staffData }, { data: overrideData }, { data: settingsData }] = await Promise.all([
      supabase.from('shifts').select('*'),
      supabase.from('profiles').select('*'),
      supabase.from('day_assignments').select('*'),
      supabase.from('settings').select('*').maybeSingle(),
    ]);
    setShifts(shiftData || []);
    setRoster(staffData || []);
    setOverrides(overrideData || []);
    if (settingsData) setSettings(settingsData);
    setLoading(false);
  }, []);

  const fetchUserData = useCallback(async () => {
    if (!profile) return;
    const [{ data: swapData }, { data: deniedData }, { data: acceptedData }, { data: timeOffData }, { data: outgoingData }] = await Promise.all([
      supabase.from('shift_requests').select('*').eq('target_user_id', profile.id).eq('type', 'swap').eq('status', 'pending'),
      supabase.from('shift_requests').select('*').eq('target_user_id', profile.id).eq('type', 'swap').eq('status', 'denied'),
      supabase.from('shift_requests').select('*').eq('target_user_id', profile.id).eq('type', 'swap').eq('status', 'approved'),
      isScheduler ? supabase.from('shift_requests').select('*').eq('type', 'petition_off').eq('status', 'pending') : Promise.resolve({ data: [] }),
      !isScheduler ? supabase.from('shift_requests').select('*').eq('user_id', profile.id).in('status', ['pending', 'approved', 'denied']) : Promise.resolve({ data: [] }),
    ]);
    setPendingSwaps(swapData || []);
    setDeniedSwaps(deniedData || []);
    setAcceptedSwaps(acceptedData || []);
    if (swapData && swapData.length > 0) setShowSwapPopup(true);
    setTimeOffRequests(timeOffData || []);
    setMyOutgoingRequests(outgoingData || []);
  }, [profile, isScheduler]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { fetchUserData(); }, [fetchUserData]);

  const handleUpdate = async () => { await Promise.all([fetchData(), fetchUserData()]); };

  const getStaffForDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00');
    const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const dayName = days[getDay(date)];
    let baseStaff = roster.filter((staff: any) => staff[`works_${dayName}`]);
    const dayOverrides = overrides.filter(o => o.date === dateStr);
    if (dayOverrides.length > 0) {
      dayOverrides.forEach(ov => {
        if (ov.replaced_staff_id) baseStaff = baseStaff.filter(s => s.id !== ov.replaced_staff_id);
        const newPerson = roster.find(r => r.id === ov.staff_id);
        if (newPerson && !baseStaff.find(s => s.id === newPerson.id)) baseStaff.push(newPerson);
      });
    }
    return baseStaff;
  };

  const toggleDaySelection = (dateStr: string) => {
    setMultiSelectedDates(prev =>
      prev.includes(dateStr) ? prev.filter(d => d !== dateStr) : [...prev, dateStr]
    );
  };

  const getMultiDayEligible = () => {
    if (!profile || multiSelectedDates.length === 0) return [];
    return roster.filter(s => {
      if (s.id === profile.id) return false;
      const matchesDiscipline = (profile.is_pt && s.is_pt) || (profile.is_ot && s.is_ot) || (profile.is_st && s.is_st);
      if (!matchesDiscipline) return false;
      return multiSelectedDates.every(date => !getStaffForDate(date).some(ws => ws.id === s.id));
    });
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

  const getAlerts = () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return getDisplayDays()
      .filter(d => isSameMonth(new Date(d + 'T12:00:00'), referenceDate) && d >= today)
      .flatMap(dateStr => {
        const dow = getDay(new Date(dateStr + 'T12:00:00'));
        const isWeekend = dow === 0 || dow === 6;
        const minPt = isWeekend ? settings.min_pt_weekend : settings.min_pt_weekday;
        const minOt = isWeekend ? settings.min_ot_weekend : settings.min_ot_weekday;
        const minSt = isWeekend ? settings.min_st_weekend : settings.min_st_weekday;
        const staff = getStaffForDate(dateStr);
        const ptCount = staff.filter(s => s.is_pt).length;
        const otCount = staff.filter(s => s.is_ot).length;
        const stCount = staff.filter(s => s.is_st).length;
        const issues: { discipline: string; count: number; min: number; colorText: string; colorBg: string }[] = [];
        if (ptCount < minPt) issues.push({ discipline: 'PT', count: ptCount, min: minPt, colorText: 'text-blue-600', colorBg: 'bg-blue-50' });
        if (otCount < minOt) issues.push({ discipline: 'OT', count: otCount, min: minOt, colorText: 'text-purple-600', colorBg: 'bg-purple-50' });
        if (stCount < minSt) issues.push({ discipline: 'ST', count: stCount, min: minSt, colorText: 'text-emerald-600', colorBg: 'bg-emerald-50' });
        if (issues.length === 0) return [];
        return [{ dateStr, issues }];
      });
  };

  const approvePetitionOff = async (req: any) => {
    await supabase.from('day_assignments').insert([{ date: req.date, staff_id: null, replaced_staff_id: req.user_id }]);
    await supabase.from('shift_requests').update({ status: 'approved' }).eq('id', req.id);
    handleUpdate();
  };

  const denyPetitionOff = async (req: any) => {
    await supabase.from('shift_requests').update({ status: 'denied' }).eq('id', req.id);
    fetchUserData();
  };

  if (loading || authLoading) return <div className="h-screen flex items-center justify-center bg-white font-black uppercase text-3xl italic tracking-tighter">Syncing...</div>;

  const alerts = getAlerts();
  const triageCount = alerts.length + timeOffRequests.length;

  return (
    <main className="flex h-screen w-full bg-white overflow-hidden text-black font-sans isolate">
      <section className="w-full lg:w-[72%] h-full flex flex-col border-r border-gray-100">
        {/* Mobile header — month nav only (portrait + landscape phones) */}
        <header className="lg:hidden h-12 flex-none border-b flex items-center justify-between px-3 bg-white">
          <button onClick={signOut} className="p-1.5 text-gray-300 hover:text-red-500 transition-colors"><LogOut size={15} /></button>
          <div className="flex items-center bg-gray-50 rounded-xl p-0.5 border gap-0.5">
            <button onClick={() => navigateMonth('prev')} className="p-1.5 hover:bg-white rounded-lg transition-all"><ChevronLeft size={15} /></button>
            <span className="text-[10px] font-black uppercase tracking-wide px-2 min-w-[80px] text-center">{format(referenceDate, 'MMMM yyyy')}</span>
            <button onClick={() => navigateMonth('next')} className="p-1.5 hover:bg-white rounded-lg transition-all"><ChevronRight size={15} /></button>
          </div>
          <button onClick={() => navigateMonth('today')} className="p-1.5 text-blue-500"><Target size={15} /></button>
        </header>

        {/* Desktop header */}
        <header className="hidden lg:flex h-20 flex-none border-b justify-between items-center px-10 bg-white">
          <div className="flex items-center gap-10">
            <h1 className="text-2xl font-black italic tracking-tighter border-l-8 border-blue-600 pl-4 uppercase">Elysian Scheduler</h1>
            {isScheduler && (
              <nav className="flex gap-6 ml-6 border-l-2 pl-8">
                <Link href={`/roster?m=${format(referenceDate, 'yyyy-MM-dd')}`} className="text-[10px] font-black uppercase text-gray-400 hover:text-blue-600 transition-all">Manage Roster</Link>
                <Link href={`/insights?m=${format(referenceDate, 'yyyy-MM')}`} className="text-[10px] font-black uppercase text-gray-400 hover:text-blue-600 transition-all">Insights</Link>
              </nav>
            )}
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => navigateMonth('today')} className="flex items-center gap-2 px-5 py-2 bg-blue-50 text-blue-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-100 transition-all active:scale-95"><Target size={14} /> Today</button>
            <div className="flex items-center bg-gray-50 rounded-2xl p-1 border">
              <button onClick={() => navigateMonth('prev')} className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all"><ChevronLeft size={18} /></button>
              <span className="text-[11px] font-black uppercase tracking-[0.2em] px-6 min-w-[160px] text-center">{format(referenceDate, 'MMMM yyyy')}</span>
              <button onClick={() => navigateMonth('next')} className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all"><ChevronRight size={18} /></button>
            </div>
            <div className="flex items-center gap-3 pl-2 border-l">
              <div className="text-right">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-900 leading-none">{profile?.full_name || user?.email}</p>
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mt-0.5">{profile?.role || 'worker'}</p>
              </div>
              <button onClick={signOut} className="p-2 text-gray-300 hover:text-red-500 transition-colors" title="Sign out"><LogOut size={16} /></button>
            </div>
          </div>
        </header>

        <div className="flex-1 p-2 lg:p-4 bg-gray-50/20 overflow-hidden flex flex-col">
          <div className="grid grid-cols-7 h-6 lg:h-8 mb-1 lg:mb-2 flex-none">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-[9px] lg:text-[10px] font-black text-gray-400 uppercase tracking-tight lg:tracking-[0.3em]">{day[0]}<span className="hidden lg:inline">{day.slice(1)}</span></div>
            ))}
          </div>
          <div className="flex-1 grid grid-cols-7 grid-rows-6 gap-0.5 lg:gap-2 h-full">
            {getDisplayDays().map((dateStr) => {
              const scheduledStaff = getStaffForDate(dateStr);
              const isToday = isSameDay(new Date(dateStr + 'T12:00:00'), new Date());
              const isCurrentMonth = isSameMonth(new Date(dateStr + 'T12:00:00'), referenceDate);
              const hasOverride = overrides.some(o => o.date === dateStr);
              const hasOpenSlot = shifts.some(s => s.date === dateStr && s.status === 'vacant');
              const dow = getDay(new Date(dateStr + 'T12:00:00'));
              const isWeekend = dow === 0 || dow === 6;
              const minPt = isWeekend ? settings.min_pt_weekend : settings.min_pt_weekday;
              const minOt = isWeekend ? settings.min_ot_weekend : settings.min_ot_weekday;
              const minSt = isWeekend ? settings.min_st_weekend : settings.min_st_weekday;
              const ptCount = scheduledStaff.filter(s => s.is_pt).length;
              const otCount = scheduledStaff.filter(s => s.is_ot).length;
              const stCount = scheduledStaff.filter(s => s.is_st).length;
              const isMeWorking = profile && scheduledStaff.some(s => s.id === profile.id);
              const isCoveringSwap = isMeWorking && acceptedSwaps.some(s => s.date === dateStr);
              const dayRequest = myOutgoingRequests.find(r => r.date === dateStr);
              const hasPendingRequest = dayRequest?.status === 'pending';
              const hasDeniedRequest = dayRequest?.status === 'denied';
              const hasApprovedRequest = dayRequest?.status === 'approved';
              const isSelected = multiSelectedDates.includes(dateStr);
              const today = format(new Date(), 'yyyy-MM-dd');
              const isPast = dateStr < today;
              const myDiscipline = !isScheduler ? (profile?.is_pt ? 'PT' : profile?.is_ot ? 'OT' : 'ST') : null;
              const hasMyOpenSlot = !isScheduler && !isMeWorking && !isPast &&
                shifts.some(s => s.date === dateStr && s.status === 'vacant' && s.discipline === myDiscipline);

              // Mobile cell styling — pure color coding
              const mobileBg = isToday ? '' : isMeWorking ? 'bg-emerald-200' : hasMyOpenSlot ? 'bg-amber-100' : 'bg-white';
              const mobileBorder = isToday ? '' : isMeWorking ? 'border-emerald-400' : hasMyOpenSlot ? 'border-amber-400' : 'border-gray-100';
              const mobileDateColor = isToday ? 'text-white' : isMeWorking ? 'text-emerald-800' : hasMyOpenSlot ? 'text-amber-700' : 'text-gray-300';

              return (
                <div key={dateStr} onClick={() => setSelectedDate(dateStr)}
                  className={`border transition-all cursor-pointer relative flex flex-col items-center justify-center
                    rounded-lg lg:rounded-[1.2rem]
                    p-0.5 lg:p-3
                    gap-0 lg:gap-1
                    ${isSelected ? 'ring-4 ring-violet-400 border-violet-500 shadow-lg z-10' : dateStr === selectedDate ? 'ring-4 ring-blue-500/10 border-blue-600 shadow-xl z-10' :
                      `${mobileBorder} lg:${isMeWorking && !isToday ? 'border-emerald-400' : 'border-gray-50 hover:border-blue-200'}`}
                    ${isToday ? 'bg-blue-600/70 border-blue-400 shadow-lg shadow-blue-200' : `${mobileBg} lg:${isMeWorking ? 'bg-emerald-50/60' : 'bg-white'}`}
                    ${!isCurrentMonth ? 'opacity-20 grayscale' : 'opacity-100'}`}
                >
                  <span className={`text-[9px] lg:text-[11px] font-black uppercase absolute top-1 lg:top-3 left-1 lg:left-3 leading-none ${isToday ? 'text-white' : `${mobileDateColor} lg:${isMeWorking ? 'text-emerald-600' : 'text-gray-300'}`}`}>
                    {format(new Date(dateStr + 'T12:00:00'), 'd')}
                  </span>
                  {/* Multi-select button — desktop only */}
                  {!isScheduler && isMeWorking && !isToday && !isPast && (
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleDaySelection(dateStr); }}
                      className={`hidden lg:block absolute top-2.5 right-2.5 w-4 h-4 rounded-full border-2 transition-all z-10 ${isSelected ? 'bg-violet-500 border-violet-500' : 'border-emerald-300 bg-white hover:bg-violet-100'}`}
                    />
                  )}
                  {/* Desktop-only indicators */}
                  {hasOverride && !multiSelectedDates.length && <div className={`hidden lg:block absolute top-3 right-3 w-1.5 h-1.5 rounded-full ${isToday ? 'bg-white' : 'bg-blue-600'}`} />}
                  {isCoveringSwap && !isToday && <div className="hidden lg:block absolute bottom-2 left-2 text-[8px]">🔄</div>}
                  {hasPendingRequest && !isToday && <div className="hidden lg:block absolute bottom-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-orange-400" />}
                  {hasDeniedRequest && !isToday && <div className="hidden lg:block absolute bottom-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-red-500" />}
                  {hasApprovedRequest && !isToday && <div className="hidden lg:block absolute bottom-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-green-500" />}
                  {hasOpenSlot && !isToday && <div className="hidden lg:block absolute bottom-2 right-2 w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                  {/* Desktop: PT/OT/ST badges */}
                  <div className="hidden lg:flex flex-col gap-1 w-full max-w-[75px]">
                    <div className={`flex justify-between px-2 py-1 rounded-md border font-black text-[8px] ${isToday ? 'bg-white/20 border-white/10 text-white' : ptCount < minPt ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-700'}`}><span>PT</span><span>{ptCount}</span></div>
                    <div className={`flex justify-between px-2 py-1 rounded-md border font-black text-[8px] ${isToday ? 'bg-white/20 border-white/10 text-white' : otCount < minOt ? 'bg-red-50 text-red-500' : 'bg-purple-50 text-purple-700'}`}><span>OT</span><span>{otCount}</span></div>
                    <div className={`flex justify-between px-2 py-1 rounded-md border font-black text-[8px] ${isToday ? 'bg-white/20 border-white/10 text-white' : stCount < minSt ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-700'}`}><span>ST</span><span>{stCount}</span></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {!isScheduler && multiSelectedDates.length > 0 && (
          <div className="flex-none px-4 py-3 bg-white border-t flex items-center justify-between gap-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-violet-600 flex-none">
              {multiSelectedDates.length} {multiSelectedDates.length === 1 ? 'day' : 'days'}
            </p>
            <div className="flex gap-2 flex-wrap justify-end">
              <button onClick={() => setMultiSelectedDates([])} className="px-4 py-2 bg-gray-100 rounded-xl font-black text-[10px] uppercase text-gray-400 hover:bg-gray-200 transition-all">
                Clear
              </button>
              <button onClick={() => setShowMultiTimeOffModal(true)} className="px-4 py-2 bg-orange-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-orange-600 transition-all">
                Time Off
              </button>
              <button onClick={() => setShowMultiSwapModal(true)} className="px-4 py-2 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all">
                Swap
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Mobile FAB — only shows when there's something to act on */}
      {(triageCount > 0 || pendingSwaps.length > 0 || myOutgoingRequests.length > 0 || showMobilePanel) && (
        <button
          onClick={() => setShowMobilePanel(p => !p)}
          className="lg:hidden fixed bottom-5 right-5 z-[150] w-12 h-12 bg-gray-900 text-white rounded-full shadow-2xl flex items-center justify-center transition-transform active:scale-95"
        >
          {showMobilePanel ? <X size={20} /> : <Activity size={20} className="text-blue-400" />}
          {(triageCount + pendingSwaps.length) > 0 && !showMobilePanel && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[9px] font-black flex items-center justify-center">{triageCount + pendingSwaps.length}</span>
          )}
        </button>
      )}

      {/* Mobile backdrop */}
      {showMobilePanel && (
        <div className="lg:hidden fixed inset-0 bg-black/40 z-[100]" onClick={() => setShowMobilePanel(false)} />
      )}

      <aside className={`
        lg:static lg:w-[28%] lg:h-full lg:translate-y-0 lg:rounded-none lg:border-l lg:border-t-0
        fixed inset-x-0 bottom-0 h-[85vh] rounded-t-[2rem] z-[110]
        flex flex-col bg-white shadow-2xl
        transform transition-transform duration-300 ease-in-out
        ${showMobilePanel ? 'translate-y-0' : 'translate-y-full lg:translate-y-0'}
      `}>
        <header className="h-14 lg:h-20 flex-none px-4 lg:p-6 border-b flex justify-between items-center bg-gray-900 text-white lg:rounded-none rounded-t-[2rem]">
          <h2 className="text-md font-black uppercase tracking-widest flex items-center gap-3">
            <Activity size={22} className="text-blue-400" /> {isScheduler ? 'Triage' : 'My Schedule'}
          </h2>
          {isScheduler && triageCount > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full">{triageCount}</span>
          )}
        </header>

        {isScheduler ? (
          alerts.length === 0 && timeOffRequests.length === 0 ? (
            <div className="flex-1 p-6 flex flex-col items-center justify-center text-gray-300 gap-4 opacity-40">
              <CheckCircle2 size={60} />
              <p className="text-xs font-black uppercase tracking-widest">Balanced</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {timeOffRequests.length > 0 && (
                <>
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 px-1">Time Off Requests</p>
                  {timeOffRequests.map(req => {
                    const worker = roster.find(r => r.id === req.user_id);
                    return (
                      <div key={req.id} className="bg-orange-50 border border-orange-100 rounded-[1.5rem] p-4 space-y-3">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-orange-700">{worker?.full_name || 'Unknown'}</p>
                          <p className="text-[9px] font-black text-orange-500 uppercase tracking-widest">{format(new Date(req.date + 'T12:00:00'), 'EEE, MMM d')}</p>
                          {req.reason && <p className="text-xs text-orange-600 italic mt-1">"{req.reason}"</p>}
                        </div>
                        {confirmAction?.id === req.id ? (
                          <div className="space-y-2">
                            {(() => { const ca = confirmAction!; return (
                            <>
                            <p className="text-[9px] font-black uppercase tracking-widest text-center text-orange-600">
                              {ca.action === 'approve' ? 'Approve this request?' : 'Deny this request?'}
                            </p>
                            <div className="flex gap-2">
                              <button onClick={() => setConfirmAction(null)} className="flex-1 py-2 bg-white border border-gray-200 rounded-xl font-black text-[9px] uppercase text-gray-400">No</button>
                              <button
                                onClick={() => { setConfirmAction(null); ca.action === 'approve' ? approvePetitionOff(req) : denyPetitionOff(req); }}
                                className={`flex-1 py-2 rounded-xl font-black text-[9px] uppercase text-white ${ca.action === 'approve' ? 'bg-orange-500' : 'bg-red-500'}`}
                              >Yes</button>
                            </div>
                            </>
                            ); })()}
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button onClick={() => setConfirmAction({ id: req.id, action: 'deny' })} className="flex-1 py-2 bg-white border border-orange-200 rounded-xl font-black text-[9px] uppercase text-orange-400 flex items-center justify-center gap-1 hover:bg-red-50 transition-all">
                              <X size={11} /> Deny
                            </button>
                            <button onClick={() => setConfirmAction({ id: req.id, action: 'approve' })} className="flex-1 py-2 bg-orange-500 rounded-xl font-black text-[9px] uppercase text-white flex items-center justify-center gap-1 hover:bg-orange-600 transition-all">
                              <Check size={11} /> Approve
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
              {alerts.length > 0 && (
                <>
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 px-1 pt-2">Staffing Alerts</p>
                  {alerts.map(({ dateStr, issues }) => (
                    <button key={dateStr} onClick={() => setSelectedDate(dateStr)}
                      className="w-full text-left bg-gray-50 hover:bg-white border border-gray-100 hover:border-gray-200 hover:shadow-md rounded-[1.5rem] p-5 transition-all"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle size={12} className="text-red-400" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">{format(new Date(dateStr + 'T12:00:00'), 'EEE, MMM d')}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {issues.map(issue => (
                          <span key={issue.discipline} className={`${issue.colorText} ${issue.colorBg} text-[9px] font-black uppercase px-2.5 py-1 rounded-lg`}>
                            {issue.discipline} {issue.count}/{issue.min}
                          </span>
                        ))}
                      </div>
                    </button>
                  ))}
                </>
              )}
            </div>
          )
        ) : (() => {
          const allIncoming = [...pendingSwaps, ...deniedSwaps];
          const incomingGrouped = Object.values(
            allIncoming.reduce((acc: any, s: any) => {
              if (!acc[s.user_id]) acc[s.user_id] = [];
              acc[s.user_id].push(s);
              return acc;
            }, {})
          ) as any[][];

          const decidePanelDay = async (swap: any, action: 'accept' | 'decline') => {
            setConfirmAction(null);
            if (action === 'accept') {
              await supabase.from('day_assignments').insert([{ date: swap.date, staff_id: profile!.id, replaced_staff_id: swap.user_id }]);
            }
            await supabase.from('shift_requests').update({ status: action === 'accept' ? 'approved' : 'denied' }).eq('id', swap.id);
            await handleUpdate();
          };

          const today = format(new Date(), 'yyyy-MM-dd');
          const yearEnd = new Date(new Date().getFullYear(), 11, 31);
          const monthShifts = eachDayOfInterval({ start: new Date(), end: yearEnd })
            .map(d => format(d, 'yyyy-MM-dd'))
            .filter(d => d >= today)
            .filter(d => {
              const dow = getDay(new Date(d + 'T12:00:00'));
              return dow === 0 || dow === 6 || getHolidayName(d) !== null;
            })
            .filter(d => profile && getStaffForDate(d).some(s => s.id === profile.id));

          // Dynamic flex weights — proportional to content size, min 2
          const incomingFlex = incomingGrouped.length > 0
            ? Math.max(incomingGrouped.reduce((s, g) => s + g.length, 0), 2) : 0;
          const myRequestFlex = myOutgoingRequests.length > 0
            ? Math.max(myOutgoingRequests.length, 2) : 0;
          const specialFlex = Math.max(monthShifts.length, 2);

          const statusStyles: Record<string, { bg: string; border: string; text: string; badge: string }> = {
            pending:  { bg: 'bg-orange-50', border: 'border-orange-100', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-600' },
            approved: { bg: 'bg-green-50',  border: 'border-green-100',  text: 'text-green-700',  badge: 'bg-green-100 text-green-700' },
            denied:   { bg: 'bg-red-50',    border: 'border-red-100',    text: 'text-red-700',    badge: 'bg-red-100 text-red-600' },
          };

          return (
            <div className="flex-1 overflow-hidden flex flex-col">
              {/* Incoming swap requests */}
              {incomingGrouped.length > 0 && (
                <div style={{ flexGrow: incomingFlex, flexShrink: 1, flexBasis: 'auto', overflowY: 'auto', minHeight: 0 }} className="border-b p-4 space-y-2">
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2">Incoming Swaps</p>
                  {incomingGrouped.map(group => {
                    const requester = roster.find(r => r.id === group[0].user_id);
                    const sorted = [...group].sort((a: any, b: any) => a.date.localeCompare(b.date));
                    return (
                      <div key={group[0].user_id} className="p-3 rounded-2xl border border-blue-100 bg-blue-50 space-y-1.5">
                        <p className="text-[10px] font-black uppercase tracking-widest text-blue-700">{requester?.full_name}</p>
                        <div className="space-y-1">
                          {sorted.map((swap: any) => {
                            const isConfirming = confirmAction?.id === swap.id;
                            return (
                              <div key={swap.id} className={`flex items-center justify-between p-2 rounded-xl border ${swap.status === 'approved' ? 'bg-green-50 border-green-200' : swap.status === 'denied' ? 'bg-red-50 border-red-100' : 'bg-white border-gray-100'}`}>
                                <span className="text-[10px] font-black uppercase text-gray-700">{format(parseISO(swap.date), 'EEE, MMM d')}</span>
                                {swap.status !== 'pending' ? (
                                  <span className={`text-[9px] font-black uppercase ${swap.status === 'approved' ? 'text-green-600' : 'text-red-500'}`}>{swap.status === 'approved' ? '✓' : '✕'}</span>
                                ) : isConfirming && confirmAction ? (
                                  <div className="flex gap-1">
                                    <button onClick={() => setConfirmAction(null)} className="px-2 py-1 bg-white border border-gray-200 rounded-lg font-black text-[9px] text-gray-400">No</button>
                                    <button onClick={() => decidePanelDay(swap, confirmAction.action as 'accept' | 'decline')} className={`px-2 py-1 rounded-lg font-black text-[9px] text-white ${confirmAction.action === 'accept' ? 'bg-blue-600' : 'bg-red-500'}`}>Yes</button>
                                  </div>
                                ) : (
                                  <div className="flex gap-1">
                                    <button onClick={() => setConfirmAction({ id: swap.id, action: 'decline' })} className="px-2 py-1 bg-white border border-gray-100 rounded-lg font-black text-[9px] text-gray-400 hover:text-red-500">✕</button>
                                    <button onClick={() => setConfirmAction({ id: swap.id, action: 'accept' })} className="px-2 py-1 bg-blue-600 text-white rounded-lg font-black text-[9px]">✓</button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* My requests */}
              {myOutgoingRequests.length > 0 && (
                <div style={{ flexGrow: myRequestFlex, flexShrink: 1, flexBasis: 'auto', overflowY: 'auto', minHeight: 0 }} className="border-b p-4 space-y-2">
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2">My Requests</p>
                  {Object.values(
                    myOutgoingRequests.reduce((acc: any, r: any) => {
                      const key = `${r.type}-${r.target_user_id || 'none'}-${r.status}`;
                      if (!acc[key]) acc[key] = []; acc[key].push(r); return acc;
                    }, {})
                  ).map((group: any) => {
                    const isSwap = group[0].type === 'swap';
                    const status = group[0].status;
                    const target = isSwap ? roster.find(r => r.id === group[0].target_user_id) : null;
                    const s = statusStyles[status] || statusStyles.pending;
                    return (
                      <div key={group[0].type + group[0].target_user_id + status} className={`p-3 rounded-2xl border ${s.bg} ${s.border}`}>
                        <div className="flex justify-between items-center mb-1.5">
                          <p className={`text-[10px] font-black uppercase tracking-widest ${s.text}`}>{isSwap ? `Swap → ${target?.full_name || '?'}` : 'Time Off'}</p>
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-lg ${s.badge}`}>{status}</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {[...group].sort((a: any, b: any) => a.date.localeCompare(b.date)).map((r: any) => (
                            <span key={r.id} className={`px-2 py-0.5 bg-white border rounded-lg text-[9px] font-black uppercase ${s.border} ${s.text}`}>{format(parseISO(r.date), 'MMM d')}</span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Weekends & Holidays */}
              <div style={{ flexGrow: specialFlex, flexShrink: 1, flexBasis: 'auto', overflowY: 'auto', minHeight: 0 }} className="p-4 space-y-1.5">
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2">Weekends & Holidays</p>
                {monthShifts.length === 0 ? (
                  <p className="text-[9px] font-black uppercase text-gray-300 tracking-widest">No weekend or holiday shifts this month</p>
                ) : monthShifts.map(d => {
                  const holiday = getHolidayName(d);
                  const dow = getDay(new Date(d + 'T12:00:00'));
                  const isWeekend = dow === 0 || dow === 6;
                  return (
                    <button key={d} onClick={() => setSelectedDate(d)}
                      className={`w-full text-left p-3 border rounded-2xl transition-all hover:shadow-sm ${holiday ? 'bg-red-50 border-red-100 hover:border-red-300' : isWeekend ? 'bg-amber-50 border-amber-100 hover:border-amber-300' : 'bg-emerald-50 border-emerald-100 hover:border-emerald-300'}`}
                    >
                      <div className="flex items-center justify-between">
                        <p className={`text-[10px] font-black uppercase tracking-widest ${holiday ? 'text-red-700' : isWeekend ? 'text-amber-700' : 'text-emerald-700'}`}>
                          {format(new Date(d + 'T12:00:00'), 'EEE, MMM d')}
                        </p>
                        {holiday && <span className="text-[8px] font-black uppercase text-red-500 bg-red-100 px-2 py-0.5 rounded-lg">{holiday}</span>}
                        {!holiday && isWeekend && <span className="text-[8px] font-black uppercase text-amber-500 bg-amber-100 px-2 py-0.5 rounded-lg">Weekend</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </aside>

      {selectedDate && isScheduler && (
        <DayDetailPanel
          shift={shifts.find(s => s.date === selectedDate) || { date: selectedDate }}
          scheduledStaff={getStaffForDate(selectedDate)}
          allStaff={roster || []}
          onClose={() => setSelectedDate(null)}
          onUpdate={handleUpdate}
        />
      )}

      {selectedDate && !isScheduler && profile && (
        <WorkerDayPanel
          dateStr={selectedDate}
          isWorkingThisDay={getStaffForDate(selectedDate).some(s => s.id === profile.id)}
          myProfile={profile}
          scheduledStaff={getStaffForDate(selectedDate)}
          allStaff={roster || []}
          acceptedSwaps={acceptedSwaps}
          onClose={() => setSelectedDate(null)}
          onUpdate={handleUpdate}
        />
      )}

      {showSwapPopup && pendingSwaps.length > 0 && profile && (
        <SwapPopup
          pendingSwaps={pendingSwaps}
          roster={roster}
          myProfile={profile}
          onDismiss={() => setShowSwapPopup(false)}
          onUpdate={handleUpdate}
        />
      )}

      {showMultiTimeOffModal && profile && (
        <MultiDayTimeOffModal
          selectedDates={multiSelectedDates}
          myProfile={profile}
          onClose={() => setShowMultiTimeOffModal(false)}
          onUpdate={async () => { setMultiSelectedDates([]); await handleUpdate(); }}
        />
      )}

      {showMultiSwapModal && profile && (
        <MultiDaySwapModal
          selectedDates={multiSelectedDates}
          myProfile={profile}
          eligibleStaff={getMultiDayEligible()}
          onClose={() => setShowMultiSwapModal(false)}
          onUpdate={async () => { setMultiSelectedDates([]); await handleUpdate(); }}
        />
      )}
    </main>
  );
}

export default function CommandCenter() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center font-black uppercase text-2xl tracking-tighter">Loading...</div>}>
      <CalendarContent />
    </Suspense>
  );
}
