// 관리자 화면이 이 브라우저에 기억해 두는 값들 (비밀 아님)
import { guessRepo, type RepoConfig } from './github';

export const CONFIG_KEY = 'sdi-admin-repo';
export const TOKEN_KEY = 'sdi-admin-token'; // "이 탭에서 기억하기"를 고른 경우에만, 탭 저장소에
const SITE_KEY = 'sdi-admin-site-url';
const EXPIRY_KEY = 'sdi-admin-token-expiry';

const get = (store: Storage, key: string) => {
  try {
    return store.getItem(key) ?? '';
  } catch {
    return '';
  }
};
const set = (store: Storage, key: string, value: string) => {
  try {
    if (value) store.setItem(key, value);
    else store.removeItem(key);
  } catch {}
};

export function readConfig(): RepoConfig {
  const guess = guessRepo();
  try {
    const saved = JSON.parse(get(localStorage, CONFIG_KEY) || 'null') as Partial<RepoConfig> | null;
    return { ...guess, ...Object.fromEntries(Object.entries(saved ?? {}).filter(([, v]) => v)) };
  } catch {
    return guess;
  }
}
export const saveConfig = (c: RepoConfig) => set(localStorage, CONFIG_KEY, JSON.stringify(c));
export const readToken = () => get(sessionStorage, TOKEN_KEY);
export const saveToken = (t: string) => set(sessionStorage, TOKEN_KEY, t);
/** 사용자 사이트(Render) 주소 */
export const readSiteUrl = () => get(localStorage, SITE_KEY);
export const saveSiteUrl = (url: string) => set(localStorage, SITE_KEY, url);
/** 깃허브가 만료일을 알려 주지 않을 때 관리자가 직접 적어 두는 키 만료일 (YYYY-MM-DD) */
export const readManualExpiry = () => get(localStorage, EXPIRY_KEY);
export const saveManualExpiry = (d: string) => set(localStorage, EXPIRY_KEY, d);
