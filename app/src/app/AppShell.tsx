import { useState, type ReactElement } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { uploadActivityFiles } from "../features/activity/activity.service";

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
        <div style={{ display: "grid", gridTemplateColumns: "250px 1fr", minHeight: "100vh" }}>
            <aside style={{
                background: "rgba(255, 252, 247, 0.95)",
                borderRight: "1px solid var(--line)",
                padding: "2rem 1.5rem",
                display: "flex",
                flexDirection: "column",
                gap: "2rem",
                position: "sticky",
                top: 0,
                height: "100vh"
            }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: "1.5rem", letterSpacing: "-0.04em", color: "var(--accent)" }}>Agon</h2>
                    <p style={{ margin: "0.2rem 0 0", fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Running Training</p>
                </div>

                <label className="button-link button-link--primary" style={{
                    cursor: "pointer",
                    padding: "0.8rem 1.2rem",
                    textAlign: "center",
                    display: "block",
                    fontWeight: 700,
                    borderRadius: "999px"
                }}>
                    <span>{isUploading ? "Uploading..." : "+ Upload Track"}</span>
                    <input type="file" multiple accept=".fit,.tcx" onChange={handleSidebarUpload} style={{ display: "none" }} />
                </label>

                <nav style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <NavLink to="/" end style={({ isActive }) => ({
                        padding: "0.8rem 1rem",
                        borderRadius: "0.8rem",
                        textDecoration: "none",
                        fontWeight: 600,
                        background: isActive ? "rgba(15, 118, 110, 0.08)" : "transparent",
                        color: isActive ? "var(--accent)" : "var(--ink)",
                    })}>
                        Dashboard
                    </NavLink>
                    <NavLink to="/tracks" style={({ isActive }) => ({
                        padding: "0.8rem 1rem",
                        borderRadius: "0.8rem",
                        textDecoration: "none",
                        fontWeight: 600,
                        background: isActive ? "rgba(15, 118, 110, 0.08)" : "transparent",
                        color: isActive ? "var(--accent)" : "var(--ink)",
                    })}>
                        Tracks & Trainings
                    </NavLink>
                    <NavLink to="/settings" style={({ isActive }) => ({
                        padding: "0.8rem 1rem",
                        borderRadius: "0.8rem",
                        textDecoration: "none",
                        fontWeight: 600,
                        background: isActive ? "rgba(15, 118, 110, 0.08)" : "transparent",
                        color: isActive ? "var(--accent)" : "var(--ink)",
                    })}>
                        Settings
                    </NavLink>
                </nav>

                <footer style={{ marginTop: "auto", fontSize: "0.75rem", color: "var(--muted)" }}>
                    <p style={{ margin: 0 }}>© {new Date().getFullYear()} Agon Coach</p>
                    <p style={{ margin: "0.2rem 0 0" }}>v1.3.0 · Offline Ready</p>
                </footer>
            </aside>

            <main style={{ padding: "2rem 3rem", overflowY: "auto", maxHeight: "100vh" }}>
                <Outlet />
            </main>
        </div>
    );
};
