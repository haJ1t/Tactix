import { ReactNode } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

interface AppLayoutProps {
    children: ReactNode;
    title?: string;
}

export default function AppLayout({ children, title }: AppLayoutProps) {
    return (
        <div className="app-layout">
            <Sidebar />
            <main className="main-content">
                <Header title={title} userName="Halil" />
                <div className="page-content">
                    {children}
                </div>
            </main>
        </div>
    );
}
