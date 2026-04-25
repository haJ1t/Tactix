import { motion } from 'framer-motion';
import { AlertCircle } from 'lucide-react';

interface ErrorStateProps {
    title?: string;
    description?: string;
    actionLabel?: string;
    onRetry?: () => void;
}

export function ErrorState({
    title = 'Something went wrong',
    description = 'The requested data could not be loaded.',
    actionLabel = 'Try again',
    onRetry,
}: ErrorStateProps) {
    return (
        <motion.div
            className="flex flex-col items-center justify-center gap-5 rounded-lg border border-[rgba(184,91,79,0.2)] bg-[var(--danger-soft)] px-6 py-12"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.18 }}
            role="alert"
        >
            <div className="text-[var(--danger)]">
                <AlertCircle size={48} strokeWidth={1.5} />
            </div>
            <div className="text-center">
                <h3 className="mb-1 text-base font-semibold text-[var(--text-primary)]">{title}</h3>
                <p className="max-w-md text-sm text-[var(--text-secondary)]">{description}</p>
            </div>
            {onRetry && (
                <motion.button
                    className="btn-ghost"
                    onClick={onRetry}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                >
                    {actionLabel}
                </motion.button>
            )}
        </motion.div>
    );
}
