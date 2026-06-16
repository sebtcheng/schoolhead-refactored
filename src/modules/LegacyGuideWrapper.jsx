import React from 'react';
import PageTransition from '../components/PageTransition';
import { FiHome, FiSettings, FiBookOpen } from "react-icons/fi";
import { LuCompass } from "react-icons/lu";
import { TbSchool } from "react-icons/tb";

const LegacyGuideWrapper = () => {
    return (
        <PageTransition>
            <div className="nodes-app-layout">
                <style dangerouslySetInnerHTML={{
                    __html: `
                    @import url('https://fonts.googleapis.com/css2?family=Quicksand:wght@500;700;900&family=Comic+Neue:wght@400;700&display=swap');
                    
                    :root {
                      --navy: #08315F;
                      --blue: #075985;
                      --blue-600: #0284C7;
                      --blue-400: #7DD3FC;
                      --blue-100: #E0F2FE;
                      --blue-50: #F0F9FF;
                      --gold: #FBBF24;
                      --amber: #D97706;
                      --red: #B91C1C;
                      --bg: #F0F9FF;
                      --card: #FFFFFF;
                      --text: #0F172A;
                      --muted: #64748B;
                      --line: #BAE6FD;
                      --font-heading: Quicksand, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                      --font-body: 'Comic Neue', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                      --radius: 22px;
                    }

                    .nodes-app-layout {
                      display: grid;
                      grid-template-columns: 260px 1fr;
                      min-height: 100vh;
                      font-family: var(--font-body);
                      color: var(--text);
                      background-color: var(--blue-50);
                      background-attachment: fixed;
                      background-image:
                        radial-gradient(43.5% 49.5% at 10% 12%, rgba(7, 89, 133, 0.30) 0 34%, transparent 78%),
                        radial-gradient(46.5% 54% at 92% 10%, rgba(251, 191, 36, 0.42) 0 36%, transparent 80%),
                        radial-gradient(40.5% 48% at 84% 92%, rgba(125, 211, 252, 0.30) 0 34%, transparent 78%),
                        radial-gradient(45% 52.5% at 8% 92%, rgba(217, 119, 6, 0.26) 0 28%, rgba(251, 191, 36, 0.18) 42%, transparent 80%);
                    }

                    .nodes-sidebar {
                      position: relative;
                      color: white;
                      padding: 24px;
                      display: flex;
                      flex-direction: column;
                      gap: 28px;
                      background: linear-gradient(180deg, color-mix(in srgb, var(--navy) 92%, transparent), color-mix(in srgb, var(--blue) 72%, var(--navy) 28%));
                      border-right: 1px solid rgba(255, 255, 255, 0.24);
                      box-shadow: 18px 0 42px rgba(11, 31, 77, 0.16);
                      overflow: hidden;
                    }

                    .nodes-brand {
                      background: transparent;
                      padding: 8px 0px;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      gap: 8px;
                    }

                    .nodes-brand img {
                      filter: drop-shadow(1px 0 0 #fff) drop-shadow(-1px 0 0 #fff) drop-shadow(0 1px 0 #fff) drop-shadow(0 -1px 0 #fff) drop-shadow(0 2px 4px rgba(0,0,0,0.15));
                    }

                    .nodes-nav {
                      display: flex;
                      flex-direction: column;
                      gap: 8px;
                    }

                    .nodes-nav a {
                      display: flex;
                      align-items: center;
                      gap: 12px;
                      padding: 12px 14px;
                      border-radius: 14px;
                      color: rgba(255, 255, 255, 0.78);
                      font-size: 14px;
                      font-weight: 700;
                      text-decoration: none;
                      transition: all 0.2s ease;
                      border: 1px solid transparent;
                    }

                    .nodes-nav a:hover {
                      color: white;
                      background: rgba(255, 255, 255, 0.08);
                    }

                    .nodes-nav a.active {
                      background: rgba(255, 255, 255, 0.16);
                      color: white;
                      border-color: rgba(255, 255, 255, 0.28);
                      box-shadow:
                        inset 0 -3px 0 var(--gold),
                        0 0 18px color-mix(in srgb, var(--blue-400) 26%, transparent);
                    }

                    .nodes-topbar {
                      position: relative;
                      isolation: isolate;
                      display: flex;
                      justify-content: space-between;
                      align-items: center;
                      gap: 25px;
                      min-height: 110px;
                      padding: 16px 32px;
                      border: 2.5px solid color-mix(in srgb, var(--blue) 64%, var(--navy) 36%);
                      background: linear-gradient(135deg, var(--blue-50), white);
                      box-shadow: 0 16px 34px color-mix(in srgb, var(--navy) 12%, transparent);
                      overflow: hidden;
                    }

                    .nodes-topbar::before {
                      content: "";
                      position: absolute;
                      left: 0;
                      top: 0;
                      bottom: 0;
                      width: 76%;
                      background:
                        radial-gradient(circle at 18% 20%, color-mix(in srgb, var(--blue-400) 24%, transparent), transparent 32%),
                        linear-gradient(135deg, var(--navy), var(--blue));
                      clip-path: polygon(0 0, 92% 0, 100% 100%, 0 100%);
                      z-index: 0;
                    }

                    .nodes-topbar::after {
                      content: "";
                      position: absolute;
                      width: 112px;
                      height: 112px;
                      right: 18px;
                      top: 50%;
                      transform: translateY(-50%);
                      border-radius: 999px;
                      background:
                        radial-gradient(circle, color-mix(in srgb, var(--gold) 20%, white 80%) 0 44%, color-mix(in srgb, var(--gold) 10%, transparent) 45% 68%, transparent 74%);
                      box-shadow:
                        0 0 0 12px color-mix(in srgb, var(--gold) 8%, transparent),
                        0 0 28px color-mix(in srgb, var(--gold) 24%, transparent);
                      z-index: 0;
                    }

                    .nodes-topbar > * {
                      position: relative;
                      z-index: 1;
                    }

                    .nodes-topbar h1 {
                      margin: 0;
                      font-family: var(--font-heading);
                      font-size: 28px;
                      line-height: 1.12;
                      font-weight: 900;
                      letter-spacing: 0.01em;
                      color: var(--blue);
                      -webkit-text-stroke: 1.15px rgba(214, 222, 235, 0.92);
                      paint-order: stroke fill;
                      text-shadow:
                        -1.25px -1.25px 0 rgba(214, 222, 235, 0.96),
                        1.25px -1.25px 0 rgba(214, 222, 235, 0.96),
                        -1.25px 1.25px 0 rgba(214, 222, 235, 0.96),
                        1.25px 1.25px 0 rgba(214, 222, 235, 0.96),
                        0 4px 10px rgba(11, 31, 77, 0.34),
                        0 12px 28px rgba(15, 23, 42, 0.26);
                    }

                    .nodes-topbar .eyebrow {
                      color: var(--gold);
                      font-size: 11px;
                      font-weight: 900;
                      letter-spacing: 0.2em;
                      text-transform: uppercase;
                      font-family: var(--font-heading);
                    }

                    @media (max-width: 768px) {
                      .nodes-app-layout {
                        grid-template-columns: 1fr;
                        padding-bottom: 82px;
                      }

                      .nodes-sidebar {
                        position: fixed;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        top: auto;
                        z-index: 40;
                        display: block;
                        padding: 8px 10px max(8px, env(safe-area-inset-bottom));
                        border: 0;
                        border-top: 1px solid rgba(255, 255, 255, 0.46);
                        background:
                          radial-gradient(ellipse at 18% 0%, color-mix(in srgb, var(--gold) 18%, transparent), transparent 48%),
                          radial-gradient(ellipse at 84% 0%, color-mix(in srgb, var(--red) 10%, transparent), transparent 46%),
                          linear-gradient(90deg, color-mix(in srgb, var(--blue) 80%, var(--navy) 20%), var(--blue-600));
                        box-shadow:
                          0 -18px 44px rgba(11, 31, 77, 0.26),
                          inset 0 1px 0 rgba(255, 255, 255, 0.18);
                        overflow: hidden;
                      }

                      .nodes-brand {
                        display: none;
                      }

                      .nodes-nav {
                        display: grid;
                        grid-template-columns: repeat(5, 1fr);
                        gap: 4px;
                        width: min(760px, 100%);
                        margin: 0 auto;
                      }

                      .nodes-nav a {
                        display: grid;
                        place-items: center;
                        gap: 2px;
                        min-height: 48px;
                        padding: 6px 2px;
                        border-radius: 16px;
                        color: rgba(255, 255, 255, 0.82);
                        font-size: 8px;
                        line-height: 1;
                        text-align: center;
                        border: 1px solid transparent;
                        background: transparent;
                        text-decoration: none;
                      }

                      .nodes-nav a.active {
                        background: linear-gradient(180deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0.10));
                        color: white;
                        border-color: rgba(255, 255, 255, 0.28);
                        box-shadow:
                          inset 0 -3px 0 var(--gold),
                          0 0 16px color-mix(in srgb, var(--blue-400) 24%, transparent);
                      }

                      .nodes-topbar {
                        min-height: 90px;
                        padding: 10px 16px;
                      }

                      .nodes-topbar h1 {
                        font-size: clamp(18px, 5.5vw, 22px);
                      }

                      .nodes-topbar::before {
                        width: 85%;
                      }
                    }
                    `
                }} />

                {/* Left Sidebar on Desktop / Bottom Bar on Mobile */}
                <div className="nodes-sidebar">
                    <div className="nodes-brand">
                        <img 
                            src={`${import.meta.env.BASE_URL || '/'}OFFICIAL LOGO/InsightED logo 5 x 3 in white outline.png`} 
                            alt="InsightED Logo" 
                            className="object-contain"
                            style={{ width: '16rem', height: '9rem' }}
                            onError={(e) => {
                                e.target.src = "OFFICIAL LOGO/InsightED logo 5 x 3 in white outline.png";
                            }}
                        />
                    </div>

                    <div className="nodes-nav">
                        <a href="#/nodes-dashboard">
                            <FiHome size={18} />
                            <span>Home</span>
                        </a>
                        <a href="#/my-activity">
                            <FiBookOpen size={18} />
                            <span>CLOUD</span>
                        </a>
                        <a href="#/modular-dashboard">
                            <LuCompass size={18} />
                            <span>Units</span>
                        </a>
                        <a href="#/guide/school-head" className="active">
                            <TbSchool size={18} />
                            <span>Guide</span>
                        </a>
                        <a href="#/profile">
                            <FiSettings size={18} />
                            <span>Settings</span>
                        </a>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-grow flex flex-col min-h-screen overflow-y-auto pb-10">
                    
                    {/* Header / Topbar */}
                    <div className="nodes-topbar">
                        <div className="flex flex-col">
                            <span className="eyebrow">
                                OPERATIONAL MANUAL
                            </span>
                            <h1 className="flex items-center gap-2">
                                <span className="text-white">GUIDE • SCHOOL HEAD</span>
                            </h1>
                            <p className="text-[10px] font-bold text-[#E0F2FE] uppercase tracking-[0.2em] mt-0.5 relative z-10">
                                STRIDE Operational Instructions & Resource Management Guidelines
                            </p>
                        </div>
                    </div>

                    {/* CONTENT AREA */}
                    <div className="flex-1 w-full h-[calc(100vh-110px)] relative">
                        <iframe 
                            src={`${import.meta.env.BASE_URL}mobile-guides/school-head.html`} 
                            className="absolute inset-0 w-full h-full border-none"
                            title="School Head Operational Guide"
                        />
                    </div>
                </div>
            </div>
        </PageTransition>
    );
};

export default LegacyGuideWrapper;
