import { useQuery } from "@tanstack/react-query";
import type { ReactElement } from "react";

import { healthKeys } from "./health.keys";
import { getLiveHealth } from "./health.service";

export const HealthPage = (): ReactElement => {
    const healthQuery = useQuery({
        queryKey: healthKeys.live(),
        queryFn: ({ signal }) => getLiveHealth(signal),
    });

    const statusClassName = healthQuery.isSuccess
        ? "status-pill status-pill--ready"
        : healthQuery.isError
            ? "status-pill status-pill--offline"
            : "status-pill status-pill--pending";
    const statusLabel = healthQuery.isSuccess ? "Online" : healthQuery.isError ? "Unavailable" : "Checking";

    return (
        <section className="dashboard-grid" aria-live="polite">
            <article className="panel panel--primary">
                <div className="panel__header">
                    <div>
                        <p className="eyebrow">Runtime check</p>
                        <h2>API health</h2>
                    </div>
                    <span className={statusClassName}>
                        {statusLabel}
                    </span>
                </div>
                {healthQuery.isPending && <p className="panel__copy">Checking the Go API...</p>}
                {healthQuery.isError && <p className="panel__copy">The API did not respond. Check the backend process and try again.</p>}
                {healthQuery.isSuccess && <p className="panel__copy">The API returned `{healthQuery.data.status}`.</p>}
            </article>
        </section>
    );
};