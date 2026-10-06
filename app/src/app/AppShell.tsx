import { useState, type ReactElement } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { uploadActivityFiles } from "../features/activity/activity.service";

const SIDEBAR_KEY = "agon.sidebar.collapsed";

const readCollapsed = (): boolean => {
    try {
        return window.localStorage.getItem(SIDEBAR_KEY) === "1";
    } catch {
        return false;
    }
};

const NAV_ITEMS = [
    { to: "/", label: "Dashboard", end: true, icon: "▦" },
    { to: "/calendar", label: "Calendar", end: false, icon: "▤" },
    { to: "/tracks", label: "Trainings", end: false, icon: "≣" },
    { to: "/schedule", label: "Schedule", end: false, icon: "◫" },
    { to: "/plans", label: "Plans", end: false, icon: "✎" },
    { to: "/settings", label: "Settings", end: false, icon: "⚙" },
];

export const AppShell = (): ReactElement => {
    const navigate = useNavigate();
    const [isUploading, setIsUploading] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(readCollapsed);

    const toggleSidebar = (): void => {
        setIsCollapsed((prev) => {
            const next = !prev;
            try {
                window.localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
            } catch {
                // Storage can be unavailable (private mode); the toggle still works for this visit.
            }
            return next;
        });
    };

    const handleSidebarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const nextFiles = e.target.files;
        if (!nextFiles || nextFiles.length === 0) return;
        setIsUploading(true);
        try {
            await uploadActivityFiles(nextFiles);
            navigate("/tracks");
        } catch (err) {
            alert("Upload failed");
        } finally {
            setIsUploading(false);
            e.target.value = "";
        }
    };

    return (
        <div className={`app-layout${isCollapsed ? " is-collapsed" : ""}`}>
            <a href="#main-content" className="skip-link">
                Skip to content
            </a>

            <aside className="sidebar">
                <div className="sidebar__top">
                    <div className="sidebar__brand">
                        <span className="sidebar__brand-mark" aria-hidden="true">A</span>
                        <div className="sidebar__brand-text">
                            <p className="sidebar__brand-name">Agon</p>
                            <p className="sidebar__brand-sub">Training Log</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        className="sidebar__toggle"
                        onClick={toggleSidebar}
                        aria-expanded={!isCollapsed}
                        aria-controls="sidebar-nav"
                        aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                        title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                    >
                        <span aria-hidden="true">{isCollapsed ? "»" : "«"}</span>
                    </button>
                </div>

                <label className="sidebar__upload file-input-btn">
                    <span className="sidebar__upload-icon" aria-hidden="true">+</span>
                    <span className="sidebar__upload-label">{isUploading ? "Uploading…" : "Upload Training"}</span>
                    <input
                        type="file"
                        multiple
                        accept=".fit,.tcx"
                        onChange={handleSidebarUpload}
                        disabled={isUploading}
                        aria-label="Upload FIT or TCX training file"
                    />
                </label>

                <nav className="sidebar__nav" id="sidebar-nav" aria-label="Main navigation">
                    {NAV_ITEMS.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.end}
                            title={item.label}
                            className={({ isActive }) => `nav-link${isActive ? " is-active" : ""}`}
                        >
                            <span className="nav-link__icon" aria-hidden="true">{item.icon}</span>
                            {/* Wrapped so the mobile bottom bar can hide the text
                                visually while keeping it for screen readers. */}
                            <span className="nav-link__label">{item.label}</span>
                        </NavLink>
                    ))}
                </nav>

                <footer className="sidebar__footer">
                    <p>© {new Date().getFullYear()} Agon</p>
                    <p>v1.4.0</p>
                </footer>
            </aside>

            <main className="app-content" id="main-content" tabIndex={-1}>
                <Outlet />
            </main>
        </div>
    );
};
