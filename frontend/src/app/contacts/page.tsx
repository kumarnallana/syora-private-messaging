import { Suspense } from 'react';
import { Shell } from '@/components/shell';
import { Contacts } from '@/components/contacts/contacts';
import { Loading } from '@/components/shared/ui';
export default function Page(){return <Shell><Suspense fallback={<Loading/>}><Contacts/></Suspense></Shell>}
