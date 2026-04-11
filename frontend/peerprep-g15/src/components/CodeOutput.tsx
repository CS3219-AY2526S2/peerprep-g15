import { useEffect, useState } from 'react';

type CaseResult = {
    input: unknown;
    expected: unknown;
    actual: unknown;
    passed: boolean;
    stderr?: string | null;
    compileOutput?: string | null;
    message?: string | null;
    status: string;
};

type CodeResult = {
    passed?: boolean;
    results?: CaseResult[];
    error?: string;
    stdout?: string | null;
    stderr?: string | null;
    compileOutput?: string | null;
    message?: string | null;
    status?: string;
};

const panelStyle: React.CSSProperties = {
    border: '1px solid #dee2e6',
    borderRadius: '0.5rem',
    background: '#fff',
};

const boxStyle = (background: string): React.CSSProperties => ({
    background,
    border: '1px solid #dee2e6',
    borderRadius: '0.5rem',
    padding: '0.75rem',
    minHeight: '96px',
});

function formatValue(value: unknown): string {
    if (value === null || value === undefined || value === '') return '';
    if (typeof value === 'string') return value;

    try {
        // If object has only one key, show just the value
        if (typeof value === 'object' && !Array.isArray(value)) {
            const keys = Object.keys(value as object);
            if (keys.length === 1) {
                return JSON.stringify((value as any)[keys[0]]);
            }
        }
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

function renderOutput(result: CaseResult): string {
    if (result.actual !== null && result.actual !== undefined && result.actual !== '') {
        return formatValue(result.actual);
    }

    if (result.stderr || result.compileOutput || result.message) {
        return '[execution failed before producing stdout]';
    }

    return 'no output';
}

const PreBlock = ({ value }: { value: string }) => (
    <pre
        className="mb-0"
        style={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            overflowWrap: 'anywhere',
            fontFamily: 'monospace',
            fontSize: '0.9rem',
        }}
    >
        {value}
    </pre>
);

const OutputPanel = ({
    isExecuting,
    codeResult,
}: {
    isExecuting: boolean;
    codeResult: CodeResult | null;
}) => {
    const [activeTab, setActiveTab] = useState(0);

    useEffect(() => {
        setActiveTab(0);
    }, [codeResult]);

    if (isExecuting) {
        return <div className="mt-3">Running...</div>;
    }

    if (!codeResult) return null;

    if (codeResult.error) {
        return (
            <div className="mt-3 alert alert-danger">
                Error: <code>{codeResult.error}</code>
            </div>
        );
    }

    const results = codeResult.results ?? [];

    if (results.length === 0) {
        return (
            <div
                className="mt-3"
                style={{
                    ...panelStyle,
                    maxHeight: '40vh',
                    overflowY: 'auto',
                }}
            >
                <div className="p-3 border-bottom fw-semibold">Execution Result</div>
                <div className="p-3">
                    {codeResult.stdout ? (
                        <PreBlock value={codeResult.stdout} />
                    ) : (
                        <span>no output</span>
                    )}

                    {codeResult.stderr && (
                        <div className="mt-3">
                            <div className="fw-semibold mb-2">STDERR</div>
                            <div style={boxStyle('#fff5f5')}>
                                <PreBlock value={codeResult.stderr} />
                            </div>
                        </div>
                    )}

                    {codeResult.compileOutput && (
                        <div className="mt-3">
                            <div className="fw-semibold mb-2">COMPILE OUTPUT</div>
                            <div style={boxStyle('#fff5f5')}>
                                <PreBlock value={codeResult.compileOutput} />
                            </div>
                        </div>
                    )}

                    {codeResult.message && (
                        <div className="mt-3">
                            <div className="fw-semibold mb-2">MESSAGE</div>
                            <div style={boxStyle('#fff5f5')}>
                                <PreBlock value={codeResult.message} />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    const active = results[activeTab];

    return (
        <div className="mt-3" style={panelStyle}>
            <div
                className="d-flex align-items-center border-bottom"
                style={{ overflowX: 'auto', background: '#f8f9fa' }}
            >
                {results.map((r, i) => (
                    <button
                        key={i}
                        onClick={() => setActiveTab(i)}
                        className="btn btn-sm rounded-0 border-0 border-end px-3 py-2 d-flex align-items-center gap-1"
                        style={{
                            fontWeight: activeTab === i ? 600 : 400,
                            borderBottom:
                                activeTab === i ? '2px solid #0d6efd' : '2px solid transparent',
                            background: activeTab === i ? '#fff' : 'transparent',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        <span>{r.passed ? '✓' : '✗'}</span>
                        <span>Case {i + 1}</span>
                    </button>
                ))}

                <div className="ms-auto px-3 py-2">
                    <span
                        className={`badge ${results.every((r) => r.passed) ? 'bg-success' : 'bg-danger'}`}
                    >
                        {results.filter((r) => r.passed).length}/{results.length} passed
                    </span>
                </div>
            </div>

            {active && (
                <div className="p-3">
                    <div className="row g-3">
                        <div className="col-md-6">
                            <div className="fw-semibold mb-2">INPUT</div>
                            <div style={boxStyle('#f8f9fa')}>
                                <PreBlock value={formatValue(active.input)} />
                            </div>
                        </div>

                        <div className="col-md-6">
                            <div className="fw-semibold mb-2">EXPECTED</div>
                            <div style={boxStyle('#edf7ed')}>
                                <PreBlock value={formatValue(active.expected)} />
                            </div>
                        </div>

                        <div className="col-12">
                            <div className="fw-semibold mb-2">YOUR OUTPUT</div>
                            <div style={boxStyle(active.passed ? '#edf7ed' : '#fff5f5')}>
                                <PreBlock value={renderOutput(active)} />
                            </div>
                        </div>

                        <div className="col-12">
                            <div className="fw-semibold mb-2">STATUS</div>
                            <div style={boxStyle(active.passed ? '#edf7ed' : '#fff5f5')}>
                                <PreBlock value={active.status} />
                            </div>
                        </div>

                        {active.stderr && (
                            <div className="col-12">
                                <div className="fw-semibold mb-2">STDERR</div>
                                <div style={boxStyle('#fff5f5')}>
                                    <PreBlock value={active.stderr} />
                                </div>
                            </div>
                        )}

                        {active.compileOutput && (
                            <div className="col-12">
                                <div className="fw-semibold mb-2">COMPILE OUTPUT</div>
                                <div style={boxStyle('#fff5f5')}>
                                    <PreBlock value={active.compileOutput} />
                                </div>
                            </div>
                        )}

                        {active.message && (
                            <div className="col-12">
                                <div className="fw-semibold mb-2">MESSAGE</div>
                                <div style={boxStyle('#fff5f5')}>
                                    <PreBlock value={active.message} />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default OutputPanel;
