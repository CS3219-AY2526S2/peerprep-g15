import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import NavBar from '../components/NavBar';

const COLLAB_URL = 'http://localhost:3004';

type Message = {
    senderId: string;
    username: string;
    content: string;
    timestamp: string;
};

type SessionState = {
    roomId: string;
    userIds: string[];
    questionId: string;
    code: string;
    language: string;
    status: string;
    messages: Message[];
};

const Collab = () => {
    // const name = localStorage.getItem('name') || 'Admin';
    const params = new URLSearchParams(window.location.search);
    const userId = params.get('userId') || localStorage.getItem('userId') || 'user1';
    const name = params.get('name') || localStorage.getItem('name') || 'User';

    // TODO: these should come from matching service / route params
    const roomId = 'test-room-1';
    const questionTitle = 'Two Sum';
    const questionDescription = 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target. You may assume that each input would have exactly one solution, and you may not use the same element twice.';
    const questionDifficulty = 'Easy';
    const questionCategories = ['Arrays', 'Hash Table'];

    const [socket, setSocket] = useState<Socket | null>(null);
    const [session, setSession] = useState<SessionState | null>(null);
    const [code, setCode] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [selectedLanguage, setSelectedLanguage] = useState('');
    const [lockedIn, setLockedIn] = useState(false);
    const [partnerLockedIn, setPartnerLockedIn] = useState(false);
    const [timer, setTimer] = useState(30);
    const [sessionStatus, setSessionStatus] = useState('pending');
    const [codeResult, setCodeResult] = useState<any>(null);
    const [isExecuting, setIsExecuting] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [partnerJoined, setPartnerJoined] = useState(false);
    const [partnerDisconnected, setPartnerDisconnected] = useState(false);
    const [disconnectTimer, setDisconnectTimer] = useState(30);

    // Connect socket
    useEffect(() => {
        const s = io(COLLAB_URL);
        setSocket(s);

        s.on('connect', () => {
            s.emit('join-room', roomId, userId);
        });

        s.on('session-state', (session: SessionState) => {
            setSession(session);
            setSessionStatus(session?.status || 'pending');
            if (session?.code) setCode(session.code);
            if (session?.language) setSelectedLanguage(session.language);
        });

        s.on('chat-history', (history: Message[]) => {
            setMessages(history);
        });

        s.on('receive-message', (msg: Message) => {
            setMessages((prev) => [...prev, msg]);
        });

        s.on('session-started', (data: { language: string }) => {
            setSessionStatus('active');
            setSelectedLanguage(data.language);
        });

        s.on('user-locked-in', () => {
            setPartnerLockedIn(true);
        });

        s.on('language-mismatch', () => {
            setSessionStatus('mismatch');
        });

        s.on('language-timeout', () => {
            setSessionStatus('timeout');
        });

        s.on('code-update', (newCode: string) => {
            setCode(newCode);
        });

        s.on('code-executing', () => {
            setIsExecuting(true);
            setCodeResult(null);
        });

        s.on('code-result', (result: any) => {
            setIsExecuting(false);
            setCodeResult(result);
        });

        s.on('code-error', (err: any) => {
            setIsExecuting(false);
            setCodeResult({ error: err.message });
        });

        s.on('session-ended', (data: { reason: string }) => {
            setSessionStatus('ended');
        });

        s.on('user-joined', (data: any) => {
            setPartnerJoined(true);
            if (data?.timeRemaining) {
                setTimer(data.timeRemaining);
            }
        });

        s.on('user-disconnected', () => {
            setPartnerDisconnected(true);
        });

        s.on('user-reconnected', () => {
            setPartnerDisconnected(false);
            setDisconnectTimer(30);
        });

        return () => {
            s.disconnect();
        };
    }, []);

    // Language selection timer
    useEffect(() => {
        if (sessionStatus === 'pending' && partnerJoined) {
            timerRef.current = setInterval(() => {
                setTimer((prev) => {
                    if (prev <= 1) {
                        clearInterval(timerRef.current!);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [sessionStatus,  partnerJoined]);

    useEffect(() => {
        if (partnerDisconnected) {
            const interval = setInterval(() => {
                setDisconnectTimer((prev) => {
                    if (prev <= 1) {
                        clearInterval(interval);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(interval);
        } else {
            setDisconnectTimer(30);
        }
    }, [partnerDisconnected]);

    // Auto scroll chat
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleLockIn = () => {
        if (!selectedLanguage || !socket) return;
        socket.emit('lock-in', roomId, userId, selectedLanguage);
        setLockedIn(true);
    };

    const handleCodeChange = (newCode: string) => {
        setCode(newCode);
        socket?.emit('code-change', roomId, newCode);
    };

    const handleRunCode = () => {
        if (!socket) return;
        socket.emit('run-code', roomId, userId, code, selectedLanguage);
    };

    const handleSendMessage = () => {
        if (!chatInput.trim() || !socket) return;
        const msg = {
            roomId,
            senderId: userId,
            username: name,
            content: chatInput.trim(),
        };
        socket.emit('send-message', msg);
        setMessages((prev) => [...prev, { ...msg, timestamp: new Date().toISOString() }]);
        setChatInput('');
    };

    const handleLeave = () => {
        socket?.emit('leave-session', roomId, userId);
    };

    // Language selection overlay
    if (sessionStatus === 'pending') {
        return (
            <>
                <NavBar name={name} />
                <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '80vh' }}>
                    <div className="card shadow-lg" style={{ width: '450px' }}>
                        <div className="card-body text-center">
                            <h3 className="card-title mb-3">Select Language</h3>

                            {!partnerJoined ? (
                                <>
                                    <div className="spinner-border text-primary mb-3" role="status" />
                                    <p className="text-muted">Waiting for partner to join...</p>
                                </>
                            ) : (
                                <>
                                    <div className="mb-3">
                                        <span className="badge bg-warning text-dark fs-5">{timer}s</span>
                                    </div>
                                    <p className="text-muted">Both users must agree on a language</p>

                                    <div className="d-flex flex-column gap-2 mb-4">
                                        {['python', 'javascript', 'java', 'cpp'].map((lang) => (
                                            <button
                                                key={lang}
                                                className={`btn ${selectedLanguage === lang ? 'btn-primary' : 'btn-outline-primary'}`}
                                                onClick={() => setSelectedLanguage(lang)}
                                                disabled={lockedIn}
                                            >
                                                {lang.charAt(0).toUpperCase() + lang.slice(1)}
                                            </button>
                                        ))}
                                    </div>

                                    <button
                                        className="btn btn-success w-100 mb-2"
                                        onClick={handleLockIn}
                                        disabled={!selectedLanguage || lockedIn}
                                    >
                                        {lockedIn ? 'Locked In!' : 'Lock In'}
                                    </button>

                                    {lockedIn && !partnerLockedIn && (
                                        <p className="text-muted mt-2">Waiting for partner to lock in...</p>
                                    )}
                                    {partnerLockedIn && !lockedIn && (
                                        <p className="text-info mt-2">Your partner has locked in!</p>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </>
        );
    }

    // Mismatch / timeout / ended screens
    if (sessionStatus === 'mismatch' || sessionStatus === 'timeout' || sessionStatus === 'ended') {
        const statusMessages: Record<string, { title: string; msg: string }> = {
            mismatch: { title: 'Language Mismatch', msg: 'You and your partner chose different languages.' },
            timeout: { title: 'Time Out', msg: 'Language selection timed out.' },
            ended: { title: 'Session Ended', msg: 'The collaboration session has ended.' },
        };
        const { title, msg } = statusMessages[sessionStatus];

        return (
            <>
                <NavBar name={name} />
                <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '80vh' }}>
                    <div className="card shadow-lg text-center" style={{ width: '400px' }}>
                        <div className="card-body">
                            <h3 className="text-danger">{title}</h3>
                            <p className="text-muted">{msg}</p>
                            <a href="/" className="btn btn-primary">Back to Home</a>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    // Active session
    return (
        <>
            <NavBar name={name} />
            <div className="container-fluid" style={{ height: 'calc(100vh - 56px)' }}>
                {/* Top bar */}
                <div className="d-flex justify-content-between align-items-center p-2 border-bottom bg-light">
                    <div className="d-flex align-items-center gap-3">
                        <span className="badge bg-success">Active</span>
                        <span className="fw-bold">{selectedLanguage.toUpperCase()}</span>
                    </div>
                    {partnerDisconnected && (
                        <div className="alert alert-warning text-center mb-0 rounded-0">
                            Partner disconnected. Session will end in {disconnectTimer}s...
                        </div>
                    )}
                    <div className="d-flex gap-2">
                        <button
                            className="btn btn-sm btn-success"
                            onClick={handleRunCode}
                            disabled={isExecuting}
                        >
                            {isExecuting ? 'Running...' : 'Run Code'}
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={handleLeave}>
                            Leave Session
                        </button>
                    </div>
                </div>

                {/* Main content */}
                <div className="row g-0" style={{ height: 'calc(100% - 50px)' }}>
                    {/* Left: Question */}
                    <div className="col-3 border-end p-3 overflow-auto" style={{ height: '100%' }}>
                        <div className="d-flex gap-2 mb-2">
                            <span className={`badge ${questionDifficulty === 'Easy' ? 'bg-success' : questionDifficulty === 'Medium' ? 'bg-warning' : 'bg-danger'}`}>
                                {questionDifficulty}
                            </span>
                            {questionCategories.map((cat) => (
                                <span key={cat} className="badge bg-secondary">{cat}</span>
                            ))}
                        </div>
                        <h5>{questionTitle}</h5>
                        <p className="text-muted" style={{ fontSize: '0.9rem' }}>
                            {questionDescription}
                        </p>
                    </div>

                    {/* Middle: Code editor + output */}
                    <div className="col-6 d-flex flex-column border-end" style={{ height: '100%' }}>
                        <textarea
                            className="form-control flex-grow-1 font-monospace border-0 rounded-0"
                            style={{ resize: 'none', fontSize: '0.85rem' }}
                            value={code}
                            onChange={(e) => handleCodeChange(e.target.value)}
                            placeholder="Write your code here..."
                        />
                        {/* Output panel */}
                        <div className="border-top p-2 bg-dark text-white" style={{ height: '150px', overflowY: 'auto', fontSize: '0.85rem' }}>
                            <strong>Output:</strong>
                            {isExecuting && <p className="text-warning mb-0">Executing...</p>}
                            {codeResult && !codeResult.error && (
                                <pre className="mb-0 text-success">{codeResult.stdout || 'No output'}</pre>
                            )}
                            {codeResult?.stderr && (
                                <pre className="mb-0 text-danger">{codeResult.stderr}</pre>
                            )}
                            {codeResult?.error && (
                                <pre className="mb-0 text-danger">{codeResult.error}</pre>
                            )}
                            {codeResult && (
                                <small className="text-muted">
                                    Status: {codeResult.status} | Time: {codeResult.time}s | Memory: {codeResult.memory}KB
                                </small>
                            )}
                        </div>
                    </div>

                    {/* Right: Chat */}
                    <div className="col-3 d-flex flex-column" style={{ height: '100%' }}>
                        <div className="p-2 border-bottom bg-light">
                            <strong>Chat</strong>
                        </div>
                        <div className="flex-grow-1 overflow-auto p-2" style={{ fontSize: '0.85rem' }}>
                            {messages.map((msg, i) => (
                                <div key={i} className={`mb-2 ${msg.senderId === userId ? 'text-end' : ''}`}>
                                    <small className="text-muted d-block">{msg.username}</small>
                                    <span
                                        className={`d-inline-block px-2 py-1 rounded ${msg.senderId === userId ? 'bg-primary text-white' : 'bg-light border'}`}
                                    >
                                        {msg.content}
                                    </span>
                                </div>
                            ))}
                            <div ref={chatEndRef} />
                        </div>
                        <div className="border-top p-2">
                            <div className="input-group">
                                <input
                                    type="text"
                                    className="form-control form-control-sm"
                                    placeholder="Type a message..."
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                />
                                <button className="btn btn-sm btn-primary" onClick={handleSendMessage}>
                                    Send
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default Collab;