import { apiRequest, type StatusEnvelope } from "../../shared/api/client";

export const getLiveHealth = async (
  signal?: AbortSignal,
): Promise<StatusEnvelope> => {
  return apiRequest<StatusEnvelope>({
    path: "/api/health/live",
    signal,
  });
};

export const getReadyHealth = async (
  signal?: AbortSignal,
): Promise<StatusEnvelope> => {
  return apiRequest<StatusEnvelope>({
    path: "/api/health/ready",
    signal,
  });
};
