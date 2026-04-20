import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import PageTransition from '../components/PageTransition';
import BottomNav from './BottomNav';
import { useAuth } from '../context/AuthContext';
import { cacheGallery, getCachedGallery } from '../db';
import { resolveAssetUrl } from '../utils/assetHelper';

// --- LAZY IMAGE COMPONENT ---
const LazyImage = ({ imageId, meta, index, onClick }) => {
    const [src, setSrc] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        const DEBUG_GALLERY = true; // Temporary diagnostic toggle
        if (meta.image_data) {
            if (DEBUG_GALLERY) console.log(`[Gallery] Resolving asset: ${imageId}`, meta);
            let base64 = meta.image_data;
            // Handle JSON string if present (legacy)
            if (typeof base64 === 'string' && base64.trim().startsWith('{')) {
                try {
                    const parsed = JSON.parse(base64);
                    base64 = parsed.image_data || parsed;
                } catch (e) {
                    console.error("Failed to parse image JSON", e);
                }
            }

            // File-path or unified binary asset — resolve against correct backend origin
            if (typeof base64 === 'string' && (base64.startsWith('/uploads/') || base64.startsWith('/api/asset/'))) {
                const finalSrc = resolveAssetUrl(base64);
                if (DEBUG_GALLERY) console.log(`[Gallery-v2] Resolved: ${finalSrc}`);
                setSrc(finalSrc);
                setLoading(false);
                return;
            }

            // Ensure data URI prefix
            if (typeof base64 === 'string' && !base64.startsWith("http") && !base64.startsWith("data:")) {
                base64 = `data:image/jpeg;base64,${base64}`;
            }

            setSrc(base64);
            setLoading(false);
        } else {
            if (DEBUG_GALLERY) console.warn(`[Gallery] MISSING image_data for asset: ${imageId}`, meta);
            setError(true);
            setLoading(false);
        }
    }, [meta, imageId]);

    if (loading) {
        return (
            <div className="bg-slate-50 w-full aspect-square flex flex-col items-center justify-center animate-pulse border border-slate-100">
                <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-400 rounded-full animate-spin"></div>
            </div>
        );
    }

    if (error || !src) {
        return (
            <div className="bg-slate-50 w-full aspect-square flex flex-col items-center justify-center text-slate-300">
                <span>⚠️ Failed</span>
            </div>
        );
    }

    return (
        <div
            className="bg-white rounded-xl overflow-hidden shadow-sm border border-slate-200 active:scale-95 transition-transform"
            onClick={() => onClick(index)}
        >
            <img
                src={src}
                alt="Site progress"
                className="w-full aspect-square object-cover cursor-pointer bg-slate-100"
                loading="lazy"
                onError={() => {
                    console.error(`[Gallery] FAILED TO LOAD: ${src}`, meta);
                    setError(true);
                }}
            />
            <div className="p-2 bg-white">
                {!meta.projectId && meta.school_name && (
                    <p className="text-[10px] font-bold text-[#004A99] truncate uppercase mb-1">
                        {meta.school_name}
                    </p>
                )}
                <p className="text-[9px] text-slate-400">
                    {new Date(meta.created_at).toLocaleDateString()}
                </p>
            </div>
        </div>
    );
};

