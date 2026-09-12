import type { ReactElement, ReactNode } from "react";

interface PageHeaderProps {
    eyebrow?: string;
    title: string;
    subtitle?: string;
    actions?: ReactNode;
}

export const PageHeader = ({ eyebrow, title, subtitle, actions }: PageHeaderProps): ReactElement => {
    return (
        <div className="page-header">
            <div>
                {eyebrow !== undefined && <p className="page-header__eyebrow">{eyebrow}</p>}
                <h1 className="page-header__title">{title}</h1>
                {subtitle !== undefined && <p className="page-header__subtitle">{subtitle}</p>}
            </div>
            {actions !== undefined && <div className="page-header__actions">{actions}</div>}
        </div>
    );
};
