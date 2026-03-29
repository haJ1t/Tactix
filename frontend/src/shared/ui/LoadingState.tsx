import { motion } from 'framer-motion';

interface LoadingStateProps {
    title?: string;
    description?: string;
    compact?: boolean;
}

export function LoadingState({
    title = 'Loading',
    description = 'Fetching the latest data.',
    compact = false,
}: LoadingStateProps) {
    return (
        <div
            className="flex flex-col items-center justify-center gap-6"
            style={{ padding: compact ? 24 : 48, minHeight: compact ? 'auto' : 280 }}
            aria-live="polite"
        >
            <div className="relative">
                <motion.div
                    className="w-12 h-12 rounded-full border-2 border-primary-500/20"
                    style={{ borderTopColor: '#22C55E' }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                />
                <motion.div
                    className="absolute inset-0 rounded-full"
                    style={{ boxShadow: '0 0 20px rgba(34, 197, 94, 0.3)' }}
                    animate={{ opacity: [0.3, 0.8, 0.3] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                />
            </div>
            <motion.div
                className="text-center"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
            >
                <h3 className="text-base font-semibold text-white mb-1">{title}</h3>
                <p className="text-sm text-muted">{description}</p>
            </motion.div>
        </div>
    );
}
