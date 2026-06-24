import { NextRequest, NextResponse } from 'next/server';
import { getAppUserId } from '@/lib/google';
import { verifyRoomPassword } from '@/lib/rooms';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: NextRequest) {
  try {
    const { roomCode, roomPassword, nickname, baseColor } = await req.json();
    const normalizedRoomCode = String(roomCode || '').trim().toUpperCase();

    if (!normalizedRoomCode || !roomPassword || !nickname || !baseColor) {
      return jsonError('roomCode, roomPassword, nickname, and baseColor are required', 400);
    }

    const { data: room, error: roomError } = await supabaseAdmin
      .from('rooms')
      .select('id, room_code, room_name, password_hash')
      .eq('room_code', normalizedRoomCode)
      .single();

    if (roomError || !room) {
      return jsonError('Room not found', 404);
    }

    if (!verifyRoomPassword(String(roomPassword), room.password_hash)) {
      return jsonError('Incorrect room password', 401);
    }

    const appUserId = getAppUserId(req);
    const { error: memberError } = await supabaseAdmin
      .from('room_members')
      .upsert({
        room_id: room.id,
        app_user_id: appUserId,
        nickname: String(nickname).trim(),
        base_color: String(baseColor),
      }, { onConflict: 'room_id,app_user_id' });

    if (memberError) {
      return jsonError(memberError.message, 500);
    }

    await supabaseAdmin
      .from('connected_google_accounts')
      .update({
        room_id: room.id,
        user_nickname: String(nickname).trim(),
        base_color: String(baseColor),
      })
      .eq('app_user_id', appUserId);

    const { data: members, error: membersError } = await supabaseAdmin
      .from('room_members')
      .select('nickname, base_color')
      .eq('room_id', room.id)
      .order('created_at', { ascending: true });

    if (membersError) {
      return jsonError(membersError.message, 500);
    }

    return NextResponse.json({
      room: {
        id: room.id,
        room_code: room.room_code,
        room_name: room.room_name,
      },
      members: members || [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not join room';
    return jsonError(message, message === 'Not authenticated with Google' ? 401 : 500);
  }
}
