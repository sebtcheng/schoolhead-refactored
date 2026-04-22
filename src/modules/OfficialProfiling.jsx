import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FiUser, FiAward, FiBriefcase, FiBook, FiFileText, FiShield,
    FiChevronLeft, FiSave, FiPlus, FiTrash2, FiCheckCircle,
    FiAlertTriangle, FiInfo, FiUpload, FiToggleLeft, FiToggleRight,
    FiSearch, FiLoader
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import PageTransition from '../components/PageTransition';

const TABS = [
    { id: 'personal',    label: 'Personal Info',  icon: FiUser },
    { id: 'eligibility', label: 'Eligibility',    icon: FiAward },
    { id: 'experience',  label: 'Experience',     icon: FiBriefcase },
    { id: 'education',   label: 'Education',      icon: FiBook },
    { id: 'documents',   label: 'Documents',      icon: FiFileText },
    { id: 'legal',       label: 'Legal',          icon: FiShield },
];

const computeAge = (dob) => {
    if (!dob) return '';
    const today = new Date();
    const birth = new Date(dob);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
};

const inp = 'w-full bg-slate-50 border-2 border-transparent focus:border-[#0038A8] rounded-2xl py-3 px-5 text-sm font-bold text-slate-800 outline-none transition-all';
const sel = 'w-full bg-slate-50 border-2 border-transparent focus:border-[#0038A8] rounded-2xl py-3 px-5 text-sm font-bold text-slate-800 outline-none transition-all';

const Field = ({ label, children }) => (
    <div className="flex flex-col gap-2">
        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
        {children}
    </div>
);

const SectionLabel = ({ color = '#CE1126', children }) => (
    <p className="text-[10px] font-black uppercase tracking-[0.4em] mb-5" style={{ color, borderLeft: `4px solid ${color}`, paddingLeft: '1rem' }}>{children}</p>
);

