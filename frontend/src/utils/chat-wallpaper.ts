export const CHAT_WALLPAPER_KEY = 'syora:chat-wallpaper';
export const CHAT_WALLPAPER_EVENT = 'syora:chat-wallpaper-changed';
export const MAX_CHAT_WALLPAPER_BYTES = 2 * 1024 * 1024;

export function getChatWallpaper() {
  if (typeof window === 'undefined') return '';
  const value = localStorage.getItem(CHAT_WALLPAPER_KEY) || '';
  return value.startsWith('data:image/') ? value : '';
}

export function saveChatWallpaper(value: string) {
  localStorage.setItem(CHAT_WALLPAPER_KEY, value);
  window.dispatchEvent(new Event(CHAT_WALLPAPER_EVENT));
}

export function clearChatWallpaper() {
  localStorage.removeItem(CHAT_WALLPAPER_KEY);
  window.dispatchEvent(new Event(CHAT_WALLPAPER_EVENT));
}

export function readChatWallpaper(file: File) {
  if (!file.type.startsWith('image/')) return Promise.reject(new Error('Choose an image file.'));
  if (file.size > MAX_CHAT_WALLPAPER_BYTES) return Promise.reject(new Error('Choose an image smaller than 2 MB.'));
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('This image could not be read.'));
    reader.readAsDataURL(file);
  });
}
