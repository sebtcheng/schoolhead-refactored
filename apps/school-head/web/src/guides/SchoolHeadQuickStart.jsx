import React from 'react';
import { FiShield, FiLock, FiCheckCircle, FiArrowRight, FiInfo, FiSmartphone, FiUserCheck, FiLogIn, FiHeart, FiRefreshCw, FiTool } from 'react-icons/fi';
import PageTransition from '../components/PageTransition';

const SchoolHeadQuickStart = () => {
    return (
        <PageTransition>
            <div className="min-h-screen bg-slate-50 text-slate-900 scroll-smooth pb-32 font-sans">
                {/* Top Navigation */}
                <nav className="sticky top-0 z-50 bg-[#0A192F] text-white border-b border-slate-800 backdrop-blur-md bg-opacity-95">
                    <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-black text-white italic text-xs tracking-tighter shadow-lg shadow-blue-500/20">IE</div>
                            <span className="font-bold tracking-tight text-sm uppercase italic">InsightED <span className="text-blue-400 font-normal not-italic">SOP MASTER GUIDE</span></span>
                        </div>
                    </div>
                </nav>

                <div className="max-w-4xl mx-auto px-6 py-12">
                    <main className="w-full">
                        
                        {/* Global Header */}
                        <header className="mb-20 text-center">
                            <div className="inline-block px-4 py-1.5 bg-[#0A192F] text-white text-[10px] font-black rounded-full uppercase tracking-[0.2em] mb-6 shadow-xl shadow-blue-900/10 border border-blue-500/20">Official Pilot Phase II</div>
                            <h1 className="text-4xl md:text-5xl font-black text-[#0A192F] mb-6 tracking-tight leading-tight">Complete Operational Guide for School Heads</h1>
                            <p className="text-lg text-slate-600 leading-relaxed mx-auto italic font-medium max-w-2xl">
                                The mandatory technical manual for achieving 100% Data Health compliance within the Stride Ecosystem.
                            </p>
                        </header>

                        {/* Module 1: Installation */}
                        <section className="mb-32 group">
                            <div className="flex items-center mb-10">
                                <span className="w-10 h-10 bg-[#0A192F] text-white rounded-2xl flex items-center justify-center font-black text-lg mr-4 shadow-xl shadow-blue-900/10 group-hover:scale-110 transition-transform">1</span>
                                <h2 className="text-3xl font-black text-[#0A192F] uppercase tracking-tight flex items-center gap-3">
                                    <FiSmartphone className="text-blue-500" />
                                    App Installation (PWA)
                                </h2>
                            </div>
                            <div className="space-y-8 text-slate-700 leading-relaxed bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
                                <p className="text-lg font-medium">InsightEd is a <span className="text-blue-600 font-black italic underline decoration-blue-200 decoration-4 underline-offset-4">Progressive Web App (PWA)</span>. It operates directly from your mobile browser for maximum performance and offline-readiness.</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                        <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                            <div className="w-8 h-8 bg-white rounded-xl shadow-sm flex items-center justify-center shrink-0 text-blue-500 font-bold">A</div>
                                            <p className="text-sm font-bold">Open <span className="text-navy-950 underline underline-offset-2 decoration-2 decoration-slate-200">Chrome (Android)</span> or <span className="text-navy-950 underline underline-offset-2 decoration-2 decoration-slate-200">Safari (iOS)</span>.</p>
                                        </div>
                                        <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                            <div className="w-8 h-8 bg-white rounded-xl shadow-sm flex items-center justify-center shrink-0 text-blue-500 font-bold">B</div>
                                            <p className="text-sm font-bold">Navigate to: <code className="bg-blue-600 text-white px-3 py-1 rounded-lg font-mono text-xs select-all shadow-md">tinyurl.com/InsightEdV2</code></p>
                                        </div>
                                        <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                            <div className="w-8 h-8 bg-white rounded-xl shadow-sm flex items-center justify-center shrink-0 text-blue-500 font-bold">C</div>
                                            <p className="text-sm font-bold">Select <strong>"Add to Home Screen"</strong> or <strong>"Install App"</strong> from your browser menu.</p>
                                        </div>
                                    </div>
                                        <img src="https://raw.githubusercontent.com/sebtcheng/InsightEd-Mobile-PWA/2a4874ba604994c6710b1ce38135db8fe2951f7b/public/pwa_installation_flow.gif" alt="PWA Installation Flow" className="w-full h-auto rounded-xl shadow-2xl" />
                                </div>
                            </div>
                        </section>

                        {/* Module 2: Registration */}
                        <section className="mb-32 group">
                            <div className="flex items-center mb-10">
                                <span className="w-10 h-10 bg-[#0A192F] text-white rounded-2xl flex items-center justify-center font-black text-lg mr-4 shadow-xl shadow-blue-900/10 group-hover:scale-110 transition-transform">2</span>
                                <h2 className="text-3xl font-black text-[#0A192F] uppercase tracking-tight flex items-center gap-3">
                                    <FiUserCheck className="text-emerald-500" />
                                    Registration & Identity
                                </h2>
                            </div>
                            <div className="space-y-8 text-slate-700 leading-relaxed bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
                                <p className="text-lg font-medium">Select the <strong className="text-emerald-600 underline underline-offset-4 decoration-emerald-200 decoration-4">School Head</strong> role. You must complete the 5-step hierarchical school selection mapping process.</p>
                                
                                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex flex-col gap-4">
                                    <div className="flex justify-between items-center px-4">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Identity Hierarchy Flow</span>
                                        <FiArrowRight className="text-slate-300" />
                                    </div>
                                    <div className="grid grid-cols-5 gap-3">
                                        {['Region', 'Division', 'District', 'Municipality', 'School'].map((step, idx) => (
                                            <div key={idx} className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-1 transition-all ${idx === 4 ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/30 scale-105' : 'bg-white border-slate-200 text-slate-400'}`}>
                                                <span className="text-[8px] font-black uppercase tracking-tighter opacity-60">Step 0{idx+1}</span>
                                                <span className="text-[10px] font-bold truncate w-full text-center tracking-tight">{step}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <img src="https://raw.githubusercontent.com/sebtcheng/InsightEd-Mobile-PWA/2a4874ba604994c6710b1ce38135db8fe2951f7b/public/registration_school_mapping.gif" alt="Registration School Mapping" className="w-full h-auto rounded-xl shadow-2xl" />

                                <div className="p-6 bg-[#0A192F] text-white rounded-[2rem] border-l-[12px] border-emerald-500/50 shadow-xl shadow-blue-900/20 relative overflow-hidden">
                                    <div className="relative z-10">
                                        <p className="text-[10px] uppercase font-black text-emerald-400 mb-3 tracking-[0.3em] flex items-center gap-2">
                                            <FiShield className="inline" /> Protocol Requirement
                                        </p>
                                        <p className="text-lg font-medium italic opacity-90 leading-relaxed">Capturing your <strong className="text-white not-italic underline decoration-emerald-500 decoration-2 underline-offset-4 uppercase tracking-wider">IERN (InsightEd ID)</strong> post-registration is mandatory for cross-office verification.</p>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Module 3: Sign-In */}
                        <section className="mb-32 group">
                            <div className="flex items-center mb-10">
                                <span className="w-10 h-10 bg-[#0A192F] text-white rounded-2xl flex items-center justify-center font-black text-lg mr-4 shadow-xl shadow-blue-900/10 group-hover:scale-110 transition-transform">3</span>
                                <h2 className="text-3xl font-black text-[#0A192F] uppercase tracking-tight flex items-center gap-3">
                                    <FiLogIn className="text-amber-500" />
                                    Administrative Sign-In
                                </h2>
                            </div>
                            <div className="space-y-12 text-slate-700 leading-relaxed bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
                                <div className="space-y-6">
                                    <p className="text-lg font-medium">Use your <strong className="text-amber-600 underline underline-offset-4 decoration-amber-200 decoration-4 uppercase tracking-widest">6-digit School ID</strong> as your primary Username.</p>
                                    <div className="flex items-center gap-4 p-5 bg-amber-50/50 border border-amber-100 rounded-3xl">
                                        <FiInfo className="text-amber-600 shrink-0" size={24} />
                                        <p className="text-sm font-bold text-amber-900 leading-relaxed uppercase tracking-tight italic">Grant all mandatory device permissions (Camera, Location, Storage) upon prompt to ensure zero-failure data capture.</p>
                                    </div>
                                    <img src="https://raw.githubusercontent.com/sebtcheng/InsightEd-Mobile-PWA/2a4874ba604994c6710b1ce38135db8fe2951f7b/public/log_in_passcode_password_switch.gif" alt="Sign-In Permissions Flow" className="w-full h-auto rounded-xl shadow-2xl" />
                                </div>

                                <div className="pt-12 border-t border-slate-100">
                                    <h3 className="text-xl font-black text-[#0A192F] mb-6 flex items-center gap-3 italic">
                                        <span className="w-1.5 h-6 bg-blue-600 rounded-full"></span>
                                        Navigating the Nexus Dashboard
                                    </h3>
                                    <p className="text-slate-600 text-base mb-8 font-medium leading-relaxed">
                                        Upon successful sign-in, you will land on the <strong className="text-blue-600 italic">Nexus Dashboard</strong>. This is your primary strategic hub for cross-module oversight and departmental management.
                                    </p>
                                    <img src="https://raw.githubusercontent.com/sebtcheng/InsightEd-Mobile-PWA/2a4874ba604994c6710b1ce38135db8fe2951f7b/public/nexus.gif" alt="Nexus Dashboard Navigation" className="w-full h-auto rounded-xl shadow-2xl" />
                                </div>
                            </div>
                        </section>

                        {/* Module 4: Data Health */}
                        <section className="mb-32 group">
                            <div className="flex items-center mb-10">
                                <span className="w-10 h-10 bg-[#0A192F] text-white rounded-2xl flex items-center justify-center font-black text-lg mr-4 shadow-xl shadow-blue-900/10 group-hover:scale-110 transition-transform">4</span>
                                <h2 className="text-3xl font-black text-[#0A192F] uppercase tracking-tight flex items-center gap-3">
                                    <FiCheckCircle className="text-indigo-500" />
                                    Achieving 100% Data Health
                                </h2>
                            </div>
                            <div className="space-y-16 text-slate-700 leading-relaxed bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
                                
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between border-b-4 border-slate-50 pb-4">
                                        <h3 className="text-xl font-black text-blue-950 uppercase italic tracking-tighter">4.1 School Profile & Geo-Tagging</h3>
                                        <span className="px-3 py-1 bg-blue-50 text-blue-600 text-[9px] font-black rounded-full uppercase tracking-widest border border-blue-100">Critical Priority</span>
                                    </div>
                                    <p className="text-slate-600 font-medium">Verify your School ID records and manually drag the map pin to the <strong className="text-blue-600 underline">exact coordinate of the primary school entrance</strong>.</p>
                                    <img src="https://raw.githubusercontent.com/sebtcheng/InsightEd-Mobile-PWA/2a4874ba604994c6710b1ce38135db8fe2951f7b/public/Unit_1_Complete_Guide.gif" alt="Geo-Tagging Validation" className="w-full h-auto rounded-xl shadow-2xl" />
                                </div>

                                <div className="space-y-6">
                                    <div className="flex items-center justify-between border-b-4 border-slate-50 pb-4">
                                        <h3 className="text-xl font-black text-blue-950 uppercase italic tracking-tighter">4.2 Enrollment & Organized Classes</h3>
                                        <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[9px] font-black rounded-full uppercase tracking-widest border border-emerald-100">High Impact</span>
                                    </div>
                                    <p className="text-slate-600 font-medium">Transmit accurate learner counts per grade level. You must include specific <strong className="text-emerald-600 italic">ARAL program enrollment</strong> data for verified compliance.</p>
                                    <img src="https://raw.githubusercontent.com/sebtcheng/InsightEd-Mobile-PWA/2a4874ba604994c6710b1ce38135db8fe2951f7b/public/unit2%20final.gif" alt="Enrollment Entry Grid" className="w-full h-auto rounded-xl shadow-2xl" />
                                </div>

                                <div className="space-y-6">
                                    <div className="flex items-center justify-between border-b-4 border-slate-50 pb-4">
                                        <h3 className="text-xl font-black text-blue-950 uppercase italic tracking-tighter">4.3 Physical Facilities & Buildings</h3>
                                        <span className="px-3 py-1 bg-amber-50 text-amber-600 text-[9px] font-black rounded-full uppercase tracking-widest border border-amber-100">Technical Audit</span>
                                    </div>
                                    <p className="text-slate-600 font-medium whitespace-pre-wrap leading-relaxed italic">Map all buildings using the <strong className="text-amber-600 not-italic uppercase font-black tracking-widest border-b-2 border-amber-200">Room Assessment Tool</strong>. 
Categories: Newcon, Functional, or Condemned for Demolition.</p>
                                    <img src="https://raw.githubusercontent.com/sebtcheng/InsightEd-Mobile-PWA/2a4874ba604994c6710b1ce38135db8fe2951f7b/public/uni7register%20building.gif" alt="Building Inventory Registry" className="w-full h-auto rounded-xl shadow-2xl" />
                                    <div className="flex items-center gap-4 p-5 bg-red-50 border border-red-100 rounded-3xl shadow-[0_10px_30px_rgba(239,68,68,0.1)]">
                                        <FiShield className="text-red-600 shrink-0" size={24} />
                                        <p className="text-sm font-black text-red-950 uppercase tracking-tight italic">Strict Rule: Photographic timestamped evidence is required for all facility assessments.</p>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Module 5: Scoring */}
                        <section className="mb-32">
                            <div className="flex items-center mb-10">
                                <span className="w-10 h-10 bg-[#0A192F] text-white rounded-2xl flex items-center justify-center font-black text-lg mr-4 shadow-xl shadow-blue-900/10 transition-transform">5</span>
                                <h2 className="text-3xl font-black text-[#0A192F] uppercase tracking-tight flex items-center gap-3 italic">
                                    Scoring Logic & Audits
                                </h2>
                            </div>
                            <div className="bg-[#0A192F] rounded-[3rem] overflow-hidden shadow-2xl shadow-blue-900/30 border-4 border-blue-500/10">
                                <div className="bg-navy-900 p-8 text-center border-b border-white/5">
                                    <h4 className="text-white text-xs font-black tracking-[0.4em] uppercase mb-2">Automatic Protocol Deductions</h4>
                                    <p className="text-blue-400 text-[10px] font-bold uppercase tracking-widest italic opacity-70">Avoid these audit triggers at all costs.</p>
                                </div>
                                <div className="p-10 space-y-6">
                                    <div className="flex items-center gap-6 p-6 bg-white/5 rounded-[2rem] border border-white/5 group hover:bg-white/10 transition-all">
                                        <div className="w-14 h-14 bg-red-500/10 text-red-500 font-black flex items-center justify-center rounded-2xl shadow-lg border border-red-500/20 text-xl tracking-tighter italic">-25</div>
                                        <div>
                                            <h5 className="text-white font-black text-sm uppercase tracking-wide mb-1">Incomplete Invariants</h5>
                                            <p className="text-blue-200/60 text-xs font-medium leading-relaxed italic">Enrollment reported without corresponding teachers, toilets, or classrooms mapping.</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6 p-6 bg-white/5 rounded-[2rem] border border-white/5 group hover:bg-white/10 transition-all">
                                        <div className="w-14 h-14 bg-red-500/10 text-red-500 font-black flex items-center justify-center rounded-2xl shadow-lg border border-red-500/20 text-xl tracking-tighter italic">-25</div>
                                        <div>
                                            <h5 className="text-white font-black text-sm uppercase tracking-wide mb-1">Unrealistic Ratios</h5>
                                            <p className="text-blue-200/60 text-xs font-medium leading-relaxed italic">Unrealistic Pupil-to-Teacher results detected (Outside of the {'<15 or >65'} students per class range).</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6 p-6 bg-white/5 rounded-[2rem] border border-white/5 group hover:bg-white/10 transition-all">
                                        <div className="w-14 h-14 bg-red-500/10 text-red-500 font-black flex items-center justify-center rounded-2xl shadow-lg border border-red-500/20 text-xl tracking-tighter italic">-25</div>
                                        <div>
                                            <h5 className="text-white font-black text-sm uppercase tracking-wide mb-1">Entity Anomaly</h5>
                                            <p className="text-blue-200/60 text-xs font-medium leading-relaxed italic">Zero counts detected on critical educational facilities in an active school population.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Module 6: Sync */}
                        <section className="mb-32 group">
                            <div className="flex items-center mb-10">
                                <span className="w-10 h-10 bg-[#0A192F] text-white rounded-2xl flex items-center justify-center font-black text-lg mr-4 shadow-xl shadow-blue-900/10 group-hover:scale-110 transition-transform">6</span>
                                <h2 className="text-3xl font-black text-[#0A192F] uppercase tracking-tight flex items-center gap-3">
                                    <FiRefreshCw className="text-blue-500" />
                                    Offline Sync Protocol
                                </h2>
                            </div>
                            <div className="space-y-8 text-slate-700 leading-relaxed bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
                                <p className="text-lg font-medium">The InsightED engine saves inputs locally. Navigate to the <strong className="text-blue-600 italic">Sync Dashboard</strong> once a stable connection established.</p>
                                    <img src="https://raw.githubusercontent.com/sebtcheng/InsightEd-Mobile-PWA/2a4874ba604994c6710b1ce38135db8fe2951f7b/public/nexus_portal_selection.gif" alt="Manual Data Sync Success" className="w-full h-auto rounded-xl shadow-2xl" />
                                <div className="p-8 bg-[#0A192F] text-white rounded-[2rem] border-4 border-red-500/20 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-10">
                                        <FiTool size={80} />
                                    </div>
                                    <div className="relative z-10">
                                        <p className="text-[11px] uppercase font-black text-red-500 mb-3 tracking-[0.4em] flex items-center gap-2">
                                            <FiShield className="animate-pulse" /> Critical Warning
                                        </p>
                                        <h4 className="text-xl font-bold mb-2 uppercase italic tracking-tighter">DO NOT LOG OUT</h4>
                                        <p className="text-base font-medium italic opacity-80 decoration-red-500/50 decoration-wavy underline underline-offset-4">Logging out while sync is pending will result in the immediate and permanent loss of cached records.</p>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Module 7: Troubleshooting */}
                        <section className="mb-32 group">
                            <div className="flex items-center mb-10">
                                <span className="w-10 h-10 bg-[#0A192F] text-white rounded-2xl flex items-center justify-center font-black text-lg mr-4 shadow-xl shadow-blue-900/10 group-hover:scale-110 transition-transform">7</span>
                                <h2 className="text-3xl font-black text-[#0A192F] uppercase tracking-tight flex items-center gap-3">
                                    <FiTool className="text-slate-500" />
                                    System Maintenance
                                </h2>
                            </div>
                            <div className="space-y-8 text-slate-700 leading-relaxed bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
                                <div className="flex items-center gap-6">
                                    <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shrink-0 shadow-sm border border-blue-100">
                                        <FiRefreshCw size={28} />
                                    </div>
                                    <p className="text-base font-bold italic text-slate-600 leading-relaxed">Every Monday, navigate to <strong className="text-navy-950 not-italic uppercase tracking-widest px-2 py-1 bg-slate-100 rounded">Settings</strong> and select <strong className="text-blue-600 italic">"Check for Updates"</strong> to ensure compliance with the latest audit templates.</p>
                                </div>
                                <div className="p-10 bg-slate-50 rounded-[2.5rem] border-4 border-dashed border-slate-200 group-hover:border-blue-200 transition-colors">
                                    <h4 className="font-black text-[#0A192F] mb-3 underline decoration-blue-500/30 decoration-4 underline-offset-8 uppercase italic tracking-tight text-lg">Resolve UI Glitches</h4>
                                    <div className="flex items-center gap-2 font-mono text-sm font-black text-blue-600 bg-white inline-flex px-4 py-2 rounded-xl shadow-sm border border-slate-100">
                                        <span className="opacity-40">Settings</span>
                                        <FiArrowRight size={10} className="opacity-40" />
                                        <span className="opacity-40">Troubleshoot</span>
                                        <FiArrowRight size={10} className="opacity-40" />
                                        <span>Clear Cache</span>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Final Support */}
                        <footer className="mt-40 pt-24 border-t-8 border-navy-950 text-center relative overflow-hidden">
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-blue-500/5 rounded-full blur-[80px]"></div>
                            <div className="max-w-md mx-auto relative z-10">
                                <div className="w-16 h-16 bg-navy-950 text-white rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-blue-900/40">
                                    <FiHeart size={32} className="text-blue-400" />
                                </div>
                                <h2 className="text-2xl font-black text-[#0A192F] uppercase mb-4 tracking-[0.2em] italic underline decoration-blue-500/10 decoration-8 underline-offset-[-2px]">Technical Support Desk</h2>
                                <p className="text-sm text-slate-400 mb-10 font-black uppercase tracking-widest leading-loose">Reach out to the Stratcom and Stride technical team via Google Chat workspace.</p>
                                <div className="bg-[#0A192F] p-8 rounded-[2rem] text-white font-mono text-base shadow-2xl shadow-blue-900/40 border border-blue-500/20 group hover:scale-105 transition-all cursor-pointer select-all">
                                    <div className="text-blue-400 text-[8px] font-black uppercase tracking-[0.5em] mb-3 opacity-50">Official SOP Inquiry Channel</div>
                                    support.stride@deped.gov.ph
                                </div>
                            </div>
                            <div className="mt-32 pb-16">
                                <div className="inline-flex items-center gap-3 mb-6 px-4 py-2 bg-slate-100 rounded-full grayscale opacity-40">
                                    <div className="w-4 h-4 bg-navy-950 rounded"></div>
                                    <span className="text-[8px] font-black uppercase tracking-[0.4em]">InsightED Core v2.4.0</span>
                                </div>
                                <p className="text-[10px] text-slate-300 uppercase tracking-[1em] font-black italic">SOP COMPLIANCE MANUAL • 2026</p>
                            </div>
                        </footer>

                    </main>
                </div>
            </div>
        </PageTransition>
    );
};

export default SchoolHeadQuickStart;
