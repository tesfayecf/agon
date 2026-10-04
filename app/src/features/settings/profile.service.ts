import { apiRequest } from "../../shared/api/client";

export type Sex = "" | "male" | "female";

/** Physical metrics; 0 or "" means the value has not been provided. */
export interface AthleteProfile {
    heightCm: number;
    weightKg: number;
    birthDate: string;
    sex: Sex;
    restingHeartRate: number;
    maxHeartRate: number;
}

export interface ProfileDerived {
    ageYears: number;
    bmi: number;
    estimatedMaxHeartRate: number;
    heartRateReserve: number;
}

export interface AthleteProfileWithDerived extends AthleteProfile {
    updatedAt?: string;
    derived: ProfileDerived;
}

export const fetchProfile = async (): Promise<AthleteProfileWithDerived> => {
    return apiRequest({ method: "GET", path: "/api/profile" });
};

export const saveProfile = async (input: AthleteProfile): Promise<AthleteProfileWithDerived> => {
    return apiRequest({ method: "PUT", path: "/api/profile", body: input });
};
