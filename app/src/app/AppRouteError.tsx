import type { ReactElement } from "react";
import { isRouteErrorResponse, useRouteError } from "react-router-dom";
import { Card } from "../shared/components/Card";

export const AppRouteError = (): ReactElement => {
    const error = useRouteError();
    const message = isRouteErrorResponse(error)
        ? `${error.status} ${error.statusText}`
        : "This page could not be loaded.";

    return (
        <main style={{ padding: "3rem", maxWidth: "40rem", margin: "0 auto" }}>
            <Card>
                <p style={{ margin: 0, fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--danger)" }}>
                    Application error
                </p>
                <h1 className="page-header__title" style={{ marginTop: "0.4rem" }}>Something went wrong.</h1>
                <p style={{ color: "var(--muted)" }}>{message}</p>
                <a href="/" className="btn btn-primary" style={{ marginTop: "0.5rem" }}>
                    Return to the overview
                </a>
            </Card>
        </main>
    );
};
