import { type ReactNode, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useInView, useSpring, useMotionValue } from 'framer-motion';

// Page transition wrapper
export function PageTransition({ children }: { children: ReactNode }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
            {children}
        </motion.div>
    );
}

// Fade in from below on scroll
export function FadeInUp({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: '-50px' });

    return (
        <motion.div
            ref={ref}
            className={className}
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            transition={{ duration: 0.5, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
            {children}
        </motion.div>
    );
}

// Container for staggered children
export function StaggerContainer({ children, className = '', staggerDelay = 0.08 }: { children: ReactNode; className?: string; staggerDelay?: number }) {
    return (
        <motion.div
            className={className}
            initial="hidden"
            animate="visible"
            variants={{
                hidden: {},
                visible: { transition: { staggerChildren: staggerDelay } },
            }}
        >
            {children}
        </motion.div>
    );
}

// Individual stagger item
export function StaggerItem({ children, className = '' }: { children: ReactNode; className?: string }) {
    return (
        <motion.div
            className={className}
            variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] } },
            }}
        >
            {children}
        </motion.div>
    );
}

// Glass card with hover glow
export function GlassCard({ children, className = '', hover = true, onClick }: { children: ReactNode; className?: string; hover?: boolean; onClick?: () => void }) {
    return (
        <motion.div
            className={`glass-card ${hover ? 'glass-card-hover' : ''} ${className}`}
            whileHover={hover ? { scale: 1.01, transition: { duration: 0.2 } } : undefined}
            whileTap={onClick ? { scale: 0.99 } : undefined}
            onClick={onClick}
            style={onClick ? { cursor: 'pointer' } : undefined}
        >
            {children}
        </motion.div>
    );
}

// Animated counter that counts up with spring physics
export function AnimatedCounter({ value, className = '' }: { value: number; className?: string }) {
    const motionValue = useMotionValue(0);
    const springValue = useSpring(motionValue, { stiffness: 100, damping: 30 });
    const [displayValue, setDisplayValue] = useState(0);

    useEffect(() => {
        motionValue.set(value);
    }, [motionValue, value]);

    useEffect(() => {
        const unsubscribe = springValue.on('change', (latest) => {
            setDisplayValue(Math.round(latest));
        });
        return unsubscribe;
    }, [springValue]);

    return <span className={className}>{displayValue}</span>;
}

// Shimmer button for CTAs
export function ShimmerButton({ children, onClick, disabled = false, className = '' }: { children: ReactNode; onClick?: () => void; disabled?: boolean; className?: string }) {
    return (
        <motion.button
            className={`btn-glow relative overflow-hidden ${className}`}
            onClick={onClick}
            disabled={disabled}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
        >
            {children}
            {!disabled && (
                <motion.div
                    className="absolute inset-0 -translate-x-full"
                    style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)' }}
                    animate={{ translateX: ['-100%', '100%'] }}
                    transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                />
            )}
        </motion.button>
    );
}

// Floating gradient orb for backgrounds
export function FloatingOrb({ color, size, top, left, delay = 0 }: { color: string; size: number; top: string; left: string; delay?: number }) {
    return (
        <motion.div
            className="gradient-orb"
            style={{ background: color, width: size, height: size, top, left }}
            animate={{ y: [0, -20, 0], x: [0, 10, 0], scale: [1, 1.1, 1] }}
            transition={{ duration: 8, repeat: Infinity, delay, ease: 'easeInOut' }}
        />
    );
}

// Animated progress bar
export function AnimatedBar({ value, max, color = 'var(--primary)', className = '' }: { value: number; max: number; color?: string; className?: string }) {
    const percentage = max > 0 ? (value / max) * 100 : 0;

    return (
        <div className={`h-1.5 rounded-full bg-white/5 overflow-hidden ${className}`}>
            <motion.div
                className="h-full rounded-full"
                style={{ background: color }}
                initial={{ width: 0 }}
                animate={{ width: `${percentage}%` }}
                transition={{ duration: 1, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.2 }}
            />
        </div>
    );
}

export { motion, AnimatePresence };
