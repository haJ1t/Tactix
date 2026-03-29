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
            className="flex flex-col items-center justify-center gap-5 py-12"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            role="alert"
        >
            <motion.div
                className="text-red-400/80"
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
            >
                <AlertCircle size={48} strokeWidth={1.5} />
            </motion.div>
            <div className="text-center">
                <h3 className="text-base font-semibold text-white mb-1">{title}</h3>
                <p className="text-sm text-muted max-w-md">{description}</p>
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
