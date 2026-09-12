import type { ReactElement } from "react";

export const SettingsPage = (): ReactElement => {
    return (
        <section className="upload-grid" aria-live="polite">
            <article className="upload-panel" style={{ gridColumn: "span 12" }}>
                <div className="panel__header">
                    <div>
                        <p className="eyebrow">Application</p>
                        <h2>Settings</h2>
                    </div>
                </div>
                <p className="panel__copy">
                    Customize your running and training preferences.
                </p>
                <div style={{ marginTop: "1rem", display: "grid", gap: "1rem" }}>
                    <div style={{ padding: "1rem", border: "1px solid var(--line)", borderRadius: "1rem" }}>
                        <h3>Preferences</h3>
                        <p className="panel__copy" style={{ margin: "0.2rem 0" }}>Configure metric/imperial units and general options.</p>
                    </div>
                </div>
            </article>
        </section>
    );
};
