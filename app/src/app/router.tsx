import { createBrowserRouter } from "react-router-dom";

import { ActivityPage } from "../features/activity/ActivityPage";
import { HealthPage } from "../features/health/HealthPage";
import { AppRouteError } from "./AppRouteError";
import { AppShell } from "./AppShell";
import { NotFoundPage } from "./NotFoundPage";

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
                path: "upload",
                element: <ActivityPage />,
            },
            {
                path: "*",
                element: <NotFoundPage />,
            },
        ],
    },
]);