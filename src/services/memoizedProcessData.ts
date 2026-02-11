
import { ProcessedDataRow, RawDataRow, Shift, User } from '../types';
import { processData } from './dataProcessor';

// Caché en memoria
const cache = new Map<string, ProcessedDataRow[]>();

/**
 * Genera una clave hash rápida basada en la longitud y puntos de control de los datos.
 */
const generateCacheKey = (rawData: RawDataRow[], shifts: Shift[], holidays?: Set<string>): string => {
    if (rawData.length === 0) return 'empty';

    const first = rawData[0];
    const last = rawData[rawData.length - 1];

    let key = `len:${rawData.length}-sLen:${shifts.length}-f:${first.IDOperario}_${first.Fecha}-l:${last.IDOperario}_${last.Fecha}`;
    if (holidays) {
        key += `-h:${holidays.size}`;
    }
    return key;
};

/**
 * Wrapper memoizado de processData.
 */
export const processDataMemoized = (rawData: RawDataRow[], users: User[] = [], employeeId?: number, holidays?: Set<string>): ProcessedDataRow[] => {
    if (employeeId) {
        return processData(rawData, users, employeeId, undefined, holidays);
    }

    const key = generateCacheKey(rawData, users as any, holidays); // Cast to ignore shift/user mismatch in key gen for now

    if (cache.has(key)) {
        console.debug("⚡ Memoized Hit: processData");
        return cache.get(key)!;
    }

    console.debug("🐢 Memoized Miss: Recalculating processData...");
    const result = processData(rawData, users, undefined, undefined, holidays);

    cache.clear();
    cache.set(key, result);

    return result;
};
