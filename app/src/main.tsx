import React from "react";
import ReactDOM from "react-dom/client";

import { AppProviders } from "./app/AppProviders";
import "./shared/styles/global.css";

const rootElement = document.getElementById("root");

if (rootElement === null) {
    throw new Error("Root container was not found.");
}

ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
        <AppProviders />
    </React.StrictMode>,
);