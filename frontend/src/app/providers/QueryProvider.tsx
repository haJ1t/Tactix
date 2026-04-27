import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense, type PropsWithChildren } from 'react';

// Lazy load devtools in dev only
const QueryDevtools = import.meta.env.DEV && import.meta.env.VITE_ENABLE_QUERY_DEVTOOLS === 'true'
    ? lazy(() => import('@tanstack/react-query-devtools').then((module) => ({ default: module.ReactQueryDevtools })))
    : null;

// Configure react query client
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 5,
            gcTime: 1000 * 60 * 30,
            retry: 1,
            refetchOnWindowFocus: false,
        },
        mutations: {
            retry: 0,
        },
    },
});

export function QueryProvider({ children }: PropsWithChildren) {
    return (
        <QueryClientProvider client={queryClient}>
            {children}
            {QueryDevtools ? (
                <Suspense fallback={null}>
                    <QueryDevtools initialIsOpen={false} />
                </Suspense>
            ) : null}
        </QueryClientProvider>
    );
}

export { queryClient };
