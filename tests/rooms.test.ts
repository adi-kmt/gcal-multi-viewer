import { describe, expect, it } from 'vitest';
import { hashRoomPassword, verifyRoomPassword } from '../lib/rooms';

describe('room password hashing', () => {
  it('verifies the original password', () => {
    const storedHash = hashRoomPassword('correct horse battery staple');

    expect(verifyRoomPassword('correct horse battery staple', storedHash)).toBe(true);
    expect(verifyRoomPassword('wrong password', storedHash)).toBe(false);
  });

  it('uses a unique salt for each hash', () => {
    const first = hashRoomPassword('same-password');
    const second = hashRoomPassword('same-password');

    expect(first).not.toEqual(second);
    expect(verifyRoomPassword('same-password', first)).toBe(true);
    expect(verifyRoomPassword('same-password', second)).toBe(true);
  });
});
