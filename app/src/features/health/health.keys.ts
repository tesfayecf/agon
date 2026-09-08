export const healthKeys = {
  all: () => ["health"] as const,
  live: () => ["health", "live"] as const,
  ready: () => ["health", "ready"] as const,
};
