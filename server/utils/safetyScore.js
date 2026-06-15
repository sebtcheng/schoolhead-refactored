
/**
 * Calculates a risk index (1-10) based on school location hazard data.
 * @param {Object} data - The school location profile data.
 * @returns {number} - Risk index from 1 to 10.
 */
export const calculateRiskIndex = (data) => {
    let score = 1; // Base score (minimum risk)

    // Significant Risk Factors (Anthropogenic)
    if (data.has_insurgency_threats === true) score += 2; // Baseline for having threats

    if (data.anthropogenic_threats && Array.isArray(data.anthropogenic_threats)) {
        const totalThreatIncidences = data.anthropogenic_threats.reduce((acc, curr) => acc + (curr.incidences || 0), 0);
        if (totalThreatIncidences > 10) score += 3;
        else if (totalThreatIncidences > 5) score += 2;
        else if (totalThreatIncidences > 0) score += 1;
    }
    if (data.river_crossing_on_foot === true) {
        const count = data.river_crossing_count || 1;
        score += (count * 1.5);
    }

    // Infrastructure Passability
    if (data.road_passable_public_transpo_pct !== undefined) {
        if (data.road_passable_public_transpo_pct < 20) score += 3;
        else if (data.road_passable_public_transpo_pct < 50) score += 2;
        else if (data.road_passable_public_transpo_pct < 80) score += 1;
    }

    // Hazard Incidences
    if (data.natural_calamities && Array.isArray(data.natural_calamities)) {
        const totalIncidences = data.natural_calamities.reduce((acc, curr) => acc + (curr.incidences || 0), 0);
        if (totalIncidences > 10) score += 2;
        else if (totalIncidences > 5) score += 1;
    }

    // Proximity to Hazards
    if (data.near_cliff_ravine === true) {
        if (data.road_cliff_pct > 50) score += 2;
        else if (data.road_cliff_pct > 10) score += 1;
    }

    if (data.near_water === true) {
        if (data.water_proximity && Array.isArray(data.water_proximity)) {
            const veryClose = data.water_proximity.some(w => w.distance_km < 0.5);
            if (veryClose) score += 1.5;
            else score += 1;
        } else {
            score += 1;
        }
    }

    // Infrastructure Factors
    if (data.road_unpaved_pct > 70) score += 1;
    if (data.public_transpo_availability === 1) score += 1; // 1 scale = poor
    if (data.weather_isolation === true) score += 1.5;

    // Emergency Response
    if (data.emergency_response_mins > 60) score += 1;
    if (data.proximity_hospital_km > 20) score += 1;

    // Cap at 10 and round
    return Math.min(10, Math.round(score));
};
