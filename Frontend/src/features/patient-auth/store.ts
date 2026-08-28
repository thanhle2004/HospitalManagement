import { create } from "zustand";
import type { PatientProfile } from "./types";

interface PatientAuthState {
  patient: PatientProfile | null;
  isInitialized: boolean;
  setPatient: (patient: PatientProfile) => void;
  clearPatient: () => void;
}

export const usePatientAuthStore = create<PatientAuthState>()((set) => ({
  patient: null,
  isInitialized: false,
  setPatient: (patient) => set({ patient, isInitialized: true }),
  clearPatient: () => set({ patient: null, isInitialized: true }),
}));
