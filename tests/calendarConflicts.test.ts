import { describe, expect, it } from 'vitest';
import { detectConflictGroups, getConflictedEventIds } from '../lib/calendarConflicts';

const base = '2026-06-12T';

describe('calendar conflict detection', () => {
  it('marks events that overlap in time', () => {
    const events = [
      {
        id: 'a',
        title: 'Design review',
        start: `${base}09:00:00.000Z`,
        end: `${base}10:00:00.000Z`,
        extendedProps: { userNickname: 'Aditi' },
      },
      {
        id: 'b',
        title: 'Customer call',
        start: `${base}09:30:00.000Z`,
        end: `${base}10:30:00.000Z`,
        extendedProps: { userNickname: 'Rohan' },
      },
      {
        id: 'c',
        title: 'Lunch',
        start: `${base}12:00:00.000Z`,
        end: `${base}13:00:00.000Z`,
        extendedProps: { userNickname: 'Aditi' },
      },
    ];

    expect(Array.from(getConflictedEventIds(events)).sort()).toEqual(['a', 'b']);
    expect(detectConflictGroups(events)).toEqual([
      {
        ids: ['a', 'b'],
        start: `${base}09:30:00.000Z`,
        end: `${base}10:00:00.000Z`,
        users: ['Aditi', 'Rohan'],
      },
    ]);
  });

  it('does not mark back-to-back meetings as conflicts', () => {
    const events = [
      { id: 'a', title: 'One', start: `${base}09:00:00.000Z`, end: `${base}10:00:00.000Z` },
      { id: 'b', title: 'Two', start: `${base}10:00:00.000Z`, end: `${base}11:00:00.000Z` },
    ];

    expect(detectConflictGroups(events)).toEqual([]);
  });
});
