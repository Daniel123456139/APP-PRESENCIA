
import { useState, useEffect } from 'react';
import { ServerConnectionMonitor, ServerStatus } from '../services/ServerConnectionMonitor';

export const useServerConnection = () => {
    const [status, setStatus] = useState<ServerStatus>(ServerConnectionMonitor.getStatus());
    const [latency, setLatency] = useState<number | null>(ServerConnectionMonitor.getLatency());

    useEffect(() => {
        const unsubscribe = ServerConnectionMonitor.subscribe((newStatus, newLatency) => {
            setStatus(newStatus);
            setLatency(newLatency);
        });

        return () => {
            unsubscribe();
        };
    }, []);

    return { 
        status, 
        latency,
        forceCheck: () => ServerConnectionMonitor.forceCheck()
    };
};
