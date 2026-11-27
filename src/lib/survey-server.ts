import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

/** 계정 정보 암호화 키. 환경변수 SURVEY_SECRET_KEY(32자 이상)가 없으면 null — 그때는 계정 정보를 저장하지 않는다 */
function secretKey(): Buffer | null {
  const raw = process.env.SURVEY_SECRET_KEY || '';
  return raw.length >= 32 ? createHash('sha256').update(raw).digest() : null;
}

export const hasSecretKey = () => secretKey() !== null;

/** AES-256-GCM → "iv.tag.ciphertext" (base64url) */
export function encryptJson(value: unknown): string {
  const key = secretKey();
  if (!key) throw new Error('SURVEY_SECRET_KEY 없음');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map(b => b.toString('base64url')).join('.');
}

export function decryptJson(payload: string): Record<string, unknown> {
  const key = secretKey();
  if (!key) throw new Error('SURVEY_SECRET_KEY 없음');
  const [iv, tag, body] = payload.split('.').map(p => Buffer.from(p, 'base64url'));
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8'));
}

/** 추측할 수 없는 링크 토큰(192비트) */
export const newToken = () => randomBytes(24).toString('base64url');

export const LINK_DAYS = 30;
export const expiryFromNow = () => new Date(Date.now() + LINK_DAYS * 86400_000).toISOString();

/** NAS 주소: 빈칸이면 null, https:// 주소만 받는다. 그 밖에는 undefined(거절) */
export function parseNasUrl(v: unknown): string | null | undefined {
  if (v === undefined || v === null || (typeof v === 'string' && !v.trim())) return null;
  if (typeof v !== 'string') return undefined;
  try {
    return new URL(v.trim()).protocol === 'https:' ? v.trim() : undefined;
  } catch {
    return undefined;
  }
}
