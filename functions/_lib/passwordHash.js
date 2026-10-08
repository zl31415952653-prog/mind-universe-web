import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';

const encoder = new TextEncoder();
const hex = bytes => Array.from(new Uint8Array(bytes)).map(x => x.toString(16).padStart(2, '0')).join('');
const ITERATIONS = 210000;

async function nativeDerive(password, salt) {
  const key = await crypto.subtle.importKey('raw', password, 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' }, key, 256);
}

// 同一 PBKDF2 算法、次数、UTF-8 编码与输出长度，保留旧账户和会话散列。
// 只对明确的运行时次数上限使用兼容实现；其他异常仍失败，不降低次数。
export async function compatibleHash(text, salt, derive = nativeDerive) {
  const passwordBytes = encoder.encode(text);
  const saltBytes = encoder.encode(salt);
  try {
    return hex(await derive(passwordBytes, saltBytes));
  } catch (error) {
    if (!/iteration.*(?:100000|100,000|not supported|limit)|(?:100000|100,000).*iteration/i.test(String(error?.message || ''))) throw error;
    return hex(await pbkdf2Async(sha256, passwordBytes, saltBytes, { c: ITERATIONS, dkLen: 32, asyncTick: 10 }));
  }
}