const OfficialProfiling = () => {
    const navigate = useNavigate();
    const { user, token } = useAuth();

    const [status, setStatus] = useState('loading'); // loading | found | not-found | error
    const [tlid, setTlid] = useState(null);
    const [tab, setTab] = useState('personal');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const [profile, setProfile] = useState({
        last_name: '', first_name: '', middle_name: '', suffix: '',
        gender: '', date_of_birth: '', age: '', civil_status: '',
        position: '', position_title: '', appointment_date: '', assignment_date: '',
        emt_passer: null, emt_date: '', ces_stage: '', ces_conferment_date: '',
        total_years_third_level: '', permanent_address: '',
        highest_education: '', education_program: '', education_year_graduated: '',
        notable_achievements: '', performance_rating_ipcrf: '', performance_rating_cespes: '',
        pending_admin_case: '', ombudsman_case: '',
        previous_positions: [],
        relevant_trainings: []
    });

    useEffect(() => {
        const targetEmail = user?.email || user?.userEmail || localStorage.getItem('userEmail') || '';
        lookupByEmail(targetEmail);
    }, [user]);

    const lookupByEmail = async (email) => {
        if (!email) { setStatus('not-found'); return; }
        try {
            const res = await fetch(`/api/third-level/by-email?email=${encodeURIComponent(email)}`, {
                headers: { 'Authorization': `Bearer ${token || localStorage.getItem('token')}` }
            });
            const data = await res.json();
            if (data.success && data.data) {
                const d = data.data;
                setTlid(d.tlid);
                
                // Fetch full profile data instead of just masterlist
                const profRes = await fetch(`/api/third-level/${d.tlid}/profile`, {
                    headers: { 'Authorization': `Bearer ${token || localStorage.getItem('token')}` }
                });
                
                if (profRes.ok) {
                    const profData = await profRes.json();
                    if (profData.success) {
                        const p = profData.data;
                        setProfile({
                            last_name: p.last_name || '',
                            first_name: p.first_name || '',
                            middle_name: p.middle_name || '',
                            suffix: p.suffix || '',
                            gender: p.gender || '',
                            date_of_birth: p.date_of_birth ? p.date_of_birth.split('T')[0] : '',
                            age: p.age ?? '',
                            civil_status: p.civil_status || '',
                            position: p.position || '',
                            position_title: p.position_title || '',
                            appointment_date: p.appointment_date ? p.appointment_date.split('T')[0] : '',
                            assignment_date: p.assignment_date ? p.assignment_date.split('T')[0] : '',
                            emt_passer: p.emt_passer ?? null,
                            emt_date: p.emt_date ? p.emt_date.split('T')[0] : '',
                            ces_stage: p.ces_stage || '',
                            ces_conferment_date: p.ces_conferment_date ? p.ces_conferment_date.split('T')[0] : '',
                            total_years_third_level: p.total_years_third_level ?? '',
                            permanent_address: p.permanent_address || '',
                            highest_education: p.highest_education || '',
                            education_program: p.education_program || '',
                            education_year_graduated: p.education_year_graduated ?? '',
                            notable_achievements: p.notable_achievements || '',
                            performance_rating_ipcrf: p.performance_rating_ipcrf || '',
                            performance_rating_cespes: p.performance_rating_cespes || '',
                            pending_admin_case: p.pending_admin_case || '',
                            ombudsman_case: p.ombudsman_case || '',
                            previous_positions: p.previous_positions || [],
                            relevant_trainings: p.relevant_trainings || []
                        });
                        setStatus('found');
                    }
                }
            } else {
                setStatus('not-found');
            }
        } catch (err) {
            console.error("Profile Lookup Error:", err);
            setStatus('error');
        }
    };

    const setP = (field, value) => setProfile(p => ({ ...p, [field]: value }));

    const handleSave = async () => {
        if (!tlid) return;
        setSaving(true);
        try {
            const payload = { ...profile };
            if (payload.date_of_birth) payload.age = computeAge(payload.date_of_birth);

            const res = await fetch(`/api/third-level/${tlid}/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token || localStorage.getItem('token')}`
                },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                setSaved(true);
                setTimeout(() => setSaved(false), 3000);
            } else {
                alert(data.error || 'Save failed.');
            }
        } catch (err) {
            alert('Save failed: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    // Helper for updating nested arrays
    const updateListItem = (field, index, updates) => {
        setProfile(p => ({
            ...p,
            [field]: p[field].map((item, i) => i === index ? { ...item, ...updates } : item)
        }));
    };

    const handleAddPosition = () => setProfile(p => ({
        ...p,
        previous_positions: [...p.previous_positions, { position_name: '', office: '', start_date: '', end_date: '', is_oic: false }]
    }));

    const handleRemovePosition = (index) => setProfile(p => ({
        ...p,
        previous_positions: p.previous_positions.filter((_, i) => i !== index)
    }));

    const handleAddTraining = () => setProfile(p => ({
        ...p,
        relevant_trainings: [...p.relevant_trainings, { training_name: '', date_completed: '' }]
    }));

    const handleRemoveTraining = (index) => setProfile(p => ({
        ...p,
        relevant_trainings: p.relevant_trainings.filter((_, i) => i !== index)
    }));

    // ── LOADING ──
    if (status === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans">
                <div className="flex flex-col items-center gap-6">
                    <div className="w-14 h-14 border-[5px] border-[#0038A8] border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-400 font-black uppercase tracking-[0.4em] text-[10px]">Loading Your Profile...</p>
                </div>
            </div>
        );
    }

    // ── NOT FOUND ──
    if (status === 'not-found' || status === 'error') {
        const isNotFound = status === 'not-found';
        return (
            <PageTransition>
                <div className="min-h-screen bg-[#f8faff] flex flex-col items-center justify-center p-8 font-sans text-center relative overflow-hidden">
                    {/* Visual Accents */}
                    <div className="absolute top-0 right-0 w-[40vw] h-[40vh] bg-blue-50 rounded-bl-[20rem] -z-0"></div>
                    <div className="absolute bottom-[-5%] left-[-5%] w-64 h-64 bg-red-50 rounded-full blur-3xl opacity-60"></div>

                    <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="max-w-md w-full bg-white rounded-[4rem] p-16 shadow-[0_40px_80px_-15px_rgba(0,0,0,0.1)] border border-slate-100 relative z-10"
                    >
                        <div className={`w-24 h-24 rounded-[2.5rem] flex items-center justify-center mx-auto mb-10 shadow-2xl ${isNotFound ? 'bg-[#FCD116]/10 text-[#0038A8]' : 'bg-rose-50 text-rose-500'}`}>
                            {isNotFound ? <FiSearch size={48} className="animate-pulse" /> : <FiAlertTriangle size={48} />}
                        </div>
                        <h2 className="text-4xl font-black text-[#0038A8] italic tracking-tighter mb-6">{isNotFound ? 'Identity Lookup' : 'Connection Error'}</h2>
                        <p className="text-[13px] font-bold text-slate-500 leading-relaxed mb-10 px-4">
                            {isNotFound 
                                ? (<>Please enter your <span className="text-[#0038A8] font-black underline decoration-2 underline-offset-4">DepEd email</span> to access and manage your professional career profile.</>)
                                : "We encountered a temporary synchronization issue with the Human Capital Registry."}
                        </p>

                        {/* Manual Search Input */}
                        {isNotFound && (
                            <div className="mb-10 relative">
                                <FiSearch className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input 
                                    type="email" 
                                    placeholder="yourname@deped.gov.ph"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') lookupByEmail(e.target.value);
                                    }}
                                    className="w-full bg-slate-50 border-2 border-transparent focus:border-[#0038A8] rounded-3xl py-5 pl-14 pr-6 text-sm font-bold text-slate-800 outline-none transition-all shadow-inner"
                                />
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-4">Press ENTER to Sync Position History</p>
                            </div>
                        )}
                        
                        <div className="bg-slate-50 rounded-3xl p-6 mb-10 text-left border border-slate-100">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Protocols:</p>
                            <ul className="space-y-3">
                                {[
                                    "Verified Third-Level Officials only",
                                    "Automatic ledger audit tracking",
                                    "Personnel Division validation"
                                ].map((step, i) => (
                                    <li key={i} className="flex items-center gap-3 text-[11px] font-bold text-slate-600">
                                        <div className="w-1.5 h-1.5 rounded-full bg-[#CE1126]" />
                                        {step}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <button 
                            onClick={() => navigate(-1)} 
                            className="w-full py-5 border-2 border-slate-100 text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] rounded-full hover:bg-slate-50 transition-all active:scale-95 flex items-center justify-center gap-4"
                        >
                            <FiChevronLeft size={18} /> BACK TO NEXUS
                        </button>
                    </motion.div>

                    <p className="mt-12 text-[10px] font-black text-slate-300 uppercase tracking-[0.6em] relative z-10">
                        DepEd Intellectual Property • 2026 Registry v2
                    </p>
                </div>
            </PageTransition>
        );
    }

    // ── MAIN PROFILING FORM ──
    return (
        <PageTransition>
            <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">

                {/* Header */}
                <div className="bg-[#0038A8] relative overflow-hidden">
                    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djZoNnYtNmgtNnptNiAwaDZ2LTZoLTZ2NnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-30" />
                    <div className="relative z-10 max-w-4xl mx-auto px-6 lg:px-8 py-10 lg:py-14">
                        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-blue-200 hover:text-white font-black text-[10px] uppercase tracking-widest mb-8 transition-colors">
                            <FiChevronLeft size={16} /> Back
                        </button>
                        <div className="flex items-center gap-6">
                            <div className="w-16 h-16 bg-white/10 rounded-[1.5rem] flex items-center justify-center text-white border border-white/20">
                                <FiUser size={32} />
                            </div>
                            <div>
                                <h1 className="text-3xl lg:text-5xl font-black text-white italic tracking-tighter leading-none">Official Profiling</h1>
                                <p className="text-blue-200 text-[10px] font-black uppercase tracking-[0.4em] mt-2">3rd Level Officials • Personnel Division TLM Section</p>
                            </div>
                        </div>
                        {profile.last_name && profile.first_name && (
                            <div className="mt-6 inline-flex px-5 py-2 bg-white/10 rounded-2xl border border-white/20">
                                <p className="text-white font-black text-sm italic tracking-tight">
                                    {profile.last_name.toUpperCase()}, {profile.first_name} {profile.middle_name}
                                    {profile.age ? <span className="text-blue-200 not-italic font-bold ml-3 text-[10px]">Age {profile.age}</span> : null}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Tab Bar */}
                <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
                    <div className="max-w-4xl mx-auto px-6 lg:px-8 flex overflow-x-auto scrollbar-none">
                        {TABS.map(t => (
                            <button
                                key={t.id}
                                onClick={() => setTab(t.id)}
                                className={`flex items-center gap-2 px-5 py-4 text-[10px] font-black uppercase tracking-widest whitespace-nowrap border-b-2 transition-all ${tab === t.id ? 'border-[#0038A8] text-[#0038A8] bg-blue-50/50' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                            >
                                <t.icon size={13} />{t.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Tab Content */}
                <div className="max-w-4xl mx-auto px-6 lg:px-8 py-10">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={tab}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.15 }}
                        >

                            {/* ── PERSONAL INFO ── */}
                            {tab === 'personal' && (
                                <div className="space-y-10">
                                    <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm space-y-6">
                                        <SectionLabel>Personal Information</SectionLabel>
                                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                            <Field label="Last Name"><input type="text" value={profile.last_name} onChange={e => setP('last_name', e.target.value)} className={inp} /></Field>
                                            <Field label="First Name"><input type="text" value={profile.first_name} onChange={e => setP('first_name', e.target.value)} className={inp} /></Field>
                                            <Field label="Middle Name"><input type="text" value={profile.middle_name} onChange={e => setP('middle_name', e.target.value)} className={inp} /></Field>
                                            <Field label="Suffix"><input type="text" value={profile.suffix} onChange={e => setP('suffix', e.target.value)} placeholder="Jr., III, N/A" className={inp} /></Field>
                                        </div>
                                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                            <Field label="Gender">
                                                <select value={profile.gender} onChange={e => setP('gender', e.target.value)} className={sel}>
                                                    <option value="">Select</option>
                                                    <option value="Male">Male</option>
                                                    <option value="Female">Female</option>
                                                </select>
                                            </Field>
                                            <Field label="Date of Birth">
                                                <input type="date" value={profile.date_of_birth} onChange={e => setProfile(p => ({ ...p, date_of_birth: e.target.value, age: computeAge(e.target.value) }))} className={inp} />
                                            </Field>
                                            <Field label="Age (auto-computed)">
                                                <div className="bg-slate-100 rounded-2xl py-3 px-5 text-sm font-black text-[#0038A8]">{profile.age || '—'}</div>
                                            </Field>
                                            <Field label="Civil Status">
                                                <select value={profile.civil_status} onChange={e => setP('civil_status', e.target.value)} className={sel}>
                                                    <option value="">Select</option>
                                                    {['Single','Married','Widowed','Separated'].map(o => <option key={o} value={o}>{o}</option>)}
                                                </select>
                                            </Field>
                                        </div>
                                    </div>

                                    <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm space-y-6">
                                        <SectionLabel color="#0038A8">Designation & Appointment</SectionLabel>
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                            <Field label="Designation (e.g. OIC-ASDS)">
                                                <select value={profile.position} onChange={e => setP('position', e.target.value)} className={sel}>
                                                    <option value="">Select or type below</option>
                                                    {['RD','ARD','SDS','ASDS','OIC-ARD','OIC-SDS','OIC-ASDS'].map(o => <option key={o} value={o}>{o}</option>)}
                                                </select>
                                            </Field>
                                            <Field label="Position Title (Appointment)"><input type="text" value={profile.position_title} onChange={e => setP('position_title', e.target.value)} placeholder="e.g. Chief Education Supervisor" className={inp} /></Field>
                                            <Field label="Date of Assignment"><input type="date" value={profile.assignment_date} onChange={e => setP('assignment_date', e.target.value)} className={inp} /></Field>
                                            <Field label="Date of Present Position (Appointment Date)"><input type="date" value={profile.appointment_date} onChange={e => setP('appointment_date', e.target.value)} className={inp} /></Field>
                                        </div>
                                    </div>

                                    <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
                                        <SectionLabel color="#64748b">Contact Addendum</SectionLabel>
                                        <Field label="Permanent Address">
                                            <input type="text" value={profile.permanent_address} onChange={e => setP('permanent_address', e.target.value)} placeholder="House No., Street, Barangay, City/Municipality, Province" className={inp} />
                                        </Field>
                                    </div>
                                </div>
                            )}

                            {/* ── ELIGIBILITY ── */}
                            {tab === 'eligibility' && (
                                <div className="space-y-8">
                                    <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm space-y-6">
                                        <SectionLabel>EMT Eligibility</SectionLabel>
                                        <Field label="Are you an EMT Passer?">
                                            <div className="flex gap-3">
                                                {[{ val: true, label: 'Yes' }, { val: false, label: 'No' }].map(opt => (
                                                    <button key={String(opt.val)} onClick={() => setP('emt_passer', opt.val)} className={`flex-1 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all border-2 ${profile.emt_passer === opt.val ? (opt.val ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-red-500 text-white border-red-500') : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'}`}>{opt.label}</button>
                                                ))}
                                                <button onClick={() => setProfile(p => ({ ...p, emt_passer: null, emt_date: '' }))} className="px-5 rounded-2xl text-[10px] font-black uppercase tracking-widest border-2 border-slate-200 text-slate-300 hover:border-slate-400 transition-all">Clear</button>
                                            </div>
                                        </Field>
                                        {profile.emt_passer === true && (
                                            <Field label="Date Passed EMT">
                                                <input type="date" value={profile.emt_date} onChange={e => setP('emt_date', e.target.value)} className={inp} />
                                            </Field>
                                        )}
                                    </div>

                                    <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm space-y-6">
                                        <SectionLabel color="#0038A8">CES Eligibility</SectionLabel>
                                        <Field label="Stage Completed / CES Rank">
                                            <select value={profile.ces_stage} onChange={e => setP('ces_stage', e.target.value)} className={sel}>
                                                <option value="">Select stage</option>
                                                {['Stage 1 (CES Written Examination)','Stage 2 (Assessment Center)','Stage 3 (Performance Validation)','Stage 4 (Board Interview)','CES Eligible','CESO VI','CESO V','CESO IV','CESO III','CESO II','CESO I'].map(o => <option key={o} value={o}>{o}</option>)}
                                            </select>
                                        </Field>
                                        <Field label="Date of Conferment">
                                            <input type="date" value={profile.ces_conferment_date} onChange={e => setP('ces_conferment_date', e.target.value)} className={inp} />
                                        </Field>
                                    </div>
                                </div>
                            )}

                            {/* ── EXPERIENCE ── */}
                            {tab === 'experience' && (
                                <div className="space-y-8">
                                    <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
                                        <SectionLabel>Managerial Experience</SectionLabel>
                                        <Field label="Total Years in 3rd Level Position (including OIC experience)">
                                            <input type="number" min="0" step="0.5" value={profile.total_years_third_level} onChange={e => setP('total_years_third_level', e.target.value)} placeholder="e.g. 3.5" className={`${inp} max-w-xs`} />
                                        </Field>
                                    </div>

                                    <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
                                        <SectionLabel color="#0038A8">Previous Positions Held</SectionLabel>
                                        <div className="space-y-3">
                                            <div className="hidden lg:grid grid-cols-[1fr_1fr_110px_110px_70px_44px] gap-3 px-2">
                                                {['Position','Office / Division','From','To','OIC?',''].map(h => <span key={h} className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{h}</span>)}
                                            </div>
                                            {profile.previous_positions.map((pos, idx) => (
                                                <motion.div key={idx} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_110px_110px_70px_44px] gap-3 items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                                    <input type="text" value={pos.position_name || ''} onChange={e => updateListItem('previous_positions', idx, { position_name: e.target.value })} placeholder="Position held" className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-[#0038A8] transition-all" />
                                                    <input type="text" value={pos.office || ''} onChange={e => updateListItem('previous_positions', idx, { office: e.target.value })} placeholder="Office / Division" className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-[#0038A8] transition-all" />
                                                    <input type="date" value={pos.start_date ? pos.start_date.split('T')[0] : ''} onChange={e => updateListItem('previous_positions', idx, { start_date: e.target.value })} className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-[#0038A8] transition-all" />
                                                    <input type="date" value={pos.end_date ? pos.end_date.split('T')[0] : ''} onChange={e => updateListItem('previous_positions', idx, { end_date: e.target.value })} className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-[#0038A8] transition-all" />
                                                    <button onClick={() => updateListItem('previous_positions', idx, { is_oic: !pos.is_oic })} className={`flex items-center justify-center gap-1 text-[10px] font-black uppercase py-2 px-2 rounded-xl transition-all ${pos.is_oic ? 'bg-[#FCD116] text-[#0038A8]' : 'bg-white border border-slate-200 text-slate-400'}`}>{pos.is_oic ? <FiToggleRight size={14}/> : <FiToggleLeft size={14}/>} OIC</button>
                                                    <button onClick={() => handleRemovePosition(idx)} className="w-10 h-10 flex items-center justify-center bg-red-50 text-red-400 rounded-xl hover:bg-red-500 hover:text-white transition-all"><FiTrash2 size={14} /></button>
                                                </motion.div>
                                            ))}
                                            <button onClick={handleAddPosition} className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-black text-[10px] uppercase tracking-widest hover:border-[#0038A8] hover:text-[#0038A8] transition-all flex items-center justify-center gap-2 mt-2">
                                                <FiPlus size={14} /> Add Position
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ── EDUCATION ── */}
                            {tab === 'education' && (
                                <div className="space-y-8">
                                    <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm space-y-6">
                                        <SectionLabel>Educational Attainment</SectionLabel>
                                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                            <Field label="Highest Educational Attainment">
                                                <select value={profile.highest_education} onChange={e => setP('highest_education', e.target.value)} className={sel}>
                                                    <option value="">Select</option>
                                                    {['Post-Doctoral Studies',"Doctorate Degree (PhD, EdD, DBA)","Master's Degree (MAEd, MS, MBA)","Bachelor's Degree"].map(o => <option key={o} value={o}>{o}</option>)}
                                                </select>
                                            </Field>
                                            <Field label="Program / Field of Study"><input type="text" value={profile.education_program} onChange={e => setP('education_program', e.target.value)} placeholder="e.g. Educational Management" className={inp} /></Field>
                                            <Field label="Year Graduated"><input type="number" min="1950" max="2099" value={profile.education_year_graduated} onChange={e => setP('education_year_graduated', e.target.value)} placeholder="e.g. 2005" className={inp} /></Field>
                                        </div>
                                    </div>

                                    <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
                                        <SectionLabel color="#0038A8">Relevant Trainings</SectionLabel>
                                        <div className="space-y-3">
                                            <div className="hidden lg:grid grid-cols-[1fr_160px_44px] gap-3 px-2">
                                                {['Training Name','Date Completed',''].map(h => <span key={h} className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{h}</span>)}
                                            </div>
                                            {profile.relevant_trainings.map((tr, idx) => (
                                                <motion.div key={idx} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 lg:grid-cols-[1fr_160px_44px] gap-3 items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                                    <input type="text" value={tr.training_name || ''} onChange={e => updateListItem('relevant_trainings', idx, { training_name: e.target.value })} placeholder="Training / Seminar name" className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-[#0038A8] transition-all" />
                                                    <input type="date" value={tr.date_completed ? tr.date_completed.split('T')[0] : ''} onChange={e => updateListItem('relevant_trainings', idx, { date_completed: e.target.value })} className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-[#0038A8] transition-all" />
                                                    <button onClick={() => handleRemoveTraining(idx)} className="w-10 h-10 flex items-center justify-center bg-red-50 text-red-400 rounded-xl hover:bg-red-500 hover:text-white transition-all"><FiTrash2 size={14} /></button>
                                                </motion.div>
                                            ))}
                                            <button onClick={handleAddTraining} className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-black text-[10px] uppercase tracking-widest hover:border-[#0038A8] hover:text-[#0038A8] transition-all flex items-center justify-center gap-2 mt-2">
                                                <FiPlus size={14} /> Add Training
                                            </button>
                                        </div>
                                    </div>

                                    <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm space-y-5">
                                        <SectionLabel color="#64748b">Performance & Recognition</SectionLabel>
                                        <Field label="Notable Achievement/s (e.g. Gawad CES)">
                                            <textarea value={profile.notable_achievements} onChange={e => setP('notable_achievements', e.target.value)} rows={3} placeholder="List notable awards and recognitions..." className="w-full bg-slate-50 border-2 border-transparent focus:border-[#0038A8] rounded-2xl py-3 px-5 text-sm font-bold outline-none transition-all resize-none" />
                                        </Field>
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                            <Field label="Latest Performance Rating (IPCRF / OPCRF)">
                                                <input type="text" value={profile.performance_rating_ipcrf} onChange={e => setP('performance_rating_ipcrf', e.target.value)} placeholder="e.g. Outstanding (4.5)" className={inp} />
                                            </Field>
                                            <Field label="Latest Performance Rating (CESPES)">
                                                <input type="text" value={profile.performance_rating_cespes} onChange={e => setP('performance_rating_cespes', e.target.value)} placeholder="e.g. 4.86 (Optional)" className={inp} />
                                            </Field>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ── DOCUMENTS ── */}
                            {tab === 'documents' && (
                                <div className="space-y-6">
                                    <div className="flex items-start gap-4 p-6 bg-blue-50 rounded-[2rem] border border-blue-100">
                                        <FiInfo className="text-[#0038A8] mt-1 shrink-0" size={18} />
                                        <p className="text-[11px] font-bold text-blue-700 leading-relaxed">
                                            Document uploads are processed by the Personnel Division. Files will be stored securely in the system once upload integration is completed. The reference IDs below track which documents have been linked to your profile.
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                                        {[
                                            { label: '2x2 ID Picture', note: 'PNG or JPG, official photo', accept: 'image/*' },
                                            { label: 'Personal Data Sheet (CSC Form 212, rev 2025)', note: 'PDF with Work Experience Sheet attached' },
                                            { label: 'Accomplished Profile (Word File)', note: 'Optional — download template at tinyurl.com/3rdLevelForms' },
                                            { label: 'Accomplished Profile (PPT Format)', note: 'Optional — download template at tinyurl.com/3rdLevelForms' },
                                            { label: 'Service Records', note: 'PDF — verifies previous positions and appointment dates' },
                                        ].map(({ label, note }) => (
                                            <div key={label} className="flex flex-col gap-3 p-6 bg-white rounded-[2rem] border border-slate-100 hover:border-[#0038A8]/20 transition-all">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-[#0038A8]"><FiFileText size={18} /></div>
                                                    <div>
                                                        <p className="text-[11px] font-black text-slate-800 leading-tight">{label}</p>
                                                        <p className="text-[9px] font-bold text-slate-400 italic mt-0.5">{note}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3 bg-slate-50 border border-dashed border-slate-300 rounded-xl px-4 py-2">
                                                    <FiUpload size={13} className="text-slate-400 shrink-0" />
                                                    <span className="text-[10px] font-bold text-slate-400 italic">Contact Personnel Division to upload</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* ── LEGAL ── */}
                            {tab === 'legal' && (
                                <div className="space-y-6">
                                    <div className="flex items-start gap-4 p-6 bg-amber-50 rounded-[2rem] border border-amber-200">
                                        <FiAlertTriangle className="text-amber-500 mt-1 shrink-0" size={20} />
                                        <div>
                                            <p className="text-[11px] font-black text-amber-800 uppercase tracking-widest mb-1">Confidential Section</p>
                                            <p className="text-[11px] font-bold text-amber-700 leading-relaxed">
                                                This section is optional and strictly confidential per civil service guidelines. You may opt not to disclose. Information entered here is accessible only to authorized Personnel Division personnel.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm space-y-6">
                                        <Field label="Pending Administrative Case/s (Optional)">
                                            <textarea value={profile.pending_admin_case} onChange={e => setP('pending_admin_case', e.target.value)} rows={4} placeholder="May be left blank. If applicable, describe the nature and status of the case." className="w-full bg-slate-50 border-2 border-transparent focus:border-amber-400 rounded-2xl py-3 px-5 text-sm font-bold outline-none transition-all resize-none" />
                                        </Field>
                                        <Field label="Ombudsman / Sandiganbayan / CSC Case/s (Optional)">
                                            <textarea value={profile.ombudsman_case} onChange={e => setP('ombudsman_case', e.target.value)} rows={4} placeholder="May be left blank." className="w-full bg-slate-50 border-2 border-transparent focus:border-amber-400 rounded-2xl py-3 px-5 text-sm font-bold outline-none transition-all resize-none" />
                                        </Field>
                                    </div>
                                </div>
                            )}

                        </motion.div>
                    </AnimatePresence>

                    {/* Save Bar */}
                    <div className="mt-10 flex justify-end gap-4">
                        <AnimatePresence>
                            {saved && (
                                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-2 px-6 py-3 bg-emerald-50 text-emerald-700 font-black text-[10px] uppercase tracking-widest rounded-full border border-emerald-200">
                                    <FiCheckCircle size={14} /> Saved!
                                </motion.div>
                            )}
                        </AnimatePresence>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-10 py-4 bg-[#0038A8] text-white font-black text-[10px] uppercase tracking-widest rounded-full shadow-xl hover:bg-blue-900 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-3"
                        >
                            {saving ? 'Saving...' : <><FiSave size={14} /> Save Profile</>}
                        </button>
                    </div>
                </div>
            </div>
        </PageTransition>
    );
};

export default OfficialProfiling;
