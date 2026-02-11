
import { processData } from '../services/dataProcessor';

// Escuchar mensajes del hilo principal
self.onmessage = (e: MessageEvent) => {
    const { rawData, allUsers, employeeId, analysisRange, holidays, employeeCalendars } = e.data;

    try {
        if (!rawData || !Array.isArray(rawData)) {
            throw new Error("Datos inválidos recibidos por el worker.");
        }

        // Reconstituir el Set de festivos si viene como array
        let holidaySet: Set<string> | undefined = undefined;
        if (holidays && Array.isArray(holidays)) {
            holidaySet = new Set(holidays);
        }

        let calendarMap: Map<number, Map<string, number>> | undefined = undefined;
        if (employeeCalendars && typeof employeeCalendars === 'object') {
            calendarMap = new Map();
            Object.entries(employeeCalendars).forEach(([empId, dateObj]: [string, any]) => {
                calendarMap!.set(Number(empId), new Map(Object.entries(dateObj)));
            });
        }

        // Ejecutar la lógica pesada
        const result = processData(rawData, allUsers || [], employeeId, analysisRange, holidaySet, calendarMap);

        // Devolver resultados
        self.postMessage({
            success: true,
            data: result
        });

    } catch (error: any) {
        console.error("Worker Error:", error);
        self.postMessage({
            success: false,
            error: error.message || "Error desconocido en el worker"
        });
    }
};
