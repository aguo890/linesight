import type { ColumnMatchResult } from '../../types/domain';

/**
 * Service for matching engine operations.
 */
export const matchingService = {
    /**
     * Uploads a file and performs column matching.
     * @param file The file to upload.
     * @returns A promise that resolves to an array of ColumnMatchResult.
     */
    uploadAndMatch: async (file: File): Promise<ColumnMatchResult[]> => {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/v1/ingestion/upload_and_match', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to upload and match columns: ${response.status} ${errorText}`);
        }

        // The backend should return data matching the ColumnMatchResult structure.
        // The 'status' field is a property in the Pydantic model response.
        const data = await response.json();

        return data as ColumnMatchResult[];
    }
};
