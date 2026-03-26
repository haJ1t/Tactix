import { NavLink } from 'react-router-dom';
import type { To } from 'react-router-dom';

interface TabItem {
    label: string;
    to: To;
}

interface TabsProps {
    items: TabItem[];
}

export function Tabs({ items }: TabsProps) {
    return (
        <nav className="workspace-tabs" aria-label="Section tabs">
            {items.map((item) => (
                <NavLink
                    key={`${item.label}-${typeof item.to === 'string' ? item.to : `${item.to.pathname || ''}${item.to.search || ''}`}`}
                    to={item.to}
                    className={({ isActive }) => `workspace-tab ${isActive ? 'active' : ''}`}
                >
                    {item.label}
                </NavLink>
            ))}
        </nav>
    );
}
