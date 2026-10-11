import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { executeCode } from './utils/piston';

const getRandomUser = () => {
  const colors = ['#f43f5e', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ec4899'];
  const randNum = Math.floor(1000 + Math.random() * 9000);
  const color = colors[Math.floor(Math.random() * colors.length)];
  return { username: `Dev-${randNum}`, color };
};

const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://127.0.0.1:8000';

function App() {
  const [user] = useState(getRandomUser);

  const getInitialRoom = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get('room') || 'room-1';
  };

  const [roomId, setRoomId] = useState(getInitialRoom);

  // Enhancement 1: Load initial code from localStorage if available
  const [text, setText] = useState(() => {
    const savedCode = localStorage.getItem('syncspace_code');
    return savedCode !== null ? savedCode : '// Write code here and press Ctrl + Enter to run\nconsole.log("Hello from SyncSpace!");';
  });

  const [language, setLanguage] = useState('javascript');

  // Enhancement 2: Theme State (vs-dark or vs light)
  const [editorTheme, setEditorTheme] = useState('vs-dark');

  const [status, setStatus] = useState('Disconnected');
  const [userCount, setUserCount] = useState(1);
  const [activeUsers, setActiveUsers] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [typerName, setTyperName] = useState('');
  const [copied, setCopied] = useState(false);

  const [consoleOutput, setConsoleOutput] = useState([]);
  const [isRunning, setIsRunning] = useState(false);

  const socketRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isIncomingChange = useRef(false);

  // WebSocket connection effect
  useEffect(() => {
    const ws = new WebSocket(`${WS_BASE_URL}/ws/${roomId}`);
    socketRef.current = ws;

    ws.onopen = () => {
      setStatus('Connected');
      ws.send(JSON.stringify({ type: 'join', user }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'presence') {
          setUserCount(data.count);
          if (data.users) setActiveUsers(data.users);
        } else if (data.type === 'init') {
          isIncomingChange.current = true;
          setText(data.text);
          setLanguage(data.language);
        } else if (data.type === 'content') {
          isIncomingChange.current = true;
          setText(data.text);
        } else if (data.type === 'language') {
          setLanguage(data.language);
        } else if (data.type === 'typing') {
          setIsTyping(data.isTyping);
          setTyperName(data.username || 'Someone');
        }
      } catch (err) {
        isIncomingChange.current = true;
        setText(event.data);
      }
    };

    ws.onclose = () => setStatus('Disconnected');

    return () => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
  }, [roomId, user]);

  // Keyboard shortcut effect (Ctrl + Enter to Run Code)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        runCode();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [language, text]);

  const handleEditorChange = (value) => {
    if (isIncomingChange.current) {
      isIncomingChange.current = false;
      return;
    }

    const val = value || '';
    setText(val);

    // Save to localStorage automatically on change
    localStorage.setItem('syncspace_code', val);

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'content', text: val }));
      socketRef.current.send(JSON.stringify({ type: 'typing', isTyping: true, username: user.username }));

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

      typingTimeoutRef.current = setTimeout(() => {
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({ type: 'typing', isTyping: false }));
        }
      }, 1000);
    }
  };

  const handleLanguageChange = (e) => {
    const newLang = e.target.value;
    setLanguage(newLang);

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'language', language: newLang }));
    }
  };

  const copyInviteLink = () => {
    const inviteUrl = `${window.location.origin}?room=${roomId}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const runCode = async () => {
    setIsRunning(true);
    setConsoleOutput(['Executing code via Piston API...']);

    try {
      if (['html', 'css', 'json'].includes(language)) {
        setConsoleOutput([`[System]: Static markup/data format (${language.toUpperCase()}). No runtime execution required.`]);
        setIsRunning(false);
        return;
      }

      const result = await executeCode(language, text);
      const outputLines = typeof result === 'string' ? result.split('\n') : [String(result)];
      setConsoleOutput(outputLines);
    } catch (err) {
      setConsoleOutput([`Execution Error: ${err.message}`]);
    } finally {
      setIsRunning(false);
    }
  };

  const maxAvatars = 4;
  const visibleUsers = activeUsers.slice(0, maxAvatars);
  const extraUsersCount = activeUsers.length - maxAvatars;

  const hasError = consoleOutput.some(
    line => line.includes('Error') || line.includes('Traceback') || line.includes('Exception')
  );

  return (
    <div style={{ backgroundColor: '#0f172a', minHeight: '100vh', color: '#f8fafc', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ borderBottom: '1px solid #1e293b', padding: '0.75rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1e293b' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#38bdf8' }}></div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.5px' }}>SyncSpace <span style={{ fontSize: '0.8rem', color: '#38bdf8', fontWeight: 400 }}>IDE</span></h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#0f172a', padding: '4px 10px', borderRadius: '6px', border: '1px solid #334155' }}>
            <span style={{ fontSize: '0.85rem', color: '#94a3b8', marginRight: '6px' }}>Room:</span>
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: '#f8fafc', fontWeight: 'bold', width: '80px', outline: 'none' }}
            />
          </div>

          <button
            onClick={copyInviteLink}
            style={{ backgroundColor: '#334155', color: '#f8fafc', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600 }}
          >
            {copied ? '✓ Link Copied!' : '🔗 Share Room'}
          </button>

          <select
            value={language}
            onChange={handleLanguageChange}
            style={{ backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', outline: 'none' }}
          >
            <option value="javascript">JavaScript</option>
            <option value="python">Python</option>
            <option value="cpp">C++</option>
            <option value="java">Java</option>
            <option value="html">HTML</option>
            <option value="css">CSS</option>
            <option value="json">JSON</option>
          </select>

          {/* Enhancement 2: Theme Switcher Button */}
          <button
            onClick={() => setEditorTheme(editorTheme === 'vs-dark' ? 'vs' : 'vs-dark')}
            style={{ backgroundColor: '#334155', color: '#f8fafc', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600 }}
            title="Toggle Editor Theme"
          >
            {editorTheme === 'vs-dark' ? '☀️ Light' : '🌙 Dark'}
          </button>

          <button
            onClick={runCode}
            disabled={isRunning}
            style={{ backgroundColor: '#22c55e', color: '#0f172a', border: 'none', padding: '6px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            {isRunning ? 'Running...' : '▶ Run Code (Ctrl+Enter)'}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: status === 'Connected' ? '#4ade80' : '#f87171' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: status === 'Connected' ? '#22c55e' : '#ef4444' }}></span>
            {status}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#0f172a', border: '1px solid #334155', padding: '4px 10px', borderRadius: '20px', maxWidth: '240px', overflow: 'hidden' }}>
            <span style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 'bold', marginRight: '4px', whiteSpace: 'nowrap' }}>
              👥 {userCount} Online
            </span>
            {visibleUsers.map((u, i) => (
              <div
                key={i}
                style={{ backgroundColor: u.color || '#3b82f6', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.75rem', color: '#fff', flexShrink: 0 }}
                title={u.username}
              >
                {u.username ? u.username.slice(4, 6) : 'Dev'}
              </div>
            ))}
            {extraUsersCount > 0 && (
              <div
                style={{ backgroundColor: '#334155', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.7rem', color: '#38bdf8', flexShrink: 0 }}
                title={`${extraUsersCount} more online`}
              >
                +{extraUsersCount}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ padding: '1rem', maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ height: '20px', marginBottom: '8px', fontSize: '0.85rem', color: '#38bdf8' }}>
          {isTyping && <span>✍️ {typerName} is typing...</span>}
        </div>

        <div style={{ border: '1px solid #334155', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#1e293b' }}>
          <Editor
            height="460px"
            language={language}
            theme={editorTheme}
            value={text}
            onChange={handleEditorChange}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              scrollBeyondLastLine: false,
              automaticLayout: true,
              padding: { top: 10 },
            }}
          />
        </div>

        <div style={{ marginTop: '1rem', backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '8px', padding: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid #1e293b', paddingBottom: '6px' }}>
            <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 'bold', letterSpacing: '0.5px' }}>TERMINAL OUTPUT</span>
            <button onClick={() => setConsoleOutput([])} style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '0.75rem', cursor: 'pointer' }}>Clear</button>
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: '0.9rem', minHeight: '80px', maxHeight: '150px', overflowY: 'auto', color: hasError ? '#f87171' : '#e2e8f0' }}>
            {consoleOutput.length === 0 ? (
              <span style={{ color: '#475569' }}>Click "Run Code" or press Ctrl+Enter above to see output...</span>
            ) : (
              consoleOutput.map((out, idx) => (
                <div key={idx} style={{ marginBottom: '4px' }}>{out}</div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;