import { useState, useCallback, useEffect } from 'react';
import { listOrgMembers, type MemberRead } from '../../../api/endpoints/team/teamApi';

export const useOrgMembers = () => {
    const [members, setMembers] = useState<MemberRead[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchMembers = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await listOrgMembers();
            setMembers(response.data);
            setError(null);
        } catch (err) {
            console.error('Failed to fetch members:', err);
            setError('Failed to load organization members.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Initial fetch
    useEffect(() => {
        fetchMembers();
    }, [fetchMembers]);

    return {
        members,
        isLoading,
        error,
        refreshMembers: fetchMembers
    };
};
