'use client';

import { AlertCircle, Check, CheckCheck, Clock3 } from 'lucide-react';
import type { Receipt } from '@/types';

const icons = {
 sending: Clock3,
 sent: Check,
 delivered: CheckCheck,
 read: CheckCheck,
 failed: AlertCircle,
};

export function DeliveryReceipt({state}:{state:Receipt}){
 const Icon=icons[state];
 return <span className={`receipt ${state}`} aria-label={state} title={state}><Icon size={13}/></span>;
}
