import { Link, useLocation } from 'react-router-dom';

interface SidebarProps {
    onNavigate?: (page: string) => void;
}

export default function Sidebar({ onNavigate }: SidebarProps) {
    const location = useLocation();

    const isActive = (path: string) => {
        return location.pathname === path ||
            (path === '/dashboard' && location.pathname === '/');
    };

    const navItems = [
        { path: '/dashboard', label: 'Dashboard', icon: DashboardIcon },
        { path: '/matches', label: 'Matches', icon: MatchesIcon },
        { path: '/metrics', label: 'Metrics', icon: MetricsIcon },
        { path: '/reports', label: 'Reports', icon: ReportsIcon },
    ];

    return (
        <aside className="sidebar">
            <div className="sidebar-logo">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                    <circle cx="16" cy="16" r="14" stroke="white" strokeWidth="2" />
                    <path d="M8 16h16M16 8v16M10 10l12 12M22 10L10 22" stroke="white" strokeWidth="1.5" />
                </svg>
                <h1>Tactix</h1>
            </div>

            <nav className="sidebar-nav">
                {navItems.map((item) => (
                    <Link
                        key={item.path}
                        to={item.path}
                        className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
                        onClick={() => onNavigate?.(item.path)}
                    >
                        <item.icon />
                        <span>{item.label}</span>
                    </Link>
                ))}
            </nav>
        </aside>
    );
}

function DashboardIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="2" width="7" height="7" rx="1" />
            <rect x="11" y="2" width="7" height="7" rx="1" />
            <rect x="2" y="11" width="7" height="7" rx="1" />
            <rect x="11" y="11" width="7" height="7" rx="1" />
        </svg>
    );
}

function MatchesIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="10" cy="10" r="7" />
            <circle cx="10" cy="10" r="3" />
            <path d="M10 3v2M10 15v2M3 10h2M15 10h2" />
        </svg>
    );
}

function MetricsIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 17V9M8 17V5M13 17V8M18 17V3" />
        </svg>
    );
}

function ReportsIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="2" width="14" height="16" rx="2" />
            <path d="M6 6h8M6 10h8M6 14h4" />
        </svg>
    );
}
