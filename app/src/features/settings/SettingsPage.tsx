import type { ReactElement } from "react";
import { PageHeader } from "../../shared/components/PageHeader";
import { Card } from "../../shared/components/Card";
import { ThemeToggle } from "../../shared/components/ThemeToggle";
import { PhysicalMetricsCard } from "./PhysicalMetricsCard";

export const SettingsPage = (): ReactElement => {
    return (
        <section aria-live="polite">
            <PageHeader eyebrow="Application" title="Settings" subtitle="Customize your running and training preferences." />

            <Card title="Appearance">
                <p className="settings-field__description">
                    Choose Light or Dark, or follow your system setting automatically.
                </p>
                <ThemeToggle />
            </Card>

            <PhysicalMetricsCard />

            <Card title="Preferences">
                <p className="settings-empty-note">
                    Unit and general preferences will be configurable here in a future iteration.
                </p>
            </Card>
        </section>
    );
};
