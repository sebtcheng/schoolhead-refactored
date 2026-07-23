import { formatUnit3Payload } from './formatUnit3Payload.js';

// Mock UI state for tests
const mockClassData = [
    // Single Grades
    { className: "Kindergarten", size: "< 25" },
    { className: "Grade 1", size: "< 25" },
    { className: "Grade 3", size: "25" },
    { className: "Grade 10", size: "> 25" },
    
    // Multi-Grade classes
    { className: "Grade 1 & 2", size: "25" },
    { className: "Grade 4, 5 & 6", size: "> 25" },
    
    // Should gracefully hit the 3-slot multigrade limit and ignore subsequent ones
    { className: "Grade 7 & 8", size: "< 25" },
    { className: "Grade 11 & 12", size: "25" } // This 4th multigrade will be ignored based on instructions
];

console.log("=== Mock Data Input ===");
console.log(JSON.stringify(mockClassData, null, 2));

const resultPayload = formatUnit3Payload(mockClassData);

console.log("\n=== Final JSON output for Backend ===");
console.log(JSON.stringify(resultPayload, null, 2));
