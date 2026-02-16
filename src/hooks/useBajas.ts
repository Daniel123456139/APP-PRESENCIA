import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, query, orderBy, getDocs, onSnapshot } from 'firebase/firestore';
import { getFirebaseDb } from '../firebaseConfig';
import { upsertClosedSickLeave } from '../services/firestoreService';

export interface ClosedSickLeaveRecord {
    id: string;
    employeeId: string | number;
    employeeName: string;
    type: 'ITEC' | 'ITAT';
    startDate: string;
    endDate: string;
    dischargeDate: string;
    motivo?: string;
}

export const BAJAS_KEYS = {
    all: ['bajas'] as const,
};

export const useBajas = () => {
    const queryClient = useQueryClient();

    // Query para el histórico de bajas desde Firebase
    const { data: historicalBajas = [], isLoading, error } = useQuery({
        queryKey: BAJAS_KEYS.all,
        queryFn: async () => {
            const db = getFirebaseDb();
            const q = query(collection(db, 'BAJAS'), orderBy('dischargeDate', 'desc'));
            const snapshot = await getDocs(q);

            return snapshot.docs.map(docSnap => {
                const data = docSnap.data();
                return {
                    id: docSnap.id,
                    employeeId: data.employeeId,
                    employeeName: data.employeeName || '',
                    type: data.type,
                    startDate: data.startDate,
                    endDate: data.endDate || data.dischargeDate,
                    dischargeDate: data.dischargeDate,
                    motivo: data.motivo
                } as ClosedSickLeaveRecord;
            });
        },
        staleTime: 1000 * 60 * 10, // 10 minutos
    });

    // Mutación para registrar bajas en el histórico
    const archiveLeaveMutation = useMutation({
        mutationFn: upsertClosedSickLeave,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: BAJAS_KEYS.all });
        }
    });

    return {
        historicalBajas,
        isLoading,
        error,
        archiveLeave: archiveLeaveMutation.mutateAsync,
        isArchiving: archiveLeaveMutation.isPending
    };
};
