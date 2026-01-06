import React from 'react';
import { type ColumnMatchResult, MatchTier } from '../../../types/domain';

interface ColumnMapperProps {
    match: ColumnMatchResult;
}

export const ColumnMapper: React.FC<ColumnMapperProps> = ({ match }) => {
    const getBadgeColor = (tier: MatchTier) => {
        switch (tier) {
            case MatchTier.HASH:
                return 'bg-green-100 text-green-800 border-green-200';
            case MatchTier.FUZZY:
                return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case MatchTier.LLM:
                return 'bg-blue-100 text-blue-800 border-blue-200';
            case MatchTier.MANUAL:
                return 'bg-purple-100 text-purple-800 border-purple-200';
            case MatchTier.UNMATCHED:
                return 'bg-red-100 text-red-800 border-red-200';
            default:
                return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    const statusColors = {
        ignored: 'text-gray-400',
        auto_mapped: 'text-green-600',
        needs_review: 'text-yellow-600',
        needs_attention: 'text-red-600',
    };

    return (
        <div className="p-4 border rounded-lg shadow-sm bg-white hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-2">
                <div>
                    <h3 className="font-semibold text-gray-900 truncate" title={match.source_column}>
                        {match.source_column}
                    </h3>
                    <p className="text-sm text-gray-500">
                        {match.target_field ? (
                            <span>maps to <span className="font-medium text-gray-700">{match.target_field}</span></span>
                        ) : (
                            <span className="italic">No target field identified</span>
                        )}
                    </p>
                </div>
                <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${getBadgeColor(match.tier)}`}
                >
                    {match.tier.toUpperCase()}
                </span>
            </div>

            <div className="flex items-center justify-between mt-3 text-sm">
                <div className="flex items-center gap-2">
                    <span className="text-gray-500">Confidence:</span>
                    <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                            className={`h-full ${match.confidence > 0.8 ? 'bg-green-500' : match.confidence > 0.5 ? 'bg-yellow-500' : 'bg-red-500'}`}
                            style={{ width: `${match.confidence * 100}%` }}
                        />
                    </div>
                    <span className="text-xs text-gray-600">{(match.confidence * 100).toFixed(0)}%</span>
                </div>

                <div className={`font-medium ${statusColors[match.status as keyof typeof statusColors] || 'text-gray-600'}`}>
                    {match.status.replace('_', ' ').toUpperCase()}
                </div>
            </div>

            {match.reasoning && (
                <div className="mt-2 text-xs text-gray-500 bg-gray-50 p-2 rounded">
                    {match.reasoning}
                </div>
            )}
        </div>
    );
};
