import { createBrowserRouter } from "react-router-dom";

import { ActivityPage } from "../features/activity/ActivityPage";
import { TracksPage } from "../features/activity/TracksPage";
import { TrackDetailPage } from "../features/activity/TrackDetailPage";
import { CalendarPage } from "../features/calendar/CalendarPage";
import { DashboardPage } from "../features/dashboard/DashboardPage";
import { SchedulePage } from "../features/schedule/SchedulePage";
import { SettingsPage } from "../features/settings/SettingsPage";
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
                element: <DashboardPage />,
            },
            {
                path: "calendar",
                element: <CalendarPage />,
            },
            {
                path: "tracks",
                element: <TracksPage />,
            },
            {
                path: "tracks/:id",
                element: <TrackDetailPage />,
            },
            {
                path: "schedule",
                element: <SchedulePage />,
            },
            {
                path: "settings",
                element: <SettingsPage />,
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
