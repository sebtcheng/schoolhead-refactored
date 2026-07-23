/**
 * Formats the Unit 3 selected class sizes into a fixed-column database payload.
 * 
 * @param {Array<{className: string, size: string}>} classData - Array of class sizes selected 
 *                                                                e.g., [{ className: "Grade 1", size: "< 25" }]
 * @returns {Object} JSON payload mapping to the strict one-row-per-school structure
 */
export const formatUnit3Payload = (classData) => {
    // 1. Initialize fixed-column payload with nulls (empty state handling)
    const payload = {
        grade_kinder_size: null,
        grade_1_size: null,
        grade_2_size: null,
        grade_3_size: null,
        grade_4_size: null,
        grade_5_size: null,
        grade_6_size: null,
        grade_7_size: null,
        grade_8_size: null,
        grade_9_size: null,
        grade_10_size: null,
        grade_11_size: null,
        grade_12_size: null,
        multigrade_groupings_1: null,
        multigrade_size_1: null,
        multigrade_groupings_2: null,
        multigrade_size_2: null,
        multigrade_groupings_3: null,
        multigrade_size_3: null,
    };

    let multigradeCount = 1;

    // Normalize input to array
    const dataList = Array.isArray(classData) ? classData : Object.values(classData || {});

    // Helper to assign a multi-grade class
    const assignMultigrade = (name, size) => {
        if (multigradeCount <= 3) {
            payload[`multigrade_groupings_${multigradeCount}`] = name;
            payload[`multigrade_size_${multigradeCount}`] = size;
            multigradeCount++;
        }
    };

    dataList.forEach(item => {
        const className = item.className ? String(item.className).trim() : "";
        const size = item.size ? String(item.size).trim() : "";

        if (!className || !size) return;

        const lowerName = className.toLowerCase();

        // 2. Single Grade Sorting
        if (lowerName === "kindergarten" || lowerName === "kinder") {
            payload.grade_kinder_size = size;
        } 
        else if (lowerName.startsWith("grade ") && !lowerName.includes("&") && !lowerName.includes(",") && !lowerName.includes(" and ") && !lowerName.includes("-")) {
            // Extract the single grade number, e.g., "Grade 1" -> matches "1"
            const match = lowerName.match(/^grade\s+(\d+)$/);
            
            if (match && match[1]) {
                const gradeNum = parseInt(match[1], 10);
                const key = `grade_${gradeNum}_size`;
                
                // Safety check that this key represents a valid single grade col
                if (payload.hasOwnProperty(key)) {
                    payload[key] = size;
                } else {
                    assignMultigrade(className, size); // Fallback for invalid formats
                }
            } else {
                // If it starts with "Grade" but isn't just a number (e.g. "Grade 4, 5 & 6")
                assignMultigrade(className, size);
            }
        } 
        // 3. Multi-Grade Sorting (Max 3 Slots)
        else {
            assignMultigrade(className, size);
        }
    });

    return payload;
};
