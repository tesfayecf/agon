import { useEffect, useState, type FormEvent, type ReactElement } from "react";

import { Card } from "../../shared/components/Card";
import { ErrorState, LoadingState } from "../../shared/components/StateViews";
import { formatDateTime } from "../../shared/utils/format";
import { fetchProfile, saveProfile, type AthleteProfile, type ProfileDerived, type Sex } from "./profile.service";

/** Form state keeps raw strings so a field can be cleared; "" maps back to 0 ("not provided"). */
interface FormState {
    heightCm: string;
    weightKg: string;
    birthDate: string;
    sex: Sex;
    restingHeartRate: string;
    maxHeartRate: string;
}

const toField = (value: number): string => value > 0 ? String(value) : "";

const toForm = (p: AthleteProfile): FormState => ({
    heightCm: toField(p.heightCm),
    weightKg: toField(p.weightKg),
    birthDate: p.birthDate,
    sex: p.sex,
    restingHeartRate: toField(p.restingHeartRate),
    maxHeartRate: toField(p.maxHeartRate),
});

const toNumber = (value: string): number => {
    const n = Number(value);
    return value.trim() === "" || !Number.isFinite(n) ? 0 : n;
};

const fromForm = (f: FormState): AthleteProfile => ({
    heightCm: toNumber(f.heightCm),
    weightKg: toNumber(f.weightKg),
    birthDate: f.birthDate,
    sex: f.sex,
    restingHeartRate: toNumber(f.restingHeartRate),
    maxHeartRate: toNumber(f.maxHeartRate),
});

const EMPTY_FORM: FormState = { heightCm: "", weightKg: "", birthDate: "", sex: "", restingHeartRate: "", maxHeartRate: "" };

const NUMBER_FIELDS: { key: Exclude<keyof FormState, "birthDate" | "sex">; label: string; min: number; max: number; step: string }[] = [
    { key: "heightCm", label: "Height (cm)", min: 100, max: 250, step: "0.5" },
    { key: "weightKg", label: "Weight (kg)", min: 30, max: 250, step: "0.1" },
    { key: "restingHeartRate", label: "Resting heart rate (bpm)", min: 25, max: 120, step: "1" },
    { key: "maxHeartRate", label: "Max heart rate (bpm)", min: 100, max: 230, step: "1" },
];

export const PhysicalMetricsCard = (): ReactElement => {
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [derived, setDerived] = useState<ProfileDerived | null>(null);
    const [updatedAt, setUpdatedAt] = useState<string | undefined>(undefined);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [savedNotice, setSavedNotice] = useState(false);

    useEffect(() => {
        const load = async (): Promise<void> => {
            try {
                const p = await fetchProfile();
                setForm(toForm(p));
                setDerived(p.derived);
                setUpdatedAt(p.updatedAt);
            } catch (err) {
                setLoadError(err instanceof Error ? err.message : "Could not load your profile.");
            } finally {
                setIsLoading(false);
            }
        };

        void load();
    }, []);

    const update = <TKey extends keyof FormState>(key: TKey, value: FormState[TKey]): void => {
        setForm((prev) => ({ ...prev, [key]: value }));
        setSavedNotice(false);
    };

    const handleSubmit = async (e: FormEvent): Promise<void> => {
        e.preventDefault();
        setIsSaving(true);
        setSaveError(null);
        try {
            const saved = await saveProfile(fromForm(form));
            setForm(toForm(saved));
            setDerived(saved.derived);
            setUpdatedAt(saved.updatedAt);
            setSavedNotice(true);
        } catch (err) {
            setSaveError(err instanceof Error ? err.message : "Could not save your profile.");
        } finally {
            setIsSaving(false);
        }
    };

    const estimatedMax = derived?.estimatedMaxHeartRate ?? 0;

    return (
        <Card title="Physical metrics">
            <p className="settings-field__description">
                Used for derived figures and to adjust race predictions for effort. Every field is optional.
            </p>

            {isLoading && <LoadingState label="Loading profile…" />}
            {!isLoading && loadError !== null && <ErrorState message={loadError} />}

            {!isLoading && loadError === null && (
                <form className="profile-form" onSubmit={handleSubmit} noValidate>
                    <div className="profile-form__grid">
                        {NUMBER_FIELDS.slice(0, 2).map((f) => (
                            <div className="form-field" key={f.key}>
                                <label htmlFor={`profile-${f.key}`}>{f.label}</label>
                                <input
                                    id={`profile-${f.key}`}
                                    type="number"
                                    inputMode="decimal"
                                    min={f.min}
                                    max={f.max}
                                    step={f.step}
                                    value={form[f.key]}
                                    onChange={(e) => update(f.key, e.target.value)}
                                />
                            </div>
                        ))}
                        <div className="form-field">
                            <label htmlFor="profile-birthDate">Date of birth</label>
                            <input id="profile-birthDate" type="date" value={form.birthDate} onChange={(e) => update("birthDate", e.target.value)} />
                        </div>
                        <div className="form-field">
                            <label htmlFor="profile-sex">Sex</label>
                            <select id="profile-sex" value={form.sex} onChange={(e) => update("sex", e.target.value as Sex)}>
                                <option value="">Prefer not to say</option>
                                <option value="female">Female</option>
                                <option value="male">Male</option>
                            </select>
                        </div>
                        {NUMBER_FIELDS.slice(2).map((f) => (
                            <div className="form-field" key={f.key}>
                                <label htmlFor={`profile-${f.key}`}>{f.label}</label>
                                <input
                                    id={`profile-${f.key}`}
                                    type="number"
                                    inputMode="numeric"
                                    min={f.min}
                                    max={f.max}
                                    step={f.step}
                                    value={form[f.key]}
                                    onChange={(e) => update(f.key, e.target.value)}
                                />
                                {f.key === "maxHeartRate" && form.maxHeartRate === "" && estimatedMax > 0 && (
                                    <button type="button" className="btn btn-ghost btn-sm profile-form__suggest" onClick={() => update("maxHeartRate", String(estimatedMax))}>
                                        Use age estimate ({estimatedMax} bpm)
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    {derived !== null && (
                        <div className="chip-row" aria-label="Derived metrics">
                            {derived.ageYears > 0 && <span className="chip">Age {derived.ageYears}</span>}
                            {derived.bmi > 0 && <span className="chip">BMI {derived.bmi.toFixed(1)}</span>}
                            {derived.heartRateReserve > 0 && <span className="chip">HR reserve {derived.heartRateReserve} bpm</span>}
                            {estimatedMax > 0 && (
                                <span className="chip" title="Tanaka formula: 208 − 0.7 × age. A lab or field test is more accurate.">
                                    Est. max HR {estimatedMax} bpm
                                </span>
                            )}
                        </div>
                    )}

                    {saveError !== null && <p className="error-banner">{saveError}</p>}

                    <div className="profile-form__actions">
                        <button type="submit" className="btn btn-primary btn-sm" disabled={isSaving}>
                            {isSaving ? "Saving…" : "Save metrics"}
                        </button>
                        <span className="profile-form__status" role="status">
                            {savedNotice ? "Saved." : updatedAt !== undefined ? `Last updated ${formatDateTime(updatedAt)}` : ""}
                        </span>
                    </div>
                </form>
            )}
        </Card>
    );
};
