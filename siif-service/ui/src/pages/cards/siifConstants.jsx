// ─── SIIF Shared Constants ────────────────────────────────────────────────────
import React from 'react';
import {
    TbSchool, TbBook, TbBulb, TbHeartHandshake, TbMoodSmile,
    TbDeviceLaptop, TbTrendingUp, TbUsers, TbChartBar,
} from 'react-icons/tb';

export const INTERVENTIONS = [
    { id: 'remediation',              label: 'Remediation',              desc: 'Help learners catch up by addressing gaps in foundational literacy and numeracy skills.' },
    { id: 'enhancement',              label: 'Enhancement',              desc: 'Strengthen classroom instruction so learners achieve grade-level competencies.' },
    { id: 'enrichment',              label: 'Enrichment',              desc: 'Deepen learning beyond minimum standards, fostering curiosity and problem-solving.' },
    { id: 'prevention',              label: 'Prevention',              desc: 'Identify and address learning difficulties early.' },
    { id: 'wellness',                label: 'Wellness',                desc: 'Address health, nutrition, and well-being factors that affect learning.' },
    { id: 'learning_environment',    label: 'Learning Environment',    desc: 'Provide safe, resource-rich environments for effective teaching.' },
    { id: 'acceleration',            label: 'Acceleration',            desc: 'Enable learners to rapidly attain foundational skills.' },
    { id: 'inclusive',               label: 'Inclusive',               desc: 'Ensure equitable access for all students, especially marginalized learners.' },
    { id: 'engagement',              label: 'Engagement',              desc: 'Improve participation and reduce absenteeism and dropout rates.' },
    { id: 'behavioral',              label: 'Behavioral',              desc: 'Remove social and emotional barriers that hinder learning.' },
    { id: 'instructional_improvement', label: 'Instructional Improvement', desc: 'Enhance teacher effectiveness through professional development.' },
    { id: 'technology_enabled',      label: 'Technology-enabled',      desc: 'Leverage technology to personalize learning and support data-informed teaching.' },
];

export const INTERVENTION_ICONS = {
    remediation:              <TbSchool size={20} />,
    enhancement:              <TbBook size={20} />,
    enrichment:               <TbBulb size={20} />,
    prevention:               <TbHeartHandshake size={20} />,
    wellness:                 <TbMoodSmile size={20} />,
    learning_environment:     <TbDeviceLaptop size={20} />,
    acceleration:             <TbTrendingUp size={20} />,
    inclusive:                <TbUsers size={20} />,
    engagement:               <TbChartBar size={20} />,
    behavioral:               <TbHeartHandshake size={20} />,
    instructional_improvement:<TbBook size={20} />,
    technology_enabled:       <TbDeviceLaptop size={20} />,
};

export const KEY_STAGES = [
    { id: 'ks1', label: 'Key Stage 1', grades: ['kindergarten', 'g1', 'g2', 'g3'] },
    { id: 'ks2', label: 'Key Stage 2', grades: ['g4', 'g5', 'g6'] },
    { id: 'ks3', label: 'Key Stage 3', grades: ['g7', 'g8', 'g9', 'g10'] },
    { id: 'ks4', label: 'Key Stage 4', grades: ['g11', 'g12'] },
];

export const GRADE_LABELS = {
    kindergarten: 'Kindergarten', g1: 'Grade 1', g2: 'Grade 2', g3: 'Grade 3',
    g4: 'Grade 4', g5: 'Grade 5', g6: 'Grade 6',
    g7: 'Grade 7', g8: 'Grade 8', g9: 'Grade 9', g10: 'Grade 10',
    g11: 'Grade 11', g12: 'Grade 12',
};

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
    selectedActivities: { sip_aip: [], action_research: [], remaining: [] },
    otherActivity:      '',
});
