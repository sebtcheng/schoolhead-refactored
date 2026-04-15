import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useServiceWorker } from '../context/ServiceWorkerContext';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    FiUsers, 
    FiTool, 
    FiArrowRight, 
    FiArrowLeft, 
    FiDatabase, 
    FiMap, 
    FiBriefcase, 
    FiActivity,
    FiShield
} from 'react-icons/fi';
import logo from '../assets/InsightEd.png';

const LaunchPad = () => {
    const navigate = useNavigate();
    const { checkForUpdates } = useServiceWorker();
    const [selectedCategory, setSelectedCategory] = useState(null); // 'hrod' | 'infra'

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { 
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        },
        exit: { opacity: 0, x: -20 }
    };

    const cardVariants = {
        hidden: { opacity: 0, y: 30, scale: 0.9 },
        visible: { 
            opacity: 1, 
            y: 0, 
            scale: 1,
            transition: { type: 'spring', stiffness: 100, damping: 15 }
        },
        hover: { 
            y: -10, 
            scale: 1.02,
            transition: { duration: 0.3 }
        }
    };

    const handleSelectSubPath = (pathId) => {
        // Navigate to login with path context
        navigate('/login', { state: { pathId } });
    };


    const MainPathCard = ({ title, subtitle, description, icon: Icon, color, onClick }) => (

        <motion.div
            variants={cardVariants}
            whileHover="hover"
            onClick={onClick}
            className={`cursor-pointer group relative overflow-hidden rounded-[3rem] bg-white p-10 shadow-2xl shadow-blue-900/10 border border-slate-100 flex flex-col justify-between min-h-[400px] transition-all duration-500`}

        >
            <div className={`absolute top-0 right-0 w-48 h-48 ${color} opacity-10 rounded-full -mr-24 -mt-24 blur-3xl transition-opacity group-hover:opacity-20`}></div>
            
            <div className={`w-20 h-20 rounded-[2rem] ${color} text-white flex items-center justify-center shadow-xl mb-8 group-hover:scale-110 transition-transform duration-500`}>
                <Icon size={40} />
            </div>


            <div className="space-y-3">
                <div className="space-y-1">
                    <h3 className="text-3xl font-black text-slate-800 tracking-tighter italic leading-tight uppercase">
                        <span className="normal-case">{title}</span>
                    </h3>
                    <p className="text-xs font-black text-[#004A99] uppercase tracking-widest">{subtitle}</p>
                </div>


                <p className="text-slate-500 text-sm font-medium leading-relaxed">{description}</p>
            </div>


            <div className="flex items-center gap-3 mt-6 text-[#004A99] font-black text-xs uppercase tracking-widest group-hover:gap-5 transition-all">
                <span>Enter Portal</span>
                <FiArrowRight />
            </div>
        </motion.div>
    );

    const SubRoleCard = ({ title, description, icon: Icon, color, onClick }) => (
        <motion.div
            variants={cardVariants}
            whileHover="hover"
            onClick={onClick}
            className={`cursor-pointer group relative overflow-hidden rounded-[3rem] bg-white p-10 shadow-2xl shadow-blue-900/10 border border-slate-100 flex flex-col justify-between min-h-[400px] transition-all duration-500`}
        >
            <div className={`absolute top-0 right-0 w-48 h-48 ${color || 'bg-blue-500'} opacity-10 rounded-full -mr-24 -mt-24 blur-3xl transition-opacity group-hover:opacity-20`}></div>
            
            <div className={`w-20 h-20 rounded-[2rem] ${color || 'bg-[#004A99]'} text-white flex items-center justify-center shadow-xl mb-8 group-hover:scale-110 transition-transform duration-500`}>
                <Icon size={40} />
            </div>

            <div className="space-y-3">
                <div className="space-y-1">
                    <h3 className="text-3xl font-black text-slate-800 tracking-tighter italic leading-tight uppercase">
                        <span className="normal-case">{title}</span>
                    </h3>
                    <p className="text-xs font-black text-[#004A99] uppercase tracking-widest">Secure Login Path</p>
                </div>

                <p className="text-slate-500 text-sm font-medium leading-relaxed">{description}</p>
            </div>

            <div className="flex items-center gap-3 mt-6 text-[#004A99] font-black text-xs uppercase tracking-widest group-hover:gap-5 transition-all">
                <span>Enter Portal</span>
                <FiArrowRight />
            </div>
        </motion.div>
    );


    return (
        <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-6 relative overflow-hidden translate-z-0 font-sans">
            {/* Background Accents */}
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-100/50 rounded-full blur-[120px] pointer-events-none animate-pulse"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-100/40 rounded-full blur-[100px] pointer-events-none"></div>

            {/* Logo Section */}
            <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-12 text-left relative z-10 w-full max-w-4xl"
            >
                <div className="space-y-1">
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter text-left leading-tight">
                        Welcome to the <br /> 
                        <span className="text-[#004A99] italic">InsightED Nexus</span>
                    </h1>
                </div>



            </motion.div>

            <AnimatePresence mode="wait">
                {!selectedCategory ? (
                    <motion.div
                        key="main-options"
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl relative z-10"
                    >
                        <MainPathCard 
                            title="InsightED"
                            subtitle="For HROD"
                            description="Access management tools for School Heads, Human Resources, and Regional/Division office personnel."
                            icon={FiUsers}
                            color="bg-gradient-to-br from-blue-500 to-indigo-600"
                            onClick={() => setSelectedCategory('hrod')}
                        />
                        <MainPathCard 
                            title="InsightED"
                            subtitle="For Infrastructure"
                            description="Monitoring and implementation tools for Engineers, Agencies, and Educational Facilities Division."
                            icon={FiTool}
                            color="bg-gradient-to-br from-slate-700 to-slate-900"
                            onClick={() => setSelectedCategory('infra')}
                        />

                    </motion.div>
                ) : (
                    <motion.div
                        key="sub-options"
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className="w-full max-w-4xl relative z-10"
                    >
                        <div className="flex items-center gap-4 mb-8">
                            <button 
                                onClick={() => setSelectedCategory(null)}
                                className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors shadow-sm"
                            >
                                <FiArrowLeft />
                            </button>
                            <div>
                                <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase italic leading-none">
                                    {selectedCategory === 'hrod' ? 'HROD Portals' : 'Infrastructure Portals'}
                                </h2>
                                <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Select your specialized portal</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {selectedCategory === 'hrod' ? (
                                <>
                                    <SubRoleCard 
                                        title="School Head Portal" 
                                        description="Manage school identity, enrolment, and learner statistics in the InsightED Nexus."
                                        icon={FiShield} 
                                        color="bg-gradient-to-br from-[#004A99] to-[#003366]"
                                        onClick={() => handleSelectSubPath('path_school_head')}
                                    />
                                    <SubRoleCard 
                                        title="RO and SDO Portal" 
                                        description="Monitor field performance and manage regional/division office reporting."
                                        icon={FiBriefcase} 
                                        color="bg-gradient-to-br from-blue-400 to-blue-600"
                                        onClick={() => handleSelectSubPath('path_ro_sd')}
                                    />

                                </>
                            ) : (
                                <>
                                    <SubRoleCard 
                                        title="Engineers Portal" 
                                        description="Submit damage assessments, site inspections, and project monitoring reports."
                                        icon={FiTool} 
                                        color="bg-gradient-to-br from-slate-700 to-slate-900"
                                        onClick={() => handleSelectSubPath('path_engineers')}
                                    />
                                    <SubRoleCard 
                                        title="Implementing Agencies Portal" 
                                        description="Track project deployment and manage agency-specific infrastructure data."
                                        icon={FiDatabase} 
                                        color="bg-gradient-to-br from-blue-700 to-blue-900"
                                        onClick={() => handleSelectSubPath('path_agencies')}
                                    />
                                    <SubRoleCard 
                                        title="EFD Portal" 
                                        description="Access Central Office oversight tools for NewCon and Mother MOA monitoring."
                                        icon={FiActivity} 
                                        color="bg-gradient-to-br from-[#004A99] to-[#003366]"
                                        onClick={() => handleSelectSubPath('path_efd')}
                                    />

                                </>
                            )}
                        </div>
                    </motion.div>

                )}
            </AnimatePresence>

            {/* Footer */}
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
                className="mt-16 text-center space-y-4 relative z-10"
            >
                <div className="flex flex-col items-center justify-center gap-6">
                    <button 
                        onClick={async () => {
                            const found = await checkForUpdates();
                            if (!found) alert('No updates found on server yet. Please try again in 1 minute.');
                        }}
                        className="text-[10px] font-black text-slate-400 hover:text-[#004A99] uppercase tracking-widest transition-colors mb-4"
                    >
                        [ Optimize App ]
                    </button>
                    <img src="https://cdn.worldvectorlogo.com/logos/deped.svg" className="h-8 opacity-40 grayscale hover:grayscale-0 transition-all" alt="DepEd" />
                </div>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em]">
                    © 2026 Department of Education • <span className="normal-case">InsightED Nexus</span>
                </p>
            </motion.div>
        </div>
    );
};

export default LaunchPad;
