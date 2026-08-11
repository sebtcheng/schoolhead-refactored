// ─── SIIF Shared Constants ────────────────────────────────────────────────────
// Canonical location: modules/siif/constants/siifConstants.js
// Previously lived in: pages/cards/siifConstants.jsx
// All card and page components should import from this path.

import React from 'react';
import {
    TbSchool, TbBook, TbBulb, TbHeartHandshake, TbMoodSmile,
    TbDeviceLaptop, TbTrendingUp, TbUsers, TbChartBar,
} from 'react-icons/tb';

export const INTERVENTIONS = [
    { id: 'remediation',              label: 'Remediation',              desc: 'To help learners who are significantly behind by addressing specific gaps in foundational literacy and numeracy skills.' },
    { id: 'enhancement',              label: 'Enhancement',              desc: 'To strengthen the quality of regular classroom instruction so that learners achieve grade-level competencies more effectively.' },
    { id: 'enrichment',               label: 'Enrichment',               desc: 'To deepen learning and extend higher-order thinking skills beyond minimum standards.' },
    { id: 'prevention',               label: 'Prevention',               desc: 'To identify and address learning difficulties early so that students do not fall behind.' },
    { id: 'wellness',                 label: 'Wellness',                 desc: "To improve learners' readiness and academic performance by addressing health, nutrition, and physical well-being factors." },
    { id: 'learning_environment',     label: 'Learning Environment',     desc: 'To provide a safe and learner-friendly environment that supports effective teaching and learning.' },
    { id: 'acceleration',             label: 'Acceleration',             desc: 'To enable learners to rapidly attain foundational skills by focusing on the most essential competencies needed to progress.' },
    { id: 'inclusive',                label: 'Inclusive',                desc: 'To ensure equitable access to learning opportunities for all students, especially those who are marginalized, at risk, or have special needs.' },
    { id: 'engagement',               label: 'Engagement',               desc: 'To improve participation, retention, and learning outcomes by reducing absenteeism and dropout, increasing learner motivation, and strengthening parent and community support.' },
    { id: 'behavioral',               label: 'Behavioral',               desc: 'To remove social, emotional, and behavioral barriers that hinder learning and to promote positive learning environments.' },
    { id: 'instructional_improvement', label: 'Instructional Improvement', desc: 'To enhance teacher effectiveness in literacy and numeracy instruction through continuous professional development and support.' },
    { id: 'technology_enabled',       label: 'Technology-enabled',       desc: 'To leverage appropriate technologies to personalize learning, improve access to quality instruction, and support data-informed teaching.' },
];

export const INTERVENTION_ICONS = {
    remediation:               <TbSchool size={20} />,
    enhancement:               <TbBook size={20} />,
    enrichment:                <TbBulb size={20} />,
    prevention:                <TbHeartHandshake size={20} />,
    wellness:                  <TbMoodSmile size={20} />,
    learning_environment:      <TbDeviceLaptop size={20} />,
    acceleration:              <TbTrendingUp size={20} />,
    inclusive:                 <TbUsers size={20} />,
    engagement:                <TbChartBar size={20} />,
    behavioral:                <TbHeartHandshake size={20} />,
    instructional_improvement: <TbBook size={20} />,
    technology_enabled:        <TbDeviceLaptop size={20} />,
};

export const KEY_STAGES = [
    { id: 'ks1', label: 'Key Stage 1', grades: ['kindergarten', 'g1', 'g2', 'g3'] },
    { id: 'ks2', label: 'Key Stage 2', grades: ['g4', 'g5', 'g6'] },
    { id: 'ks3', label: 'Key Stage 3', grades: ['g7', 'g8', 'g9', 'g10'] },
    { id: 'ks4', label: 'Key Stage 4', grades: ['g11', 'g12'] },
];

export const GRADE_LABELS = {
    kindergarten: 'Kindergarten', g1: 'Grade 1', g2: 'Grade 2', g3: 'Grade 3',
    g4: 'Grade 4',  g5: 'Grade 5',  g6: 'Grade 6',
    g7: 'Grade 7',  g8: 'Grade 8',  g9: 'Grade 9',  g10: 'Grade 10',
    g11: 'Grade 11', g12: 'Grade 12',
};

// Subject areas for Remediation intervention (includes 'Others' — no text input rendered for Others)
export const REMEDIATION_SUBJECTS = [
    'Reading',
    'Mathematics',
    'Science',
    'Others',
];

export const SIP_AIP_ACTIVITIES = [
    'Development or enhancement of learning materials',
    'Conduct of school-level Learning Action Cell (LAC) sessions',
    'Purchase of instructional supplies and materials for classroom use',
    'Purchase of food and ingredients for school-based feeding programs',
    'Minor repairs and improvements to enhance the learning environment',
    'Printing or reproduction of learning materials',
    'Others (specify)',
];

export const REMAINING_ACTIVITIES = [
    'Procurement of semi-expandable items',
    'Conduct of workshops and capacity-building activities',
    'Other day-to-day operational needs',
];

export const ACTION_RESEARCH_ACTIVITY =
    'Implementation of Action Research or innovative interventions designed to improve learner performance';

export const emptyIntData = () => ({
    selectedGrades:     [],
    beneficiaryCounts:  {},
    aralCounts:         {},
    selectedActivities: { sip_aip: [], action_research: [], remaining: [] },
    otherActivity:      '',
});
