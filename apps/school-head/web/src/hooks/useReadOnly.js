import { useState, useEffect } from 'react';

const useReadOnly = () => {
    const [isReadOnly, setIsReadOnly] = useState(false);
    const [isSuperUser, setIsSuperUser] = useState(false);

    useEffect(() => {
        const checkReadOnly = () => {
            const isViewingAsSU = sessionStorage.getItem('isViewingAsSuperUser') === 'true';
            const userRole = localStorage.getItem('userRole');
            const actualIsSU = userRole === 'Super User';

            setIsSuperUser(actualIsSU);

            // If viewing as Super User (impersonation/audit mode), it's read-only
            if (isViewingAsSU) {
                setIsReadOnly(true);
            } else {
                setIsReadOnly(false);
            }
        };

        checkReadOnly();
        
        // Optional: listen for storage events to update state if sessionStorage changes
        const handleStorage = () => checkReadOnly();
        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    return { isReadOnly, isSuperUser };
};

export default useReadOnly;
