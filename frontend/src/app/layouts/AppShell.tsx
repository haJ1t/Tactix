import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
    ChevronLeft,
    ChevronRight,
    Crosshair,
    FileText,
    LayoutDashboard,
    Menu,
    Users,
    X,
    Zap,
} from 'lucide-react';

const navItems = [
    { label: 'Overview', to: '/overview', icon: LayoutDashboard },
    { label: 'Matches', to: '/matches', icon: Crosshair },
    { label: 'Teams', to: '/teams', icon: Users },
    { label: 'Reports', to: '/reports', icon: FileText },
];

const sectionTitles: Record<string, { title: string; context: string }> = {
    overview: { title: 'Overview', context: 'Workspace summary and recent analysis' },
    matches: { title: 'Matches', context: 'Fixture catalog and match review' },
    teams: { title: 'Teams', context: 'Season-scoped team analysis' },
    reports: { title: 'Reports', context: 'PDF dossiers and saved outputs' },
};

const getShellMeta = (pathname: string) => {
    const firstSegment = pathname.split('/').filter(Boolean)[0] || 'overview';
    return sectionTitles[firstSegment] || sectionTitles.overview;
};

function SidebarContent({
    collapsed,
    onToggle,
    onNavigate,
}: {
    collapsed: boolean;
    onToggle?: () => void;
    onNavigate?: () => void;
}) {
    const location = useLocation();

    return (
        <>
            <div className="flex h-16 items-center gap-3 border-b border-[var(--border-soft)] px-4">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-[rgba(79,143,101,0.22)] bg-[var(--primary-soft)] text-[var(--primary-strong)]">
                    <Zap size={18} />
                </div>
                {!collapsed && (
                    <div className="min-w-0">
                        <h1 className="truncate text-base font-bold text-[var(--text-primary)]">Tactix</h1>
                        <p className="truncate text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                            Football analytics
                        </p>
                    </div>
                )}
            </div>

            <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Primary navigation">
                {navItems.map((item) => {
                    const isActive = location.pathname.startsWith(item.to);
                    const Icon = item.icon;

                    return (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            onClick={onNavigate}
                            className={({ isActive: linkActive }) =>
                                [
                                    'group relative flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition-colors',
                                    linkActive || isActive
                                        ? 'bg-[var(--primary-soft)] text-[var(--primary-strong)]'
                                        : 'text-[var(--text-secondary)] hover:bg-[var(--surface-soft)] hover:text-[var(--text-primary)]',
                                    collapsed ? 'justify-center' : '',
                                ].join(' ')
                            }
                            aria-label={collapsed ? item.label : undefined}
                            title={collapsed ? item.label : undefined}
                        >
                            <Icon size={19} strokeWidth={1.9} className="shrink-0" />
                            {!collapsed && <span className="truncate">{item.label}</span>}
                            {(isActive && !collapsed) && (
                                <span className="ml-auto h-2 w-2 rounded-full bg-[var(--primary)]" aria-hidden />
                            )}
                        </NavLink>
                    );
                })}
            </nav>

            {onToggle && (
                <div className="border-t border-[var(--border-soft)] p-3">
                    <button
                        className="btn-ghost h-10 w-full px-0"
                        onClick={onToggle}
                        type="button"
                        aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
                    >
                        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                        {!collapsed && <span>Collapse</span>}
                    </button>
                </div>
            )}
        </>
    );
}

export default function AppShell() {
    const location = useLocation();
    const meta = getShellMeta(location.pathname);
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    useEffect(() => {
        setMobileOpen(false);
    }, [location.pathname]);

    return (
        <div className="min-h-screen bg-transparent text-[var(--text-primary)]">
            <aside
                className={[
                    'fixed left-0 top-0 z-40 hidden h-screen flex-col border-r border-[var(--border)] bg-[rgba(255,255,255,0.86)] shadow-[var(--shadow-xs)] backdrop-blur md:flex',
                    collapsed ? 'w-[76px]' : 'w-[248px]',
                ].join(' ')}
            >
                <SidebarContent collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} />
            </aside>

            <AnimatePresence>
                {mobileOpen && (
                    <>
                        <motion.div
                            className="fixed inset-0 z-40 bg-[rgba(29,37,45,0.18)] md:hidden"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setMobileOpen(false)}
                        />
                        <motion.aside
                            className="fixed inset-y-0 left-0 z-50 flex w-[82vw] max-w-[320px] flex-col border-r border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-sm)] md:hidden"
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ duration: 0.18, ease: 'easeOut' }}
                        >
                            <button
                                className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface-soft)]"
                                type="button"
                                aria-label="Close navigation"
                                onClick={() => setMobileOpen(false)}
                            >
                                <X size={18} />
                            </button>
                            <SidebarContent collapsed={false} onNavigate={() => setMobileOpen(false)} />
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>

            <div className={collapsed ? 'md:pl-[76px]' : 'md:pl-[248px]'}>
                <header className="sticky top-0 z-30 border-b border-[var(--border-soft)] bg-[rgba(247,248,244,0.9)] backdrop-blur">
                    <div className="flex min-h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
                        <div className="flex min-w-0 items-center gap-3">
                            <button
                                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] md:hidden"
                                type="button"
                                aria-label="Open navigation"
                                onClick={() => setMobileOpen(true)}
                            >
                                <Menu size={18} />
                            </button>
                            <div className="min-w-0">
                                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.13em] text-[var(--text-muted)]">
                                    Tactix
                                </p>
                                <h2 className="truncate text-lg font-semibold text-[var(--text-primary)]">{meta.title}</h2>
                            </div>
                        </div>
                        <div className="hidden min-w-0 items-center gap-2 text-right sm:flex">
                            <span className="h-2 w-2 rounded-full bg-[var(--primary)]" aria-hidden />
                            <span className="truncate text-xs font-medium text-[var(--text-secondary)]">{meta.context}</span>
                        </div>
                    </div>
                </header>

                <main className="px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
                    <div className="mx-auto w-full max-w-[1500px]">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
}
