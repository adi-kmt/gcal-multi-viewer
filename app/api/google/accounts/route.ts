import { NextRequest, NextResponse } from 'next/server';
import { getAppUserId } from '@/lib/google';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req: NextRequest) {
  try {
    const appUserId = getAppUserId(req);
    const { data, error } = await supabaseAdmin
      .from('connected_google_accounts')
      .select('id, google_email, created_at')
      .eq('app_user_id', appUserId)
      .order('created_at', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ accounts: data || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load Google accounts';
    return NextResponse.json({ error: message }, { status: message === 'Not authenticated with Google' ? 401 : 500 });
  }
}
