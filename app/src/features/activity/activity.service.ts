import { apiRequest } from "../../shared/api/client";

export interface ActivityRecord {
  timestamp?: string;
  latitude?: number;
  longitude?: number;
  distance?: number;
  speed?: number;
  heartRate?: number;
  altitude?: number;
}

export interface ActivityFile {
  id: string;
  filename: string;
  fileType: string;
  activityDate?: string;
  durationSeconds?: number;
  distanceMeters?: number;
  recordCount: number;
  records: ActivityRecord[];
  status: "success" | "error";
  error?: string;
}

export interface ActivityUploadPayload {
  files: ActivityFile[];
}

export const uploadActivityFiles = async (
  files: FileList | File[],
): Promise<ActivityUploadPayload> => {
  const formData = new FormData();
  const items = Array.from(files);

  for (const file of items) {
    formData.append("files", file, file.name);
  }

  return apiRequest<ActivityUploadPayload>({
    method: "POST",
    path: "/api/activities/upload",
    body: formData as unknown as BodyInit,
    headers: {
      Accept: "application/json",
    },
  });
};
