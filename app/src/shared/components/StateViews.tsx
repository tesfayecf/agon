import type { ReactElement, ReactNode } from "react";

export const LoadingState = ({ label = "Loading…" }: { label?: string }): ReactElement => {
    return (
        <div className="state-block" role="status">
            <span className="spinner" aria-hidden="true" />
            <p className="state-block__message">{label}</p>
        </div>
    );
};

export const EmptyState = ({
    title,
    message,
    action,
}: {
    title: string;
    message?: string;
    action?: ReactNode;
}): ReactElement => {
    return (
        <div className="state-block">
            <p className="state-block__title">{title}</p>
            {message !== undefined && <p className="state-block__message">{message}</p>}
            {action}
        </div>
    );
};

export const ErrorState = ({ message }: { message: string }): ReactElement => {
    return (
        <div className="error-banner" role="alert">
            {message}
        </div>
    );
};
