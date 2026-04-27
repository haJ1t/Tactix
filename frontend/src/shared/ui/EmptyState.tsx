import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface EmptyStateProps {
    title: string;
    description: string;
    icon?: ReactNode;
    action?: ReactNode;
}

// Empty placeholder card
export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
    return (
        <motion.div
            className="flex flex-col items-center justify-center gap-5 rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--surface-soft)] px-6 py-12"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
        >
            {icon && (
                <div className="text-[var(--text-muted)] opacity-70">
                    {icon}
                </div>
            )}
            <div className="text-center">
                <h3 className="mb-1 text-base font-semibold text-[var(--text-primary)]">{title}</h3>
                <p className="max-w-md text-sm text-[var(--text-secondary)]">{description}</p>
            </div>
            {action}
        </motion.div>
    );
}
