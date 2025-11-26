/**
 * React Testing Library helpers for UI component tests
 * Provides common render function with all necessary providers
 */

import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TamaguiProvider } from '@/lib/tamagui/Provider';
import { api } from '@/lib/trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import type { AppRouter } from '@/server/api/root';

// Create a test query client
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  });
}

// Create a test tRPC client
function createTestTRPCClient() {
  return api.createClient({
    transformer: superjson,
    links: [
      httpBatchLink({
        url: 'http://localhost:3010/api/trpc',
        fetch: async (url, options) => {
          // Mock fetch for tests - return empty responses
          return new Response(JSON.stringify({}), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        },
      }),
    ],
  });
}

interface AllTheProvidersProps {
  children: React.ReactNode;
  queryClient?: QueryClient;
  trpcClient?: ReturnType<typeof api.createClient>;
}

function AllTheProviders({ 
  children, 
  queryClient = createTestQueryClient(),
  trpcClient = createTestTRPCClient(),
}: AllTheProvidersProps) {
  return (
    <api.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <TamaguiProvider>
          {children}
        </TamaguiProvider>
      </QueryClientProvider>
    </api.Provider>
  );
}

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient;
  trpcClient?: any;
}

/**
 * Custom render function that includes all necessary providers
 * Use this instead of the default render from @testing-library/react
 */
export function renderWithProviders(
  ui: React.ReactElement,
  {
    queryClient,
    trpcClient,
    ...renderOptions
  }: CustomRenderOptions = {}
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <AllTheProviders queryClient={queryClient} trpcClient={trpcClient}>
        {children}
      </AllTheProviders>
    );
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

// Re-export everything from @testing-library/react
export * from '@testing-library/react';
export { renderWithProviders as render };

