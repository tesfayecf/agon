import type { ReactElement } from "react";
import { Card } from "../shared/components/Card";

export const NotFoundPage = (): ReactElement => {
    return (
        <Card>
            <p style={{ margin: 0, fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted)" }}>404</p>
            <h1 className="page-header__title" style={{ marginTop: "0.4rem" }}>Page not found.</h1>
            <p style={{ color: "var(--muted)" }}>The address does not match a route in this application.</p>
        </Card>
    );
};
