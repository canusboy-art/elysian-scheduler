import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { email, password, staffId } = await req.json()

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await supabaseAdmin.from('profiles')
    .update({ auth_user_id: data.user.id, email })
    .eq('id', staffId)

  return NextResponse.json({ success: true })
}
