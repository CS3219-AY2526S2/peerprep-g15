import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useParams } from 'react-router';
import NavBar from '../components/NavBar';
import * as Y from 'yjs';
import { MonacoBinding } from 'y-monaco';
import Editor from '@monaco-editor/react';
import OutputPanel from '../components/CodeOutput';
import { createHighlighter } from 'shiki';
import { shikiToMonaco } from '@shikijs/monaco';
import { loader } from '@monaco-editor/react';
import type { ExecutionSpec, TestCase } from '../types/execution';

const COLLAB_URL = 'http://localhost:3004';

type Question = {
    questionId: number;
    title: string;
    description: string;
    categories: string[];
    difficulty: string;
    constraints: string[];
    hints: string[];
    sourceUrl?: string;
    supportedLanguages: string[];
    examples: { input: string; output: string; explanation?: string }[];
    testCases: TestCase[];
    starterCode: Record<string, string>;
    executionSpec: ExecutionSpec;
};

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

let shikiReady = false;
let shikiMonaco: any = null;
const shikiReadyCallbacks: (() => void)[] = [];

const highlighterPromise = createHighlighter({
    themes: ['github-dark', 'github-light'],
    langs: ['python', 'javascript', 'java', 'cpp'],
});

loader.init().then(async (monaco) => {
    const highlighter = await highlighterPromise;

    shikiToMonaco(highlighter, monaco);
    monaco.editor.setTheme('github-light');
    shikiReady = true;
    shikiReadyCallbacks.forEach((cb) => cb());
    shikiReadyCallbacks.length = 0;
});

const stripParamName = (input: string) => {
    const eqIndex = input.indexOf('=');
    return eqIndex !== -1 ? input.slice(eqIndex + 2) : input; // +2 to skip '= '
};

