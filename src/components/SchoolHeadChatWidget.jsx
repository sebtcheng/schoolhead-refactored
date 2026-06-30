import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

const SchoolHeadChatWidget = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [activeBubble, setActiveBubble] = useState('SDO'); // 'SDO' | 'HRMO' | 'ADMIN'
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // API Backend States
  const [contacts, setContacts] = useState({ SDO: null, HRMO: null, ADMIN: null });
  const [rooms, setRooms] = useState({ SDO: null, HRMO: null, ADMIN: null });
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Check if current user is a School Head
  const userRole = localStorage.getItem('userRole') || (user && user.role);
  const isSchoolHead = userRole === 'School Head' || userRole === 'school_head';

  // 1. Fetch UIDs of relevant contact roles on mount
  useEffect(() => {
    if (!isSchoolHead) return;
    const token = localStorage.getItem('token');
    if (!token) return;

    fetch(api('/api/chat/contacts'), {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
      if (data.success && data.contacts) {
        setContacts({
          SDO: data.contacts.SDO,
          HRMO: data.contacts.HRMO,
          ADMIN: data.contacts.ADMIN
        });
      }
    })
    .catch(err => console.error('[CHAT WIDGET] Fetch contacts error:', err));
  }, [isSchoolHead]);

  // 2. Fetch or create Room ID when active tab switches, then load its message history
  useEffect(() => {
    if (!isOpen || !isSchoolHead) return;
    const contact = contacts[activeBubble];
    if (!contact) {
      setMessages([]);
      return;
    }

    const token = localStorage.getItem('token');
    setLoading(true);

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
        const roomId = roomData.room_id;
        setRooms(prev => ({ ...prev, [activeBubble]: roomId }));
        
        // Fetch messages for this room
        return fetch(api(`/api/chat/rooms/${roomId}/messages`), {
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } else {
        throw new Error(roomData.error || 'Failed to get room');
      }
    })
    .then(res => res && res.json())
    .then(msgData => {
      if (msgData && msgData.success) {
        setMessages(msgData.messages || []);
      }
    })
    .catch(err => {
      console.error('[CHAT WIDGET] Load thread error:', err);
      setMessages([]);
    })
    .finally(() => setLoading(false));
  }, [activeBubble, contacts, isOpen]);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, loading, uploading]);

  if (!isSchoolHead) return null;

  // Handle standard text messaging
  const handleSendMessage = (e) => {
    e.preventDefault();
    const roomId = rooms[activeBubble];
    if (!inputMessage.trim() || !roomId) return;

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
          sender_role: 'School Head'
        }]);
      }
    })
    .catch(err => console.error('[CHAT WIDGET] Send message error:', err));
  };

  // Upload file buffer to backend (Azure storage / local fallback)
  const uploadImageFile = (file) => {
    const roomId = rooms[activeBubble];
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
        // Post message to DB with type 'image' and storage url
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
          sender_role: 'School Head'
        }]);
      }
    })
    .catch(err => {
      console.error('[CHAT WIDGET] Upload attachment failed:', err);
      alert('Failed to send image attachment. Check your connection.');
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

  return (
    <>
      {/* Floating Action Button (FAB) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: '#2563eb',
          color: 'white',
          border: 'none',
          boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4), 0 2px 5px rgba(0, 0, 0, 0.1)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: isOpen ? 'rotate(135deg) scale(0.9)' : 'scale(1)',
        }}
        title="Open Chat Support"
      >
        {isOpen ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
        )}
      </button>

      {/* Chat Drawer Panel */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          bottom: '96px',
          right: '24px',
          zIndex: 9998,
          width: '380px',
          height: '520px',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
          animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes slideUp {
              from { transform: translateY(20px); opacity: 0; }
              to { transform: translateY(0); opacity: 1; }
            }
          `}} />

          {/* Header Part 1: Title & Info */}
          <div style={{
            backgroundColor: '#1e3a8a',
            padding: '16px 16px 12px 16px',
            color: 'white',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid #1e40af'
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

          {/* Header Part 2: Bubble Tabs (SDO, HRMO, ADMIN) */}
          <div style={{
            display: 'flex',
            backgroundColor: '#1e3a8a',
            padding: '4px 8px 12px 8px',
            gap: '8px',
            justifyContent: 'space-around',
          }}>
            {[
              { id: 'SDO', label: 'SDO', sub: 'Division Office', color: '#3b82f6' },
              { id: 'HRMO', label: 'HRMO', sub: 'Human Resources', color: '#10b981' },
              { id: 'ADMIN', label: 'ADMIN', sub: 'Support (999009)', color: '#f59e0b' }
            ].map((bubble) => {
              const isActive = activeBubble === bubble.id;
              const hasContact = !!contacts[bubble.id];
              return (
                <button
                  key={bubble.id}
                  disabled={!hasContact}
                  onClick={() => setActiveBubble(bubble.id)}
                  style={{
                    flex: 1,
                    padding: '8px 4px',
                    borderRadius: '12px',
                    border: 'none',
                    backgroundColor: isActive ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                    color: 'white',
                    cursor: hasContact ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease',
                    boxShadow: isActive ? 'inset 0 1px 3px rgba(0,0,0,0.2)' : 'none',
                    borderBottom: isActive ? `3px solid ${bubble.color}` : '3px solid transparent',
                    opacity: hasContact ? 1 : 0.4
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
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}>
                    {bubble.label[0]}
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

          {/* Chat Messages Panel */}
          <div style={{
            flex: 1,
            padding: '16px',
            overflowY: 'auto',
            backgroundColor: '#f8fafc',
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
                      {isSelf ? 'You' : msg.sender_role || activeBubble}
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

            {/* Uploading progress message */}
            {uploading && (
              <div style={{ alignSelf: 'flex-end', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <div style={{
                  padding: '10px 14px',
                  borderRadius: '16px 16px 0px 16px',
                  backgroundColor: '#93c5fd', // Light blue loading
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
                  Uploading screenshot...
                </div>
              </div>
            )}

            {isTyping && (
              <div style={{ alignSelf: 'flex-start', display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '10px', color: '#64748b', marginBottom: '2px' }}>
                  {activeBubble} is typing...
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
                  <span className="dot" style={{ width: '6px', height: '6px', backgroundColor: '#94a3b8', borderRadius: '50%', display: 'inline-block', animation: 'bounce 1.4s infinite ease-in-out both' }}></span>
                  <span className="dot" style={{ width: '6px', height: '6px', backgroundColor: '#94a3b8', borderRadius: '50%', display: 'inline-block', animation: 'bounce 1.4s infinite ease-in-out both 0.2s' }}></span>
                  <span className="dot" style={{ width: '6px', height: '6px', backgroundColor: '#94a3b8', borderRadius: '50%', display: 'inline-block', animation: 'bounce 1.4s infinite ease-in-out both 0.4s' }}></span>
                </div>
                <style dangerouslySetInnerHTML={{__html: `
                  @keyframes bounce {
                    0%, 80%, 100% { transform: scale(0); }
                    40% { transform: scale(1.0); }
                  }
                `}} />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Message Input Area */}
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
            {/* Camera / Image Attachment Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={!rooms[activeBubble] || uploading}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: '#f1f5f9',
                color: '#475569',
                border: 'none',
                cursor: (rooms[activeBubble] && !uploading) ? 'pointer' : 'default',
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

            {/* Input field with handlePaste logic */}
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onPaste={handlePaste}
              placeholder={`Message ${activeBubble}... (Paste Ctrl+V screenshots)`}
              disabled={!rooms[activeBubble] || uploading}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '24px',
                border: '1px solid #cbd5e1',
                outline: 'none',
                fontSize: '13px',
                transition: 'border-color 0.2s',
                backgroundColor: (rooms[activeBubble] && !uploading) ? 'white' : '#f1f5f9'
              }}
              onFocus={(e) => e.target.style.borderColor = '#2563eb'}
              onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
            />
            <button
              type="submit"
              disabled={!inputMessage.trim() || !rooms[activeBubble] || uploading}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: (inputMessage.trim() && rooms[activeBubble] && !uploading) ? '#2563eb' : '#cbd5e1',
                color: 'white',
                border: 'none',
                cursor: (inputMessage.trim() && rooms[activeBubble] && !uploading) ? 'pointer' : 'default',
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
    </>
  );
};

export default SchoolHeadChatWidget;
