import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export type BundleEventType = "BUNDLE_STARTED" | "PART_COUNTED" | "BUNDLE_COMPLETED";

export interface TelemetryEvent {
    event_type: BundleEventType;
    timestamp: string;
    device_id: string;
    part_count: number;
    fraud_suspected: boolean;
    fraud_reason: string | null;
}

/**
 * useRetrofitTelemetry
 * 
 * Subscribes to Edge Node real-time telemetry over WebSockets.
 * Employs a Dual-Path Architecture: updates dashboard UI incrementally via
 * React Query's setQueryData without triggering full REST re-fetches for each event.
 */
export function useRetrofitTelemetry(deviceId: string) {
    const queryClient = useQueryClient();

    useEffect(() => {
        // Mock WebSocket connection to the FastAPI sub-service
        const wsUrl = `ws://localhost:8000/api/v1/ws/telemetry/${deviceId}`;
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
             console.log(`[WebSocket] Connected to Edge Node Telemetry stream for ${deviceId}`);
        };

        ws.onmessage = (event) => {
            try {
                const data: TelemetryEvent = JSON.parse(event.data);
                
                // --- DUAL-PATH ARCHITECTURE ---
                // Fast path: bypass database/REST latency by patching the front-end cache.
                queryClient.setQueryData(
                    ['telemetry', deviceId], 
                    (oldData: TelemetryEvent[] | undefined) => {
                        const currentData = oldData || [];
                        return [...currentData, data];
                    }
                );

                // Option to trigger full invalidations strictly on BUNDLE_COMPLETED 
                // in case other backend aggregations need to be fetched (the slow path).
                if (data.event_type === "BUNDLE_COMPLETED") {
                    console.log(`[WebSocket] Bundle completed for ${deviceId}. Invalidating related dashboard queries.`);
                    // queryClient.invalidateQueries({ queryKey: ['dashboards', 'overall'] });
                }

            } catch (err) {
                console.error("[WebSocket] Failed to parse edge telemetry JSON:", err);
            }
        };

        ws.onerror = (err) => {
            console.error(`[WebSocket] Connection error for ${deviceId}:`, err);
        };

        return () => {
            console.log(`[WebSocket] Disconnecting from stream for ${deviceId}`);
            ws.close();
        };
    }, [deviceId, queryClient]);
}
