import React from 'react';
import UserProfile from '../../../../school-head/web/src/modules/UserProfile';

const SIIFSettings = () => {
    return (
        <div className="siif-settings-wrapper relative z-10">
            {/* We render UserProfile but tell it to hide the Nexus sidebar so it doesn't clash with SIIF's layout */}
            <UserProfile hideSidebar={true} />
        </div>
    );
};

export default SIIFSettings;
