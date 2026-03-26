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
        <div className="empty-state" role="alert">
            <div className="empty-icon">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v5" />
                    <circle cx="12" cy="16" r="0.8" fill="currentColor" />
                </svg>
            </div>
            <h3>{title}</h3>
            <p>{description}</p>
            {onRetry ? (
                <button className="btn btn-primary" onClick={onRetry} type="button">
                    {actionLabel}
                </button>
            ) : null}
        </div>
    );
}
