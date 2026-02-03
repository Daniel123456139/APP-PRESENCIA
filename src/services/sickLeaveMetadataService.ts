
// Servicio para gestionar datos extra de las bajas que el ERP no soporta nativamente.
// Se vincula por ID Operario + Fecha Inicio de la baja.

export interface SickLeaveMetadata {
    id: string; // Composite key: employeeId_startDateISO
    nextRevisionDate?: string | null;
    dischargeDate?: string | null; // Fecha Alta - triggers move to history
    doctorNotes?: string;
    confirmedByEmployee?: boolean;
}

import { encryptStorageData, decryptStorageData } from './encryptionService';

const STORAGE_KEY = 'hr_app_sick_leave_metadata';

export const SickLeaveMetadataService = {
    load(): Record<string, SickLeaveMetadata> {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? (decryptStorageData(data) || {}) : {};
        } catch (e) {
            console.error("Error loading sick leave metadata", e);
            return {};
        }
    },

    save(data: Record<string, SickLeaveMetadata>) {
        try {
            // Privacy Hardening: Do NOT persist doctorNotes in local storage
            const safeData: Record<string, SickLeaveMetadata> = {};
            for (const key in data) {
                const { doctorNotes, ...rest } = data[key];
                safeData[key] = rest;
            }
            localStorage.setItem(STORAGE_KEY, encryptStorageData(safeData));
        } catch (e) {
            console.error("Error saving sick leave metadata", e);
        }
    },

    get(employeeId: number, startDate: string): SickLeaveMetadata | null {
        const db = this.load();
        const key = `${employeeId}_${startDate}`;
        return db[key] || null;
    },

    update(employeeId: number, startDate: string, updates: Partial<SickLeaveMetadata>) {
        const db = this.load();
        const key = `${employeeId}_${startDate}`;

        db[key] = {
            id: key,
            ...db[key],
            ...updates
        };

        this.save(db);
        return db[key];
    }
};
