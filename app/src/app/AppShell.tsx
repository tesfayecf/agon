import { useState, type ReactElement } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { uploadActivityFiles } from "../features/activity/activity.service";

const NAV_ITEMS = [
    { to: "/", label: "Dashboard", end: true, icon: "▦" },
    { to: "/calendar", label: "Calendar", end: false, icon: "▤" },
    { to: "/tracks", label: "Trainings", end: false, icon: "≣" },
    { to: "/schedule", label: "Schedule", end: false, icon: "◫" },
    { to: "/settings", label: "Settings", end: false, icon: "⚙" },
];

export const AppShell = (): ReactElement => {
    const navigate = useNavigate();
    const [isUploading, setIsUploading] = useState(false);

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
        <div className="app-layout">
            <a href="#main-content" className="skip-link">
                Skip to content
            </a>

            <aside className="sidebar">
                <div className="sidebar__brand">
                    <span className="sidebar__brand-mark" aria-hidden="true">A</span>
                    <div>
                        <p className="sidebar__brand-name">Agon</p>
                        <p className="sidebar__brand-sub">Training Log</p>
                    </div>
                </div>

                <label className="btn btn-primary sidebar__upload file-input-btn">
                    <span>{isUploading ? "Uploading…" : "+ Upload Training"}</span>
                    <input
                        type="file"
                        multiple
                        accept=".fit,.tcx"
                        onChange={handleSidebarUpload}
                        disabled={isUploading}
                        aria-label="Upload FIT or TCX training file"
                    />
                </label>

                <nav className="sidebar__nav" aria-label="Main navigation">
                    {NAV_ITEMS.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.end}
                            className={({ isActive }) => `nav-link${isActive ? " is-active" : ""}`}
                        >
                            <span className="nav-link__icon" aria-hidden="true">{item.icon}</span>
                            {item.label}
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
