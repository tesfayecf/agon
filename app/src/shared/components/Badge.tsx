import type { ReactElement, ReactNode } from "react";

type BadgeTone = "success" | "warning" | "danger" | "neutral";

export const Badge = ({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }): ReactElement => {
    return <span className={`badge badge--${tone}`}>{children}</span>;
};
