import type { CSSProperties, ReactElement, ReactNode } from "react";

interface CardProps {
    title?: string;
    eyebrow?: string;
    /** Color token for the header marker, tying a card to the series it displays. */
    accent?: string;
    /** Extra content rendered at the end of the header row (chips, counts, controls). */
    actions?: ReactNode;
    children: ReactNode;
    style?: CSSProperties;
    className?: string;
}

export const Card = ({ title, eyebrow, accent, actions, children, style, className }: CardProps): ReactElement => {
    const hasHeader = title !== undefined || actions !== undefined;

    return (
        <section className={`card${className !== undefined ? ` ${className}` : ""}`} style={style}>
            {hasHeader && (
                <header className="card__header">
                    <div className="card__heading">
                        {accent !== undefined && <span className="card__accent" style={{ background: accent }} aria-hidden="true" />}
                        <div>
                            {eyebrow !== undefined && <p className="card__eyebrow">{eyebrow}</p>}
                            {title !== undefined && <h2 className="card__title">{title}</h2>}
                        </div>
                    </div>
                    {actions !== undefined && <div className="card__header-actions">{actions}</div>}
                </header>
            )}
            {children}
        </section>
    );
};
