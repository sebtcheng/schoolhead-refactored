import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiCopy, FiX, FiUser, FiMail, FiCheck } from 'react-icons/fi';
import { LuShieldCheck, LuMapPin, LuBuilding2 } from 'react-icons/lu';
import { useAuth } from '../context/AuthContext';
import BottomNav from './BottomNav';
import PageTransition from '../components/PageTransition';

const RegionalEngineerLookup = () => {
    const { user, token } = useAuth();
    const navigate = useNavigate();

    const [lookupEmail, setLookupEmail] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [foundEngineer, setFoundEngineer] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [copiedField, setCopiedField] = useState(null);

    const handleLookup = async () => {
        if (!lookupEmail.trim()) return;
        setIsSearching(true);
        try {
            const res = await fetch(
                `/api/regional-engineer/lookup-engineer?email=${encodeURIComponent(lookupEmail.trim())}&region=${encodeURIComponent(user?.region || '')}`,
                { headers: token ? { Authorization: `Bearer ${token}` } : {} }
            );
            if (res.ok) {
                const data = await res.json();
                setFoundEngineer(data);
                setShowModal(true);
            } else {
                const err = await res.json();
                alert(err.error || "Engineer not found or is outside your regional jurisdiction.");
            }
        } catch (err) {
            console.error("Lookup error:", err);
            alert("An error occurred while searching.");
        } finally {
            setIsSearching(false);
        }
    };

    const copyToClipboard = (text, field) => {
        if (!text) return;
        navigator.clipboard.writeText(text).then(() => {
            setCopiedField(field);
            setTimeout(() => setCopiedField(null), 2000);
        }).catch(() => {});
    };

    const initials = foundEngineer
        ? [foundEngineer.first_name?.[0], foundEngineer.last_name?.[0]].filter(Boolean).join('').toUpperCase() || '?'
        : '';

    return (
        <PageTransition>
            <div className="min-h-screen bg-slate-100 dark:bg-slate-900 pb-32">

                {/* ── HERO HEADER ── */}
                <div className="relative bg-gradient-to-br from-[#004A99] via-[#003a7a] to-[#001D3D] px-6 pt-14 pb-28 overflow-hidden">
                    {/* decorative circles */}
                    <div className="absolute -top-16 -right-16 w-64 h-64 bg-white/5 rounded-full" />
                    <div className="absolute top-8 right-8 w-32 h-32 bg-blue-400/10 rounded-full" />
                    <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-blue-300/5 rounded-full" />

                    {/* grid texture */}
                    <div
                        className="absolute inset-0 opacity-[0.04]"
                        style={{
                            backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
                            backgroundSize: '32px 32px'
                        }}
                    />

                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-11 h-11 bg-white/15 backdrop-blur-sm border border-white/20 rounded-2xl flex items-center justify-center shadow-lg">
                                <LuShieldCheck size={22} className="text-white" />
                            </div>
                            <div>
                                <p className="text-white/50 text-[9px] font-black uppercase tracking-[0.3em]">Regional Engineering</p>
                                <h1 className="text-2xl font-black text-white tracking-tight leading-none">Account Lookup</h1>
                            </div>
                        </div>

                        <p className="text-white/60 text-xs font-medium leading-relaxed max-w-xs">
                            Find Division Engineers and Architects under your jurisdiction and retrieve their passcode instantly.
                        </p>

                        {/* Jurisdiction pill */}
                        <div className="mt-4 inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/15 rounded-full px-4 py-2">
                            <LuMapPin size={12} className="text-blue-300 shrink-0" />
                            <span className="text-white text-[11px] font-black truncate max-w-[200px]">{user?.region || 'Your Region'}</span>
                        </div>
                    </div>
                </div>

                {/* ── SEARCH CARD (floats over header) ── */}
                <div className="relative z-20 max-w-xl mx-auto px-4 -mt-14 space-y-4">
                    <div className="bg-white dark:bg-slate-800 rounded-[1.75rem] shadow-2xl shadow-slate-900/15 p-6 border border-white dark:border-slate-700">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Search by Email</p>

                        <div className="relative mb-3">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 bg-[#004A99]/8 rounded-xl flex items-center justify-center">
                                <FiMail size={14} className="text-[#004A99]" />
                            </div>
                            <input
                                type="email"
                                value={lookupEmail}
                                onChange={e => setLookupEmail(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleLookup()}
                                placeholder="engineer@deped.gov.ph"
                                className="w-full pl-14 pr-4 py-4 bg-slate-50 dark:bg-slate-900/60 border-2 border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-medium text-slate-700 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-500 focus:border-[#004A99] focus:bg-white dark:focus:bg-slate-800 focus:outline-none transition-all"
                            />
                        </div>

                        <button
                            onClick={handleLookup}
                            disabled={!lookupEmail.trim() || isSearching}
                            className="w-full py-4 bg-gradient-to-r from-[#004A99] to-[#0063cc] hover:from-[#003a7a] hover:to-[#004A99] text-white text-sm font-black rounded-2xl shadow-lg shadow-blue-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2.5 active:scale-[0.98]"
                        >
                            {isSearching ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                    Searching...
                                </>
                            ) : (
                                <>
                                    <FiSearch size={16} />
                                    Search Engineer
                                </>
                            )}
                        </button>
                    </div>

                    {/* ── HOW IT WORKS ── */}
                    <div className="bg-white dark:bg-slate-800 rounded-[1.75rem] border border-slate-100 dark:border-slate-700 shadow-sm p-5">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">How it works</p>
                        <div className="space-y-3">
                            {[
                                { step: '01', label: 'Enter email', desc: 'Type the exact email of the Division Engineer or Architect.' },
                                { step: '02', label: 'Jurisdiction check', desc: 'Only engineers under your region are accessible.' },
                                { step: '03', label: 'View passcode', desc: 'Copy the passcode directly to share with the engineer.' },
                            ].map(({ step, label, desc }) => (
                                <div key={step} className="flex items-start gap-3">
                                    <div className="w-7 h-7 bg-[#004A99]/8 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                                        <span className="text-[9px] font-black text-[#004A99]">{step}</span>
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-slate-700 dark:text-slate-200">{label}</p>
                                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── ENGINEER DETAILS MODAL ── */}
                {showModal && foundEngineer && (
                    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-slate-800 w-full sm:max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300">

                            {/* Modal drag handle (mobile) */}
                            <div className="flex justify-center pt-4 pb-1 sm:hidden">
                                <div className="w-10 h-1 bg-slate-200 dark:bg-slate-600 rounded-full" />
                            </div>

                            {/* Avatar banner */}
                            <div className="bg-gradient-to-br from-[#004A99] to-[#001D3D] px-7 pt-5 pb-8 rounded-t-[2.5rem] relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="absolute top-4 right-5 p-1.5 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                                >
                                    <FiX className="text-white" size={18} />
                                </button>
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 bg-white/20 backdrop-blur-sm border-2 border-white/30 rounded-2xl flex items-center justify-center shadow-lg shrink-0">
                                        <span className="text-xl font-black text-white">{initials}</span>
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-white font-black text-base leading-tight truncate">
                                            {[foundEngineer.first_name, foundEngineer.last_name].filter(Boolean).join(' ') || 'Engineer'}
                                        </p>
                                        <span className="inline-flex items-center gap-1 mt-1.5 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-white/15 text-white/80">
                                            <FiUser size={9} /> {foundEngineer.role}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="px-7 py-5 space-y-3">
                                {/* Region + Division */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-3.5">
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <LuMapPin size={10} className="text-slate-400" />
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Region</p>
                                        </div>
                                        <p className="text-xs font-black text-slate-700 dark:text-slate-200 leading-tight">{foundEngineer.region || '—'}</p>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-3.5">
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <LuBuilding2 size={10} className="text-slate-400" />
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Division</p>
                                        </div>
                                        <p className="text-xs font-black text-slate-700 dark:text-slate-200 leading-tight">{foundEngineer.division || '—'}</p>
                                    </div>
                                </div>

                                {/* Email */}
                                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-3.5">
                                    <div className="overflow-hidden mr-2">
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <FiMail size={10} className="text-slate-400" />
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Email</p>
                                        </div>
                                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{foundEngineer.email}</p>
                                    </div>
                                    <button
                                        onClick={() => copyToClipboard(foundEngineer.email, 'email')}
                                        className={`p-2 rounded-xl border transition-all active:scale-95 shrink-0 ${copiedField === 'email' ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-[#004A99]'}`}
                                    >
                                        {copiedField === 'email' ? <FiCheck size={14} /> : <FiCopy size={14} />}
                                    </button>
                                </div>

                                {/* Passcode — hero card */}
                                <div className="relative bg-gradient-to-br from-[#004A99] to-[#003a7a] rounded-2xl p-5 overflow-hidden">
                                    <div className="absolute top-0 right-0 w-28 h-28 bg-white/5 rounded-full -translate-y-1/3 translate-x-1/3" />
                                    <div className="relative z-10 flex items-center justify-between">
                                        <div>
                                            <div className="flex items-center gap-1.5 mb-2">
                                                <LuShieldCheck size={11} className="text-blue-300" />
                                                <p className="text-[9px] font-black text-blue-300 uppercase tracking-widest">Active Passcode</p>
                                            </div>
                                            {foundEngineer.passcode ? (
                                                <p className="font-mono text-3xl font-black text-white tracking-[0.35em] drop-shadow">
                                                    {foundEngineer.passcode}
                                                </p>
                                            ) : (
                                                <p className="text-sm font-bold text-white/40 italic">No passcode set</p>
                                            )}
                                        </div>
                                        {foundEngineer.passcode && (
                                            <button
                                                onClick={() => copyToClipboard(foundEngineer.passcode, 'passcode')}
                                                className={`p-3.5 rounded-2xl shadow-lg transition-all active:scale-95 shrink-0 ${copiedField === 'passcode' ? 'bg-emerald-400 text-white' : 'bg-white/20 hover:bg-white/30 text-white'}`}
                                            >
                                                {copiedField === 'passcode' ? <FiCheck size={18} /> : <FiCopy size={18} />}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <button
                                    onClick={() => setShowModal(false)}
                                    className="w-full py-3.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-white font-black rounded-2xl transition-all text-sm"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            <BottomNav userRole="Regional Engineer" />
        </PageTransition>
    );
};

export default RegionalEngineerLookup;
