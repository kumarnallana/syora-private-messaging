'use client';

import { memo } from 'react';
import { AlertCircle, Check, CheckCheck, Clock3 } from 'lucide-react';
import type { Receipt } from '@/types';

const icons = {
 sending: Clock3,
 sent: Check,
 delivered: CheckCheck,
 read: CheckCheck,
 failed: AlertCircle,
};

export const DeliveryReceipt = memo(function DeliveryReceipt({state}:{state:Receipt}){

 const Icon=icons[state];
 return <span className={`receipt is-${state}`} aria-label={state} title={state}><Icon size={13}/></span>;
});
