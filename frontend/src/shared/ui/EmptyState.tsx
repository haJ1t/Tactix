import type { ReactNode } from 'react';

interface EmptyStateProps {
    title: string;
    description: string;
    icon?: ReactNode;
    action?: ReactNode;
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
    return (
        <div className="empty-state">
            {icon ? <div className="empty-icon">{icon}</div> : null}
            <h3>{title}</h3>
            <p>{description}</p>
            {action}
        </div>
    );
}
