import type { ReactElement } from "react";
import { isRouteErrorResponse, useRouteError } from "react-router-dom";

export const AppRouteError = (): ReactElement => {
    const error = useRouteError();
    const message = isRouteErrorResponse(error)
        ? `${error.status} ${error.statusText}`
        : "This page could not be loaded.";

    return (
        <main className="app-shell">
            <section className="panel panel--primary" role="alert">
                <p className="eyebrow">Application error</p>
                <h1>Something went wrong.</h1>
                <p className="panel__copy">{message}</p>
                <a href="/">Return to the overview</a>
            </section>
        </main>
    );
};