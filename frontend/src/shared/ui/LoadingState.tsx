import { motion } from 'framer-motion';

interface LoadingStateProps {
    title?: string;
    description?: string;
    compact?: boolean;
}

// Spinner with title and description
export function LoadingState({
    title = 'Loading',
    description = 'Fetching the latest data.',
    compact = false,
}: LoadingStateProps) {
    return (
        <div
            className="flex flex-col items-center justify-center gap-5 rounded-lg border border-[var(--border-soft)] bg-[var(--surface)]"
            style={{ padding: compact ? 24 : 48, minHeight: compact ? 'auto' : 280 }}
            aria-live="polite"
        >
            <div className="relative">
                <motion.div
                    className="h-10 w-10 rounded-full border-2 border-[var(--primary-soft)]"
                    style={{ borderTopColor: 'var(--primary)' }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                />
            </div>
            <motion.div
                className="text-center"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
            >
                <h3 className="mb-1 text-base font-semibold text-[var(--text-primary)]">{title}</h3>
                <p className="text-sm text-[var(--text-secondary)]">{description}</p>
            </motion.div>
        </div>
    );
}
