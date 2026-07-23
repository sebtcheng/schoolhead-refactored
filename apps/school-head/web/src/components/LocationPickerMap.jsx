import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default Leaflet icon not displaying correctly in some bundlers
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

const PHILIPPINES_CENTER = [12.8797, 121.7740];
const DEFAULT_ZOOM = 6;

function DraggableMarker({ position, setPosition, onLocationSelect, disabled }) {
    const markerRef = useRef(null);

    const eventHandlers = useMemo(
        () => ({
            dragend() {
                const marker = markerRef.current;
                if (marker != null) {
                    const newPos = marker.getLatLng();
                    setPosition(newPos);
                    onLocationSelect(newPos.lat, newPos.lng);
                }
            },
        }),
        [onLocationSelect, setPosition],
    );

    return (
        <Marker
            draggable={!disabled}
            eventHandlers={disabled ? {} : eventHandlers}
            position={position}
            ref={markerRef}
        >
            <Popup>School Location</Popup>
        </Marker>
    );
}

function MapEvents({ setPosition, onLocationSelect, disabled }) {
    const map = useMap();

    // Fix for off-center pins: invalidate size when the container element changes size
    useEffect(() => {
        if (!map) return;
        const resizeObserver = new ResizeObserver(() => {
            map.invalidateSize();
        });
        const container = map.getContainer();
        resizeObserver.observe(container);
        return () => resizeObserver.unobserve(container);
    }, [map]);

    useMapEvents({
        click(e) {
            if (!disabled) {
                setPosition(e.latlng);
                onLocationSelect(e.latlng.lat, e.latlng.lng);
            }
        },
    });
    return null;
}

// COMPONENT: Aggressively center map and invalidate size (handles CSS transitions)
function RobustCenter({ position }) {
    const map = useMap();
    useEffect(() => {
        const lat = position.lat || position[0];
        const lng = position.lng || position[1];
        
        if (!lat || !lng || (lat === PHILIPPINES_CENTER[0] && lng === PHILIPPINES_CENTER[1])) return;

        const performCenter = () => {
            if (map) {
                map.invalidateSize();
                map.setView([lat, lng], 16);
            }
        };

        // Aggressive centering strategy: 
        // Call multiple times to catch the end of any CSS transitions (framer-motion, etc)
        performCenter();
        const t1 = setTimeout(performCenter, 100);
        const t2 = setTimeout(performCenter, 500);
        const t3 = setTimeout(performCenter, 1000);

        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            clearTimeout(t3);
        };
    }, [position, map]);
    return null;
}

const LocationPickerMap = ({ latitude, longitude, onLocationSelect, onChange, disabled = false, userLocation = null, className = "h-[400px]" }) => {
    // Support both prop names for compatibility
    const handleLocationSelect = onLocationSelect || onChange;
    // Initial position state
    const [position, setPosition] = useState(PHILIPPINES_CENTER);
    // Internal edit toggle — marker is locked until user clicks the edit button
    const [isEditing, setIsEditing] = useState(false);

    const markerDisabled = disabled || !isEditing;

    // Sync internal state with props when they change (validating they exist)
    useEffect(() => {
        if (latitude && longitude && !isNaN(latitude) && !isNaN(longitude)) {
            setPosition({ lat: parseFloat(latitude), lng: parseFloat(longitude) });
        }
    }, [latitude, longitude]);

    return (
        <div className={`w-full rounded-xl overflow-hidden border border-slate-200 shadow-inner relative z-0 ${className}`}>
            {/* Map */}
            <MapContainer
                center={position.lat ? position : PHILIPPINES_CENTER}
                zoom={DEFAULT_ZOOM}
                scrollWheelZoom={true}
                style={{ height: "100%", width: "100%" }}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* Click Listener */}
                <MapEvents setPosition={setPosition} onLocationSelect={onLocationSelect} disabled={markerDisabled} />

                {/* Aggressive Recenter */}
                <RobustCenter position={position} />

                {/* School Marker */}
                <DraggableMarker
                    position={position}
                    setPosition={setPosition}
                    onLocationSelect={handleLocationSelect}
                    disabled={markerDisabled}
                />

                {/* User Location Marker & Geofence Visual (Read-Only) */}
                {userLocation && (
                    <>
                        <Marker position={[userLocation.lat, userLocation.lng]} opacity={0.7}>
                            <Popup>You are Here</Popup>
                        </Marker>
                        <Circle
                            center={position}
                            radius={200}
                            pathOptions={{ color: 'blue', fillColor: 'blue', fillOpacity: 0.1 }}
                        />
                    </>
                )}
            </MapContainer>

            {/* Edit / Lock toggle button — only shown when not externally disabled */}
            {!disabled && (
                <button
                    type="button"
                    onClick={() => setIsEditing(prev => !prev)}
                    className={`absolute bottom-3 right-3 z-[1000] flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black shadow-lg border transition-all active:scale-95 ${
                        isEditing
                            ? 'bg-emerald-500 text-white border-emerald-600 hover:bg-emerald-600'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                >
                    {isEditing ? (
                        <>
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            DONE
                        </>
                    ) : (
                        <>
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            EDIT LOCATION
                        </>
                    )}
                </button>
            )}
        </div>
    );
};

export default LocationPickerMap;
