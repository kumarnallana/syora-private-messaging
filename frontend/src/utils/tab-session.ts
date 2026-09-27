const TAB_SESSION_KEY = 'syora:tab-authenticated';

export function hasTabSession() {
  if (typeof window === 'undefined') return false;
  try { return sessionStorage.getItem(TAB_SESSION_KEY) === 'true'; }
  catch { return false; }
}

export function markTabSession() {
  if (typeof window === 'undefined') return;
  try { sessionStorage.setItem(TAB_SESSION_KEY, 'true'); } catch {}
}

export function clearTabSession() {
  if (typeof window === 'undefined') return;
  try { sessionStorage.removeItem(TAB_SESSION_KEY); } catch {}
}
