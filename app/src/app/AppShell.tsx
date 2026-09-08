import type { ReactElement } from "react";
import { NavLink, Outlet } from "react-router-dom";

export const AppShell = (): ReactElement => {
    return (
        <main className="app-shell">
            <div className="app-shell__backdrop" aria-hidden="true" />
            <header className="hero-panel">
                <div className="hero-panel__copy">
                    <p className="eyebrow">App template</p>
                    <h1>Build from a useful starting point.</h1>
                    <p className="hero-panel__lede">
                        A small React shell backed by a Go API, with a health check ready for your first feature.
                    </p>
                </div>
                <dl className="hero-panel__meta">
                    <div>
                        <dt>Frontend</dt>
                        <dd>React + Vite</dd>
                    </div>
                    <div>
                        <dt>Backend</dt>
                        <dd>Go + net/http</dd>
                    </div>
                </dl>
            </header>

            <nav className="workspace-nav" aria-label="Primary navigation">
                <NavLink className="workspace-nav__item" to="/" end>
                    <strong>Overview</strong>
                    <small>Check the application foundation</small>
                </NavLink>
            </nav>

            <Outlet />
        </main>
    );
};