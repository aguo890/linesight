/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

/**
 * File upload and preview API service
 */
import axios from 'axios';
import { authStorage } from './authStorage';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export interface FileUploadResponse {
    id: string;
    filename: string;
    status: string;
    message: string;
    file_type?: string;
    file_size_bytes?: number;
}

export interface TablePreview {
    columns: string[];
    data: Record<string, any>[];
    total_rows: number;
    preview_rows: number;
    filename: string;
}

/**
 * Upload an Excel or CSV file
 */
export const uploadFile = async (file: File, productionLineId?: string): Promise<FileUploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);

    const token = authStorage.getToken();

    let url = `${API_URL}/ingestion/upload`;
    if (productionLineId) {
        url += `?production_line_id=${productionLineId}`;
    }

    const response = await axios.post<FileUploadResponse>(
        url,
        formData,
        {
            headers: {
                'Content-Type': 'multipart/form-data',
                'Authorization': `Bearer ${token}`,
            },
        }
    );

    return response.data;
};

/**
 * Get preview of staging data for a raw import
 */
export const getImportPreview = async (
    rawImportId: string
): Promise<TablePreview> => {
    const token = authStorage.getToken();
    const response = await axios.get<TablePreview>(
        `${API_URL}/ingestion/preview/${rawImportId}`,
        {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Cache-Control': 'no-cache, no-store, must-revalidate',
            },
        }
    );

    return response.data;
};

/**
 * Get internal preview of uploaded file (metadata and basic sample)
 * @deprecated Use getImportPreview for staging data
 */
export const getFilePreview = async (
    fileId: string
): Promise<TablePreview> => {
    const token = authStorage.getToken();
    const response = await axios.get<TablePreview>(
        `${API_URL}/ingestion/preview/${fileId}`,
        {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
            },
        }
    );

    return response.data;
};

/**
 * Process an uploaded file
 */
export interface ProcessFileRequest {
    use_ai_agent?: boolean;
    target_model?: string;
}

export interface ProcessFileResponse {
    job_id: string;
    status: string;
    message: string;
    records_inserted?: number;
    warnings?: string[];
    target_tables?: string[];
}

export const processFile = async (
    fileId: string,
    options?: ProcessFileRequest
): Promise<ProcessFileResponse> => {
    const token = authStorage.getToken();
    const response = await axios.post<ProcessFileResponse>(
        `${API_URL}/ingestion/process/${fileId}`,
        options || { use_ai_agent: false },
        {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        }
    );

    return response.data;
};

/**
 * Get processing job status
 */
export interface JobStatus {
    id: string;
    status: string;
    progress_pct: number;
    error_message?: string;
    rows_processed?: number;
    started_at?: string;
    completed_at?: string;
}

export const getJobStatus = async (jobId: string): Promise<JobStatus> => {
    const token = authStorage.getToken();
    const response = await axios.get<JobStatus>(
        `${API_URL}/uploads/process/status/${jobId}`,
        {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
            },
        }
    );

    return response.data;
};

/**
 * List uploaded files
 */
export interface FileListItem {
    id: string;
    original_filename: string;
    file_type?: string;
    file_size_bytes?: number;
    status: string;
    created_at: string;
}

export interface FileListResponse {
    files: FileListItem[];
    total: number;
    offset: number;
    limit: number;
}

export const listFiles = async (
    statusFilter?: string,
    limit: number = 50,
    offset: number = 0
): Promise<FileListResponse> => {
    const token = authStorage.getToken();

    let url = `${API_URL}/ingestion/uploads?limit=${limit}&offset=${offset}`;
    if (statusFilter) {
        url += `&status_filter=${statusFilter}`;
    }

    // Added cache-busting headers to force a fresh network request
    const response = await axios.get<FileListResponse>(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
        },
    });

    return response.data;
};

/**
 * List uploaded files filtered by production line
 */
export const listFilesByProductionLine = async (
    productionLineId: string,
    limit: number = 50,
    offset: number = 0
): Promise<FileListResponse> => {
    const token = authStorage.getToken();

    const url = `${API_URL}/ingestion/uploads?production_line_id=${productionLineId}&limit=${limit}&offset=${offset}`;

    const response = await axios.get<FileListResponse>(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
        },
    });

    return response.data;
};

/**
 * Get download URL for a file
 */
export const getFileDownloadUrl = (fileId: string): string => {
    return `${API_URL}/ingestion/files/${fileId}/download`;
};

/**
 * Open file in new tab (triggers download or preview)
 */
export const openFileInNewTab = (fileId: string) => {
    const token = authStorage.getToken();
    const url = getFileDownloadUrl(fileId);

    // Open with auth header by creating a temporary link
    const link = document.createElement('a');
    link.href = `${url}?token=${token}`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

