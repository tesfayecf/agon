import type { ReactElement } from "react";

export const NotFoundPage = (): ReactElement => {
    return (
        <section className="panel" role="status">
            <p className="eyebrow">404</p>
            <h2>Page not found.</h2>
            <p className="panel__copy">The address does not match a route in this application.</p>
        </section>
    );
};