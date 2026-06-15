import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageTransition from '../components/PageTransition';
import { FiX, FiClock, FiUsers, FiCopy, FiSearch, FiCheck, FiSave } from 'react-icons/fi';
import { api } from "../lib/api";

const UserManagement = () => {
    const { user, token } = useAuth();
    const navigate = useNavigate();
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);

    // Users Search State
    const [userSearchId, setUserSearchId] = useState('');
    const [foundUser, setFoundUser] = useState(null);
    const [showUserModal, setShowUserModal] = useState(false);
    const [isSearchingUser, setIsSearchingUser] = useState(false);
    const [newPasscode, setNewPasscode] = useState('');
    const [isSavingPasscode, setIsSavingPasscode] = useState(false);

    useEffect(() => {
        if (user) {
            // ROLE PROTECTION: Only School Division Office or Regional Office can access this module
            if (user.role !== 'School Division Office' && user.role !== 'Regional Office' && user.role !== 'Super User') {
                console.warn(`🚫 Access Denied: User role ${user.role} is not authorized for User Management.`);
                navigate('/monitoring-dashboard');
                return;
            }
            setUserData(user);
            setLoading(false);
        }
    }, [user, navigate]);

    const handleSearchUser = async () => {
        if (!userSearchId || userSearchId.length !== 6) {
            alert("Please enter a valid 6-digit School ID.");
            return;
        }

        setIsSearchingUser(true);
        try {
            const res = await fetch(api(`/api/sdo/user-details/${userSearchId}?region=${encodeURIComponent(userData.region)}&division=${encodeURIComponent(userData.division)}`), {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            if (res.ok) {
                const data = await res.json();
                setFoundUser(data);
                setShowUserModal(true);
                setNewPasscode(''); // Reset
            } else {
                const errorData = await res.json();
                alert(errorData.error || "User not found or is outside your division jurisdiction.");
            }
        } catch (err) {
            console.error("Search failed:", err);
            alert("An error occurred while searching for the user.");
        } finally {
            setIsSearchingUser(false);
        }
    };

    const handleSetPasscode = async () => {
        if (!newPasscode || newPasscode.length < 4) {
            alert("Passcode must be at least 4 characters.");
            return;
        }

        setIsSavingPasscode(true);
        try {
            const res = await fetch(api(`/api/sdo/set-passcode`), {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    school_id: userSearchId,
                    passcode: newPasscode,
                    region: userData.region,
                    division: userData.division
                })
            });

            if (res.ok) {
                alert("Passcode updated successfully!");
                // Refresh local state
                setFoundUser(prev => ({ ...prev, passcode: newPasscode }));
                setNewPasscode('');
            } else {
                const data = await res.json();
                alert("Failed to update passcode: " + data.error);
            }
        } catch (err) {
            console.error("Set passcode error:", err);
            alert("An error occurred while saving the passcode.");
        } finally {
            setIsSavingPasscode(false);
        }
    };

    const copyToClipboard = (text, label) => {
        if (!text) return;
        navigator.clipboard.writeText(text).then(() => {
            alert(`${label} copied to clipboard!`);
        }).catch(err => {
            console.error('Failed to copy: ', err);
        });
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
                <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <PageTransition>
            <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-32">
                {/* Header */}
                <div className="bg-gradient-to-br from-[#10346B] to-[#0A234A] p-8 pb-20 rounded-b-[3rem] shadow-2xl text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                        <FiUsers size={200} />
                    </div>
                    <div className="relative z-20 mb-4">
                        <button
                            onClick={() => navigate('/monitoring-dashboard')}
                            className="flex items-center gap-2 text-white/80 hover:text-white transition-colors text-sm font-bold uppercase tracking-wider"
                        >
                            <FiX size={18} /> Back to Dashboard
                        </button>
                    </div>
                    <div className="relative z-10">
                        <h1 className="text-4xl font-black tracking-tighter">User Management</h1>
                        <p className="text-blue-200 text-lg font-medium mt-1">
                            Account lookup and security oversight
                        </p>
                    </div>
                </div>

                <div className="max-w-3xl mx-auto px-6 -mt-12 space-y-6 relative z-30">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl p-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-6">User Account Lookup</h2>
                        <p className="text-slate-600 dark:text-slate-300 mb-6">
                            Enter the School ID to retrieve account details (email, contact number, and passcode).
                        </p>

                        <div className="flex flex-col md:flex-row gap-4 items-end">
                            <div className="flex-1 w-full">
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">School ID</label>
                                <input
                                    type="text"
                                    value={userSearchId}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/\D/g, '');
                                        if (val.length <= 6) setUserSearchId(val);
                                    }}
                                    placeholder="e.g. 100000"
                                    className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white"
                                />
                            </div>
                            <button
                                onClick={handleSearchUser}
                                disabled={userSearchId.length !== 6 || isSearchingUser}
                                className="w-full md:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isSearchingUser ? (
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                    <FiSearch size={20} />
                                )}
                                Search User
                            </button>
                        </div>
                    </div>
                </div>

                {/* MODAL: User Details */}
                {showUserModal && foundUser && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="p-8">
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <h3 className="text-2xl font-black text-slate-800 dark:text-white">User Details</h3>
                                        <p className="text-slate-500 font-bold uppercase tracking-wider text-xs bg-slate-100 dark:bg-slate-700 px-3 py-1 rounded-full mt-2 inline-block">
                                            School ID: {foundUser.school_id}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setShowUserModal(false)}
                                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
                                    >
                                        <FiX className="text-slate-400" size={24} />
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-bold text-slate-400 uppercase">Region</label>
                                            <p className="font-bold text-slate-700 dark:text-slate-200">{foundUser.region}</p>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-400 uppercase">Division</label>
                                            <p className="font-bold text-slate-700 dark:text-slate-200">{foundUser.division}</p>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 uppercase">District</label>
                                        <p className="font-bold text-slate-700 dark:text-slate-200">{foundUser.district || 'N/A'}</p>
                                    </div>

                                    <hr className="border-slate-100 dark:border-slate-700" />

                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-2xl group">
                                            <div className="overflow-hidden mr-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase block">Email Address</label>
                                                <p className="font-bold text-slate-700 dark:text-slate-200 truncate">{foundUser.email}</p>
                                            </div>
                                            <button 
                                                onClick={() => copyToClipboard(foundUser.email, 'Email')}
                                                className="p-2 bg-white dark:bg-slate-700 shadow-sm border border-slate-200 dark:border-slate-600 rounded-xl hover:bg-slate-50 transition-all active:scale-95"
                                            >
                                                <FiCopy size={16} className="text-blue-600" />
                                            </button>
                                        </div>

                                        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-2xl group">
                                            <div className="overflow-hidden mr-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase block">Contact Number</label>
                                                <p className="font-bold text-slate-700 dark:text-slate-200 truncate">{foundUser.contact_number || 'N/A'}</p>
                                            </div>
                                            <button 
                                                onClick={() => copyToClipboard(foundUser.contact_number, 'Contact Number')}
                                                className="p-2 bg-white dark:bg-slate-700 shadow-sm border border-slate-200 dark:border-slate-600 rounded-xl hover:bg-slate-50 transition-all active:scale-95"
                                            >
                                                <FiCopy size={16} className="text-blue-600" />
                                            </button>
                                        </div>

                                        <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                                            <div className="flex-1 mr-2">
                                                <label className="text-[10px] font-black text-blue-400 uppercase block">Active Passcode</label>
                                                {foundUser.passcode ? (
                                                    <p className="font-mono text-lg font-black text-blue-900 dark:text-blue-200 tracking-widest">{foundUser.passcode}</p>
                                                ) : (
                                                    <div className="mt-1 flex gap-2">
                                                        <input 
                                                            type="text"
                                                            maxLength={6}
                                                            placeholder="Set Passcode"
                                                            value={newPasscode}
                                                            onChange={(e) => setNewPasscode(e.target.value.toUpperCase())}
                                                            className="flex-1 px-3 py-1 text-sm rounded-lg border-2 border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-700 outline-none focus:border-blue-500"
                                                        />
                                                        <button 
                                                            onClick={handleSetPasscode}
                                                            disabled={isSavingPasscode || !newPasscode}
                                                            className="px-4 py-1 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                                        >
                                                            {isSavingPasscode ? '...' : 'Save'}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                            {foundUser.passcode && (
                                                <button 
                                                    onClick={() => copyToClipboard(foundUser.passcode, 'Passcode')}
                                                    className="p-3 bg-blue-600 shadow-lg text-white rounded-2xl hover:bg-blue-700 transition-all active:scale-95"
                                                >
                                                    <FiCopy size={20} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={() => setShowUserModal(false)}
                                    className="w-full mt-8 py-4 bg-slate-800 dark:bg-slate-700 text-white font-black rounded-2xl hover:bg-slate-700 dark:hover:bg-slate-600 transition-all shadow-xl"
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </PageTransition>
    );
};

export default UserManagement;
