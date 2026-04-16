import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const EFDFilterContext = createContext();

export const EFDFilterProvider = ({ children }) => {
    // Basic Filters
    const [selectedRegions, setSelectedRegions] = useState(() => JSON.parse(localStorage.getItem('efd_selectedRegions') || '[]'));
    const [selectedCategories, setSelectedCategories] = useState(() => JSON.parse(localStorage.getItem('efd_selectedCategories') || '[]'));
    const [selectedYears, setSelectedYears] = useState(() => JSON.parse(localStorage.getItem('efd_selectedYears') || '[]'));
    const [selectedBatches, setSelectedBatches] = useState(() => JSON.parse(localStorage.getItem('efd_selectedBatches') || '[]'));
    const [searchQuery, setSearchQuery] = useState(() => localStorage.getItem('efd_searchQuery') || '');

    // Location Depth
    const [selectedDivision, setSelectedDivision] = useState(() => localStorage.getItem('efd_selectedDivision') || '');
    const [selectedProvince, setSelectedProvince] = useState(() => localStorage.getItem('efd_selectedProvince') || '');
    const [selectedMunicipality, setSelectedMunicipality] = useState(() => localStorage.getItem('efd_selectedMunicipality') || '');
    const [selectedDistrict, setSelectedDistrict] = useState(() => localStorage.getItem('efd_selectedDistrict') || '');

    // Extended Filters (Home specific but synced)
    const [selectedSource, setSelectedSource] = useState(() => localStorage.getItem('efd_selectedSource') || 'All');
    const [selectedDonated, setSelectedDonated] = useState(() => localStorage.getItem('efd_selectedDonated') || 'All');
    const [selectedDocStatus, setSelectedDocStatus] = useState(() => localStorage.getItem('efd_selectedDocStatus') || 'All');
    const [searchHistory, setSearchHistory] = useState(() => JSON.parse(localStorage.getItem('efd_searchHistory') || '[]'));

    // Accomplishment Percentage Range [min, max]
    const [accomplishmentRange, setAccomplishmentRange] = useState(() => JSON.parse(localStorage.getItem('efd_accomplishmentRange') || '[0,100]'));


    // Persistence Layer
    useEffect(() => {
        localStorage.setItem('efd_selectedRegions', JSON.stringify(selectedRegions));
        localStorage.setItem('efd_selectedCategories', JSON.stringify(selectedCategories));
        localStorage.setItem('efd_selectedYears', JSON.stringify(selectedYears));
        localStorage.setItem('efd_selectedBatches', JSON.stringify(selectedBatches));
        localStorage.setItem('efd_searchQuery', searchQuery);
        localStorage.setItem('efd_selectedDivision', selectedDivision);
        localStorage.setItem('efd_selectedProvince', selectedProvince);
        localStorage.setItem('efd_selectedMunicipality', selectedMunicipality);
        localStorage.setItem('efd_selectedDistrict', selectedDistrict);
        localStorage.setItem('efd_selectedSource', selectedSource);
        localStorage.setItem('efd_selectedDonated', selectedDonated);
        localStorage.setItem('efd_selectedDocStatus', selectedDocStatus);
        localStorage.setItem('efd_accomplishmentRange', JSON.stringify(accomplishmentRange));
    }, [
        selectedDistrict, selectedSource, selectedDonated, selectedDocStatus,
        searchHistory, accomplishmentRange
    ]);

    const addToSearchHistory = useCallback((query) => {
        if (!query || query.trim() === '') return;
        const normalized = query.trim();
        setSearchHistory(prev => {
            const next = [normalized, ...prev.filter(q => q !== normalized)].slice(0, 10);
            localStorage.setItem('efd_searchHistory', JSON.stringify(next));
            return next;
        });
    }, []);

    const clearFilters = useCallback(() => {
        setSelectedRegions([]);
        setSelectedCategories([]);
        setSelectedYears([]);
        setSelectedBatches([]);
        setSearchQuery('');
        setSelectedDivision('');
        setSelectedProvince('');
        setSelectedMunicipality('');
        setSelectedDistrict('');
        setSelectedSource('All');
        setSelectedDonated('All');
        setSelectedDocStatus('All');
        setAccomplishmentRange([0, 100]);

        // Clean storage
        const keys = [
            'efd_selectedRegions', 'efd_selectedCategories', 'efd_selectedYears',
            'efd_selectedBatches', 'efd_searchQuery', 'efd_selectedDivision',
            'efd_selectedProvince', 'efd_selectedMunicipality', 'efd_selectedDistrict',
            'efd_selectedSource', 'efd_selectedDonated', 'efd_selectedDocStatus',
            'efd_accomplishmentRange'
        ];
        keys.forEach(k => localStorage.removeItem(k));
    }, []);

    const value = {
        selectedRegions, setSelectedRegions,
        selectedCategories, setSelectedCategories,
        selectedYears, setSelectedYears,
        selectedBatches, setSelectedBatches,
        searchQuery, setSearchQuery,
        selectedDivision, setSelectedDivision,
        selectedProvince, setSelectedProvince,
        selectedMunicipality, setSelectedMunicipality,
        selectedDistrict, setSelectedDistrict,
        selectedSource, setSelectedSource,
        selectedDonated, setSelectedDonated,
        selectedDocStatus, setSelectedDocStatus,
        searchHistory, addToSearchHistory,
        accomplishmentRange, setAccomplishmentRange,
        clearFilters
    };

    return (
        <EFDFilterContext.Provider value={value}>
            {children}
        </EFDFilterContext.Provider>
    );
};

export const useEFDFilters = () => {
    const context = useContext(EFDFilterContext);
    if (!context) {
        throw new Error('useEFDFilters must be used within an EFDFilterProvider');
    }
    return context;
};
