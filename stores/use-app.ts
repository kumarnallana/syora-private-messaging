'use client';
import { useSyncExternalStore } from 'react';
import { services } from '@/services/mock';
export function useApp(){const state=useSyncExternalStore(services.subscribe,services.getSnapshot,services.getSnapshot);return {...state,services,me:state.users.find(u=>u.id===state.currentUserId)};}