const ProjectGallery = () => {
    const { user, token } = useAuth();
    const { projectId } = useParams();
    const navigate = useNavigate();
    const [images, setImages] = useState([]); // Now this will hold METADATA only
    const [loading, setLoading] = useState(true);
    const [selectedImageIndex, setSelectedImageIndex] = useState(null);
    const [deletingId, setDeletingId] = useState(null);

    const API_BASE = '';

    useEffect(() => {
        const fetchImages = async () => {
            if (!user) {
                setLoading(false);
                return;
            }

            // Load Metadata List
            try {
                const endpoint = projectId
                    ? `${API_BASE}/api/project-images/${projectId}`
                    : `${API_BASE}/api/engineer-images/${user.uid}`;

                const response = await fetch(endpoint);
                const data = await response.json();

                if (Array.isArray(data)) {
                    console.log("Loaded image list:", data.length);
                    setImages(data);
                } else {
                    console.warn("API did not return an array:", data);
                    setImages([]);
                }

            } catch (err) {
                console.warn("Network gallery load failed:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchImages();
    }, [projectId, user]);

    const handleDeleteImage = async (imageId) => {
        if (!window.confirm("Delete this photo? This cannot be undone.")) return;
        setDeletingId(imageId);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_BASE}/api/project-images/${imageId}`, {
                method: 'DELETE',
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            if (!res.ok) throw new Error("Failed to delete image");
            setImages(prev => prev.filter(img => img.id !== imageId));
            setSelectedImageIndex(null);
        } catch (err) {
            alert("Error deleting photo: " + err.message);
        } finally {
            setDeletingId(null);
        }
    };

    const goToNext = (e) => {
        if (e) e.stopPropagation();
        if (images.length <= 1) return;
        setSelectedImageIndex((prev) => (prev + 1) % images.length);
    };

    const goToPrev = (e) => {
        if (e) e.stopPropagation();
        if (images.length <= 1) return;
        setSelectedImageIndex((prev) => (prev - 1 + images.length) % images.length);
    };

    // Keyboard support
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (selectedImageIndex === null) return;
            if (e.key === 'ArrowRight') goToNext();
            if (e.key === 'ArrowLeft') goToPrev();
            if (e.key === 'Escape') setSelectedImageIndex(null);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedImageIndex, images.length]);

    const selectedImage = selectedImageIndex !== null ? images[selectedImageIndex] : null;
    const resolvedZoomSrc = selectedImage ? (
        (typeof selectedImage.image_data === 'string' && (selectedImage.image_data.startsWith('/uploads/') || selectedImage.image_data.startsWith('/api/asset/')))
            ? resolveAssetUrl(selectedImage.image_data)
            : (selectedImage.image_data.startsWith('http') || selectedImage.image_data.startsWith('data:') ? selectedImage.image_data : `data:image/jpeg;base64,${selectedImage.image_data}`)
    ) : null;

    return (
        <PageTransition>
            <div className="min-h-screen bg-slate-50 pb-24">
                {/* Header */}
                <div className="bg-[#004A99] p-6 pt-12 rounded-b-3xl shadow-lg mb-6 sticky top-0 z-10">
                    <button onClick={() => navigate(-1)} className="text-white mb-4 flex items-center gap-2 text-sm hover:text-blue-200 transition-colors">
                        ← Back to Dashboard
                    </button>
                    <h1 className="text-2xl font-bold text-white">
                        {projectId ? "Project Gallery" : "My Uploads"}
                    </h1>
                    <p className="text-blue-100 text-xs">
                        {projectId ? "Viewing site progress for this project" : "Viewing all your submitted site photos"}
                    </p>
                </div>

                <div className="px-5">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                            <p className="text-slate-500 text-sm">Loading gallery...</p>
                        </div>
                    ) : images.length === 0 ? (
                        <div className="bg-white rounded-2xl p-10 text-center border border-dashed border-slate-300">
                            <span className="text-4xl block mb-4">📷</span>
                            <p className="text-slate-600 font-medium">No photos found</p>
                            <p className="text-[11px] text-slate-400 mt-1">
                                {projectId
                                    ? "No photos have been uploaded for this specific project yet."
                                    : "You haven't uploaded or taken any photos yet."}
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 gap-3">
                            {images.map((meta, idx) => (
                                <LazyImage
                                    key={meta.id}
                                    imageId={meta.id}
                                    meta={meta}
                                    index={idx}
                                    onClick={(index) => setSelectedImageIndex(index)}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* FULLSCREEN IMAGE PREVIEW MODAL */}
                {selectedImage && createPortal(
                    <div
                        className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex flex-col items-center justify-center p-4 animate-in fade-in duration-200"
                        onClick={() => setSelectedImageIndex(null)}
                    >
                        {/* Status Bar */}
                        <div className="absolute top-0 left-0 right-0 p-6 flex items-center justify-between z-[102] bg-gradient-to-b from-black/60 to-transparent">
                            <div className="flex flex-col">
                                <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest leading-none">Photo {selectedImageIndex + 1} of {images.length}</p>
                                <p className="text-white text-sm font-bold mt-1">{selectedImage.school_name || 'Project Evidence'}</p>
                            </div>
                            <button
                                className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-white text-xl hover:bg-white/20 transition backdrop-blur-md"
                                onClick={() => setSelectedImageIndex(null)}
                            >
                                ✕
                            </button>
                        </div>

                        {/* Navigation Arrows */}
                        {images.length > 1 && (
                            <>
                                <button
                                    onClick={goToPrev}
                                    className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition z-[101] backdrop-blur-sm"
                                >
                                    <span className="text-2xl mr-1">‹</span>
                                </button>
                                <button
                                    onClick={goToNext}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition z-[101] backdrop-blur-sm"
                                >
                                    <span className="text-2xl ml-1">›</span>
                                </button>
                            </>
                        )}

                        <button
                            className="absolute bottom-10 right-6 w-12 h-12 bg-red-500/80 rounded-2xl flex items-center justify-center text-white hover:bg-red-600 transition z-[101] shadow-xl"
                            onClick={(e) => { e.stopPropagation(); handleDeleteImage(selectedImage.id); }}
                            disabled={deletingId === selectedImage.id}
                            title="Delete photo"
                        >
                            {deletingId === selectedImage.id ? '...' : '🗑'}
                        </button>

                        <div className="w-full max-w-4xl h-[60vh] flex items-center justify-center relative group">
                            <img
                                src={resolvedZoomSrc}
                                alt="Zoomed progress"
                                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl transition-all duration-300"
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>

                        <div className="mt-6 text-center text-white">
                            {selectedImage.school_name && (
                                <p className="text-md font-bold text-blue-400 uppercase mb-2">{selectedImage.school_name}</p>
                            )}
                            <p className="text-sm font-bold">Captured on</p>
                            <p className="text-xs text-slate-400">
                                {new Date(selectedImage.created_at).toLocaleDateString('en-US', {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                })}
                            </p>
                            <p className="text-xs text-slate-400 mt-1">
                                {new Date(selectedImage.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                        </div>
                    </div>,
                    document.body
                )}

                <BottomNav userRole={user?.role || "Engineer"} />
            </div>
        </PageTransition>
    );
};

export default ProjectGallery;