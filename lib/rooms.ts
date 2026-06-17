import { randomBytes, pbkdf2Sync, timingSafeEqual } from 'crypto';

const HASH_ITERATIONS = 120000;
const HASH_KEY_LENGTH = 32;
const HASH_DIGEST = 'sha256';

export function hashRoomPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, HASH_ITERATIONS, HASH_KEY_LENGTH, HASH_DIGEST).toString('hex');
  return `pbkdf2:${HASH_DIGEST}:${HASH_ITERATIONS}:${salt}:${hash}`;
}

export function verifyRoomPassword(password: string, storedHash: string) {
  const [algorithm, digest, iterations, salt, hash] = storedHash.split(':');
  if (algorithm !== 'pbkdf2' || !digest || !iterations || !salt || !hash) return false;

  const candidate = pbkdf2Sync(password, salt, Number(iterations), HASH_KEY_LENGTH, digest).toString('hex');
  const candidateBuffer = Buffer.from(candidate, 'hex');
  const hashBuffer = Buffer.from(hash, 'hex');

  return candidateBuffer.length === hashBuffer.length && timingSafeEqual(candidateBuffer, hashBuffer);
}
