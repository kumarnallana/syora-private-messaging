'use client';

import { useEffect } from 'react';

export function ThemeController() {
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const apply = () => {
      let appearance: 'dark' | 'light' | 'system' = 'dark';
      try { appearance = JSON.parse(localStorage.getItem('syora:preferences') || '{}').appearance || 'dark'; } catch {}
      document.documentElement.dataset.theme = appearance === 'system'
        ? (media.matches ? 'light' : 'dark')
        : appearance;
    };
    apply();
    media.addEventListener('change', apply);
    window.addEventListener('storage', apply);
    window.addEventListener('syora:preferences-changed', apply);
    return () => {
      media.removeEventListener('change', apply);
      window.removeEventListener('storage', apply);
      window.removeEventListener('syora:preferences-changed', apply);
    };
  }, []);

  return null;
}
