import { Suspense } from 'react';
import { Shell } from '@/components/shell';
import { Chats } from '@/components/chat/chats';
import { Loading } from '@/components/shared/ui';
export default function Page(){return <Shell><Suspense fallback={<Loading/>}><Chats/></Suspense></Shell>}
