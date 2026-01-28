
import { processData } from '../services/dataProcessor';

// Escuchar mensajes del hilo principal
self.onmessage = (e: MessageEvent) => {
    const { rawData, allUsers, employeeId, analysisRange, holidays } = e.data;

    try {
        if (!rawData || !Array.isArray(rawData)) {
            throw new Error("Datos inválidos recibidos por el worker.");
        }

        // Reconstituir el Set de festivos si viene como array
        let holidaySet: Set<string> | undefined = undefined;
        if (holidays && Array.isArray(holidays)) {
            holidaySet = new Set(holidays);
        }

        // Ejecutar la lógica pesada
        const result = processData(rawData, allUsers || [], employeeId, analysisRange, holidaySet);

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
