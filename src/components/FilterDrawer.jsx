import React, { useState, useMemo, useEffect, useRef } from 'react';
import { FiX, FiCheck, FiChevronDown, FiCheckSquare, FiSquare } from 'react-icons/fi';
import { createPortal } from 'react-dom';

const ALL_REGIONS = ['NCR', 'CAR', 'REGION I', 'REGION II', 'REGION III', 'REGION IV-A', 'MIMAROPA', 'REGION V', 'REGION VI', 'REGION VII', 'REGION VIII', 'REGION IX', 'REGION X', 'REGION XI', 'REGION XII', 'CARAGA', 'BARMM'];

// ─── Multi-Select Dropdown ────────────────────────────────────────────────────
const MultiSelectDropdown = ({ label, options = [], selected = [], onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef(null);

    // Close when clicking outside
    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setIsOpen(false);
        };
        if (isOpen) document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isOpen]);

    const allSelected = options.length > 0 && selected.length === options.length;

    const toggle = (opt) => {
        if (selected.includes(opt)) onChange(selected.filter(s => s !== opt));
        else onChange([...selected, opt]);
    };

    const toggleAll = () => {
        if (allSelected) onChange([]);
        else onChange([...options]);
    };

    const displayLabel = selected.length === 0
        ? `All ${label}`
        : selected.length === 1
            ? selected[0]
            : `${label} (${selected.length})`;

    return (
        <div className="space-y-2" ref={ref}>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
            <div className="relative">
                <button
                    type="button"
                    onClick={() => setIsOpen(v => !v)}
                    className="w-full flex items-center justify-between bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3.5 text-[11px] font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-left"
                >
                    <span className="truncate pr-2">
                        {selected.length > 0 ? (
                            <span className="text-blue-600 dark:text-blue-400">{displayLabel}</span>
                        ) : (
                            <span className="text-slate-400">{displayLabel}</span>
                        )}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                        {selected.length > 0 && (
                            <span className="bg-blue-600 text-white text-[9px] font-black rounded-full w-4 h-4 flex items-center justify-center leading-none">
                                {selected.length}
                            </span>
                        )}
                        <FiChevronDown
                            size={14}
                            className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                        />
                    </div>
                </button>

                {isOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-700 z-[200] py-1.5 max-h-[220px] overflow-y-auto custom-scrollbar">
                        {/* Select All row */}
                        <div
                            onClick={toggleAll}
                            className="flex items-center justify-between px-4 py-2 hover:bg-blue-50 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-100 dark:border-slate-700"
                        >
                            <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                                {allSelected ? 'Deselect All' : 'Select All'}
                            </span>
                            {allSelected
                                ? <FiCheckSquare size={14} className="text-blue-500" />
                                : <FiSquare size={14} className="text-slate-300" />
                            }
                        </div>
                        {options.map(opt => {
                            const checked = selected.includes(opt);
                            return (
                                <div
                                    key={opt}
                                    onClick={() => toggle(opt)}
                                    className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
                                >
                                    <span className={`text-[11px] font-semibold truncate pr-2 ${checked ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-slate-600 dark:text-slate-300'}`}>
                                        {opt}
                                    </span>
                                    {checked
                                        ? <FiCheckSquare size={14} className="text-blue-500 shrink-0" />
                                        : <FiSquare size={14} className="text-slate-300 shrink-0" />
                                    }
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── Single-Select Dropdown ───────────────────────────────────────────────────
const DropdownField = ({ label, value, onChange, options, placeholder }) => (
    <div className="space-y-2">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
        <div className="relative group">
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3.5 text-[11px] font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 appearance-none transition-all"
            >
                <option value="">{placeholder}</option>
                {(options || []).map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                ))}
            </select>
            <FiChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-focus-within:text-blue-500" />
        </div>
    </div>
);

// ─── Accomplishment Range Filter ──────────────────────────────────────────────
const AccomplishmentRange = ({ value, onChange }) => {
    const [min, max] = value;
    // Local string state so user can type freely before committing
    const [minInput, setMinInput] = useState(String(min));
    const [maxInput, setMaxInput] = useState(String(max));

    // Keep input boxes in sync when value changes from outside (preset clicks / reset)
    useEffect(() => { setMinInput(String(min)); }, [min]);
    useEffect(() => { setMaxInput(String(max)); }, [max]);

    const commitMin = (raw) => {
        let v = parseInt(raw, 10);
        if (isNaN(v)) v = 0;
        v = Math.max(0, Math.min(v, max));
        setMinInput(String(v));
        onChange([v, max]);
    };
    const commitMax = (raw) => {
        let v = parseInt(raw, 10);
        if (isNaN(v)) v = 100;
        v = Math.max(min, Math.min(v, 100));
        setMaxInput(String(v));
        onChange([min, v]);
    };

    const handleSliderMin = (e) => {
        const v = Math.min(Number(e.target.value), max);
        onChange([v, max]);
    };
    const handleSliderMax = (e) => {
        const v = Math.max(Number(e.target.value), min);
        onChange([min, v]);
    };

    const isActive = min > 0 || max < 100;

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between ml-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Accomplishment %</label>
                {isActive && (
                    <button
                        onClick={() => onChange([0, 100])}
                        className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest hover:underline"
                    >
                        Reset
                    </button>
                )}
            </div>

            {/* Input + Slider rows */}
            <div className="space-y-3">
                {/* Min row */}
                <div className="flex items-center gap-3">
                    <span className="text-[9px] font-black text-slate-400 uppercase w-6 shrink-0">Min</span>
                    <input
                        type="range"
                        min={0} max={100} step={1}
                        value={min}
                        onChange={handleSliderMin}
                        className="flex-1 h-1.5 accent-blue-600 cursor-pointer"
                    />
                    <div className="relative shrink-0">
                        <input
                            type="number"
                            min={0} max={max}
                            value={minInput}
                            onChange={(e) => setMinInput(e.target.value)}
                            onBlur={(e) => commitMin(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && commitMin(e.target.value)}
                            className={`w-14 text-center text-[11px] font-black rounded-xl border px-1 py-1.5 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all
                                ${isActive ? 'border-blue-300 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-700 text-blue-600 dark:text-blue-400' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300'}`}
                        />
                        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 pointer-events-none">%</span>
                    </div>
                </div>

                {/* Max row */}
                <div className="flex items-center gap-3">
                    <span className="text-[9px] font-black text-slate-400 uppercase w-6 shrink-0">Max</span>
                    <input
                        type="range"
                        min={0} max={100} step={1}
                        value={max}
                        onChange={handleSliderMax}
                        className="flex-1 h-1.5 accent-blue-600 cursor-pointer"
                    />
                    <div className="relative shrink-0">
                        <input
                            type="number"
                            min={min} max={100}
                            value={maxInput}
                            onChange={(e) => setMaxInput(e.target.value)}
                            onBlur={(e) => commitMax(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && commitMax(e.target.value)}
                            className={`w-14 text-center text-[11px] font-black rounded-xl border px-1 py-1.5 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all
                                ${isActive ? 'border-blue-300 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-700 text-blue-600 dark:text-blue-400' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300'}`}
                        />
                        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 pointer-events-none">%</span>
                    </div>
                </div>
            </div>

            {/* Quick preset badges */}
            <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                    { label: 'Not Started', range: [0, 0] },
                    { label: '1–25%', range: [1, 25] },
                    { label: '26–50%', range: [26, 50] },
                    { label: '51–75%', range: [51, 75] },
                    { label: '76–99%', range: [76, 99] },
                    { label: 'Completed', range: [100, 100] },
                ].map(({ label, range }) => {
                    const active = min === range[0] && max === range[1];
                    return (
                        <button
                            key={label}
                            onClick={() => onChange(range)}
                            className={`px-3 py-1.5 rounded-xl text-[9px] font-black transition-all border ${
                                active
                                    ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                                    : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-500 hover:border-blue-200'
                            }`}
                        >
                            {label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

// ─── Min Photos Filter ────────────────────────────────────────────────────────
const PHOTO_PRESETS = [
    { label: 'Any', value: 0 },
    { label: '>5', value: 6 },
    { label: '>10', value: 11 },
    { label: '>20', value: 21 },
    { label: '>50', value: 51 },
];

const MinPhotosFilter = ({ value, onChange }) => {
    const [customInput, setCustomInput] = useState(value > 0 ? String(value) : '');
    const isActive = value > 0;

    useEffect(() => {
        setCustomInput(value > 0 ? String(value) : '');
    }, [value]);

    const commitCustom = (raw) => {
        const v = parseInt(raw, 10);
        if (isNaN(v) || v <= 0) {
            onChange(0);
            setCustomInput('');
        } else {
            onChange(v);
            setCustomInput(String(v));
        }
    };

    return (
        <div className="space-y-3">
            <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                Min. Photos in Gallery
            </label>

            {/* Preset badges */}
            <div className="flex flex-wrap gap-1.5">
                {PHOTO_PRESETS.map(({ label, value: pv }) => {
                    const active = pv === 0 ? value === 0 : value === pv;
                    return (
                        <button
                            key={label}
                            onClick={() => { onChange(pv); setCustomInput(pv > 0 ? String(pv) : ''); }}
                            className={`px-3 py-1.5 rounded-xl text-[9px] font-black transition-all border ${
                                active
                                    ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                                    : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-500 hover:border-blue-200'
                            }`}
                        >
                            {label}
                        </button>
                    );
                })}
            </div>

            {/* Custom input */}
            <div className="flex items-center gap-2">
                <span className="text-[9px] font-black text-slate-400 uppercase shrink-0">Custom:</span>
                <input
                    type="number"
                    min={1}
                    placeholder="e.g. 15"
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    onBlur={(e) => commitCustom(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && commitCustom(e.target.value)}
                    className={`w-24 text-center text-[11px] font-black rounded-xl border px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all
                        ${isActive && !PHOTO_PRESETS.some(p => p.value === value)
                            ? 'border-blue-300 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-700 text-blue-600 dark:text-blue-400'
                            : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300'}`}
                />
                <span className="text-[9px] text-slate-400">photos or more</span>
            </div>
        </div>
    );
};

// ─── Main FilterDrawer ────────────────────────────────────────────────────────
const FilterDrawer = ({
    isOpen,
    onClose,
    onApply,
    projects = [],
    locations = [],
    initialRegions = [],
    initialDivisions = [],
    initialCategories = [],
    initialYears = [],
    initialBatches = [],
    initialAccRange = [0, 100],
    initialMinPhotos = 0,
    initialPendingApproval = false,
    yearOptions = [],
    batchOptions = [],
    categoryOptions = [],
    hideRegions = false,
    hideDivisions = false,
    hideProvinces = false,
    hideMunicipalities = false,
    showPendingApproval = false,
}) => {
    const [selectedRegions, setSelectedRegions] = useState(initialRegions);
    const [selectedCategories, setSelectedCategories] = useState(initialCategories);
    const [selectedDivision, setSelectedDivision] = useState(initialDivisions[0] || '');
    const [selectedProvince, setSelectedProvince] = useState('');
    const [selectedMunicipality, setSelectedMunicipality] = useState('');
    const [selectedDistrict, setSelectedDistrict] = useState('');
    const [selectedYears, setSelectedYears] = useState(initialYears);
    const [selectedBatchFunds, setSelectedBatchFunds] = useState(initialBatches);
    const [accRange, setAccRange] = useState(initialAccRange);
    const [minPhotos, setMinPhotos] = useState(initialMinPhotos);
    const [pendingApprovalOnly, setPendingApprovalOnly] = useState(initialPendingApproval);

    // Sync when drawer opens — intentional setState in effect to reset draft state
    // once per open. Array props excluded from deps to avoid infinite re-sync loop.
    useEffect(() => {
        if (isOpen) {
            /* eslint-disable react-hooks/set-state-in-effect */
            setSelectedRegions(initialRegions || []);
            setSelectedCategories(initialCategories || []);
            setSelectedDivision(initialDivisions[0] || '');
            setSelectedYears(initialYears || []);
            setSelectedBatchFunds(initialBatches || []);
            setAccRange(initialAccRange || [0, 100]);
            setMinPhotos(initialMinPhotos || 0);
            setPendingApprovalOnly(initialPendingApproval || false);
            /* eslint-enable react-hooks/set-state-in-effect */
        }
    }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

    const normalize = (val) => val?.toString().trim().toUpperCase() || '';

    const options = useMemo(() => {
        const sourceData = Array.isArray(locations) && locations.length > 0
            ? locations
            : (Array.isArray(projects) ? projects : []);

        const filtered = sourceData.filter(loc =>
            selectedRegions.length === 0 || selectedRegions.some(reg => normalize(reg) === normalize(loc.region))
        );

        const divisions = [...new Set(filtered.map(l => l.division).filter(Boolean))].map(s => s.trim().toUpperCase());

        const provinces = [...new Set(filtered
            .filter(l => !selectedDivision || normalize(l.division) === normalize(selectedDivision))
            .map(l => l.province).filter(Boolean))].map(s => s.trim().toUpperCase());

        const municipalities = [...new Set(filtered
            .filter(l => !selectedDivision || normalize(l.division) === normalize(selectedDivision))
            .filter(l => !selectedProvince || normalize(l.province) === normalize(selectedProvince))
            .map(l => l.municipality).filter(Boolean))].map(s => s.trim().toUpperCase());

        const projectsSource = Array.isArray(projects) ? projects : [];
        const years = yearOptions.length > 0
            ? yearOptions.map(String)
            : [...new Set(projectsSource.map(p => p.funding_year || p.fundingYear).filter(Boolean).map(String))].sort((a, b) => b.localeCompare(a));

        const batches = batchOptions.length > 0
            ? batchOptions.map(String)
            : [...new Set(projectsSource.map(p => p.batch_of_funds || p.batchOfFunds).filter(Boolean).map(s => String(s).trim()))].sort();

        const categories = categoryOptions.length > 0
            ? categoryOptions
            : [...new Set(projectsSource.map(p => p.project_category || p.projectCategory).filter(Boolean))].map(s => s.trim()).filter(Boolean);

        return {
            divisions: [...new Set(divisions)].sort(),
            provinces: [...new Set(provinces)].sort(),
            municipalities: [...new Set(municipalities)].sort(),
            years,
            batches,
            categories,
        };
    }, [projects, locations, selectedRegions, selectedDivision, selectedProvince, categoryOptions, yearOptions, batchOptions]);

    if (!isOpen) return null;

    const handleApply = () => {
        if (onApply) {
            onApply({
                regions: selectedRegions,
                divisions: selectedDivision ? [selectedDivision] : [],
                categories: selectedCategories,
                years: selectedYears,
                province: selectedProvince,
                municipality: selectedMunicipality,
                district: selectedDistrict,
                batches: selectedBatchFunds,
                accRange,
                minPhotos,
                pendingApprovalOnly,
            });
        }
        onClose();
    };

    const clearFilters = () => {
        setSelectedRegions([]);
        setSelectedCategories([]);
        setSelectedDivision('');
        setSelectedProvince('');
        setSelectedMunicipality('');
        setSelectedDistrict('');
        setSelectedYears(["2022", "2023", "2024", "2025", "2026"]);
        setSelectedBatchFunds([]);
        setAccRange([0, 100]);
        setMinPhotos(0);
        setPendingApprovalOnly(false);
    };

    const activeCount = [
        selectedRegions.length > 0,
        selectedCategories.length > 0,
        selectedDivision,
        selectedYears.length > 0,
        selectedBatchFunds.length > 0,
        accRange[0] > 0 || accRange[1] < 100,
        minPhotos > 0,
        pendingApprovalOnly,
    ].filter(Boolean).length;

    const drawer = (
        <div className="fixed inset-0 z-[10000] overflow-hidden">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={onClose} />

            <div className="absolute inset-y-0 right-0 max-w-full flex">
                <div className="w-screen max-w-md bg-white dark:bg-slate-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">

                    {/* Header */}
                    <div className="px-6 py-6 border-b border-slate-100 dark:border-slate-700">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <h2 className="text-xl font-black text-slate-800 dark:text-white leading-tight tracking-tighter">
                                    Filter Projects
                                </h2>
                                {activeCount > 0 && (
                                    <p className="text-[10px] font-bold text-blue-500 mt-0.5">{activeCount} filter{activeCount > 1 ? 's' : ''} active</p>
                                )}
                            </div>
                            <button
                                onClick={onClose}
                                className="p-3 bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-2xl text-slate-400 transition-all active:scale-90"
                            >
                                <FiX size={18} />
                            </button>
                        </div>
                        <button
                            onClick={clearFilters}
                            className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest hover:underline"
                        >
                            Reset All
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-7 custom-scrollbar">

                        {/* Region */}
                        {!hideRegions && (
                            <MultiSelectDropdown
                                label="Region"
                                options={ALL_REGIONS}
                                selected={selectedRegions}
                                onChange={setSelectedRegions}
                            />
                        )}

                        {/* Project Category */}
                        <MultiSelectDropdown
                            label="Project Category"
                            options={options.categories}
                            selected={selectedCategories}
                            onChange={setSelectedCategories}
                        />

                        {/* Funding Year */}
                        <MultiSelectDropdown
                            label="Funding Year"
                            options={options.years}
                            selected={selectedYears}
                            onChange={setSelectedYears}
                        />

                        {/* Batch of Funds */}
                        <MultiSelectDropdown
                            label="Batch of Funds"
                            options={options.batches}
                            selected={selectedBatchFunds}
                            onChange={setSelectedBatchFunds}
                        />

                        {/* Accomplishment Range */}
                        <AccomplishmentRange value={accRange} onChange={setAccRange} />

                        {/* Min Photos Filter */}
                        <MinPhotosFilter value={minPhotos} onChange={setMinPhotos} />

                        {/* Pending Approval Filter — EFD only */}
                        {showPendingApproval && (
                            <div className="space-y-2">
                                <p className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Approval Status</p>
                                <button
                                    onClick={() => setPendingApprovalOnly(v => !v)}
                                    className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border-2 transition-all font-bold text-sm ${
                                        pendingApprovalOnly
                                            ? 'bg-red-50 border-red-400 text-red-700 dark:bg-red-900/20 dark:border-red-500 dark:text-red-300'
                                            : 'bg-slate-50 border-slate-200 text-slate-500 dark:bg-slate-700/50 dark:border-slate-600 dark:text-slate-400'
                                    }`}
                                >
                                    <span className="flex items-center gap-2">
                                        <span className={`w-2 h-2 rounded-full ${pendingApprovalOnly ? 'bg-red-500 animate-pulse' : 'bg-slate-300'}`} />
                                        Requires Validation
                                    </span>
                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${pendingApprovalOnly ? 'bg-red-400 text-white' : 'bg-slate-200 text-slate-400'}`}>
                                        {pendingApprovalOnly ? 'ON' : 'OFF'}
                                    </span>
                                </button>
                            </div>
                        )}

                        {/* Location Hierarchy */}
                        <div className="space-y-4">
                            {!hideDivisions && (
                                <DropdownField
                                    label="Division"
                                    value={selectedDivision}
                                    onChange={setSelectedDivision}
                                    options={options.divisions}
                                    placeholder="All Divisions"
                                />
                            )}
                            {!hideProvinces && (
                                <DropdownField
                                    label="Province"
                                    value={selectedProvince}
                                    onChange={setSelectedProvince}
                                    options={options.provinces}
                                    placeholder="All Provinces"
                                />
                            )}
                            {!hideMunicipalities && (
                                <DropdownField
                                    label="Municipality / City"
                                    value={selectedMunicipality}
                                    onChange={setSelectedMunicipality}
                                    options={options.municipalities}
                                    placeholder="All Municipalities"
                                />
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-6 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40">
                        <button
                            onClick={handleApply}
                            className="w-full py-4 bg-blue-600 dark:bg-blue-500 text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-blue-500/30 hover:bg-blue-700 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                        >
                            <FiCheck size={16} /> Apply Filters
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(drawer, document.body);
};

export default FilterDrawer;
