'use client';

import { useEffect, useMemo, useState } from 'react';
import type { DateSelectArg, EventClickArg, EventContentArg } from '@fullcalendar/core';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { detectConflictGroups, getConflictedEventIds } from '@/lib/calendarConflicts';

// ─── Types ───────────────────────────────────────────────────────────────────
type UserSlot = {
  nickname: string;
  baseColor: string; // hex
  calendars: { name: string; shade: string }[];
};

type RoomState = {
  roomName: string;
  roomCode: string;
  hasPassword: boolean;
  users: UserSlot[];
};

type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  backgroundColor: string;
  borderColor: string;
  extendedProps: {
    userNickname: string;
    calendarName: string;
  };
};

type JoinRoomPayload = {
  mode: 'create' | 'join';
  nickname: string;
  roomName: string;
  roomCode: string;
  roomPassword: string;
  baseColor: string;
};

type AuthUser = {
  email: string;
  name?: string;
  picture?: string;
};

function GoogleAuthScreen() {
  return (
    <div className="join-screen welcome-stage">
      <div className="door-scene" aria-hidden="true">
        <div className="door-frame">
          <div className="door-panel" />
          <div className="door-light" />
        </div>
      </div>
      <div className="join-hero">
        <div className="join-logo">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <rect width="40" height="40" rx="12" fill="var(--accent-color)" fillOpacity="0.15"/>
            <circle cx="14" cy="20" r="5" fill="var(--accent-color)" fillOpacity="0.6"/>
            <circle cx="26" cy="20" r="5" fill="var(--accent-color)"/>
            <path d="M19 20h2" stroke="var(--accent-color)" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        <h1 className="join-title">Unify</h1>
        <p className="join-subtitle">Sign in with Google to create rooms, join rooms, sync calendars, and send calendar invites.</p>
        <blockquote className="welcome-quote">"Time opens when everyone can see the same door."</blockquote>
        <a className="google-auth-btn" href="/api/google/auth" aria-label="Continue with Google">
          <span className="google-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.31 9.14 5.38 12 5.38z" />
            </svg>
          </span>
          <span>Continue with Google</span>
        </a>
      </div>
    </div>
  );
}

// ─── Color Utilities ──────────────────────────────────────────────────────────
function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** Generate N perceptually distinct shades from a base hue */
function generateShades(baseColor: string, count: number): string[] {
  const [h, s] = hexToHsl(baseColor);
  const shades: string[] = [];
  // Lightness steps spread from 35% to 65% — dark-mode friendly
  const step = count > 1 ? 30 / (count - 1) : 0;
  for (let i = 0; i < count; i++) {
    const l = 35 + i * step;
    shades.push(hslToHex(h, Math.min(s, 55), l));
  }
  return shades;
}

// ─── Demo Data ────────────────────────────────────────────────────────────────
const DEMO_ROOM: RoomState = {
  roomName: 'Launch Planning',
  roomCode: 'UNIFY-42',
  hasPassword: true,
  users: [
    {
      nickname: 'Aditya',
      baseColor: '#5068A8',
      calendars: [
        { name: 'Work', shade: '' },
        { name: 'Personal', shade: '' },
        { name: 'Health', shade: '' },
      ],
    },
    {
      nickname: 'Priya',
      baseColor: '#8B5E3C',
      calendars: [
        { name: 'Work', shade: '' },
        { name: 'Study', shade: '' },
      ],
    },
  ],
};

// Resolve demo room shades
DEMO_ROOM.users.forEach((u) => {
  const shades = generateShades(u.baseColor, u.calendars.length);
  u.calendars = u.calendars.map((c, i) => ({ ...c, shade: shades[i] }));
});

