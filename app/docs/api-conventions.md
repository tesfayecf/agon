# API Conventions

The frontend keeps backend integration in three layers:

1. `shared/api/client.ts` owns transport concerns: URLs, JSON bodies, response parsing, abort signals, and `ApiError`.
2. A feature service owns endpoint paths and response types, such as `features/health/health.service.ts`.
3. A feature key module owns stable TanStack Query keys, such as `features/health/health.keys.ts`.

Components use the service and key modules with `useQuery` or `useMutation`; they do not build API URLs directly. Put reusable response envelopes in `shared/api/client.ts` and product-specific response types beside the feature service.

The application uses the single `QueryClient` exported from `shared/api/queryClient.ts`. Mutations should invalidate the narrowest affected feature key after a successful write.

## Example

```tsx
const widgetQuery = useQuery({
  queryKey: widgetKeys.detail(widgetId),
  queryFn: ({ signal }) => getWidget(widgetId, signal),
});
```

Use `VITE_API_BASE_URL` for a separate API origin. Leave it unset for same-origin requests through the Vite development proxy or the production Nginx proxy.
