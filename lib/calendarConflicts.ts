export type ConflictEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  extendedProps?: {
    userNickname?: string;
    calendarName?: string;
  };
};

export type ConflictGroup = {
  ids: string[];
  start: string;
  end: string;
  users: string[];
};

function toMillis(value: string) {
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
}

export function detectConflictGroups(events: ConflictEvent[]): ConflictGroup[] {
  const timedEvents = events
    .map((event) => ({
      event,
      start: toMillis(event.start),
      end: toMillis(event.end),
    }))
    .filter((item): item is { event: ConflictEvent; start: number; end: number } => (
      item.start !== null && item.end !== null && item.start < item.end
    ))
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const groups: ConflictGroup[] = [];
  let active: typeof timedEvents = [];

  for (const item of timedEvents) {
    active = active.filter((candidate) => candidate.end > item.start);
    const overlapping = active.filter((candidate) => candidate.start < item.end);

    if (overlapping.length > 0) {
      const groupItems = [...overlapping, item];
      const ids = Array.from(new Set(groupItems.map(({ event }) => event.id))).sort();
      const existing = groups.find((group) => ids.every((id) => group.ids.includes(id)) && group.ids.length === ids.length);
      if (!existing) {
        groups.push({
          ids,
          start: new Date(Math.max(...groupItems.map(({ start }) => start))).toISOString(),
          end: new Date(Math.min(...groupItems.map(({ end }) => end))).toISOString(),
          users: Array.from(new Set(groupItems.map(({ event }) => event.extendedProps?.userNickname).filter(Boolean) as string[])).sort(),
        });
      }
    }

    active.push(item);
  }

  return groups;
}

export function getConflictedEventIds(events: ConflictEvent[]) {
  return new Set(detectConflictGroups(events).flatMap((group) => group.ids));
}
