import type { ReactElement } from "react";
import { PageHeader } from "../../shared/components/PageHeader";
import { Card } from "../../shared/components/Card";

export const SettingsPage = (): ReactElement => {
    return (
        <section aria-live="polite">
            <PageHeader eyebrow="Application" title="Settings" subtitle="Customize your running and training preferences." />

            <Card title="Preferences">
                <p style={{ color: "var(--muted)", margin: 0 }}>
                    Unit and general preferences will be configurable here in a future iteration.
                </p>
            </Card>
        </section>
    );
};
