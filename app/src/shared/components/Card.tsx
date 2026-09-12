import type { CSSProperties, ReactElement, ReactNode } from "react";
import { Link } from "react-router-dom";

interface CardProps {
    title?: string;
    eyebrow?: string;
    link?: { to: string; label: string };
    children: ReactNode;
    style?: CSSProperties;
}

export const Card = ({ title, eyebrow, link, children, style }: CardProps): ReactElement => {
    return (
        <section className="card" style={style}>
            {(title !== undefined || link !== undefined) && (
                <div className="card__header">
                    <div>
                        {eyebrow !== undefined && <p className="page-header__eyebrow">{eyebrow}</p>}
                        {title !== undefined && <h2 className="card__title">{title}</h2>}
                    </div>
                    {link !== undefined && (
                        <Link className="card__link" to={link.to}>
                            {link.label}
                        </Link>
                    )}
                </div>
            )}
            {children}
        </section>
    );
};
