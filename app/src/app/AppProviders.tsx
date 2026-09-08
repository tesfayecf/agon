import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import type { ReactElement } from "react";
import { RouterProvider } from "react-router-dom";

import { router } from "./router";
import { queryClient } from "../shared/api/queryClient";

export const AppProviders = (): ReactElement => {
    return (
        <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
            {import.meta.env.DEV ? <ReactQueryDevtools initialIsOpen={false} /> : null}
        </QueryClientProvider>
    );
};