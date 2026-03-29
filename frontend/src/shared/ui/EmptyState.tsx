import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface EmptyStateProps {
    title: string;
    description: string;
    icon?: ReactNode;
    action?: ReactNode;
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
    return (
        <motion.div
            className="flex flex-col items-center justify-center gap-5 py-12"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
        >
            {icon && (
                <motion.div
                    className="text-muted opacity-40"
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                >
                    {icon}
                </motion.div>
            )}
            <div className="text-center">
                <h3 className="text-base font-semibold text-white mb-1">{title}</h3>
                <p className="text-sm text-muted max-w-md">{description}</p>
            </div>
            {action}
        </motion.div>
    );
}
