import { NextRequest, NextResponse } from 'next/server';
import { getAppUserId } from '@/lib/google';
import { hashRoomPassword } from '@/lib/rooms';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: NextRequest) {
  try {
    const { roomName, roomCode, roomPassword, nickname, baseColor } = await req.json();
    const normalizedRoomCode = String(roomCode || '').trim().toUpperCase();

    if (!roomName || !normalizedRoomCode || !roomPassword || !nickname || !baseColor) {
      return jsonError('roomName, roomCode, roomPassword, nickname, and baseColor are required', 400);
    }

    if (String(roomPassword).length < 4) {
      return jsonError('roomPassword must be at least 4 characters', 400);
    }

    const appUserId = getAppUserId(req);
    const { data: room, error: roomError } = await supabaseAdmin
      .from('rooms')
      .insert({
        room_code: normalizedRoomCode,
        room_name: String(roomName).trim(),
        password_hash: hashRoomPassword(String(roomPassword)),
        created_by_app_user_id: appUserId,
      })
      .select('id, room_code, room_name')
      .single();

    if (roomError || !room) {
      return jsonError(roomError?.message || 'Could not create room', 500);
    }

    const { data: member, error: memberError } = await supabaseAdmin
      .from('room_members')
      .insert({
        room_id: room.id,
        app_user_id: appUserId,
        nickname: String(nickname).trim(),
        base_color: String(baseColor),
      })
      .select('nickname, base_color')
      .single();

    if (memberError || !member) {
      return jsonError(memberError?.message || 'Could not create room member', 500);
    }

    await supabaseAdmin
      .from('connected_google_accounts')
      .update({
        room_id: room.id,
        user_nickname: String(nickname).trim(),
        base_color: String(baseColor),
      })
      .eq('app_user_id', appUserId);

    return NextResponse.json({ room, members: [member] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not create room';
    return jsonError(message, message === 'Not authenticated with Google' ? 401 : 500);
  }
}
