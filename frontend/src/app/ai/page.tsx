import { Suspense } from 'react';
import { Shell } from '@/components/shell';
import { AIAssistant } from '@/components/ai/ai-assistant';
import { Loading } from '@/components/shared/ui';

export const metadata = {
  title: 'Syora AI — Professional Messaging Assistant',
  description: 'AI-powered professional messaging assistant for generating, refining, and sending messages.',
};

export default function Page() {
  return (
    <Shell>
      <Suspense fallback={<Loading />}>
        <AIAssistant />
      </Suspense>
    </Shell>
  );
}
