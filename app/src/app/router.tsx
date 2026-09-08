import { createBrowserRouter } from "react-router-dom";

import { AppRouteError } from "./AppRouteError";
import { AppShell } from "./AppShell";
import { NotFoundPage } from "./NotFoundPage";
import { HealthPage } from "../features/health/HealthPage";

export const router = createBrowserRouter([
    {
        path: "/",
        element: <AppShell />,
        errorElement: <AppRouteError />,
        children: [
            {
                index: true,
                element: <HealthPage />,
            },
            {
                path: "*",
                element: <NotFoundPage />,
            },
        ],
    },
]);