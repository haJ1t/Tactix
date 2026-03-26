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
            className="empty-state"
            style={{ padding: compact ? 24 : 48, minHeight: compact ? 'auto' : 280 }}
            aria-live="polite"
        >
            <div className="spinner" />
            <h3>{title}</h3>
            <p>{description}</p>
        </div>
    );
}
