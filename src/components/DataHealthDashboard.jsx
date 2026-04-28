import React, { useState, useEffect } from 'react';
import { FiCheckCircle, FiXCircle, FiActivity, FiAlertTriangle } from 'react-icons/fi';

const DataHealthDashboard = ({ schoolId }) => {
    const [healthData, setHealthData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchHealthScore = async () => {
            if (!schoolId) return;
            setLoading(true);
            try {
                // Step 1: Trigger Python fraud detection recalculation (same as School Head dashboard)
                // This ensures the score is always fresh and matches what the School Head sees
                try {
                    await fetch('api/validate-school-health', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ school_id: schoolId })
                    });
                } catch (valErr) {
                    console.warn("Validation trigger failed (non-blocking):", valErr);
                }

                // Step 2: Fetch the freshly-updated health score
                const response = await fetch(`api/schools/${schoolId}/health-score`);
                if (!response.ok) {
                    throw new Error('Failed to fetch data health score');
                }
                const data = await response.json();
                setHealthData(data);
            } catch (err) {
                console.error("Error fetching health score:", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchHealthScore();
    }, [schoolId]);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex justify-center items-center h-64 text-red-500">
                <p>Error: {error}</p>
            </div>
        );
    }

    if (!healthData) return null;

    const { score, checklist, totalModules, completedCount, dataHealthScore, dataHealthDescription, dataQualityIssues } = healthData;

    // Use actual data health score from school_summary if available, otherwise fall back to form completion
    const displayScore = dataHealthScore !== null && dataHealthScore !== undefined ? dataHealthScore : score;
    const displayDescription = dataHealthDescription || (score === 100 ? 'Excellent' : score >= 80 ? 'Good' : score >= 50 ? 'Fair' : 'Critical');

    // Determine color based on actual data health score
    let scoreColorClass = "text-red-500";
    let scoreBgClass = "bg-red-50 dark:bg-red-900/20";
    if (displayScore === 100) {
        scoreColorClass = "text-emerald-500";
        scoreBgClass = "bg-emerald-50 dark:bg-emerald-900/20";
    } else if (displayScore >= 80) {
        scoreColorClass = "text-blue-500";
        scoreBgClass = "bg-blue-50 dark:bg-blue-900/20";
    } else if (displayScore >= 50) {
        scoreColorClass = "text-amber-500";
        scoreBgClass = "bg-amber-50 dark:bg-amber-900/20";
    }

    return (
        <div className="p-6 lg:p-10 animate-fade-in custom-scrollbar overflow-y-auto w-full h-full max-h-[85vh]">
            <div className="flex flex-col gap-8">
                {/* Top Row: Data Health Score + Form Completion */}
                <div className="flex flex-col md:flex-row gap-6">
                    {/* Actual Data Health Score from school_summary */}
                    <div className="w-full md:w-1/2 flex flex-col items-center justify-center p-8 rounded-3xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
                        <div className={`p-4 rounded-full mb-4 ${scoreBgClass}`}>
                            <FiActivity className={scoreColorClass} size={32} />
                        </div>
                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-2 text-center">
                            Data Health Score
                        </h3>
                        <div className="flex items-baseline gap-1">
                            <span className={`text-6xl font-black tracking-tighter ${scoreColorClass}`}>
                                {displayScore}
                            </span>
                            <span className="text-3xl font-bold text-slate-400">%</span>
                        </div>
                        <span className={`mt-3 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider ${
                            displayDescription === 'Excellent' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                            displayDescription === 'Good' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                            displayDescription === 'Fair' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                            'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                            {displayDescription}
                        </span>
                        <p className="text-[10px] font-bold text-slate-400 mt-3 text-center uppercase">
                            From Advanced Fraud Detection
                        </p>
                    </div>

                    {/* Form Completion Score */}
                    <div className="w-full md:w-1/2 flex flex-col items-center justify-center p-8 rounded-3xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
                        <div className={`p-4 rounded-full mb-4 ${score === 100 ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-amber-50 dark:bg-amber-900/20'}`}>
                            <FiCheckCircle className={score === 100 ? 'text-emerald-500' : 'text-amber-500'} size={32} />
                        </div>
                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-2 text-center">
                            Form Completion
                        </h3>
                        <div className="flex items-baseline gap-1">
                            <span className={`text-6xl font-black tracking-tighter ${score === 100 ? 'text-emerald-500' : score >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                                {score}
                            </span>
                            <span className="text-3xl font-bold text-slate-400">%</span>
                        </div>
                        <p className="text-xs font-bold text-slate-500 mt-4 text-center">
                            {completedCount} of {totalModules} Modules Completed
                        </p>
                    </div>
                </div>

                {/* Data Quality Issues Section */}
                {dataQualityIssues && dataQualityIssues !== 'None' && dataQualityIssues.trim() !== '' && (
                    <div className="bg-red-50 dark:bg-red-900/10 p-6 rounded-3xl border border-red-100 dark:border-red-900/30 shadow-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
                                <FiAlertTriangle className="text-red-500" size={20} />
                            </div>
                            <h3 className="text-sm font-black text-red-600 dark:text-red-400 uppercase tracking-widest">
                                Data Quality Issues
                            </h3>
                        </div>
                        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-red-100 dark:border-red-900/30">
                            <p className="text-sm text-red-700 dark:text-red-300 font-semibold leading-relaxed whitespace-pre-wrap">
                                {dataQualityIssues}
                            </p>
                        </div>
                    </div>
                )}

                {/* Checklist Section */}
                <div className="w-full flex flex-col bg-white dark:bg-slate-800 p-8 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm">
                    <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
                        Data Completion Checklist
                    </h3>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {checklist.map((item, index) => (
                            <div 
                                key={index} 
                                className={`flex items-center gap-3 p-4 rounded-2xl border transition-colors
                                    ${item.status 
                                        ? 'border-emerald-100 bg-emerald-50/50 dark:border-emerald-900/30 dark:bg-emerald-900/10' 
                                        : 'border-red-100 bg-red-50/50 dark:border-red-900/30 dark:bg-red-900/10'
                                    }`}
                            >
                                <div className="shrink-0">
                                    {item.status ? (
                                        <FiCheckCircle className="text-emerald-500" size={20} />
                                    ) : (
                                        <FiXCircle className="text-red-400" size={20} />
                                    )}
                                </div>
                                <div>
                                    <p className={`text-sm font-bold ${item.status ? 'text-slate-700 dark:text-slate-200' : 'text-slate-600 dark:text-slate-300'}`}>
                                        {item.module}
                                    </p>
                                    <p className="text-[10px] font-black uppercase tracking-wider mt-0.5">
                                        {item.status ? (
                                            <span className="text-emerald-600 dark:text-emerald-400">Completed</span>
                                        ) : (
                                            <span className="text-red-500 dark:text-red-400">Incomplete</span>
                                        )}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DataHealthDashboard;

