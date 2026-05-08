import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { authUserId, email, fullName } = await req.json()

  // Check if a profile with this email already exists
  const { data: existing } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('email', email)
    .single()

  if (existing) {
    const { count } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'scheduler')
    const updates: any = { auth_user_id: authUserId }
    if (fullName) updates.full_name = fullName
    if (count === 0) updates.role = 'scheduler'
    await supabaseAdmin.from('profiles').update(updates).eq('id', existing.id)
    return NextResponse.json({ profile: { ...existing, ...updates } })
  }

  // No existing profile — create one. First user becomes manager.
  const { count } = await supabaseAdmin
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'manager')

  const role = count === 0 ? 'scheduler' : 'worker'

  const { data: newProfile } = await supabaseAdmin.from('profiles').insert([{
    full_name: fullName || email,
    email,
    role,
    auth_user_id: authUserId,
    is_pt: false, is_ot: false, is_st: false, is_prn: false,
    works_mon: false, works_tue: false, works_wed: false,
    works_thu: false, works_fri: false, works_sat: false, works_sun: false,
  }]).select().single()

  return NextResponse.json({ profile: newProfile })
}
