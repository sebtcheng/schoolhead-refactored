import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    FiArrowRight, 
    FiArrowLeft, 
    FiCamera, 
    FiPlus, 
    FiTrash2, 
    FiCheckCircle, 
    FiBriefcase, 
    FiBookOpen, 
    FiStar, 
    FiAward,
    FiUser
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import PageTransition from '../components/PageTransition';

const OfficialApplication = () => {
    const navigate = useNavigate();
    const { user, token } = useAuth();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        header: {
            fullname: user?.displayName || '',
            current_position: user?.position || '',
            position_applied_for: '',
            age: '',
            applicantType: (user?.role && user?.role !== 'Third Level Applicant') ? 'deped' : 'outsider', // Auto-detect if existing user
            photo: null,
            photoPreview: null
        },
        experience: [{ position: '', location: '', duration: '', isDepedRole: false }],
        education: [{ university: '', degree: '', year_graduated: '' }],
        ratings: [{ period: '', rating: '' }],
        eligibility: [{ eligibility: '', date_acquired: '' }]
    });

    const nextStep = () => setStep(prev => Math.min(prev + 1, 6));
    const prevStep = () => setStep(prev => Math.max(prev - 1, 1));

    const handleHeaderChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            header: { ...prev.header, [name]: value }
        }));
    };

    const handlePhotoChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setFormData(prev => ({
                ...prev,
                header: { 
                    ...prev.header, 
                    photo: file,
                    photoPreview: URL.createObjectURL(file)
                }
            }));
        }
    };

    const handleListChange = (section, index, field, value) => {
        const newList = [...formData[section]];
        newList[index][field] = value;
        setFormData(prev => ({ ...prev, [section]: newList }));
    };

    const addListItem = (section) => {
        const templates = {
            experience: { position: '', location: '', duration: '', isDepedRole: formData.header.applicantType === 'deped' },
            education: { university: '', degree: '', year_graduated: '' },
            ratings: { period: '', rating: '' },
            eligibility: { eligibility: '', date_acquired: '' }
        };
        setFormData(prev => ({
            ...prev,
            [section]: [...prev[section], { ...templates[section] }]
        }));
    };

    const removeListItem = (section, index) => {
        if (formData[section].length > 1) {
            const newList = formData[section].filter((_, i) => i !== index);
            setFormData(prev => ({ ...prev, [section]: newList }));
        }
    };

    const handleSubmit = async () => {
        setLoading(true);
        try {
            const data = new FormData();
            data.append('header', JSON.stringify(formData.header));
            data.append('experience', JSON.stringify(formData.experience));
            data.append('education', JSON.stringify(formData.education));
            data.append('ratings', JSON.stringify(formData.ratings));
            data.append('eligibility', JSON.stringify(formData.eligibility));
            
            if (formData.header.photo) {
                data.append('photo', formData.header.photo);
            }

            const response = await fetch('/api/officials/apply', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: data
            });

            if (response.ok) {
                setSuccess(true);
                setTimeout(() => navigate('/'), 3000);
            } else {
                alert('Submission failed. Please try again.');
            }
        } catch (err) {
            console.error(err);
            alert('An error occurred during submission.');
        } finally {
            setLoading(false);
        }
    };

    const stepVariants = {
        initial: { opacity: 0, x: 20 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -20 }
    };

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 text-center">
                <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="max-w-md w-full bg-white p-12 rounded-[3rem] shadow-2xl border border-blue-100"
                >
                    <div className="w-24 h-24 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-8">
                        <FiCheckCircle size={48} />
                    </div>
                    <h2 className="text-3xl font-black text-slate-900 mb-4 tracking-tighter italic uppercase">Application Received</h2>
                    <p className="text-slate-500 font-bold leading-relaxed">
                        Your career path application has been submitted successfully to the Personnel Division. 
                        Redirecting to Nexus...
                    </p>
                </motion.div>
            </div>
        );
    }

    return (
        <PageTransition>
            <div className="min-h-screen bg-slate-50 pb-20 font-sans text-slate-900">
                {/* Header Accents */}
                <div className="bg-[#0038A8] h-48 relative overflow-hidden flex items-end px-8 lg:px-20 pb-8">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl"></div>
                    <div className="relative z-10">
                        <h1 className="text-4xl font-black text-white italic tracking-tighter">Career Path Protocol</h1>
                        <p className="text-blue-200 text-xs font-black uppercase tracking-[0.4em] mt-1">Recruitment & Selection • Step {step} of 6</p>
                    </div>
                </div>

                <div className="max-w-4xl mx-auto -mt-10 px-6">
                    <div className="bg-white rounded-[3rem] shadow-2xl shadow-blue-900/10 border border-blue-50 overflow-hidden">
                        
                        {/* Progress Bar */}
                        <div className="h-2 bg-slate-100 w-full">
                            <motion.div 
                                className="h-full bg-yellow-400"
                                initial={{ width: 0 }}
                                animate={{ width: `${(step / 6) * 100}%` }}
                            />
                        </div>

                        <div className="p-8 lg:p-12">
                            <AnimatePresence mode="wait">
                                {step === 1 && (
                                    <motion.div key="step1" variants={stepVariants} initial="initial" animate="animate" exit="exit" className="space-y-8">
                                        <div className="flex flex-col md:flex-row gap-8 items-start">
                                            <div className="relative group mx-auto md:mx-0">
                                                <div className="w-40 h-40 rounded-[2.5rem] bg-slate-100 border-4 border-white shadow-xl overflow-hidden flex items-center justify-center">
                                                    {formData.header.photoPreview ? (
                                                        <img src={formData.header.photoPreview} className="w-full h-full object-cover" alt="Preview" />
                                                    ) : (
                                                        <FiUser size={64} className="text-slate-300" />
                                                    )}
                                                </div>
                                                <label className="absolute bottom-[-10px] right-[-10px] bg-[#0038A8] text-white p-3 rounded-2xl shadow-lg cursor-pointer hover:scale-110 transition-all">
                                                    <FiCamera />
                                                    <input type="file" hidden accept="image/*" onChange={handlePhotoChange} />
                                                </label>
                                            </div>
                                            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                                                <div className="md:col-span-2 flex flex-col gap-2">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Applicant Classification</label>
                                                    <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1">
                                                        <button 
                                                            onClick={() => setFormData(prev => ({ ...prev, header: { ...prev.header, applicantType: 'deped' } }))}
                                                            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${formData.header.applicantType === 'deped' ? 'bg-[#0038A8] text-white shadow-lg' : 'text-slate-500 hover:bg-slate-200'}`}
                                                        >
                                                            Existing DepEd Personnel
                                                        </button>
                                                        <button 
                                                            onClick={() => setFormData(prev => ({ ...prev, header: { ...prev.header, applicantType: 'outsider' } }))}
                                                            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${formData.header.applicantType === 'outsider' ? 'bg-[#0038A8] text-white shadow-lg' : 'text-slate-500 hover:bg-slate-200'}`}
                                                        >
                                                            External Candidate
                                                        </button>
                                                    </div>
                                                </div>
                                                <InputField label="Full Name" name="fullname" value={formData.header.fullname} onChange={handleHeaderChange} icon={FiUser} />
                                                <InputField label="Age" name="age" type="number" value={formData.header.age} onChange={handleHeaderChange} />
                                                <InputField 
                                                    label={formData.header.applicantType === 'deped' ? "Current Position & Office" : "Present Occupation & Company"} 
                                                    name="current_position" 
                                                    value={formData.header.current_position} 
                                                    onChange={handleHeaderChange} 
                                                    placeholder={formData.header.applicantType === 'deped' ? "e.g. OIC-SDS, Quezon City" : "e.g. Project Manager, AB Corp."} 
                                                />
                                                <InputField label="Position Applied For" name="position_applied_for" value={formData.header.position_applied_for} onChange={handleHeaderChange} placeholder="e.g. Assistant Schools Division Superintendent" />
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                                {step === 2 && (
                                    <motion.div key="step2" variants={stepVariants} initial="initial" animate="animate" exit="exit">
                                        <StepHeader title="Managerial Experience" icon={FiBriefcase} subtitle="List your previous leadership roles and durations." />
                                        <DynamicTable 
                                            headers={[
                                                formData.header.applicantType === 'deped' ? 'DepEd Position' : 'Previous Position',
                                                formData.header.applicantType === 'deped' ? 'Division/Region' : 'Company/Organization',
                                                'Years/Duration'
                                            ]}
                                            data={formData.experience}
                                            renderRow={(item, idx) => (
                                                <>
                                                    <TableInput value={item.position} onChange={(v) => handleListChange('experience', idx, 'position', v)} placeholder="Position" />
                                                    <TableInput value={item.location} onChange={(v) => handleListChange('experience', idx, 'location', v)} placeholder="Location" />
                                                    <TableInput value={item.duration} onChange={(v) => handleListChange('experience', idx, 'duration', v)} placeholder="e.g. 2 yrs" />
                                                </>
                                            )}
                                            onAdd={() => addListItem('experience')}
                                            onRemove={(i) => removeListItem('experience', i)}
                                        />
                                    </motion.div>
                                )}

                                {step === 3 && (
                                    <motion.div key="step3" variants={stepVariants} initial="initial" animate="animate" exit="exit">
                                        <StepHeader title="Educational Attainment" icon={FiBookOpen} subtitle="Degrees earned and universities attended." />
                                        <DynamicTable 
                                            headers={['University', 'Degree Earned', 'Year Graduated']}
                                            data={formData.education}
                                            renderRow={(item, idx) => (
                                                <>
                                                    <TableInput value={item.university} onChange={(v) => handleListChange('education', idx, 'university', v)} placeholder="University" />
                                                    <TableInput value={item.degree} onChange={(v) => handleListChange('education', idx, 'degree', v)} placeholder="Degree" />
                                                    <TableInput value={item.year_graduated} onChange={(v) => handleListChange('education', idx, 'year_graduated', v)} placeholder="Year" />
                                                </>
                                            )}
                                            onAdd={() => addListItem('education')}
                                            onRemove={(i) => removeListItem('education', i)}
                                        />
                                    </motion.div>
                                )}

                                {step === 4 && (
                                    <motion.div key="step4" variants={stepVariants} initial="initial" animate="animate" exit="exit">
                                        <StepHeader title="Performance Ratings" icon={FiStar} subtitle="Recent evaluation ratings (CESPES / OPCRF)." />
                                        <DynamicTable 
                                            headers={['Period/Semester', 'Rating Value']}
                                            data={formData.ratings}
                                            renderRow={(item, idx) => (
                                                <>
                                                    <TableInput value={item.period} onChange={(v) => handleListChange('ratings', idx, 'period', v)} placeholder="e.g. 2024 1st Sem" />
                                                    <TableInput value={item.rating} onChange={(v) => handleListChange('ratings', idx, 'rating', v)} placeholder="4.86" type="number" step="0.01" />
                                                </>
                                            )}
                                            onAdd={() => addListItem('ratings')}
                                            onRemove={(i) => removeListItem('ratings', i)}
                                        />
                                    </motion.div>
                                )}

                                {step === 5 && (
                                    <motion.div key="step5" variants={stepVariants} initial="initial" animate="animate" exit="exit">
                                        <StepHeader title="Official Eligibility" icon={FiAward} subtitle="CESO, EMT, and other professional qualifications." />
                                        <DynamicTable 
                                            headers={['Eligibility Type', 'Date Acquired']}
                                            data={formData.eligibility}
                                            renderRow={(item, idx) => (
                                                <>
                                                    <TableInput value={item.eligibility} onChange={(v) => handleListChange('eligibility', idx, 'eligibility', v)} placeholder="e.g. CESO VI" />
                                                    <TableInput value={item.date_acquired} onChange={(v) => handleListChange('eligibility', idx, 'date_acquired', v)} type="date" />
                                                </>
                                            )}
                                            onAdd={() => addListItem('eligibility')}
                                            onRemove={(i) => removeListItem('eligibility', i)}
                                        />
                                    </motion.div>
                                )}

                                {step === 6 && (
                                    <motion.div key="step6" variants={stepVariants} initial="initial" animate="animate" exit="exit" className="space-y-8">
                                        <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100">
                                            <h3 className="text-xl font-black text-[#0038A8] mb-6 italic uppercase tracking-tighter">Final Review</h3>
                                            <div className="grid grid-cols-2 gap-4 text-sm font-bold">
                                                <div>
                                                    <p className="text-slate-400 uppercase text-[9px] tracking-widest mb-1">Applicant Name</p>
                                                    <p className="text-slate-800 uppercase">{formData.header.fullname}</p>
                                                </div>
                                                <div>
                                                    <p className="text-slate-400 uppercase text-[9px] tracking-widest mb-1">Applying For</p>
                                                    <p className="text-slate-800 uppercase text-[#0038A8]">{formData.header.position_applied_for}</p>
                                                </div>
                                            </div>
                                            <div className="mt-8 pt-8 border-t border-slate-200">
                                                <p className="text-slate-500 text-xs leading-relaxed italic">
                                                    By submitting this application, I certify that all information provided is true and correct to the best of my knowledge and authorized by the Personnel Division protocols.
                                                </p>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Actions */}
                            <div className="mt-12 flex justify-between items-center">
                                <button 
                                    onClick={prevStep}
                                    disabled={step === 1 || loading}
                                    className={`flex items-center gap-2 px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all ${step === 1 ? 'opacity-0' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                >
                                    <FiArrowLeft /> Back
                                </button>

                                {step === 6 ? (
                                    <button 
                                        onClick={handleSubmit}
                                        disabled={loading}
                                        className="flex items-center gap-2 px-10 py-5 bg-[#0038A8] text-white rounded-3xl font-black italic uppercase tracking-widest shadow-xl shadow-blue-900/20 active:scale-95 disabled:opacity-50"
                                    >
                                        {loading ? 'Processing...' : 'Submit Application'}
                                    </button>
                                ) : (
                                    <button 
                                        onClick={nextStep}
                                        className="flex items-center gap-2 px-10 py-5 bg-[#0038A8] text-white rounded-3xl font-black italic uppercase tracking-widest shadow-xl shadow-blue-900/20 active:scale-95 hover:gap-4 transition-all"
                                    >
                                        Next <FiArrowRight />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 text-center">
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em]">Integrated Merit and Selection System • 2026</p>
                    </div>
                </div>
            </div>
        </PageTransition>
    );
};

// --- Sub-components ---

const InputField = ({ label, name, type = 'text', value, onChange, icon: Icon, placeholder }) => (
    <div className="flex flex-col gap-2">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
        <div className="relative">
            {Icon && <Icon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />}
            <input 
                type={type}
                name={name}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                className={`w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all ${Icon ? 'pl-12' : ''}`}
            />
        </div>
    </div>
);

const StepHeader = ({ title, icon: Icon, subtitle }) => (
    <div className="flex items-center gap-6 mb-8 bg-blue-50/50 p-6 rounded-[2rem] border border-blue-50">
        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-[#0038A8] shadow-sm">
            <Icon size={28} />
        </div>
        <div>
            <h3 className="text-2xl font-black text-slate-900 tracking-tighter italic uppercase">{title}</h3>
            <p className="text-xs font-bold text-slate-500 tracking-wide mt-1">{subtitle}</p>
        </div>
    </div>
);

const DynamicTable = ({ headers, data, renderRow, onAdd, onRemove }) => (
    <div className="space-y-4">
        <div className="grid grid-cols-[1fr_1fr_1fr_40px] gap-4 px-4">
            {headers.map(h => (
                <span key={h} className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{h}</span>
            ))}
            <span></span>
        </div>
        <div className="space-y-3">
            {data.map((item, idx) => (
                <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={idx} 
                    className="grid grid-cols-[1fr_1fr_1fr_40px] gap-4 items-center"
                >
                    {renderRow(item, idx)}
                    <button 
                        onClick={() => onRemove(idx)}
                        className="w-10 h-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-sm"
                    >
                        <FiTrash2 size={16} />
                    </button>
                </motion.div>
            ))}
        </div>
        <button 
            onClick={onAdd}
            className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-black text-[10px] uppercase tracking-widest hover:border-blue-400 hover:text-blue-500 transition-all flex items-center justify-center gap-2 mt-6"
        >
            <FiPlus /> Add Record
        </button>
    </div>
);

const TableInput = ({ value, onChange, placeholder, type = 'text', step }) => (
    <input 
        type={type}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
    />
);

export default OfficialApplication;
