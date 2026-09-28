import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

// Singleton AudioContext pre-unlocked on user interaction
let globalAudioCtx = null;

const getSharedAudioContext = () => {
  if (typeof window === 'undefined') return null;
  if (!globalAudioCtx) {
    const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
    if (AudioCtxClass) {
      globalAudioCtx = new AudioCtxClass();
    }
  }
  if (globalAudioCtx && globalAudioCtx.state === 'suspended') {
    globalAudioCtx.resume().catch(() => {});
  }
  return globalAudioCtx;
};

if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    getSharedAudioContext();
  };
  window.addEventListener('click', unlockAudio, { passive: true });
  window.addEventListener('keydown', unlockAudio, { passive: true });
  window.addEventListener('touchstart', unlockAudio, { passive: true });
}

const SchoolHeadChatWidget = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [activeBubble, setActiveBubble] = useState('SDO'); // 'SDO' | 'ADMIN'
  const [selectedRoomId, setSelectedRoomId] = useState(null); // Active room ID
  const [showNewChatSelector, setShowNewChatSelector] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // API Backend States
  const [contacts, setContacts] = useState({ SDOs: [], ADMIN: null });
  const [rooms, setRooms] = useState([]); // List of active rooms from backend
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Check if current user is a School Head or Admin/Super User
  const userRole = localStorage.getItem('userRole') || (user && user.role) || '';
  const roleLower = userRole.toLowerCase();
  const isSchoolHead = roleLower.includes('school') || roleLower.includes('head') || roleLower.includes('admin') || roleLower.includes('super');

  const prevUnreadTotalRef = useRef(null);
  const prevMsgCountRef = useRef(0);

  // Helper audio chime player for incoming messages (Loud & Crisp Web Audio)
  const playNotificationSound = () => {
    try {
      const audioCtx = getSharedAudioContext();
      if (!audioCtx) return;

      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }

      const now = audioCtx.currentTime;

      // Primary oscillator (D5 to A5 pitch sweep)
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now); // D5
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5
      gain1.gain.setValueAtTime(0.5, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      // Harmony oscillator (F#5 to D6) for a bright, clear bell ring
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(739.99, now + 0.05); // F#5
      osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.2); // D6
      gain2.gain.setValueAtTime(0.35, now + 0.05);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.start(now + 0.05);
      osc2.stop(now + 0.4);
    } catch (e) {
      console.warn('[SH CHAT] Audio play failed:', e);
    }
  };

  // Reset active room message count on room selection change
  useEffect(() => {
    prevMsgCountRef.current = 0;
  }, [selectedRoomId]);

  // 1. Fetch active rooms & contacts + Poll periodically (5s) for new unread messages
  useEffect(() => {
    if (!isSchoolHead) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    const fetchRoomsAndContacts = () => {
      const currentToken = localStorage.getItem('token');
      if (!currentToken) return;

      fetch(api('/api/chat/rooms'), {
        headers: { 'Authorization': `Bearer ${currentToken}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            const fetchedRooms = data.rooms || [];
            setRooms(fetchedRooms);

            // Calculate total unread count
            const totalUnread = fetchedRooms.reduce((acc, r) => acc + (parseInt(r.unread_count || 0, 10)), 0);
            if (prevUnreadTotalRef.current !== null && totalUnread > prevUnreadTotalRef.current) {
              playNotificationSound();
            }
            prevUnreadTotalRef.current = totalUnread;
          }
        })
        .catch(err => console.error('[SH CHAT] Load rooms error:', err));
    };

    // Load contacts list (filtered to Division SBM Coordinator)
    fetch(api('/api/chat/contacts?designation=Division SBM Coordinator'), {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.contacts) {
          setContacts({
            SDOs: data.contacts.SDOs || [],
            ADMIN: data.contacts.ADMIN
          });
        }
      })
      .catch(err => console.error('[SH CHAT] Fetch contacts error:', err));

    fetchRoomsAndContacts();
    const interval = setInterval(fetchRoomsAndContacts, 5000);
    return () => clearInterval(interval);
  }, [isSchoolHead]);

  // 2. Fetch messages for active room + polling every 4s when chat room is open
  useEffect(() => {
    if (!selectedRoomId || !isOpen) return;
    const token = localStorage.getItem('token');

    const fetchMessages = (showLoading = false) => {
      if (showLoading) setLoading(true);
      fetch(api(`/api/chat/rooms/${selectedRoomId}/messages`), {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            const fetchedMsgs = data.messages || [];
            const selfUid = user?.uid || localStorage.getItem('uid');

            // Play sound if a new message arrived from another person while room is open
            if (fetchedMsgs.length > prevMsgCountRef.current && prevMsgCountRef.current > 0) {
              const lastMsg = fetchedMsgs[fetchedMsgs.length - 1];
              if (lastMsg && lastMsg.sender_uid !== selfUid) {
                playNotificationSound();
              }
            }
            prevMsgCountRef.current = fetchedMsgs.length;
            setMessages(fetchedMsgs);

            // Update rooms list immediately to reflect cleared unread_count
            fetch(api('/api/chat/rooms'), {
              headers: { 'Authorization': `Bearer ${token}` }
            })
              .then(r => r.json())
              .then(d => {
                if (d.success) setRooms(d.rooms || []);
              });
          }
        })
        .catch(err => {
          console.error('[SH CHAT] Load messages error:', err);
          if (showLoading) setMessages([]);
        })
        .finally(() => {
          if (showLoading) setLoading(false);
        });
    };

    fetchMessages(true);
    const interval = setInterval(() => fetchMessages(false), 4000);
    return () => clearInterval(interval);
  }, [selectedRoomId, isOpen]);

  // 3. Auto-scroll to bottom of chat
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, loading, uploading]);

  if (!isSchoolHead) return null;

  // Start new chat with target SDO or Admin
  const handleStartNewChat = (contact) => {
    const token = localStorage.getItem('token');
    fetch(api('/api/chat/room'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ target_uid: contact.uid })
    })
      .then(res => res.json())
      .then(roomData => {
        if (roomData.success) {
          setSelectedRoomId(roomData.room_id);
          setShowNewChatSelector(false);

          // Refresh rooms list
          return fetch(api('/api/chat/rooms'), {
            headers: { 'Authorization': `Bearer ${token}` }
          });
        } else {
          alert(roomData.error || 'Failed to initialize chat room.');
          throw new Error(roomData.error || 'Failed to initialize room');
        }
      })
      .then(res => res && res.json())
      .then(data => {
        if (data && data.success) {
          setRooms(data.rooms || []);
        }
      })
      .catch(err => console.error('[SH CHAT] Start new chat error:', err));
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    let roomId = selectedRoomId;

    // For ADMIN tab, if no room is selected yet, we auto-create/find it on send
    if (activeBubble === 'ADMIN' && !roomId) {
      const contact = contacts[activeBubble];
      if (!contact) return;

      const token = localStorage.getItem('token');
      fetch(api('/api/chat/room'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ target_uid: contact.uid })
      })
        .then(res => res.json())
        .then(roomData => {
          if (roomData.success) {
            setSelectedRoomId(roomData.room_id);
            postMessageToBackend(roomData.room_id);
          }
        })
        .catch(err => console.error('[SH CHAT] Auto room create error:', err));
      return;
    }

    if (roomId) {
      postMessageToBackend(roomId);
    }
  };

  const postMessageToBackend = (roomId) => {
    if (!inputMessage.trim()) return;
    const token = localStorage.getItem('token');
    const body = {
      room_id: roomId,
      message_text: inputMessage
    };

    setInputMessage('');

    fetch(api('/api/chat/messages'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(body)
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          const userUid = user?.uid || localStorage.getItem('uid');
          setMessages(prev => [...prev, {
            ...data.message,
            sender_uid: userUid,
            first_name: user?.first_name || 'You',
            last_name: user?.last_name || '',
            sender_role: 'School Head',
            sender_position: user?.position || null
          }]);
        }
      })
      .catch(err => console.error('[SH CHAT] Send message error:', err));
  };

  // Upload file buffer to backend (Azure storage / local fallback)
  const uploadImageFile = (file) => {
    const roomId = selectedRoomId;
    if (!roomId) return;

    setUploading(true);
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('image', file);

    fetch(api('/api/chat/upload'), {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          return fetch(api('/api/chat/messages'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              room_id: roomId,
              message_type: 'image',
              attachment_url: data.url,
              message_text: 'Sent an image attachment'
            })
          });
        } else {
          throw new Error(data.error || 'Failed to upload image');
        }
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          const userUid = user?.uid || localStorage.getItem('uid');
          setMessages(prev => [...prev, {
            ...data.message,
            sender_uid: userUid,
            first_name: user?.first_name || 'You',
            last_name: user?.last_name || '',
            sender_role: 'School Head',
            sender_position: user?.position || null
          }]);
        }
      })
      .catch(err => {
        console.error('[SH CHAT] Upload attachment failed:', err);
        alert('Failed to send image attachment.');
      })
      .finally(() => setUploading(false));
  };

  // Capture copy-paste screenshot clipboards
  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          uploadImageFile(file);
        }
      }
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadImageFile(file);
    }
  };

  // Calculate category unread totals
  const getCategoryUnreadCount = (category) => {
    return rooms.filter(room => {
      if (category === 'SDO') {
        return room.participant_role === 'School Division Office' || room.participant_role === 'Regional Division Office' || room.participant_role === 'RO/SDO' || room.participant_role === 'Ro/sdo';
      } else {
        return room.participant_role === 'Admin' || room.participant_role === 'Super Admin';
      }
    }).reduce((acc, r) => acc + (parseInt(r.unread_count || 0, 10)), 0);
  };

  const totalUnreadBadge = rooms.reduce((acc, r) => acc + (parseInt(r.unread_count || 0, 10)), 0);

  // Filter rooms based on active tab bubble
  const displayedRooms = rooms.filter(room => {
    if (activeBubble === 'SDO') {
      return room.participant_role === 'School Division Office' || room.participant_role === 'Regional Division Office' || room.participant_role === 'RO/SDO' || room.participant_role === 'Ro/sdo';
    } else {
      return room.participant_role === 'Admin' || room.participant_role === 'Super Admin';
    }
  });

  const activeRoom = rooms.find(r => r.room_id === selectedRoomId);

  return (
    <>
      {/* Chat Widget Styles injected into the head */}
      <style dangerouslySetInnerHTML={{
        __html: `
        .sh-chat-fab {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 9999;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background-color: #1d4ed8;
          color: white;
          border: none;
          box-shadow: 0 4px 14px rgba(29, 78, 216, 0.4), 0 2px 5px rgba(0, 0, 0, 0.1);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .sh-chat-drawer {
          position: fixed;
          bottom: 96px;
          right: 24px;
          z-index: 9998;
          width: 380px;
          height: 520px;
          background-color: #ffffff;
          border-radius: 16px;
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.04);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          animation: slideUpSH 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @media (max-width: 768px) {
          .sh-chat-fab {
            bottom: 96px;
          }
          .sh-chat-drawer {
            bottom: 168px;
            width: calc(100% - 48px);
            right: 24px;
            height: calc(100vh - 200px);
          }
        }
      `}} />

      {/* Floating Action Button (FAB) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="sh-chat-fab"
        style={{
          transform: isOpen ? 'rotate(135deg) scale(0.9)' : 'scale(1)',
        }}
        title="Open Support Chat"
      >
        {isOpen ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            {totalUnreadBadge > 0 && (
              <span style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                backgroundColor: '#ef4444',
                color: 'white',
                fontSize: '11px',
                fontWeight: 'bold',
                minWidth: '20px',
                height: '20px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 4px',
                border: '2px solid white',
                boxShadow: '0 2px 4px rgba(239,68,68,0.4)',
                animation: 'pulse 2s infinite'
              }}>
                {totalUnreadBadge > 99 ? '99+' : totalUnreadBadge}
              </span>
            )}
          </>
        )}
      </button>

      {/* Chat Drawer Panel */}
      {isOpen && (
        <div className="sh-chat-drawer">
          <style dangerouslySetInnerHTML={{
            __html: `
            @keyframes slideUpSH {
              from { transform: translateY(20px); opacity: 0; }
              to { transform: translateY(0); opacity: 1; }
            }
            @keyframes popInSH {
              from { transform: scale(0.95) translateY(-6px); opacity: 0; }
              to { transform: scale(1) translateY(0); opacity: 1; }
            }
          `}} />

          {/* Header Part 1: Title & Role */}
          <div style={{
            backgroundColor: '#1e40af',
            padding: '16px 16px 12px 16px',
            color: 'white',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid #1d4ed8'
          }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', letterSpacing: '-0.02em' }}>InsightED Chat</h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', opacity: 0.8 }}>Logged in as School Head</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(255,255,255,0.1)', padding: '4px 8px', borderRadius: '12px', fontSize: '11px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22c55e' }}></span>
              Connected
            </div>
          </div>

          {/* Header Part 2: Bubble Tabs (SDO, ADMIN) */}
          <div style={{
            display: 'flex',
            backgroundColor: '#1e40af',
            padding: '4px 8px 12px 8px',
            gap: '12px',
            justifyContent: 'space-around',
          }}>
            {[
              { id: 'SDO', label: 'SDO', sub: 'Division Office', color: '#3b82f6' },
              { id: 'ADMIN', label: 'ADMIN', sub: 'Support (999009)', color: '#f59e0b' }
            ].map((bubble) => {
              const isActive = activeBubble === bubble.id;
              const unreadCount = getCategoryUnreadCount(bubble.id);

              return (
                <button
                  key={bubble.id}
                  onClick={() => {
                    setActiveBubble(bubble.id);
                    setSelectedRoomId(null);
                    setShowNewChatSelector(false);
                  }}
                  style={{
                    flex: 1,
                    padding: '8px 4px',
                    borderRadius: '12px',
                    border: 'none',
                    backgroundColor: isActive ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                    color: 'white',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease',
                    boxShadow: isActive ? 'inset 0 1px 3px rgba(0,0,0,0.2)' : 'none',
                    borderBottom: isActive ? `3px solid ${bubble.color}` : '3px solid transparent',
                    position: 'relative'
                  }}
                >
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: bubble.color,
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    fontSize: '12px',
                    marginBottom: '4px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    position: 'relative'
                  }}>
                    {bubble.label[0]}
                    {unreadCount > 0 && (
                      <span style={{
                        position: 'absolute',
                        top: '-3px',
                        right: '-3px',
                        backgroundColor: '#ef4444',
                        color: 'white',
                        fontSize: '9px',
                        fontWeight: 'bold',
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1.5px solid white'
                      }}>
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: isActive ? 'bold' : 'normal' }}>{bubble.label}</span>
                  <span style={{ fontSize: '8px', opacity: 0.7, whiteSpace: 'nowrap' }}>{bubble.sub}</span>
                </button>
              );
            })}
          </div>

          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="image/*"
            style={{ display: 'none' }}
          />

          {/* Chat Panel Body */}
          <div style={{
            flex: 1,
            backgroundColor: '#f8fafc',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {!selectedRoomId ? (
              /* HISTORY DIRECTORY & CONTACTS SELECTOR */
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569' }}>
                    {activeBubble === 'SDO' ? 'Active SDO Discussions' : `${activeBubble} Channel`}
                  </span>

                  {activeBubble === 'SDO' && (
                    <button
                      onClick={() => setShowNewChatSelector(!showNewChatSelector)}
                      style={{
                        padding: '6px 14px',
                        backgroundColor: showNewChatSelector ? '#ef4444' : '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: '20px',
                        fontSize: '11px',
                        fontWeight: '800',
                        cursor: 'pointer',
                        boxShadow: showNewChatSelector ? '0 4px 12px rgba(239, 68, 68, 0.4)' : '0 4px 12px rgba(16, 185, 129, 0.35)',
                        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transform: showNewChatSelector ? 'scale(1.02)' : 'scale(1)'
                      }}
                    >
                      <span>{showNewChatSelector ? '✕ Close Selector' : '✨ + New Message'}</span>
                    </button>
                  )}
                </div>

                {/* SDO Directory dropdown selector with rich aesthetics */}
                {showNewChatSelector && activeBubble === 'SDO' && (
                  <div style={{
                    background: 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)',
                    border: '2px solid #10b981',
                    borderRadius: '14px',
                    padding: '12px',
                    marginBottom: '16px',
                    boxShadow: '0 12px 24px -6px rgba(16, 185, 129, 0.25), 0 4px 8px -2px rgba(0,0,0,0.05)',
                    animation: 'popInSH 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: '#10b981',
                          boxShadow: '0 0 8px #10b981',
                        }} />
                        <span style={{ fontSize: '11px', color: '#047857', fontWeight: '800', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                          Select Division SBM Coordinator
                        </span>
                      </div>
                      <span style={{ fontSize: '9px', fontWeight: '800', backgroundColor: '#d1fae5', color: '#065f46', padding: '3px 8px', borderRadius: '10px' }}>
                        {contacts.SDOs.length} Available
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto', paddingRight: '2px' }}>
                      {contacts.SDOs.map(sdo => {
                        const initials = `${sdo.first_name?.[0] || ''}${sdo.last_name?.[0] || ''}`.toUpperCase();
                        const displayDesignation = sdo.designation || sdo.position || 'Division SBM Coordinator';
                        return (
                          <button
                            key={sdo.uid}
                            onClick={() => handleStartNewChat(sdo)}
                            style={{
                              textAlign: 'left',
                              padding: '10px 12px',
                              backgroundColor: '#ffffff',
                              border: '1.5px solid #a7f3d0',
                              borderRadius: '10px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '10px',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
                              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            }}
                            onMouseOver={e => {
                              e.currentTarget.style.backgroundColor = '#f0fdf4';
                              e.currentTarget.style.borderColor = '#10b981';
                              e.currentTarget.style.transform = 'translateY(-2px) scale(1.01)';
                              e.currentTarget.style.boxShadow = '0 6px 12px rgba(16, 185, 129, 0.15)';
                            }}
                            onMouseOut={e => {
                              e.currentTarget.style.backgroundColor = '#ffffff';
                              e.currentTarget.style.borderColor = '#a7f3d0';
                              e.currentTarget.style.transform = 'translateY(0) scale(1)';
                              e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.03)';
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: '800',
                                fontSize: '11px',
                                boxShadow: '0 2px 4px rgba(16, 185, 129, 0.3)'
                              }}>
                                {initials || 'SBM'}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '12px', fontWeight: '800', color: '#064e3b' }}>
                                  {sdo.first_name} {sdo.last_name}
                                </span>
                                <span style={{ fontSize: '10px', color: '#047857', fontWeight: '600' }}>
                                  {displayDesignation} {sdo.division ? `(${sdo.division})` : ''}
                                </span>
                              </div>
                            </div>

                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              backgroundColor: '#10b981',
                              color: 'white',
                              fontSize: '10px',
                              fontWeight: 'bold',
                              padding: '4px 10px',
                              borderRadius: '12px',
                              boxShadow: '0 2px 4px rgba(16, 185, 129, 0.3)'
                            }}>
                              <span>Chat</span>
                              <span style={{ fontSize: '12px' }}>&rarr;</span>
                            </div>
                          </button>
                        );
                      })}
                      {contacts.SDOs.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '16px 8px', color: '#64748b' }}>
                          <span style={{ fontSize: '12px', fontWeight: '600', display: 'block' }}>No Division SBM Coordinator found</span>
                          <span style={{ fontSize: '10px', opacity: 0.8 }}>No registered SBM Coordinator matches your division jurisdiction.</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Active chat rooms listing */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {displayedRooms.map((room) => {
                    const roomUnread = parseInt(room.unread_count || 0, 10);
                    return (
                      <div
                        key={room.room_id}
                        onClick={() => setSelectedRoomId(room.room_id)}
                        style={{
                          padding: '12px',
                          backgroundColor: roomUnread > 0 ? '#eff6ff' : '#ffffff',
                          borderRadius: '10px',
                          border: roomUnread > 0 ? '1.5px solid #bfdbfe' : '1px solid #e2e8f0',
                          cursor: 'pointer',
                          transition: 'transform 0.2s, box-shadow 0.2s',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px',
                          position: 'relative'
                        }}
                        onMouseOver={e => {
                          e.currentTarget.style.transform = 'translateY(-1px)';
                          e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.05)';
                        }}
                        onMouseOut={e => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '12px', fontWeight: roomUnread > 0 ? '800' : 'bold', color: roomUnread > 0 ? '#1e3a8a' : '#1e293b' }}>
                              {room.first_name} {room.last_name}
                            </span>
                            {roomUnread > 0 && (
                              <span style={{
                                backgroundColor: '#ef4444',
                                color: 'white',
                                fontSize: '10px',
                                fontWeight: 'bold',
                                padding: '1px 6px',
                                borderRadius: '10px'
                              }}>
                                {roomUnread} new
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: '9px', color: roomUnread > 0 ? '#2563eb' : '#94a3b8', fontWeight: roomUnread > 0 ? 'bold' : 'normal' }}>
                            {room.last_message_time ? new Date(room.last_message_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>
                        <span style={{ fontSize: '10px', color: '#64748b' }}>
                          {room.participant_role}
                        </span>
                        <span style={{
                          fontSize: '11px',
                          color: roomUnread > 0 ? '#1e40af' : '#94a3b8',
                          fontWeight: roomUnread > 0 ? '600' : 'normal',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          marginTop: '4px'
                        }}>
                          {room.last_message ? room.last_message : 'Click to start conversation.'}
                        </span>
                      </div>
                    );
                  })}
                  {displayedRooms.length === 0 && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', padding: '24px 0' }}>
                      <span style={{ fontSize: '12px' }}>No active discussions found.</span>
                      {activeBubble !== 'SDO' && contacts[activeBubble] && (
                        <button
                          onClick={() => handleStartNewChat(contacts[activeBubble])}
                          style={{
                            marginTop: '10px',
                            padding: '6px 12px',
                            backgroundColor: '#1d4ed8',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                          }}
                        >
                          Start Support Chat
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* ACTIVE CHAT WINDOW */
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{
                  padding: '8px 12px',
                  borderBottom: '1px solid #e2e8f0',
                  backgroundColor: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <button
                    onClick={() => {
                      setSelectedRoomId(null);
                      // Refresh rooms list
                      const token = localStorage.getItem('token');
                      fetch(api('/api/chat/rooms'), {
                        headers: { 'Authorization': `Bearer ${token}` }
                      })
                        .then(res => res.json())
                        .then(data => { if (data.success) setRooms(data.rooms || []); });
                    }}
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      color: '#1d4ed8',
                      border: '1px solid #1d4ed8',
                      borderRadius: '6px',
                      backgroundColor: 'transparent',
                      cursor: 'pointer'
                    }}
                  >
                    &larr; Back
                  </button>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {activeRoom?.first_name} {activeRoom?.last_name}
                  </span>
                </div>

                {/* Messages Flow */}
                <div style={{
                  flex: 1,
                  padding: '16px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  {loading ? (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifySelf: 'center', color: '#94a3b8', fontSize: '13px', margin: 'auto' }}>
                      Loading thread...
                    </div>
                  ) : messages.length === 0 ? (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center', color: '#94a3b8', margin: 'auto' }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '8px', opacity: 0.6 }}>
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                      </svg>
                      <span style={{ fontSize: '12px', fontWeight: '500' }}>No messages yet.</span>
                      <span style={{ fontSize: '10px', marginTop: '4px' }}>Send a text or paste a screenshot to start.</span>
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const selfUid = user?.uid || localStorage.getItem('uid');
                      const isSelf = msg.sender_uid === selfUid;
                      const timestamp = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      const displayRole = isSelf ? 'You' : `${msg.sender_role || activeBubble}${msg.sender_position ? ` (${msg.sender_position})` : ''}`;

                      return (
                        <div
                          key={msg.id}
                          style={{
                            alignSelf: isSelf ? 'flex-end' : 'flex-start',
                            maxWidth: '75%',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: isSelf ? 'flex-end' : 'flex-start'
                          }}
                        >
                          <span style={{ fontSize: '10px', color: '#64748b', marginBottom: '2px', fontWeight: '500' }}>
                            {displayRole}
                          </span>
                          <div style={{
                            padding: '10px 14px',
                            borderRadius: isSelf ? '16px 16px 0px 16px' : '16px 16px 16px 0px',
                            backgroundColor: isSelf ? '#2563eb' : '#ffffff',
                            color: isSelf ? 'white' : '#1e293b',
                            fontSize: '13px',
                            lineHeight: '1.4',
                            boxShadow: isSelf ? '0 2px 5px rgba(37,99,235,0.2)' : '0 1px 3px rgba(0,0,0,0.05)',
                            border: isSelf ? 'none' : '1px solid #e2e8f0',
                            whiteSpace: 'pre-wrap',
                            overflow: 'hidden'
                          }}>
                            {msg.message_type === 'image' ? (
                              <a href={msg.attachment_url} target="_blank" rel="noreferrer">
                                <img
                                  src={msg.attachment_url}
                                  alt="Screenshot"
                                  style={{
                                    maxWidth: '100%',
                                    maxHeight: '180px',
                                    borderRadius: '8px',
                                    marginTop: '2px',
                                    cursor: 'zoom-in',
                                    display: 'block'
                                  }}
                                />
                              </a>
                            ) : (
                              msg.message_text
                            )}
                          </div>
                          <span style={{ fontSize: '9px', color: '#94a3b8', marginTop: '3px' }}>
                            {timestamp}
                          </span>
                        </div>
                      );
                    })
                  )}

                  {/* Uploading progress overlay */}
                  {uploading && (
                    <div style={{ alignSelf: 'flex-end', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                      <div style={{
                        padding: '10px 14px',
                        borderRadius: '16px 16px 0px 16px',
                        backgroundColor: '#bfdbfe',
                        color: '#1e3a8a',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <svg className="animate-spin" style={{ width: '12px', height: '12px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25"></circle>
                          <path d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor"></path>
                        </svg>
                        Uploading image...
                      </div>
                    </div>
                  )}

                  {isTyping && (
                    <div style={{ alignSelf: 'flex-start', display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '10px', color: '#64748b', marginBottom: '2px' }}>
                        Typing...
                      </span>
                      <div style={{
                        padding: '8px 14px',
                        borderRadius: '16px 16px 16px 0px',
                        backgroundColor: '#ffffff',
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        width: 'fit-content'
                      }}>
                        <span style={{ width: '6px', height: '6px', backgroundColor: '#94a3b8', borderRadius: '50%', display: 'inline-block', animation: 'bounceSH 1.4s infinite ease-in-out both' }}></span>
                        <span style={{ width: '6px', height: '6px', backgroundColor: '#94a3b8', borderRadius: '50%', display: 'inline-block', animation: 'bounceSH 1.4s infinite ease-in-out both 0.2s' }}></span>
                        <span style={{ width: '6px', height: '6px', backgroundColor: '#94a3b8', borderRadius: '50%', display: 'inline-block', animation: 'bounceSH 1.4s infinite ease-in-out both 0.4s' }}></span>
                      </div>
                      <style dangerouslySetInnerHTML={{
                        __html: `
                        @keyframes bounceSH {
                          0%, 80%, 100% { transform: scale(0); }
                          40% { transform: scale(1.0); }
                        }
                      `}} />
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input form */}
                <form
                  onSubmit={handleSendMessage}
                  style={{
                    padding: '12px 16px',
                    borderTop: '1px solid #e2e8f0',
                    display: 'flex',
                    gap: '8px',
                    backgroundColor: '#ffffff',
                    alignItems: 'center'
                  }}
                >
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={!selectedRoomId || uploading}
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      backgroundColor: '#f1f5f9',
                      color: '#475569',
                      border: 'none',
                      cursor: (selectedRoomId && !uploading) ? 'pointer' : 'default',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s',
                    }}
                    title="Attach Image"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                      <circle cx="12" cy="13" r="4"></circle>
                    </svg>
                  </button>

                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onPaste={handlePaste}
                    placeholder="Message... (Paste Ctrl+V screenshots)"
                    disabled={!selectedRoomId || uploading}
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: '24px',
                      border: '1px solid #cbd5e1',
                      outline: 'none',
                      fontSize: '13px',
                      transition: 'border-color 0.2s',
                      backgroundColor: (selectedRoomId && !uploading) ? 'white' : '#f1f5f9'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#1d4ed8'}
                    onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
                  />
                  <button
                    type="submit"
                    disabled={!inputMessage.trim() || !selectedRoomId || uploading}
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      backgroundColor: (inputMessage.trim() && selectedRoomId && !uploading) ? '#2563eb' : '#cbd5e1',
                      color: 'white',
                      border: 'none',
                      cursor: (inputMessage.trim() && selectedRoomId && !uploading) ? 'pointer' : 'default',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s',
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13"></line>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                    </svg>
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default SchoolHeadChatWidget;
