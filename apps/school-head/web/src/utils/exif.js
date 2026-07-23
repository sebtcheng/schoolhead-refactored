import EXIF from 'exif-js';

/**
 * Extracts GPS and Capture Date metadata from a File object.
 * @param {File} file - The image file to extract metadata from.
 * @returns {Promise<Object>} - A promise that resolves with extracted metadata.
 */
export const extractPhotoMetadata = (file) => {
    return new Promise((resolve) => {
        if (!file || !file.type.startsWith('image/')) {
            return resolve(null);
        }

        EXIF.getData(file, function() {
            const allTags = EXIF.getAllTags(this);
            const lat = EXIF.getTag(this, "GPSLatitude");
            const lon = EXIF.getTag(this, "GPSLongitude");
            const latRef = EXIF.getTag(this, "GPSLatitudeRef") || "N";
            const lonRef = EXIF.getTag(this, "GPSLongitudeRef") || "E";
            const dateTaken = EXIF.getTag(this, "DateTimeOriginal") || EXIF.getTag(this, "DateTime");

            let latitude = null;
            let longitude = null;

            const toDecimal = (gpsData, ref) => {
                if (!gpsData || !Array.isArray(gpsData) || gpsData.length < 3) return null;
                
                const d = gpsData[0].numerator ? gpsData[0].numerator / gpsData[0].denominator : gpsData[0];
                const m = gpsData[1].numerator ? gpsData[1].numerator / gpsData[1].denominator : gpsData[1];
                const s = gpsData[2].numerator ? gpsData[2].numerator / gpsData[2].denominator : gpsData[2];
                
                let coordinate = d + (m / 60) + (s / 3600);
                if (ref === "S" || ref === "W") coordinate *= -1;
                return parseFloat(coordinate.toFixed(7));
            };

            if (lat && lon) {
                latitude = toDecimal(lat, latRef);
                longitude = toDecimal(lon, lonRef);
            }

            // Convert EXIF date string (YYYY:MM:DD HH:MM:SS) to ISO format if possible
            let timestamp = null;
            if (dateTaken && typeof dateTaken === 'string') {
                const parts = dateTaken.split(' ');
                if (parts.length === 2) {
                    const datePart = parts[0].replace(/:/g, '-');
                    const timePart = parts[1];
                    timestamp = `${datePart}T${timePart}`;
                }
            }

            resolve({
                latitude,
                longitude,
                takenAt: timestamp,
                exif: allTags 
            });
        });
    });
};