const Collab = () => {
    // const name = localStorage.getItem('name') || 'Admin';
    const params = new URLSearchParams(window.location.search);
    const userId = params.get('userId') || localStorage.getItem('userId') || 'user1';
    const name = params.get('name') || localStorage.getItem('name') || 'User';

    // TODO: these should come from matching service / route params
    const { roomId } = useParams();

    const ydoc = useRef(new Y.Doc());
    const ytext = useRef(ydoc.current.getText('code'));
    const bindingRef = useRef<MonacoBinding | null>(null);
    const starterInserted = useRef(false);

    const [socket, setSocket] = useState<Socket | null>(null);
    const [_session, setSession] = useState<SessionState | null>(null);
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
    const [partnerName, setPartnerName] = useState('Partner');
    const [submitResult, setSubmitResult] = useState<any>(null);
    const [submitTimer, setSubmitTimer] = useState(10);
    const [question, setQuestion] = useState<Question | null>(null);
    const [initialSyncDone, setInitialSyncDone] = useState(false);
    const monacoRef = useRef<any>(null);
    const questionRef = useRef<Question | null>(null);

    const getExecutionSpec = (): ExecutionSpec => {
        return question?.executionSpec ?? { kind: 'stdin', comparator: 'string' };
    };

    // Connect socket
    useEffect(() => {
        const s = io(COLLAB_URL, {
            transports: ['websocket'],
        });
        setSocket(s);

        s.on('connect', () => {
            s.emit('join-room', roomId, userId, name);
        });

        s.on('session-state', (data: { session: SessionState; question: Question }) => {
            const { session, question } = data;
            setSession(session);
            setSessionStatus(session?.status || 'pending');
            setInitialSyncDone(false);

            if (session?.language) {
                setSelectedLanguage(session.language);
            }

            if (question) {
                setQuestion(question);
                questionRef.current = question;
            }
        });

        const handleYjsUpdate = (update: Uint8Array, origin: any) => {
            if (origin === 'remote') return; // don't re-broadcast updates that came from the server
            s.emit('yjs-update', roomId, update);
        };

        ydoc.current.on('update', handleYjsUpdate);

        s.on('yjs-update', (update: ArrayBuffer) => {
            Y.applyUpdate(ydoc.current, new Uint8Array(update), 'remote');

            if (ytext.current.toString().trim().length > 0) {
                starterInserted.current = true;
            }
            setInitialSyncDone(true);
        });

        s.on('yjs-sync', (state: ArrayBuffer) => {
            Y.applyUpdate(ydoc.current, new Uint8Array(state), 'remote');

            if (ytext.current.toString().trim().length > 0) {
                starterInserted.current = true;
            }

            setInitialSyncDone(true);
        });

        s.on('chat-history', (history: Message[]) => {
            setMessages(history);
        });

        s.on('receive-message', (msg: Message) => {
            setMessages((prev) => [...prev, msg]);
        });

        s.on('session-started', (data: { language: string; yjsState?: ArrayBuffer }) => {
            setSessionStatus('active');
            setSelectedLanguage(data.language);
            setInitialSyncDone(true);
            starterInserted.current = true;

            if (data.yjsState) {
                Y.applyUpdate(ydoc.current, new Uint8Array(data.yjsState), 'remote');
            }
        });

        s.on('user-locked-in', async () => {
            setPartnerLockedIn(true);
        });

        s.on('language-mismatch', () => {
            setSessionStatus('mismatch');
        });

        s.on('language-timeout', () => {
            setSessionStatus('timeout');
        });

        s.on('code-executing', () => {
            console.log('code-executing received');
            setIsExecuting(true);
            setCodeResult(null);
        });

        s.on('code-result', (result: any) => {
            console.log('code-result received:', result);
            setIsExecuting(false);
            setCodeResult(result);
        });

        s.on('submit-result', (result: any) => {
            console.log('submit-result received:', result);
            setIsExecuting(false);
            setSubmitResult(result);
        });

        s.on('code-error', (err: any) => {
            console.log('code-error received:', err);
            setIsExecuting(false);
            setCodeResult({ error: err.message });
        });

        s.on('session-ended', () => {
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

        s.on('partner-info', (data: { userId: string; username: string }) => {
            setPartnerName(data.username);
        });

        return () => {
            ydoc.current.off('update', handleYjsUpdate); // clean up yjs listener
            bindingRef.current?.destroy();
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
    }, [sessionStatus, partnerJoined]);

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

    //Timer for successful submission before leaving session
    useEffect(() => {
        if (submitResult?.passed) {
            const interval = setInterval(() => {
                setSubmitTimer((prev) => {
                    if (prev <= 1) {
                        clearInterval(interval);
                        socket?.emit('leave-session', roomId, userId);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [submitResult]);

    useEffect(() => {
        if (sessionStatus !== 'active') return;
        if (initialSyncDone) return;

        const timeout = setTimeout(() => {
            setInitialSyncDone(true);
        }, 800);

        return () => clearTimeout(timeout);
    }, [sessionStatus, initialSyncDone]);

    // Loading theme
    useEffect(() => {
        const apply = () => {
            shikiMonaco?.editor.setTheme('github-light');
        };

        if (shikiReady) {
            apply();
            return;
        }
        shikiReadyCallbacks.push(apply);
    }, []);

    const handleEditorWillMount = (monaco: any) => {
        // --- 1. JavaScript & TypeScript (High Robustness) ---
        // This enables the "Red Squiggles" for missing returns and type mismatches
        const compilerOptions = {
            target: monaco.languages.typescript.ScriptTarget.ESNext,
            allowNonTsExtensions: true,
            checkJs: true, // Reports errors in plain .js files
            noImplicitAny: false,
            noImplicitReturn: true, // Specifically catches missing return statements
            strictNullChecks: true,
        };

        monaco.languages.typescript.javascriptDefaults.setCompilerOptions(compilerOptions);
        monaco.languages.typescript.typescriptDefaults.setCompilerOptions(compilerOptions);

        // --- 2. Python, Java, C++ (Standard Robustness) ---
        // For these, Monaco handles "Syntax" (missing brackets/colons) out of the box.
        // We can improve the experience by enabling specific Editor options.

        monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
            validate: true,
        });
    };

    const handleLockIn = () => {
        if (!selectedLanguage || !socket) return;
        socket.emit('lock-in', roomId, userId, selectedLanguage);
        setLockedIn(true);
    };

    const handleRunCode = () => {
        if (!socket) return;

        const filteredTestCases = question?.testCases.filter((tc) => !tc.isHidden) ?? [];
        const code = ytext.current.toString();

        socket.emit(
            'run-code',
            roomId,
            userId,
            code,
            selectedLanguage,
            filteredTestCases,
            getExecutionSpec(),
        );
    };

    const handleSubmit = () => {
        if (!socket) return;
        const code = ytext.current.toString();
        socket.emit(
            'submit-code',
            roomId,
            userId,
            code,
            selectedLanguage,
            question?.testCases ?? [],
            getExecutionSpec(),
        );
        setIsExecuting(true);
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

    const handleLeave = async () => {
        socket?.emit('leave-session', roomId, userId);
        window.location.href = '/home';
    };

    const handleEditorMount = (editor: any, monaco: any) => {
        monacoRef.current = monaco;
        bindingRef.current = new MonacoBinding(
            ytext.current,
            editor.getModel()!,
            new Set([editor]),
        );
    };

    // Language selection overlay
    if (sessionStatus === 'pending') {
        return (
            <>
                <NavBar name={name} />
                <div className="container-fluid" style={{ height: 'calc(100vh - 56px)' }}>
                    <div className="row g-0" style={{ height: '100%' }}>
                        <div
                            className="d-flex justify-content-center align-items-center"
                            style={{ minHeight: '80vh', marginRight: 'min(25%, 350px)' }}
                        >
                            <div className="card shadow-lg" style={{ width: '450px' }}>
                                <div className="card-body text-center">
                                    <h3 className="card-title mb-3">Select Language</h3>

                                    {!partnerJoined ? (
                                        <>
                                            <div
                                                className="spinner-border text-primary mb-3"
                                                role="status"
                                            />
                                            <p className="text-muted">
                                                Waiting for partner to join...
                                            </p>
                                        </>
                                    ) : (
                                        <>
                                            <div className="mb-3">
                                                <span className="badge bg-warning text-dark fs-5">
                                                    {timer}s
                                                </span>
                                            </div>
                                            <p className="text-muted">
                                                Both users must agree on a language
                                            </p>

                                            <div className="d-flex flex-column gap-2 mb-4">
                                                {(
                                                    question?.supportedLanguages ?? [
                                                        'python',
                                                        'javascript',
                                                        'java',
                                                        'cpp',
                                                    ]
                                                ).map((lang) => (
                                                    <button
                                                        key={lang}
                                                        className={`btn ${selectedLanguage === lang ? 'btn-primary' : 'btn-outline-primary'}`}
                                                        onClick={() => setSelectedLanguage(lang)}
                                                        disabled={lockedIn}
                                                    >
                                                        {lang.charAt(0).toUpperCase() +
                                                            lang.slice(1)}
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
                                                <p className="text-muted mt-2">
                                                    Waiting for partner to lock in...
                                                </p>
                                            )}
                                            {partnerLockedIn && !lockedIn && (
                                                <p className="text-info mt-2">
                                                    Your partner has locked in!
                                                </p>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                            <div
                                className="col-3 d-flex flex-column border-start position-fixed end-0 top-0 bg-white"
                                style={{
                                    height: 'calc(100vh - 56px)',
                                    marginTop: '56px',
                                    width: '25%',
                                    zIndex: 100,
                                    marginLeft: '8px',
                                }}
                            >
                                <div className="p-2 border-bottom bg-light">
                                    <strong>Chat</strong>
                                </div>
                                <div
                                    className="flex-grow-1 overflow-auto p-2"
                                    style={{ fontSize: '0.85rem' }}
                                >
                                    {messages.map((msg, i) => (
                                        <div
                                            key={i}
                                            className={`mb-2 ${msg.senderId === userId ? 'text-end' : ''}`}
                                        >
                                            <small className="text-muted d-block">
                                                {msg.username}
                                            </small>
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
                                            onKeyDown={(e) =>
                                                e.key === 'Enter' && handleSendMessage()
                                            }
                                        />
                                        <button
                                            className="btn btn-sm btn-primary"
                                            onClick={handleSendMessage}
                                        >
                                            Send
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    // Mismatch / timeout / ended screens
    if (sessionStatus === 'mismatch' || sessionStatus === 'timeout' || sessionStatus === 'ended') {
        const statusMessages: Record<string, { title: string; msg: string }> = {
            mismatch: {
                title: 'Language Mismatch',
                msg: 'You and your partner chose different languages.',
            },
            timeout: { title: 'Time Out', msg: 'Language selection timed out.' },
            ended: { title: 'Session Ended', msg: 'The collaboration session has ended.' },
        };
        const { title, msg } = statusMessages[sessionStatus];

        return (
            <>
                <NavBar name={name} />
                <div
                    className="d-flex justify-content-center align-items-center"
                    style={{ minHeight: '80vh' }}
                >
                    <div className="card shadow-lg text-center" style={{ width: '400px' }}>
                        <div className="card-body">
                            <h3 className="text-danger">{title}</h3>
                            <p className="text-muted">{msg}</p>
                            <button className="btn btn-primary" onClick={handleLeave}>
                                Back to Home
                            </button>
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
                        <span className="text-muted">Partner: {partnerName}</span>
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
                        <button
                            className="btn btn-sm btn-warning"
                            onClick={handleSubmit}
                            disabled={isExecuting}
                        >
                            Submit
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
                        <div className="d-flex gap-2 mb-2 flex-wrap">
                            <span
                                className={`badge ${question?.difficulty === 'Easy' ? 'bg-success' : question?.difficulty === 'Medium' ? 'bg-warning' : 'bg-danger'}`}
                            >
                                {question?.difficulty}
                            </span>
                            {(question?.categories ?? []).map((cat: string) => (
                                <span key={cat} className="badge bg-secondary">
                                    {cat}
                                </span>
                            ))}
                        </div>
                        <h5>{question?.title}</h5>
                        <p style={{ fontSize: '0.9rem' }}>{question?.description}</p>
                        {question?.examples && question.examples.length > 0 && (
                            <div className="mt-3">
                                <strong style={{ fontSize: '0.9rem' }}>Examples</strong>
                                {question.examples.map((ex, i) => (
                                    <div
                                        key={i}
                                        className="bg-light border rounded p-2 mt-2"
                                        style={{ fontSize: '0.8rem' }}
                                    >
                                        <div>
                                            <span className="fw-semibold">Input:</span>{' '}
                                            <code>{stripParamName(ex.input)}</code>
                                        </div>
                                        <div>
                                            <span className="fw-semibold">Output:</span>{' '}
                                            <code>{ex.output}</code>
                                        </div>
                                        {ex.explanation && (
                                            <div className="text-muted mt-1">{ex.explanation}</div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                        {question?.constraints && question.constraints.length > 0 && (
                            <div className="mt-3">
                                <strong style={{ fontSize: '0.9rem' }}>Constraints</strong>
                                <div
                                    className="bg-light border rounded p-2 mt-2"
                                    style={{ fontSize: '0.8rem' }}
                                >
                                    {question.constraints.map((constraint, i) => (
                                        <div
                                            key={i}
                                            className={i > 0 ? 'mt-1' : ''}
                                            style={{ fontSize: '0.8rem' }}
                                        >
                                            <span className="text-muted mt-1">{i + 1}: </span>{' '}
                                            <code> {constraint}</code>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {question?.hints && question.hints.length > 0 && (
                            <div className="mt-3">
                                <strong style={{ fontSize: '0.9rem' }}>Hints</strong>
                                <div
                                    className="bg-light border rounded p-2 mt-2"
                                    style={{ fontSize: '0.8rem' }}
                                >
                                    {question.hints.map((hint, i) => (
                                        <div
                                            key={i}
                                            className={i > 0 ? 'mt-1' : ''}
                                            style={{ fontSize: '0.8rem' }}
                                        >
                                            <span className="text-muted mt-1">
                                                {i + 1}: {hint}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Middle: Code editor + output */}
                    <div
                        className="col-6 d-flex flex-column border-end"
                        style={{ height: '100%', minHeight: 0 }}
                    >
                        <div style={{ flex: 1, minHeight: 0 }}>
                            <Editor
                                theme="github-light"
                                height="100%"
                                language={selectedLanguage}
                                onMount={handleEditorMount}
                                beforeMount={handleEditorWillMount}
                                options={{
                                    fontSize: 14,
                                    automaticLayout: true,
                                    minimap: { enabled: false },
                                    quickSuggestions: {
                                        other: true,
                                        comments: false,
                                        strings: true,
                                    },
                                    parameterHints: { enabled: true },
                                    suggestOnTriggerCharacters: true,
                                    acceptSuggestionOnEnter: 'on',
                                    tabCompletion: 'on',
                                    wordBasedSuggestions: 'allDocuments',
                                }}
                            />
                        </div>

                        <div style={{ flexShrink: 0, maxHeight: '40vh', overflowY: 'auto' }}>
                            <OutputPanel isExecuting={isExecuting} codeResult={codeResult} />
                        </div>
                    </div>

                    {/* Right: Chat */}
                    <div className="col-3 d-flex flex-column" style={{ height: '100%' }}>
                        <div className="p-2 border-bottom bg-light">
                            <strong>Chat</strong>
                        </div>
                        <div
                            className="flex-grow-1 overflow-auto p-2"
                            style={{ fontSize: '0.85rem' }}
                        >
                            {messages.map((msg, i) => (
                                <div
                                    key={i}
                                    className={`mb-2 ${msg.senderId === userId ? 'text-end' : ''}`}
                                >
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
                                <button
                                    className="btn btn-sm btn-primary"
                                    onClick={handleSendMessage}
                                >
                                    Send
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {submitResult?.passed && (
                <div
                    className="position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center"
                    style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000 }}
                >
                    <div className="card shadow-lg text-center" style={{ width: '400px' }}>
                        <div className="card-body">
                            <h3 className="text-success">Correct Answer!</h3>
                            <p className="text-muted">Session will end in {submitTimer}s</p>
                            <button className="btn btn-primary" onClick={handleLeave}>
                                Leave Now
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {submitResult && !submitResult.passed && (
                <div
                    className="position-fixed bottom-0 start-50 translate-middle-x mb-3"
                    style={{ zIndex: 1000 }}
                >
                    <div className="alert alert-danger d-flex align-items-center gap-2 mb-0">
                        <div>
                            <strong>Wrong Answer.</strong>
                            <div style={{ fontSize: '0.85rem' }}>
                                {submitResult.results?.filter((r: any) => r.passed).length ?? 0}/
                                {submitResult.results?.length ?? 0} test cases passed.
                            </div>
                        </div>
                        <button className="btn-close ms-2" onClick={() => setSubmitResult(null)} />
                    </div>
                </div>
            )}
        </>
    );
};

export default Collab;