function buildDemoEvents(room: RoomState): CalendarEvent[] {
  const today = new Date();
  const d = (offset: number, h: number, m: number) => {
    const dt = new Date(today);
    dt.setDate(today.getDate() + offset);
    dt.setHours(h, m, 0, 0);
    return dt.toISOString();
  };

  const titles = [
    ['Standup', 'Product review', 'Morning run', 'Dinner with family', '1:1 with manager'],
    ['Client call', 'ML lecture', 'Sprint planning', 'Paper reading', 'Team lunch'],
    ['Design sync', 'Focus block', 'Planning review', 'Workout', 'Project check-in'],
  ];

  return room.users.flatMap((user, userIndex) => {
    const userTitles = titles[userIndex % titles.length];
    return user.calendars.slice(0, 3).flatMap((cal, calIndex) => {
      const firstHour = 9 + userIndex + calIndex * 2;
      const secondHour = 13 + userIndex + calIndex;
      return [
        {
          id: `${user.nickname}-${cal.name}-1`,
          title: userTitles[calIndex] || `${cal.name} block`,
          start: d(calIndex, firstHour, 0),
          end: d(calIndex, firstHour + 1, 0),
          backgroundColor: cal.shade,
          borderColor: cal.shade,
          extendedProps: { userNickname: user.nickname, calendarName: cal.name },
        },
        {
          id: `${user.nickname}-${cal.name}-2`,
          title: userTitles[calIndex + 2] || `${cal.name} review`,
          start: d(calIndex + 1, secondHour, 30),
          end: d(calIndex + 1, secondHour + 1, 30),
          backgroundColor: cal.shade,
          borderColor: cal.shade,
          extendedProps: { userNickname: user.nickname, calendarName: cal.name },
        },
      ];
    });
  });
}

// ─── Preset Colour Options ────────────────────────────────────────────────────
const COLOR_PRESETS = [
  '#4F6EB5', '#5B8E6A', '#A0634E', '#7A5BA8', '#5B8EA0', '#A08E4E',
  '#B5504F', '#4EA0A0', '#8E5B8A', '#6E8E4F',
];

