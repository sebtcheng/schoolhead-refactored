import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiSend, FiUsers, FiBell, FiLink, FiCheckCircle, FiAlertCircle, FiSmartphone } from 'react-icons/fi';

const AdminPushBroadcast = () => {
    const [targetRole, setTargetRole] = useState('School Head');
    const [title, setTitle] = useState('InsightEd Update');
    const [message, setMessage] = useState('Please check your latest school audit report.');
    const [url, setUrl] = useState('/#/nodes-dashboard');
    const [isSending, setIsSending] = useState(false);
    const [status, setStatus] = useState(null); // { type: 'success' | 'error', message: string, count?: number }

    const handleBroadcast = async (e) => {
        e.preventDefault();
        setIsSending(true);
        setStatus(null);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch('api/broadcast-push', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ targetRole, title, message, url })
            });

            const data = await response.json();

            if (response.ok) {
                setStatus({
                    type: 'success',
                    message: `Broadcast complete! Sent to ${data.count} devices.`,
                    count: data.count
                });
                // Reset form slightly for next use
                setMessage('');
            } else {
                throw new Error(data.error || 'Failed to send broadcast');
            }
        } catch (err) {
            setStatus({
                type: 'error',
                message: err.message
            });
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8">
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-2xl mx-auto"
            >
                {/* Header Card */}
                <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-8 border border-slate-100 overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                        <FiBell size={120} className="text-blue-600" />
                    </div>

                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-blue-50 rounded-xl text-blue-600">
                                <FiSmartphone size={24} />
                            </div>
                            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Push Broadcast Center</h1>
                        </div>
                        <p className="text-slate-500 text-sm mb-8">Target specific roles with instant mobile browser notifications.</p>

                        <form onSubmit={handleBroadcast} className="space-y-6">
                            {/* Target Role */}
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                    <FiUsers /> Target Role
                                </label>
                                <select 
                                    value={targetRole}
                                    onChange={(e) => setTargetRole(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none appearance-none"
                                >
                                    <option value="School Head">School Head</option>
                                    <option value="Admin">Admin</option>
                                    <option value="Super User">Super User</option>
                                    <option value="Regional Office">Regional Office</option>
                                    <option value="School Division Office">Division Office</option>
                                </select>
                            </div>

                            {/* Title */}
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                    <FiBell /> Notification Title
                                </label>
                                <input 
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Enter short title..."
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                                    required
                                />
                            </div>

                            {/* Message */}
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                    Message Content
                                </label>
                                <textarea 
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    placeholder="What do you want to say?"
                                    rows="3"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none resize-none"
                                    required
                                />
                            </div>

                            {/* Redirect URL */}
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                    <FiLink /> Click Action (URL)
                                </label>
                                <input 
                                    type="text"
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                    placeholder="/#/dashboard"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none font-mono text-sm"
                                />
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={isSending}
                                className={`w-full py-4 rounded-2xl font-bold text-white shadow-lg shadow-blue-200 flex items-center justify-center gap-3 transition-all ${isSending ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.98]'}`}
                            >
                                {isSending ? (
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <FiSend /> Send Global Broadcast
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Status Messages */}
                <AnimatePresence>
                    {status && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className={`mt-6 p-6 rounded-3xl border flex items-center gap-4 ${status.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-rose-50 border-rose-100 text-rose-800'}`}
                        >
                            {status.type === 'success' ? <FiCheckCircle size={24} className="flex-shrink-0" /> : <FiAlertCircle size={24} className="flex-shrink-0" />}
                            <div>
                                <p className="font-bold">{status.type === 'success' ? 'Sent!' : 'Broadcast Failed'}</p>
                                <p className="text-sm opacity-90">{status.message}</p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Info Card */}
                <div className="mt-8 p-6 bg-slate-800 rounded-3xl text-slate-400 text-xs flex items-start gap-4 leading-relaxed">
                    <FiAlertCircle size={20} className="text-amber-400 flex-shrink-0" />
                    <div>
                        <p className="font-semibold text-slate-200 mb-1 tracking-wide uppercase">Operational Guidance</p>
                        <p>This broadcast targets the browser's Service Worker. Only users who have logged in and "Allowed" notifications on their device will receive this message. For iOS users, the app must be "Added to Home Screen" first.</p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default AdminPushBroadcast;
