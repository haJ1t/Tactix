import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { PropsWithChildren, ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';

interface RenderOptions {
    route?: string;
}

export const renderWithProviders = (ui: ReactElement, options: RenderOptions = {}) => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
                gcTime: 0,
            },
            mutations: {
                retry: false,
            },
        },
    });

    const Wrapper = ({ children }: PropsWithChildren) => (
        <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={[options.route || '/']}>{children}</MemoryRouter>
        </QueryClientProvider>
    );

    return render(ui, { wrapper: Wrapper });
};
