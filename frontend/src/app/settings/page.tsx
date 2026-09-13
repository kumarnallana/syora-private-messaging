import { Suspense } from 'react';
import { Shell } from '@/components/shell';
import { Settings } from '@/components/settings/settings';
import { Loading } from '@/components/shared/ui';
export default function Page(){return <Shell><Suspense fallback={<Loading/>}><Settings/></Suspense></Shell>}
