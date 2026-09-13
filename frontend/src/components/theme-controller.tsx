'use client';

import { useEffect } from 'react';
import { useApp } from '@/stores/use-app';

export function ThemeController() {
  const { preferences } = useApp();

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const apply = () => {
      document.documentElement.dataset.theme = preferences.appearance === 'system'
        ? (media.matches ? 'light' : 'dark')
        : preferences.appearance;
    };
    apply();
    if (preferences.appearance === 'system') media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [preferences.appearance]);

  return null;
}
