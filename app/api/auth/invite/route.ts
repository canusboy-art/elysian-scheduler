import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { email, staffId } = await req.json()

  const host = req.headers.get('host') || 'localhost:3000'
  const protocol = host.includes('localhost') ? 'http' : 'https'
  const redirectTo = `${protocol}://${host}/auth/callback`

  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, { redirectTo })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await supabaseAdmin.from('profiles')
    .update({ auth_user_id: data.user.id, email })
    .eq('id', staffId)

  return NextResponse.json({ success: true })
}
