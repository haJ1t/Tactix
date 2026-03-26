import type { CSSProperties } from 'react';

interface StatCardProps {
    label: string;
    value: string | number;
    tone?: 'default' | 'accent' | 'success' | 'warning';
}

const toneStyles: Record<NonNullable<StatCardProps['tone']>, CSSProperties> = {
    default: {},
    accent: { borderColor: 'rgba(74, 144, 217, 0.3)', background: 'rgba(74, 144, 217, 0.06)' },
    success: { borderColor: 'rgba(34, 197, 94, 0.3)', background: 'rgba(34, 197, 94, 0.06)' },
    warning: { borderColor: 'rgba(245, 158, 11, 0.3)', background: 'rgba(245, 158, 11, 0.08)' },
};

export function StatCard({ label, value, tone = 'default' }: StatCardProps) {
    return (
        <div className="snapshot-metric" style={toneStyles[tone]}>
            <span className="snapshot-label">{label}</span>
            <span className="snapshot-value">{value}</span>
        </div>
    );
}
