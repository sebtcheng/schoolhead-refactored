import { useState } from "react";
import { api } from "../lib/api";

export const useHistoricalData = (unitKey, user, targetSchoolId) => {
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historicalData, setHistoricalData] = useState(null);
  const [historicalLoading, setHistoricalLoading] = useState(false);

  const fetchHistoricalData = async () => {
    setHistoricalLoading(true);
    setHistoricalData(null);
    try {
      const storedId = targetSchoolId || user?.school_id || localStorage.getItem("schoolId");
      if (!storedId) {
        setHistoricalLoading(false);
        return;
      }
      const res = await fetch(api(`/ph_schools/${storedId}?school_yr=SY 25-26`));
      if (res.ok) {
        const payload = await res.json();
        if (payload.exists && payload.data) {
          setHistoricalData(payload.data);
        }
      }
    } catch (e) {
      console.warn("Failed to fetch historical data", e);
    } finally {
      setHistoricalLoading(false);
    }
  };

  const handleOpenHistoryModal = () => {
    setShowHistoryModal(true);
    fetchHistoricalData();
  };

  const handleCopyHistoricalData = (copyHandler) => {
    if (!historicalData) return;
    copyHandler(historicalData);
    setShowHistoryModal(false);
  };

  return {
    showHistoryModal,
    setShowHistoryModal,
    historicalData,
    historicalLoading,
    handleOpenHistoryModal,
    handleCopyHistoricalData,
  };
};
