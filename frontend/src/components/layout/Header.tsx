interface HeaderProps {
    title?: string;
    userName?: string;
}

export default function Header({ title = "App Name", userName = "User" }: HeaderProps) {
    // Build initials from name
    const initials = userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

    return (
        <header className="header">
            <h2 className="header-title">{title}</h2>

            <div className="header-actions">
                <div className="header-search">
                    <SearchIcon />
                    <input type="text" placeholder="Search..." />
                </div>

                <NotificationIcon />

                <div className="user-profile">
                    <div className="user-avatar">{initials}</div>
                    <span style={{ fontSize: '0.875rem', color: '#64748b' }}>{userName}</span>
                </div>

                <button className="btn btn-outline" style={{ padding: '6px 12px' }}>
                    Logout
                </button>
            </div>
        </header>
    );
}

function SearchIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#94a3b8" strokeWidth="1.5" style={{ marginRight: 8 }}>
            <circle cx="7" cy="7" r="5" />
            <path d="M11 11l3 3" />
        </svg>
    );
}

function NotificationIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#64748b" strokeWidth="1.5" style={{ cursor: 'pointer' }}>
            <path d="M10 2a6 6 0 016 6c0 7 3 8 3 8H1s3-1 3-8a6 6 0 016-6z" />
            <path d="M8 18a2 2 0 004 0" />
        </svg>
    );
}
