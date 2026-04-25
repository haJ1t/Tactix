import { motion } from 'framer-motion';
import { AnimatedCounter } from './motion';
import type { ReactNode } from 'react';

interface StatCardProps {
    label: string;
    value: string | number;
    icon?: ReactNode;
    tone?: 'default' | 'accent' | 'success' | 'warning';
}

const toneConfig = {
    default: { border: 'var(--border-soft)', background: 'var(--surface)' },
    accent: { border: 'rgba(66, 111, 143, 0.28)', background: 'var(--tactical-blue-soft)' },
    success: { border: 'rgba(79, 143, 101, 0.28)', background: 'var(--primary-soft)' },
    warning: { border: 'rgba(184, 135, 53, 0.28)', background: 'var(--amber-soft)' },
};

export function StatCard({ label, value, icon, tone = 'default' }: StatCardProps) {
    const config = toneConfig[tone];

    return (
        <motion.div
            className="glass-card p-5"
            style={{ borderColor: config.border, background: config.background }}
            transition={{ duration: 0.16 }}
        >
            <div className="flex items-start justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">{label}</span>
                {icon && <span className="text-[var(--primary-strong)] opacity-80">{icon}</span>}
            </div>
            <div className="stat-value-large text-[var(--text-primary)]">
                {typeof value === 'number' ? <AnimatedCounter value={value} /> : value}
            </div>
        </motion.div>
    );
}
