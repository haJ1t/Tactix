import { NavLink, Outlet, useLocation } from 'react-router-dom';

const navItems = [
    {
        label: 'Overview',
        to: '/overview',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 12.5 12 5l8 7.5" />
                <path d="M6.5 10.5V19h11v-8.5" />
            </svg>
        ),
    },
    {
        label: 'Matches',
        to: '/matches',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="12" r="8.5" />
                <path d="M12 3.5v17M3.5 12h17" />
            </svg>
        ),
    },
    {
        label: 'Teams',
        to: '/teams',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M7.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                <path d="M16.5 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
                <path d="M3.5 18c.8-2.4 2.7-3.6 5.8-3.6S14.2 15.6 15 18" />
                <path d="M13.8 18c.5-1.7 1.9-2.6 4.2-2.6 1.2 0 2.2.3 2.9.8" />
            </svg>
        ),
    },
    {
        label: 'Reports',
        to: '/reports',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M7 4.5h7l3 3V19a1.5 1.5 0 0 1-1.5 1.5h-8A1.5 1.5 0 0 1 6 19V6A1.5 1.5 0 0 1 7.5 4.5Z" />
                <path d="M14 4.5V8h3.5" />
                <path d="M8.5 11.5h7M8.5 15h7" />
            </svg>
        ),
    },
];

const sectionTitles: Record<string, { title: string; context: string }> = {
    overview: { title: 'Overview', context: 'Product summary and recent activity' },
    matches: { title: 'Matches', context: 'Discovery and match workspaces' },
    teams: { title: 'Teams', context: 'Team profiles and aggregate analysis' },
    reports: { title: 'Reports', context: 'Saved analyst outputs' },
};

const getShellMeta = (pathname: string) => {
    const firstSegment = pathname.split('/').filter(Boolean)[0] || 'overview';
    return sectionTitles[firstSegment] || sectionTitles.overview;
};

export default function AppShell() {
    const location = useLocation();
    const meta = getShellMeta(location.pathname);

    return (
        <div className="app-layout">
            <aside className="sidebar">
                <div className="sidebar-logo">
                    <div className="sidebar-mark">
                        <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
                            <circle cx="16" cy="16" r="12" stroke="white" strokeWidth="1.8" />
                            <path d="M9.5 16h13M16 9.5v13M11.2 11.2l9.6 9.6M20.8 11.2l-9.6 9.6" stroke="white" strokeWidth="1.35" />
                        </svg>
                    </div>
                    <div className="sidebar-brand-copy">
                        <h1>Tactix</h1>
                        <p className="sidebar-caption">Analyst workspace</p>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                        >
                            <span className="nav-icon">{item.icon}</span>
                            <span>{item.label}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <span className="sidebar-footer-label">Workspace</span>
                    <strong>Quiet, focused, match-first</strong>
                </div>
            </aside>

            <main className="main-content">
                <header className="header shell-header">
                    <div className="shell-heading">
                        <p className="shell-breadcrumb">Tactix</p>
                        <h2 className="shell-title">{meta.title}</h2>
                    </div>
                    <div className="shell-meta">
                        <div className="shell-status">
                            <span className="shell-status-dot" />
                            <span>{meta.context}</span>
                        </div>
                    </div>
                </header>

                <div className="page-content">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
