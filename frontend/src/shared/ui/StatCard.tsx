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
    default: { border: 'rgba(255,255,255,0.06)', glow: 'transparent' },
    accent: { border: 'rgba(59, 130, 246, 0.3)', glow: 'rgba(59, 130, 246, 0.05)' },
    success: { border: 'rgba(34, 197, 94, 0.3)', glow: 'rgba(34, 197, 94, 0.05)' },
    warning: { border: 'rgba(245, 158, 11, 0.3)', glow: 'rgba(245, 158, 11, 0.05)' },
};

export function StatCard({ label, value, icon, tone = 'default' }: StatCardProps) {
    const config = toneConfig[tone];

    return (
        <motion.div
            className="glass-card p-5"
            style={{ borderColor: config.border, background: config.glow }}
            whileHover={{ scale: 1.02, borderColor: 'rgba(34, 197, 94, 0.3)' }}
            transition={{ duration: 0.2 }}
        >
            <div className="flex items-start justify-between mb-3">
                <span className="text-xs font-medium uppercase tracking-wider text-muted">{label}</span>
                {icon && <span className="text-muted opacity-60">{icon}</span>}
            </div>
            <div className="stat-value-large text-white">
                {typeof value === 'number' ? <AnimatedCounter value={value} /> : value}
            </div>
        </motion.div>
    );
}
