import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { To } from 'react-router-dom';

interface TabItem {
    label: string;
    to: To;
}

interface TabsProps {
    items: TabItem[];
}

export function Tabs({ items }: TabsProps) {
    const location = useLocation();

    const getPath = (to: To): string => {
        if (typeof to === 'string') return to;
        return to.pathname || '';
    };

    return (
        <nav className="flex items-center gap-1 p-1 glass-card" aria-label="Section tabs">
            {items.map((item) => {
                const path = getPath(item.to);
                const isActive = location.pathname.endsWith(path);

                return (
                    <NavLink
                        key={`${item.label}-${path}`}
                        to={item.to}
                        className="relative px-4 py-2.5 text-sm font-medium rounded-xl transition-colors cursor-pointer"
                        style={{ color: isActive ? '#F8FAFC' : '#94A3B8' }}
                    >
                        {isActive && (
                            <motion.div
                                layoutId="tab-indicator"
                                className="absolute inset-0 rounded-xl"
                                style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.2)' }}
                                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                            />
                        )}
                        <span className="relative z-10">{item.label}</span>
                    </NavLink>
                );
            })}
        </nav>
    );
}
