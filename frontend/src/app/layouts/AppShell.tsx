import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, Crosshair, Users, FileText, ChevronLeft, ChevronRight, Zap } from 'lucide-react';

const navItems = [
    { label: 'Overview', to: '/overview', icon: LayoutDashboard },
    { label: 'Matches', to: '/matches', icon: Crosshair },
    { label: 'Teams', to: '/teams', icon: Users },
    { label: 'Reports', to: '/reports', icon: FileText },
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
    const [collapsed, setCollapsed] = useState(false);

    return (
        <div className="flex h-screen overflow-hidden bg-[#0A0A0F]">
            {/* Sidebar */}
            <motion.aside
                className="relative flex flex-col h-full border-r border-white/[0.04] bg-[#08080D]"
                animate={{ width: collapsed ? 72 : 240 }}
                transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
                {/* Logo */}
                <div className="flex items-center gap-3 px-5 h-16 border-b border-white/[0.04]">
                    <motion.div
                        className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(34,197,94,0.05))' , border: '1px solid rgba(34,197,94,0.2)' }}
                        animate={{ boxShadow: ['0 0 15px rgba(34,197,94,0.1)', '0 0 25px rgba(34,197,94,0.2)', '0 0 15px rgba(34,197,94,0.1)'] }}
                        transition={{ duration: 3, repeat: Infinity }}
                    >
                        <Zap size={18} className="text-primary-400" />
                    </motion.div>
                    <AnimatePresence>
                        {!collapsed && (
                            <motion.div
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                transition={{ duration: 0.2 }}
                            >
                                <h1 className="text-base font-bold text-white tracking-tight">Tactix</h1>
                                <p className="text-[10px] text-muted uppercase tracking-widest">Analyst workspace</p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Nav */}
                <nav className="flex-1 px-3 py-4 space-y-1">
                    {navItems.map((item) => {
                        const isActive = location.pathname.startsWith(item.to);
                        const Icon = item.icon;

                        return (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                className="relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer"
                                style={{ color: isActive ? '#F8FAFC' : '#64748B' }}
                            >
                                {isActive && (
                                    <motion.div
                                        layoutId="sidebar-active"
                                        className="absolute inset-0 rounded-xl"
                                        style={{
                                            background: 'rgba(34, 197, 94, 0.08)',
                                            border: '1px solid rgba(34, 197, 94, 0.15)',
                                        }}
                                        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                                    />
                                )}
                                <motion.div
                                    className="relative z-10"
                                    whileHover={{ scale: 1.1 }}
                                    transition={{ duration: 0.15 }}
                                >
                                    <Icon size={20} />
                                </motion.div>
                                <AnimatePresence>
                                    {!collapsed && (
                                        <motion.span
                                            className="relative z-10 text-sm font-medium"
                                            initial={{ opacity: 0, x: -5 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -5 }}
                                            transition={{ duration: 0.15 }}
                                        >
                                            {item.label}
                                        </motion.span>
                                    )}
                                </AnimatePresence>
                                {isActive && (
                                    <motion.div
                                        className="absolute right-0 top-1/2 w-0.5 h-5 rounded-full bg-primary-400 -translate-y-1/2"
                                        layoutId="sidebar-indicator"
                                        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                                    />
                                )}
                            </NavLink>
                        );
                    })}
                </nav>

                {/* Collapse toggle */}
                <div className="px-3 py-4 border-t border-white/[0.04]">
                    <motion.button
                        className="flex items-center justify-center w-full py-2 rounded-xl text-muted hover:text-white transition-colors cursor-pointer"
                        style={{ background: 'rgba(255,255,255,0.03)' }}
                        onClick={() => setCollapsed(!collapsed)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                    </motion.button>
                </div>
            </motion.aside>

            {/* Main content */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="flex items-center justify-between px-8 h-16 border-b border-white/[0.04] bg-[#0A0A0F]/80 backdrop-blur-xl">
                    <div>
                        <p className="text-[10px] text-muted uppercase tracking-widest mb-0.5">Tactix</p>
                        <h2 className="text-lg font-semibold text-white">{meta.title}</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-primary-400 animate-glow-pulse" />
                        <span className="text-xs text-muted">{meta.context}</span>
                    </div>
                </header>

                {/* Page content */}
                <div className="flex-1 overflow-y-auto px-8 py-6">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
