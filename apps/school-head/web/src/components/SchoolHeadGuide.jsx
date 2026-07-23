import React from 'react';
import LogoDepEd from '../assets/deped.png';
import LogoBagongPilipinas from '../assets/bagongpilipinas.png';
import LogoHROD from '../assets/hrod.png';

const SchoolHeadGuide = () => {
    // Scroll Reveal Logic
    

    return (
        <div className="bg-slate-50 text-slate-900 scroll-smooth min-h-screen relative w-full overflow-x-hidden">
            <style dangerouslySetInnerHTML={{ __html: `
        /* Luxury Design System */
        :root {
            --primary: #3B82F6;
            --primary-focus: #2563EB;
            --navy-dark: #0A192F;
            --slate-body: #F8FAFC;
        }

        body { 
            font-family: 'Inter', sans-serif; 
            background-color: var(--slate-body); 
            scroll-behavior: smooth;
            -webkit-font-smoothing: antialiased;
            font-size: 100%;
            width: 100%;
            max-width: 100vw;
            overflow-x: hidden;
        }

        /* Premium Card Architecture */
        .unit-card {
            background: #ffffff;
            border: 1px solid rgba(241, 245, 249, 0.8);
            border-radius: 2.5rem;
            box-shadow: 
                0 4px 6px -1px rgba(0, 0, 0, 0.02),
                0 20px 25px -5px rgba(0, 0, 0, 0.03);
            transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
            padding: 3rem;
            margin-bottom: 6rem;
            position: relative;
            overflow: hidden;
        }

        @media (max-width: 768px) {
            .unit-card {
                padding: 1.5rem;
                margin-bottom: 3rem;
                border-radius: 1.5rem;
            }
            .step-pill {
                width: 2.5rem;
                height: 2.5rem;
                font-size: 1rem;
                margin-right: 1rem;
            }
        }

        /* Essential Mobile Overrides (Samsung S8+ / Small Screens) */
        @media (max-width: 480px) {
            body { 
                font-size: 90%; 
            }
            .unit-card {
                padding: 1.25rem;
                margin-bottom: 2rem;
                border-radius: 1.25rem;
            }
            .step-pill {
                width: 2.25rem;
                height: 2.25rem;
                font-size: 0.9rem;
                margin-right: 0.75rem;
                border-radius: 1rem;
            }
            h1 { font-size: 3rem !important; line-height: 1.1 !important; }
            h2 { font-size: 1.75rem !important; line-height: 1.2 !important; }
            .summary-card { padding: 1rem; border-radius: 1rem; }
            .alert-box { padding: 0.75rem 1rem; }
            .p-12, .p-10 { padding: 1.5rem !important; }
            .rounded-\[4rem\], .rounded-\[3\.5rem\], .rounded-\[2\.5rem\] { border-radius: 1.5rem !important; }
            .mb-16, .mb-32, .mt-24 { margin-top: 1.5rem !important; margin-bottom: 2rem !important; }
            .gap-16, .gap-20, .gap-12 { gap: 1rem !important; }
        }

        /* Timeline - Connector Lines */
        section {
            position: relative;
        }
        section:not(:last-of-type)::after {
            content: '';
            position: absolute;
            left: 2.5rem; /* Center of step-pill (Desktop) */
            top: 5rem;
            bottom: -2rem;
            width: 2px;
            background: linear-gradient(to bottom, #3b82f6 50%, transparent);
            z-index: 0;
            opacity: 0.3;
        }
        @media (max-width: 768px) {
            section:not(:last-of-type)::after {
                left: 2rem;
                top: 4.5rem;
                bottom: -2rem;
            }
        }
        @media (max-width: 480px) {
            section:not(:last-of-type)::after {
                left: 1.125rem;
                top: 3.5rem;
                bottom: -1rem;
            }
        }

        /* Scroll Reveal */
        
        ..visible {
            opacity: 1;
            transform: translateY(0);
        }

        .unit-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 4px;
            background: linear-gradient(90deg, transparent, var(--primary), transparent);
            opacity: 0;
            transition: opacity 0.5s ease;
        }

        .unit-card:hover { 
            transform: translateY(-8px);
            box-shadow: 0 40px 60px -15px rgba(15, 23, 42, 0.08);
        }

        .unit-card:hover::before { opacity: 1; }

        /* Icon & Step Styling */
        .step-pill {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 3.5rem;
            height: 3.5rem;
            background: var(--navy-dark);
            color: #ffffff;
            border-radius: 1.25rem;
            font-size: 1.25rem;
            font-weight: 900;
            margin-right: 1.5rem;
            box-shadow: 0 10px 15px -3px rgba(15, 23, 42, 0.1);
            transition: all 0.3s ease;
        }

        .unit-card:hover .step-pill {
            transform: scale(1.1) rotate(-5deg);
            background: var(--primary);
        }

        /* Phone Mockup (User requested to keep this frame) */
        .phone-mockup {
            max-width: 280px;
            width: 100%;
            margin: 0 auto;
            border: 8px solid #1e293b;
            border-radius: 2rem;
            box-shadow: 0 50px 100px -20px rgba(0, 0, 0, 0.15);
            background: #000;
            overflow: hidden;
            position: relative;
        }

        /* Glassmorphism Utilities */
        .glass-panel {
            background: rgba(255, 255, 255, 0.7);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.3);
        }

        /* Navigation Accents */
        .desktop-toc-link {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 0.6rem 0.5rem;
            color: #64748b; /* Slate-500 */
            font-size: 0.7rem; /* text-[10px] */
            font-weight: 800;
            text-transform: uppercase;
            font-style: italic;
            letter-spacing: 0.1em;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            border-radius: 0.5rem;
        }

        .desktop-toc-link:hover {
            color: #1e293b; /* Slate-900 */
            background-color: #f8fafc; /* Slate-50 */
            padding-left: 1rem;
        }

        .desktop-toc-link .step-id {
            color: #94a3b8; /* Slate-400 */
            font-style: normal;
        }
        
        .desktop-toc-link:hover .step-id {
            color: #3b82f6; /* Blue-500 */
        }

        .toc-link {
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .toc-link:hover { padding-left: 1.25rem; color: var(--primary); }
        .toc-link:hover .step-num { background-color: var(--primary); color: white; transform: scale(1.1); }

        /* Hide Scrollbar but keep functionality */
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

        /* Mobile Overlay Transition */
        .mobile-overlay { transition: opacity 0.3s ease; }

        /* Mobile Sidebar Customization */
        #mobile-nav-toggle:checked ~ #mobile-sidebar { transform: translateX(0); }
        #mobile-nav-toggle:checked ~ .mobile-overlay { display: block; opacity: 1; }

        /* At a Glance Summary Cards */
        .summary-card {
            background: linear-gradient(135deg, #eff6ff 0%, #ffffff 100%);
            border: 1px solid #dbeafe;
            border-left: 4px solid #3b82f6;
            border-radius: 1.5rem;
            padding: 1.5rem;
            margin-bottom: 2rem;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
        }

        /* Color-Coded Alerts */
        .alert-box {
            padding: 1rem 1.5rem;
            border-radius: 1rem;
            font-size: 0.875rem;
            font-weight: 600;
            display: flex;
            align-items: start;
            gap: 0.75rem;
            margin-top: 1.5rem;
        }
        .alert-required { background-color: #fef2f2; border: 1px solid #fee2e2; color: #991b1b; }
        .alert-tip { background-color: #f0fdf4; border: 1px solid #dcfce7; color: #166534; }
        .alert-warning { background-color: #fffbeb; border: 1px solid #fef3c7; color: #92400e; }

        @media (max-width: 480px) {
            body { font-size: 90%; }
            .unit-card {
                padding: 1rem;
                margin-bottom: 2rem;
                border-radius: 1rem;
            }
            .step-pill {
                width: 2rem;
                height: 2rem;
                font-size: 0.875rem;
            }
            h1 { font-size: 2.75rem !important; line-height: 1 !important; }
            h2 { font-size: 1.75rem !important; }
            .summary-card { padding: 1rem; }
        }
    ` }} />
            

    

    

    

    <div className="max-w-[1600px] w-full mx-auto px-6 py-12">
        

        <main className="flex-1 min-w-0">
            
            {/* Global Content Header (Clean White Mode) */}
            <header className="mb-8 md:mb-32 relative group">
                <div className="flex flex-col items-center justify-center py-8 md:py-24 px-4 md:px-10 rounded-[1.5rem] md:rounded-[3.5rem] border border-slate-100 bg-white shadow-[0_40px_80px_-20px_rgba(0,0,0,0.03)] overflow-hidden relative">
                     {/* Minimalist Accents */}
                     <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent via-blue-500/10 to-transparent"></div>

                     <div className="flex items-center justify-center gap-4 sm:gap-8 md:gap-12 mb-8 relative z-10 w-full">
                         <div className="flex-shrink-0 hover:scale-110 transition-transform duration-500">
                             <img src={LogoDepEd} alt="Logo 1" className="h-16 sm:h-20 md:h-24 w-auto" />
                         </div>
                         <div className="flex-shrink-0 hover:scale-110 transition-transform duration-500">
                             <img src={LogoBagongPilipinas} alt="Logo 2" className="h-20 sm:h-24 md:h-28 w-auto" />
                         </div>
                         <div className="flex-shrink-0 hover:scale-110 transition-transform duration-500">
                             <img src={LogoHROD} alt="Logo 3" className="h-16 sm:h-20 md:h-24 w-auto" />
                         </div>
                     </div>
                     
                     <div className="text-center relative z-10 max-w-5xl">
                          <h1 className="text-3xl md:text-8xl font-black text-slate-950 mb-2 md:mb-10 tracking-[-0.03em] leading-tight md:leading-tight uppercase">
                             InsightEd <br />
                             <span className="text-transparent bg-clip-text bg-gradient-to-br from-blue-600 to-slate-950 italic">Operational Guide</span>
                          </h1>
                          
                          <p className="text-lg md:text-3xl text-slate-400 font-medium italic tracking-tight mx-auto max-w-3xl">
                              "Accurate Data. Clear Insights."
                          </p>
                     </div>
                </div>
            </header>

            <section id="unit-1" className="mb-16 md:mb-32 scroll-mt-24 px-4 md:px-12 ">
                <header className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
                    <div className="flex items-center">
                        <span className="step-pill">01</span>
                        <div>
                            <span className="text-sm font-black text-blue-600 uppercase tracking-[0.4em] block mb-1">Getting Ready</span>
                            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 uppercase tracking-tighter italic">Quick Start</h2>
                        </div>
                    </div>
                    <div className="h-px flex-1 bg-slate-200 hidden md:block mx-8 mb-4"></div>
                    <div className="text-right">
                        <span className="text-base font-bold text-slate-400 uppercase tracking-widest">Installation Guide</span>
                    </div>
                </header>

                <div className="unit-card">
                    <div className="grid md:grid-cols-2 gap-16 items-center">
                        <div className="summary-card">
                            <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest mb-2 italic">At a Glance</h4>
                            <p className="text-sm text-slate-600 italic">To install InsightEd, open your browser and navigate to tinyurl.com/InsightEdV2. Use your browser's menu to 'Add to Home Screen' to install it as a phone-first app, allowing for seamless school reporting directly from your mobile device.</p>
                        </div>
                    </div>
                </div>
                {/* Next Unit Link */}
                <div className="mt-8 text-right px-4">
                    <a href="#unit-2" className="text-[10px] font-black text-blue-500 uppercase tracking-widest italic flex items-center justify-end gap-2 group">
                        Next: Welcome to InsightEd
                        <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                    </a>
                </div>
            </section>

            <section id="unit-2" className="mb-16 md:mb-32 scroll-mt-24 px-4 md:px-12 ">
                <header className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
                    <div className="flex items-center">
                        <span className="step-pill">02</span>
                        <div>
                            <span className="text-sm font-black text-blue-600 uppercase tracking-[0.4em] block mb-1">Accessing the App</span>
                            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 uppercase tracking-tighter italic">Welcome to InsightEd</h2>
                        </div>
                    </div>
                    <div className="h-px flex-1 bg-slate-200 hidden md:block mx-8 mb-4"></div>
                    <div className="text-right">
                        <span className="text-base font-bold text-slate-400 uppercase tracking-widest">Portal Logic</span>
                    </div>
                </header>

                <div className="unit-card">
                    <div className="grid md:grid-cols-2 gap-16 items-center">
                        <div className="summary-card">
                            <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest mb-2 italic">At a Glance</h4>
                            <p className="text-sm text-slate-600 italic">Access the app by selecting the 'School Head Portal' from the main entry screen. If you are a first-time user, click 'Create Account' to begin your registration and gain access to your school’s specialized data management tools.</p>
                        </div>
                    </div>
                </div>
                {/* Next Unit Link */}
                <div className="mt-8 text-right px-4">
                    <a href="#unit-3" className="text-[10px] font-black text-blue-500 uppercase tracking-widest italic flex items-center justify-end gap-2 group">
                        Next: School Registration
                        <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                    </a>
                </div>
            </section>

            <section id="unit-3" className="mb-32 scroll-mt-24 ">
                <header className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
                    <div className="flex items-center">
                        <span className="step-pill">03</span>
                        <div>
                            <span className="text-sm font-black text-blue-600 uppercase tracking-[0.4em] block mb-1">Getting Started</span>
                            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 uppercase tracking-tighter italic">School Registration</h2>
                        </div>
                    </div>
                    <div className="h-px flex-1 bg-slate-200 hidden md:block mx-8 mb-4"></div>
                </header>

                <div className="unit-card">
                    <div className="grid md:grid-cols-2 gap-16 items-center">
                        <div className="summary-card">
                            <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest mb-2 italic">At a Glance</h4>
                            <p className="text-sm text-slate-600 italic">Register your school by entering personal details, mapping your location hierarchy, and geotagging your school's exact coordinates. Remember to save your unique School ID (IERN), as it is required for all future logins.</p>
                        </div>
                    </div>
                </div>
                {/* Next Unit Link */}
                <div className="mt-8 text-right px-4">
                    <a href="#unit-4" className="text-[10px] font-black text-blue-500 uppercase tracking-widest italic flex items-center justify-end gap-2 group">
                        Next: Your Dashboard
                        <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                    </a>
                </div>
            </section>

            <section id="unit-4" className="mb-16 md:mb-32 scroll-mt-24 px-4 md:px-12 ">
                <header className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
                    <div className="flex items-center">
                        <span className="step-pill">04</span>
                        <div>
                            <span className="text-sm font-black text-blue-600 uppercase tracking-[0.4em] block mb-1">Manage Your School</span>
                            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 uppercase tracking-tighter italic">Your Dashboard</h2>
                        </div>
                    </div>
                </header>

                <div className="unit-card">
                    <div className="grid md:grid-cols-2 gap-16 items-center">
                        <div className="summary-card">
                            <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest mb-2 italic">At a Glance</h4>
                            <p className="text-sm text-slate-600 italic">Your dashboard is the central hub for school management. Use the 'CLOUD' button for comprehensive school monitoring and audits (Units 1-9), and access 'ESF7' to efficiently manage and upload your teacher personnel files.</p>
                        </div>
                    </div>
                </div>
                {/* Next Unit Link */}
                <div className="mt-8 text-right px-4">
                    <a href="#unit-5" className="text-[10px] font-black text-blue-500 uppercase tracking-widest italic flex items-center justify-end gap-2 group">
                        Next: Unit 1 - School Profile
                        <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                    </a>
                </div>
            </section>
            <section id="unit-5" className="mb-16 md:mb-32 scroll-mt-24 px-4 md:px-12 ">
                <header className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
                    <div className="flex items-center">
                        <span className="step-pill">05</span>
                        <div>
                            <span className="text-sm font-black text-blue-600 uppercase tracking-[0.4em] block mb-1">Your School Identity</span>
                            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 uppercase tracking-tighter italic">Unit 1: School Profile</h2>
                        </div>
                    </div>
                </header>

                <div className="unit-card">
                    <div className="grid md:grid-cols-2 gap-16 items-center">
                        <div className="summary-card">
                            <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest mb-2 italic">At a Glance</h4>
                            <p className="text-sm text-slate-600 italic">Confirm your school's identity, official name, and establishment dates. Upload required ownership documentation and link any mother or annex schools to ensure a complete profile.</p>
                        </div>
                        <div className="phone-mockup">
                            <img src="https://raw.githubusercontent.com/sebtcheng/InsightEd-Mobile-PWA/2a4874ba604994c6710b1ce38135db8fe2951f7b/public/Unit_1_Complete_Guide.gif" alt="Unit 1 Complete Guide" className="w-full h-auto" />
                        </div>
                    </div>
                </div>
                {/* Next Unit Link */}
                <div className="mt-8 text-right px-4">
                    <a href="#unit-6" className="text-[10px] font-black text-blue-500 uppercase tracking-widest italic flex items-center justify-end gap-2 group">
                        Next: Unit 2 - Enrollment
                        <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                    </a>
                </div>
            </section>
            <section id="unit-6" className="mb-16 md:mb-32 scroll-mt-24 px-4 md:px-12 ">
                <header className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
                    <div className="flex items-center">
                        <span className="step-pill">06</span>
                        <div>
                            <span className="text-sm font-black text-blue-600 uppercase tracking-[0.4em] block mb-1">Learner Count</span>
                            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 uppercase tracking-tighter italic">Unit 2: Learners</h2>
                        </div>
                    </div>
                </header>

                <div className="unit-card">
                    <div className="grid md:grid-cols-2 gap-16 items-center">
                        <div className="summary-card">
                            <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest mb-2 italic">At a Glance</h4>
                            <p className="text-sm text-slate-600 italic">Log enrollment by grade level and gender. The system validates that male and female counts match the total. Use the combination tool to accurately group multigrade classes.</p>
                        </div>
                        <div className="phone-mockup">
                            <img src="https://raw.githubusercontent.com/sebtcheng/InsightEd-Mobile-PWA/2a4874ba604994c6710b1ce38135db8fe2951f7b/public/unit2%20final.gif" alt="Unit 2 Learners Enrollment" className="w-full h-auto" />
                        </div>
                    </div>
                </div>
                {/* Next Unit Link */}
                <div className="mt-8 text-right px-4">
                    <a href="#unit-7" className="text-[10px] font-black text-blue-500 uppercase tracking-widest italic flex items-center justify-end gap-2 group">
                        Next: Unit 3 - Sections
                        <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                    </a>
                </div>
            </section>

            <section id="unit-7" className="mb-16 md:mb-32 scroll-mt-24 px-4 md:px-12 ">
                <header className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
                    <div className="flex items-center">
                        <span className="step-pill">07</span>
                        <div>
                            <span className="text-sm font-black text-blue-600 uppercase tracking-[0.4em] block mb-1">Classroom Density</span>
                            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 uppercase tracking-tighter italic">Unit 3: Sectioning</h2>
                        </div>
                    </div>
                </header>

                <div className="unit-card">
                    <div className="grid md:grid-cols-2 gap-16 items-center">
                        <div className="summary-card">
                            <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest mb-2 italic">At a Glance</h4>
                            <p className="text-sm text-slate-600 italic">Organize class sections and assign instructional shifts. Categorize each section by density—Less Than, Within, or Above Standard—to monitor and maintain optimal learner-teacher ratios across your campus.</p>
                        </div>
                        <div className="phone-mockup">
                            <img src="https://raw.githubusercontent.com/sebtcheng/InsightEd-Mobile-PWA/2a4874ba604994c6710b1ce38135db8fe2951f7b/public/unit%203%20final.gif" alt="Unit 3 Teachers Sectioning" className="w-full h-auto" />
                        </div>
                    </div>
                </div>
                {/* Next Unit Link */}
                <div className="mt-8 text-right px-4">
                    <a href="#unit-8" className="text-[10px] font-black text-blue-500 uppercase tracking-widest italic flex items-center justify-end gap-2 group">
                        Next: Unit 4 - Profiles
                        <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                    </a>
                </div>
            </section>

            <section id="unit-8" className="mb-32 scroll-mt-24 px-4 md:px-12 ">
                <header className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
                    <div className="flex items-center">
                        <span className="step-pill">08</span>
                        <div>
                            <span className="text-sm font-black text-blue-600 uppercase tracking-[0.4em] block mb-1">Special Education & Health</span>
                            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 uppercase tracking-tighter italic">Unit 4: Profiles</h2>
                        </div>
                    </div>
                </header>

                <div className="unit-card">
                    <div className="grid md:grid-cols-2 gap-16 items-center">
                        <div className="phone-mockup">
                            <img src="https://raw.githubusercontent.com/sebtcheng/InsightEd-Mobile-PWA/2a4874ba604994c6710b1ce38135db8fe2951f7b/public/unit4.gif" alt="Unit 4 Specialized Analytics" className="w-full h-auto" />
                        </div>
                        <div className="summary-card">
                            <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest mb-2 italic">At a Glance</h4>
                            <p className="text-sm text-slate-600 italic">Record specialized data for learner communities like IP and ALS. Monitor critical health metrics and performance indicators, such as dropouts and repeaters, to provide targeted support for at-risk students.</p>
                        </div>
                    </div>
                </div>
                {/* Next Unit Link */}
                <div className="mt-8 text-right px-4">
                    <a href="#unit-9" className="text-[10px] font-black text-blue-500 uppercase tracking-widest italic flex items-center justify-end gap-2 group">
                        Next: Unit 5 - Modalities
                        <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                    </a>
                </div>
            </section>
            <section id="unit-9" className="mb-16 md:mb-32 scroll-mt-24 px-4 md:px-12 ">
                <header className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
                    <div className="flex items-center">
                        <span className="step-pill">09</span>
                        <div>
                            <span className="text-sm font-black text-blue-600 uppercase tracking-[0.4em] block mb-1">Class Setup</span>
                            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 uppercase tracking-tighter italic font-display">Unit 5: Learning Modalities</h2>
                        </div>
                    </div>
                </header>

                <div className="unit-card">
                    <div className="grid md:grid-cols-2 gap-16 items-center">
                        <div className="summary-card">
                            <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest mb-2 italic">At a Glance</h4>
                            <p className="text-sm text-slate-600 italic">Configure your school's learning setup by selecting between in-person, blended, or distance delivery modes. Define your shifting models and report any emergency ADM protocols to ensure accurate operational mapping for reporting.</p>
                        </div>
                        <div className="phone-mockup">
                            <img src="https://raw.githubusercontent.com/sebtcheng/InsightEd-Mobile-PWA/2a4874ba604994c6710b1ce38135db8fe2951f7b/public/unit%205%20final.gif" alt="Unit 5 Modality Configuration" className="w-full h-auto" />
                        </div>
                    </div>
                </div>
                {/* Next Unit Link */}
                <div className="mt-8 text-right px-4">
                    <a href="#unit-10" className="text-[10px] font-black text-blue-500 uppercase tracking-widest italic flex items-center justify-end gap-2 group">
                        Next: Unit 6 - Resources
                        <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                    </a>
                </div>
            </section>

            <section id="unit-9" className="mb-16 md:mb-32 scroll-mt-24 px-4 md:px-12 ">
                <header className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
                    <div className="flex items-center">
                        <span className="step-pill">09</span>
                        <div>
                            <span className="text-sm font-black text-blue-600 uppercase tracking-[0.4em] block mb-1">Classroom Logic</span>
                            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 uppercase tracking-tighter italic">Unit 5: Learning Modalities</h2>
                        </div>
                    </div>
                </header>

                <div className="unit-card">
                    <div className="grid md:grid-cols-2 gap-16 items-center">
                        <div className="summary-card">
                            <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest mb-2 italic">At a Glance</h4>
                            <p className="text-sm text-slate-600 italic">Configure your school's learning setup by selecting between in-person, blended, or distance delivery modes. Define your shifting models and report any emergency ADM protocols to ensure accurate operational mapping for reporting.</p>
                        </div>
                    </div>
                </div>
            </section>

            <section id="unit-10" className="mb-16 md:mb-32 scroll-mt-24 px-4 md:px-12 ">
                <header className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
                    <div className="flex items-center">
                        <span className="step-pill">10</span>
                        <div>
                            <span className="text-sm font-black text-blue-600 uppercase tracking-[0.4em] block mb-1">School Property</span>
                            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 uppercase tracking-tighter italic font-display">Unit 6: School Resources</h2>
                        </div>
                    </div>
                </header>

                <div className="unit-card">
                    <div className="grid md:grid-cols-2 gap-16 items-center">
                        <div className="summary-card">
                            <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest mb-2 italic">At a Glance</h4>
                            <p className="text-sm text-slate-600 italic">Inventory furniture and ICT assets like laptops and eCarts. Log the status of power, internet, and WASH facilities to provide a clear view of your school's operational resources.</p>
                        </div>
                        <div className="phone-mockup">
                            <img src="https://raw.githubusercontent.com/sebtcheng/InsightEd-Mobile-PWA/2a4874ba604994c6710b1ce38135db8fe2951f7b/public/unit6%20resources.gif" alt="Unit 6 Resources" className="w-full h-auto" />
                        </div>
                    </div>
                </div>
                {/* Next Unit Link */}
                <div className="mt-8 text-right px-4">
                    <a href="#unit-11" className="text-[10px] font-black text-blue-500 uppercase tracking-widest italic flex items-center justify-end gap-2 group">
                        Next: Unit 7 - Buildings
                        <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                    </a>
                </div>
            </section>

            <section id="unit-11" className="mb-16 md:mb-32 scroll-mt-24 px-4 md:px-12 ">
                <header className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
                    <div className="flex items-center">
                        <span className="step-pill">11</span>
                        <div>
                            <span className="text-sm font-black text-blue-600 uppercase tracking-[0.4em] block mb-1">Building Audit</span>
                            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 uppercase tracking-tighter italic">Unit 7: Physical Facilities</h2>
                        </div>
                    </div>
                </header>

                <div className="unit-card">
                    <div className="grid md:grid-cols-2 gap-16 items-center">
                        <div className="summary-card">
                            <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest mb-2 italic">At a Glance</h4>
                            <p className="text-sm text-slate-600 italic">Audit all school buildings and rooms to assess conditions. Map buildable spaces for future development and use the damage slider to report specific repair needs for prioritized maintenance.</p>
                        </div>
                        <div className="phone-mockup">
                            <img src="https://raw.githubusercontent.com/sebtcheng/InsightEd-Mobile-PWA/2a4874ba604994c6710b1ce38135db8fe2951f7b/public/uni7%20buildable.gif" alt="Unit 7 Facilities" className="w-full h-auto" />
                        </div>
                    </div>
                </div>
                {/* Next Unit Link */}
                <div className="mt-8 text-right px-4">
                    <a href="#unit-12" className="text-[10px] font-black text-blue-500 uppercase tracking-widest italic flex items-center justify-end gap-2 group">
                        Next: Unit 8 - Risks
                        <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                    </a>
                </div>
            </section>

            <section id="unit-12" className="mb-16 md:mb-32 scroll-mt-24 px-4 md:px-12 ">
                <header className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
                    <div className="flex items-center">
                        <span className="step-pill">12</span>
                        <div>
                            <span className="text-sm font-black text-blue-600 uppercase tracking-[0.4em] block mb-1">School Environment</span>
                            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 uppercase tracking-tighter italic">Unit 8: Terrain & Risk Profile</h2>
                        </div>
                    </div>
                </header>

                <div className="unit-card">
                    <div className="grid md:grid-cols-2 gap-16 items-center">
                        <div className="summary-card">
                            <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest mb-2 italic">At a Glance</h4>
                            <p className="text-sm text-slate-600 italic">Profile environmental hazards and terrain risks. Document your school's proximity to support facilities and its capacity to serve as an evacuation center during emergencies or natural calamities.</p>
                        </div>
                        <div className="phone-mockup">
                            <img src="https://raw.githubusercontent.com/sebtcheng/InsightEd-Mobile-PWA/2a4874ba604994c6710b1ce38135db8fe2951f7b/public/uni9.gif" alt="Unit 8 Risks" className="w-full h-auto" />
                        </div>
                    </div>
                </div>
            </section>

            {/* CRITICAL WARNING: NO LOGOUT */}
            <div className="mb-16 md:mb-32 p-6 md:p-8 bg-red-50 border-4 border-red-500 rounded-3xl shadow-2xl max-w-2xl mx-auto text-center transform hover:scale-[1.02] transition-transform">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-2">
                        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                    </div>
                    <h3 className="text-3xl font-black text-red-900 uppercase tracking-tighter italic">DO NOT LOG OUT</h3>
                    <p className="text-lg font-bold text-red-700 italic">Logging out may cause sync issues. Please keep the app open or minimized.</p>
                </div>
            </div>

            {/* Final Support */}
            <footer className="mt-40 pt-16 border-t border-slate-200 text-center">
                <div className="max-w-md mx-auto">
                    <div className="flex items-center justify-center gap-6 mb-8">
                        <div className="flex-shrink-0"><img src={LogoDepEd} alt="Logo 1" className="h-12 md:h-16 w-auto" /></div>
                        <div className="flex-shrink-0"><img src={LogoBagongPilipinas} alt="Logo 2" className="h-12 md:h-16 w-auto" /></div>
                        <div className="flex-shrink-0"><img src={LogoHROD} alt="Logo 3" className="h-12 md:h-16 w-auto" /></div>
                    </div>
                    <h2 className="text-2xl font-black text-navy-950 uppercase mb-4 tracking-widest">Technical Support Desk</h2>
                    <p className="text-lg text-slate-500 mb-8 italic">For critical inquiries, contact the Stratcom/Stride team via Google Chat.</p>
                    <div className="bg-blue-100 p-6 rounded-2xl text-blue-900 font-black font-mono text-xl shadow-lg border-2 border-blue-200">
                        support.stride@deped.gov.ph
                    </div>
                </div>
                <p className="mt-20 text-sm text-slate-300 uppercase tracking-[0.5em] font-black pb-12 italic">InsightEd: Complete Operational Guide for School Heads &copy; 2026</p>
            </footer>

        </main>
    </div>

    

        </div>
    );
};

export default SchoolHeadGuide;
