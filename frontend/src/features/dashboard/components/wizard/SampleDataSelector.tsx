import React, { useState, useEffect } from 'react';
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import api from '../../../../lib/api';

interface SampleFile {
    filename: string;
    size: number;
    description: string;
}

interface SampleDataSelectorProps {
    onFileSelected: (file: File) => void;
}

export const SampleDataSelector: React.FC<SampleDataSelectorProps> = ({ onFileSelected }) => {
    const [sampleFiles, setSampleFiles] = useState<SampleFile[]>([]);
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState<string | null>(null);

    useEffect(() => {
        fetchSampleFiles();
    }, []);

    const fetchSampleFiles = async () => {
        try {
            // baseURL includes /api/v1
            // Use local endpoint mock or actual backend?
            // Assuming /samples/sample-files corresponds to backend endpoint OR we use hardcoded local for now?
            // The file had 'http://localhost:8000/api/v1/samples/sample-files'.
            // If we use api client, it prepends baseURL.
            const response = await api.get('/samples/sample-files');
            setSampleFiles(response.data);
        } catch (error) {
            console.error('Failed to fetch sample files:', error);
            // Don't clear if error, maybe just log
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadAndSelect = async (filename: string) => {
        setDownloading(filename);
        try {
            const response = await api.get(`/samples/sample-files/${filename}`, {
                responseType: 'blob'
            });

            const blob = response.data;
            const file = new File([blob], filename, { type: blob.type });
            onFileSelected(file);
        } catch (error) {
            console.error('Failed to download sample file:', error);
            alert('Failed to load sample file. Please try again.');
        } finally {
            setDownloading(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
        );
    }

    if (sampleFiles.length === 0) {
        return (
            <div className="text-center py-8 text-gray-500 text-sm">
                No sample files available
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700">Or try a sample file:</p>
            <div className="space-y-2">
                {sampleFiles.map((file) => (
                    <button
                        key={file.filename}
                        onClick={() => handleDownloadAndSelect(file.filename)}
                        disabled={downloading !== null}
                        className="w-full flex items-start space-x-3 p-3 border border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
                    >
                        <FileSpreadsheet className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">{file.filename}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{file.description}</p>
                            <p className="text-xs text-gray-400 mt-1">
                                {(file.size / 1024).toFixed(1)} KB
                            </p>
                        </div>
                        {downloading === file.filename ? (
                            <Loader2 className="w-4 h-4 animate-spin text-blue-600 flex-shrink-0" />
                        ) : (
                            <Download className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
};
