import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';

import { useAuth } from './features/auth/authStore';
import { router } from './router';
import { RealtimeBridge } from './shared/realtime/RealtimeBridge';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: true },
  },
});

export function App() {
  const bootstrap = useAuth((s) => s.bootstrap);

  // A reload loses the in-memory access token by design; the refresh cookie
  // recovers the session silently (AUTH-12).
  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return (
    <QueryClientProvider client={queryClient}>
      <RealtimeBridge />
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
