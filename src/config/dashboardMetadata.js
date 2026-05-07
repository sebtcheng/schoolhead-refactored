import { FiHome, FiUsers, FiGrid, FiBookOpen, FiClock, FiMapPin, FiUser, FiLayers, FiBox, FiZap } from "react-icons/fi";
import { TbSchool, TbUsers, TbActivity, TbReportAnalytics, TbShieldCheck, TbMoneybag } from "react-icons/tb";

export const DASHBOARD_METADATA = {
    units: [
        { id: 1, title: "School Profile", icon: FiHome, emoji: '🏫', path: "/modular/unit-1", xp: 150 },
        { id: 2, title: "Enrollment", icon: FiUsers, emoji: '👨‍🎓', path: "/modular/unit-2", xp: 200 },
        { id: 3, title: "Organized Classes", icon: FiGrid, emoji: '📚', path: "/modular/unit-3", xp: 250 },
        { id: 4, title: "Learner Profile", icon: FiBookOpen, emoji: '📋', path: "/modular/unit-4", xp: 300 },
        { id: 5, title: "Shifting & Modality", icon: FiClock, emoji: '🔄', path: "/modular/unit-5", xp: 350 },
        { id: 6, title: "School Resources", icon: FiBox, emoji: '🧰', path: "/modular/unit-6", xp: 400 },
        { id: 7, title: "Physical Facilities", icon: FiBookOpen, emoji: '🏗️', path: "/modular/unit-7", xp: 450 },
        { id: 8, title: "School Terrain", subtitle: "Geography & Safety", icon: FiMapPin, emoji: '🛡️', path: "/modular/unit-8", xp: 500, color: "bg-blue-600", description: "Environmental and structural variables for school location and safety." },
        { id: 9, title: "Infrastructure & Safety", subtitle: "Wiring & Disaster Preparedness", icon: FiZap, emoji: '⚡', path: "/modular/unit-9", xp: 550, description: "Electrical wiring audit, safety hazards, CCTV status, and disaster equipment inventory." },
    ],
    forms: [
        { id: 1, name: "School Profile", route: "/school-profile", icon: TbSchool, color: "bg-blue-100 text-blue-600", flag: "f1_profile", unit: 1 },
        { id: 2, name: "School Head Info", route: "/school-information", icon: FiUser, color: "bg-indigo-100 text-indigo-600", flag: "f2_head", unit: 1 },
        { id: 3, name: "Enrollment", route: "/enrolment", icon: TbUsers, color: "bg-orange-100 text-orange-600", flag: "f3_enrollment", unit: 2 },
        { id: 4, name: "Organized Classes", route: "/organized-classes", icon: FiLayers, color: "bg-purple-100 text-purple-600", flag: "f4_classes", unit: 3 },
        { id: 5, name: "Learner Statistics", route: "/learner-statistics", icon: TbActivity, color: "bg-pink-100 text-pink-600", flag: "f10_stats", unit: 4 },
        { id: 6, name: "Shifting & Modality", route: "/shifting-modalities", icon: TbReportAnalytics, color: "bg-cyan-100 text-cyan-600", flag: "f9_shifting", unit: 5 },
        { id: 7, name: "School Resources", route: "/school-resources", icon: FiBox, color: "bg-emerald-100 text-emerald-600", flag: "f7_resources", unit: 6 },
        { id: 8, name: "Physical Facilities", route: "/physical-facilities", icon: FiLayers, color: "bg-amber-100 text-amber-600", flag: "f8_facilities", unit: 7 },
        { id: 9, name: "School Terrain", route: "/modular/unit-8", icon: FiMapPin, color: "bg-rose-100 text-rose-600", flag: "f11_location", unit: 8 },
        { id: 10, name: "SIIF Fund", route: "/siif", icon: TbMoneybag, color: "bg-yellow-100 text-yellow-700", flag: "f12_siif", unit: 9 },
    ]
};
