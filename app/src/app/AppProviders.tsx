import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import type { ReactElement } from "react";
import { RouterProvider } from "react-router-dom";

import { router } from "./router";
import { queryClient } from "../shared/api/queryClient";
import { ThemeProvider } from "../shared/theme/ThemeContext";

export const AppProviders = (): ReactElement => {
    return (
        <ThemeProvider>
            <QueryClientProvider client={queryClient}>
                <RouterProvider router={router} />
                {import.meta.env.DEV ? <ReactQueryDevtools initialIsOpen={false} /> : null}
            </QueryClientProvider>
        </ThemeProvider>
    );
};