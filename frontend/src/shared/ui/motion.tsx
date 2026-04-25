import { type ReactNode, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useInView, useSpring, useMotionValue, useReducedMotion } from 'framer-motion';

// Page transition wrapper
export function PageTransition({ children }: { children: ReactNode }) {
    const shouldReduceMotion = useReducedMotion();

    return (
        <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
            animate={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? undefined : { opacity: 0, y: -4 }}
            transition={shouldReduceMotion ? { duration: 0.12 } : { duration: 0.18, ease: 'easeOut' }}
        >
            {children}
        </motion.div>
    );
}

// Fade in from below on scroll
export function FadeInUp({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: '-50px' });
    const shouldReduceMotion = useReducedMotion();

    return (
        <motion.div
            ref={ref}
            className={className}
            initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
            animate={shouldReduceMotion ? { opacity: 1, y: 0 } : isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
            transition={shouldReduceMotion ? { duration: 0.12 } : { duration: 0.22, delay, ease: 'easeOut' }}
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
                hidden: { opacity: 0, y: 8 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.18, ease: 'easeOut' } },
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
            whileTap={onClick ? { scale: 0.995 } : undefined}
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
    const shouldReduceMotion = useReducedMotion();

    useEffect(() => {
        setDisplayValue(Math.round(value));
        if (shouldReduceMotion) {
            return;
        }
        motionValue.set(value);
    }, [motionValue, shouldReduceMotion, value]);

    useEffect(() => {
        if (shouldReduceMotion) {
            return undefined;
        }
        const unsubscribe = springValue.on('change', (latest) => {
            setDisplayValue(Math.round(latest));
        });
        return unsubscribe;
    }, [shouldReduceMotion, springValue]);

    return <span className={className}>{displayValue}</span>;
}

// Shimmer button for CTAs
export function ShimmerButton({ children, onClick, disabled = false, className = '' }: { children: ReactNode; onClick?: () => void; disabled?: boolean; className?: string }) {
    return (
        <motion.button
            className={`btn-glow ${className}`}
            onClick={onClick}
            disabled={disabled}
            whileTap={disabled ? undefined : { scale: 0.99 }}
        >
            {children}
        </motion.button>
    );
}

// Floating gradient orb for backgrounds
export function FloatingOrb({ color, size, top, left, delay = 0 }: { color: string; size: number; top: string; left: string; delay?: number }) {
    void color;
    void size;
    void top;
    void left;
    void delay;
    return null;
}

// Animated progress bar
export function AnimatedBar({ value, max, color = 'var(--primary)', className = '' }: { value: number; max: number; color?: string; className?: string }) {
    const percentage = max > 0 ? (value / max) * 100 : 0;

    return (
        <div className={`h-1.5 overflow-hidden rounded-full bg-[var(--surface-muted)] ${className}`}>
            <motion.div
                className="h-full rounded-full"
                style={{ background: color }}
                initial={{ width: 0 }}
                animate={{ width: `${percentage}%` }}
                transition={{ duration: 0.45, ease: 'easeOut', delay: 0.05 }}
            />
        </div>
    );
}

export { motion, AnimatePresence };