// ─── Join Room Screen ─────────────────────────────────────────────────────────
function JoinRoomScreen({ onJoin }: { onJoin: (payload: JoinRoomPayload) => void }) {
  const [mode, setMode] = useState<'landing' | 'create' | 'join'>('landing');
  const [nickname, setNickname] = useState('');
  const [roomName, setRoomName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [roomPassword, setRoomPassword] = useState('');
  const [baseColor, setBaseColor] = useState(COLOR_PRESETS[0]);
  const [customColor, setCustomColor] = useState('');

  function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'UNIFY-';
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
    setRoomCode(code);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === 'landing') return;
    if (!nickname.trim() || !roomCode.trim() || !roomPassword.trim()) return;
    onJoin({
      mode,
      nickname: nickname.trim(),
      roomName: roomName.trim() || roomCode.trim().toUpperCase(),
      roomCode: roomCode.trim().toUpperCase(),
      roomPassword: roomPassword.trim(),
      baseColor,
    });
  }

  if (mode === 'landing') {
    return (
      <div className="join-screen welcome-stage">
        <div className="door-scene" aria-hidden="true">
          <div className="door-frame">
            <div className="door-panel" />
            <div className="door-light" />
          </div>
        </div>
        <div className="join-hero">
          <div className="join-logo">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="12" fill="var(--accent-color)" fillOpacity="0.15"/>
              <circle cx="14" cy="20" r="5" fill="var(--accent-color)" fillOpacity="0.6"/>
              <circle cx="26" cy="20" r="5" fill="var(--accent-color)"/>
              <path d="M19 20h2" stroke="var(--accent-color)" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <h1 className="join-title">Unify</h1>
          <p className="join-subtitle">A shared calendar room for many people. See schedules, plan together, and invite everyone without losing context.</p>
          <blockquote className="welcome-quote">"Time opens when everyone can see the same door."</blockquote>
          <div className="join-actions">
            <button className="primary-btn join-btn" onClick={() => { generateRoomCode(); setMode('create'); }}>
              Create a Room
            </button>
            <button className="secondary-btn join-btn" onClick={() => setMode('join')}>
              Join a Room
            </button>
          </div>
          <button
            className="demo-link"
            onClick={() => onJoin({
              mode: 'join',
              nickname: '__DEMO__',
              roomName: DEMO_ROOM.roomName,
              roomCode: '__DEMO__',
              roomPassword: 'demo',
              baseColor: '#5068A8',
            })}
          >
            Preview demo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="join-screen">
      <div className="join-card">
        <button className="back-btn" onClick={() => setMode('landing')}>← Back</button>
        <h2>{mode === 'create' ? 'Create a Room' : 'Join a Room'}</h2>
        <p className="join-card-sub">
          {mode === 'create'
            ? 'Share the room name, code, and password with the people joining.'
            : 'Enter the room details shared by the host.'}
        </p>
        <form onSubmit={handleSubmit} className="join-form">
          <div className="form-group">
            <label>Your Nickname</label>
            <input
              type="text"
              placeholder="e.g. Aditya"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label>Room Name</label>
            <input
              type="text"
              placeholder="e.g. Product launch"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Room Code</label>
            <div className="room-code-row">
              <input
                type="text"
                placeholder="e.g. UNIFY-AB12"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                required
                style={{ fontFamily: 'monospace', letterSpacing: '0.1em' }}
              />
              {mode === 'create' && (
                <button type="button" onClick={generateRoomCode} className="regen-btn">↻</button>
              )}
            </div>
          </div>

          <div className="form-group">
            <label>Room Password</label>
            <input
              type="password"
              placeholder="Required to enter"
              value={roomPassword}
              onChange={(e) => setRoomPassword(e.target.value)}
              minLength={4}
              required
            />
          </div>

          <div className="form-group">
            <label>Your Colour</label>
            <p className="color-hint">All your calendars will be shades of this colour.</p>
            <div className="color-presets">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`color-swatch ${baseColor === c ? 'selected' : ''}`}
                  style={{ background: c }}
                  onClick={() => setBaseColor(c)}
                />
              ))}
              <div className="color-picker-wrap">
                <input
                  type="color"
                  className="color-picker-input"
                  value={customColor || baseColor}
                  onChange={(e) => { setCustomColor(e.target.value); setBaseColor(e.target.value); }}
                  title="Custom colour"
                />
                <span className="color-picker-label">Custom</span>
              </div>
            </div>
            <div className="color-preview-row">
              {generateShades(baseColor, 3).map((shade, i) => (
                <div key={i} className="shade-chip" style={{ background: shade }}>
                  Cal {i + 1}
                </div>
              ))}
            </div>
          </div>

          <button type="submit" className="primary-btn" style={{ width: '100%', marginTop: 8 }}>
            {mode === 'create' ? 'Create & Enter Room' : 'Join Room'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Main Calendar View ───────────────────────────────────────────────────────
export default function CalendarView() {
  const [authUser, setAuthUser] = useState<AuthUser | null | undefined>(undefined);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [currentUser, setCurrentUser] = useState<UserSlot | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [hiddenUsers, setHiddenUsers] = useState<Set<string>>(new Set());
  const [hiddenCals, setHiddenCals] = useState<Set<string>>(new Set());
  const [showRoomIntro, setShowRoomIntro] = useState(false);
  const [roomNotice, setRoomNotice] = useState('');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalSelection, setModalSelection] = useState<{ startStr: string; endStr: string } | null>(null);
  const [eventTitle, setEventTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date>(new Date());

  useEffect(() => {
    let isMounted = true;
    fetch('/api/auth/me')
      .then((response) => response.ok ? response.json() : { user: null })
      .then((body) => {
        if (isMounted) setAuthUser(body.user);
      })
      .catch(() => {
        if (isMounted) setAuthUser(null);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  function enterRoom(nextRoom: RoomState, me: UserSlot, nextEvents: CalendarEvent[]) {
    setRoom(nextRoom);
    setCurrentUser(me);
    setEvents(nextEvents);
    setLastSynced(new Date());
    setShowRoomIntro(true);
    window.setTimeout(() => setShowRoomIntro(false), 2200);
  }

  function buildUser(nickname: string, baseColor: string): UserSlot {
    const shades = generateShades(baseColor, 3);
    return {
      nickname,
      baseColor,
      calendars: [
        { name: 'Work', shade: shades[0] },
        { name: 'Personal', shade: shades[1] },
        { name: 'Health', shade: shades[2] },
      ],
    };
  }

  async function handleJoin(payload: JoinRoomPayload) {
    if (payload.nickname === '__DEMO__') {
      const me = DEMO_ROOM.users[0];
      enterRoom(DEMO_ROOM, me, buildDemoEvents(DEMO_ROOM));
      return;
    }

    const me = buildUser(payload.nickname, payload.baseColor);
    let users = [me];
    let roomName = payload.roomName;

    try {
      const response = await fetch(payload.mode === 'create' ? '/api/rooms' : '/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Room sync failed');
      }

      const body = await response.json();
      roomName = body.room?.room_name || roomName;
      users = (body.members || []).map((member: { nickname: string; base_color: string }) => (
        buildUser(member.nickname, member.base_color)
      ));
      setRoomNotice('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Room sync failed';
      setRoomNotice(`Using a local room preview because backend room sync failed: ${message}`);
    }

    const newRoom: RoomState = {
      roomName,
      roomCode: payload.roomCode,
      hasPassword: Boolean(payload.roomPassword),
      users,
    };

    enterRoom(newRoom, me, buildDemoEvents(newRoom));
  }

  const visibleEvents = events.filter((ev) => {
    const user = ev.extendedProps.userNickname;
    const calKey = `${user}::${ev.extendedProps.calendarName}`;
    return !hiddenUsers.has(user) && !hiddenCals.has(calKey);
  });
  const conflictGroups = useMemo(() => detectConflictGroups(visibleEvents), [visibleEvents]);
  const conflictedEventIds = useMemo(() => getConflictedEventIds(visibleEvents), [visibleEvents]);

  function toggleUser(nickname: string) {
    setHiddenUsers((prev) => {
      const next = new Set(prev);
      next.has(nickname) ? next.delete(nickname) : next.add(nickname);
      return next;
    });
  }

  function toggleCal(userNickname: string, calName: string) {
    const key = `${userNickname}::${calName}`;
    setHiddenCals((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function handleDateSelect(selection: DateSelectArg) {
    setModalSelection({ startStr: selection.startStr, endStr: selection.endStr });
    setEventTitle('');
    setIsModalOpen(true);
  }

  function handleCreateEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!eventTitle || !modalSelection || !currentUser) return;
    setIsSubmitting(true);

    setTimeout(() => {
      const shade = currentUser.calendars[0]?.shade || currentUser.baseColor;
      const newEv: CalendarEvent = {
        id: Date.now().toString(),
        title: eventTitle,
        start: modalSelection.startStr,
        end: modalSelection.endStr,
        backgroundColor: shade,
        borderColor: shade,
        extendedProps: {
          userNickname: currentUser.nickname,
          calendarName: currentUser.calendars[0]?.name || 'Work',
        },
      };
      setEvents((prev) => [...prev, newEv]);
      setLastSynced(new Date());
      setIsSubmitting(false);
      setIsModalOpen(false);
    }, 400);
  }

  function renderEventContent(eventInfo: EventContentArg) {
    const user = eventInfo.event.extendedProps.userNickname;
    const cal = eventInfo.event.extendedProps.calendarName;
    return (
      <div className={`custom-event ${conflictedEventIds.has(eventInfo.event.id) ? 'event-conflict' : ''}`}>
        <span className="event-user-dot" style={{ background: eventInfo.event.backgroundColor }} />
        <span className="event-label">{user} · {cal}</span>
        {conflictedEventIds.has(eventInfo.event.id) && <span className="conflict-pill">Conflict</span>}
        <span className="event-title">{eventInfo.event.title}</span>
      </div>
    );
  }

  if (authUser === undefined) {
    return <div className="join-screen"><div className="join-card"><h2>Loading</h2></div></div>;
  }

  if (!authUser) {
    return <GoogleAuthScreen />;
  }

  // If room not set, show join screen
  if (!room || !currentUser) {
    return <JoinRoomScreen onJoin={handleJoin} />;
  }

  return (
    <div className="app-container">
      {/* ── Sidebar ── */}
      <div className="sidebar">
        <div className="sidebar-logo">
          <svg width="28" height="28" viewBox="0 0 40 40" fill="none">
            <rect width="40" height="40" rx="10" fill="var(--accent-color)" fillOpacity="0.15"/>
            <circle cx="14" cy="20" r="5" fill="var(--accent-color)" fillOpacity="0.6"/>
            <circle cx="26" cy="20" r="5" fill="var(--accent-color)"/>
            <path d="M19 20h2" stroke="var(--accent-color)" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <span className="sidebar-app-name">Unify</span>
        </div>

        <div className="room-badge">
          <span className="room-badge-label">{room.roomName}</span>
          <span className="room-badge-code">{room.roomCode}</span>
          {room.hasPassword && <span className="room-lock">Password protected</span>}
        </div>

        <div className="auth-chip">
          <span>Google</span>
          <strong>{authUser.email}</strong>
        </div>

        <button className="primary-btn new-event-btn" onClick={() => setIsModalOpen(true)}>
          + New Event
        </button>

        {/* Per-user calendar legend */}
        <div className="cal-legend">
          {room.users.map((user) => {
            const isUserHidden = hiddenUsers.has(user.nickname);
            const isMe = user.nickname === currentUser.nickname;
            return (
              <div key={user.nickname} className="legend-user-group">
                <button
                  className={`legend-user-header ${isUserHidden ? 'dimmed' : ''}`}
                  onClick={() => toggleUser(user.nickname)}
                >
                  <div className="legend-user-swatch" style={{ background: user.baseColor }} />
                  <span>{user.nickname}</span>
                  {isMe && <span className="you-badge">you</span>}
                  <span className="toggle-icon">{isUserHidden ? '◉' : '●'}</span>
                </button>
                {!isUserHidden && (
                  <div className="legend-cals">
                    {user.calendars.map((cal) => {
                      const key = `${user.nickname}::${cal.name}`;
                      const isCalHidden = hiddenCals.has(key);
                      return (
                        <button
                          key={cal.name}
                          className={`legend-cal-item ${isCalHidden ? 'dimmed' : ''}`}
                          onClick={() => toggleCal(user.nickname, cal.name)}
                        >
                          <div className="legend-cal-dot" style={{ background: cal.shade }} />
                          <span>{cal.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="sidebar-footer">
          <div className="sync-status">
            <div className="sync-dot" />
            <span>Synced · {lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <button
            className="leave-btn"
            onClick={() => { setRoom(null); setCurrentUser(null); }}
          >
            Leave Room
          </button>
        </div>
      </div>

      {/* ── Main ── */}
      <div className="main-content">
        {roomNotice && <div className="room-notice">{roomNotice}</div>}
        {conflictGroups.length > 0 && (
          <div className="conflict-summary">
            <strong>{conflictGroups.length} overlap{conflictGroups.length === 1 ? '' : 's'} in view</strong>
            <span>
              Conflicted meetings are marked and kept side-by-side so no one disappears behind another event.
            </span>
          </div>
        )}
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay',
          }}
          events={visibleEvents}
          selectable
          selectMirror
          select={handleDateSelect}
          eventContent={renderEventContent}
          height="100%"
          dayMaxEvents={true}
          eventMaxStack={4}
          slotEventOverlap={false}
          slotLabelFormat={{ hour: 'numeric', minute: '2-digit', meridiem: 'short' }}
          eventClick={(info: EventClickArg) => {
            const user = info.event.extendedProps.userNickname;
            const cal = info.event.extendedProps.calendarName;
            alert(`${info.event.title}\nBy: ${user} (${cal})`);
          }}
        />
      </div>

      {/* ── New Event Modal ── */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>New Event</h2>
            <p className="modal-sub">Will be added to <strong>{currentUser.nickname}</strong>'s calendars</p>
            <form onSubmit={handleCreateEvent}>
              <div className="form-group">
                <label>Event Title</label>
                <input
                  type="text"
                  autoFocus
                  required
                  placeholder="e.g. Coffee catchup"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                />
              </div>
              {modalSelection && (
                <div className="modal-time-preview">
                  <span>🕐</span>
                  <span>
                    {new Date(modalSelection.startStr).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    {' → '}
                    {new Date(modalSelection.endStr).toLocaleString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )}
              <div className="modal-actions">
                <button type="button" onClick={() => setIsModalOpen(false)} className="cancel-btn">Cancel</button>
                <button type="submit" className="primary-btn" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving…' : 'Save Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRoomIntro && (
        <div className="room-intro" aria-live="polite">
          <div className="intro-door" aria-hidden="true">
            <div className="intro-door-panel" />
            <div className="intro-door-glow" />
          </div>
          <div className="intro-copy">
            <span>Welcome to</span>
            <strong>{room.roomName}</strong>
            <q>Great meetings begin before the first minute is spent.</q>
          </div>
        </div>
      )}
    </div>
  );
}
