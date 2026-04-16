import { useNavigate, useParams } from 'react-router';
import NavBar from '../components/NavBar.tsx';
import AdminNavBar from '../components/AdminNavBar.tsx';
import questionAxios from '../questionAxios.ts';
import { useEffect, useState } from 'react';

type Param = { name: string; type: string };
type FunctionSignature = { name: string; returnType: string; params: Param[] };
type DesignMethod = { name: string; returnType: string; params: Param[] };
type DesignSignature = { className: string; constructorParams: Param[]; methods: DesignMethod[] };
type SqlTable = { name: string; columns: string[] };

type QuestionPayload = {
    questionId: number;
    title: string;
    description: string;
    categories: string[];
    difficulty: string;
    questionType?: 'function' | 'design' | 'sql';
    sourceUrl: string;
    imageUrl: string;
    constraints: string[];
    hints: string[];
    examples?: string[];
    testCases: string[];
    functionSignature?: FunctionSignature;
    designSignature?: DesignSignature;
    sqlTables?: SqlTable[];
    supportedLanguages: string[];
    executionSpec: any;
    __v: number;
};

const EditQuestion = () => {
    const navigate = useNavigate();
    const { questionId } = useParams();
    const name = localStorage.getItem('name') || 'Admin';

    const [formQuestionId, setFormQuestionId] = useState('');
    const [version, setVersion] = useState<number>(0);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [categories, setCategories] = useState('');
    const [difficulty, setDifficulty] = useState('');
    const [sourceUrl, setSourceUrl] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [constraints, setConstraints] = useState('');
    const [hints, setHints] = useState('');
    const [examples, setExamples] = useState('');
    const [testCases, setTestCases] = useState('');
    const [supportedLanguages, setSupportedLanguages] = useState<string[]>([]);
    const [functionName, setFunctionName] = useState('');
    const [returnType, setReturnType] = useState('');
    const [functionParams, setFunctionParams] = useState<Param[]>([{ name: '', type: '' }]);
    const [className, setClassName] = useState('');
    const [constructorParams, setConstructorParams] = useState<Param[]>([{ name: '', type: '' }]);
    const [methods, setMethods] = useState<DesignMethod[]>([
        { name: '', returnType: '', params: [{ name: '', type: '' }] },
    ]);
    const [sqlTables, setSqlTables] = useState<SqlTable[]>([{ name: '', columns: [''] }]);

    const [questionType, setQuestionType] = useState<'function' | 'design' | 'sql'>('function');
    const [executionSpec, setExecutionSpec] = useState<any>({});
    const [errorMessage, setErrorMessage] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchQuestion = async () => {
            try {
                setLoading(true);
                setErrorMessage('');

                const response = await questionAxios.get(`/questions/${questionId}`);
                const question = response.data;
                console.log('Fetched question:', question);

                // Set the form fields with the existing question data
                setFormQuestionId(String(question.questionId ?? ''));
                setTitle(question.title ?? '');
                setDescription(question.description ?? '');
                setCategories(
                    Array.isArray(question.categories) ? question.categories.join(', ') : '',
                );
                setDifficulty(question.difficulty ?? '');
                setSourceUrl(question.sourceUrl ?? '');
                setImageUrl(question.imageUrl ?? '');
                setConstraints(question.constraints ?? '');
                setHints(question.hints ?? '');
                setExamples(question.examples ?? '');
                setTestCases(question.testCases ?? '');
                setSupportedLanguages(question.supportedLanguages ?? []);
                setVersion(Number(question.__v) ?? 0);
                setExecutionSpec(question.executionSpec ?? {});

                // For function, design, and SQL question types
                if (question.questionType === 'function') {
                    setFunctionName(question.functionSignature?.name ?? '');
                    setReturnType(question.functionSignature?.returnType ?? '');
                    // Ensure params is always an array with at least one parameter
                    setFunctionParams(
                        question.functionSignature?.params.length > 0
                            ? question.functionSignature?.params
                            : [{ name: '', type: '' }],
                    );
                    setQuestionType('function');
                }

                if (question.questionType === 'design') {
                    setClassName(question.designSignature?.className ?? '');
                    // Ensure constructorParams is always an array with at least one parameter
                    setConstructorParams(
                        question.designSignature?.constructorParams.length > 0
                            ? question.designSignature?.constructorParams
                            : [{ name: '', type: '' }],
                    );
                    // Ensure methods are always an array with at least one method
                    setMethods(
                        question.designSignature?.methods.length > 0
                            ? question.designSignature?.methods
                            : [{ name: '', returnType: '', params: [{ name: '', type: '' }] }],
                    );
                    setQuestionType('design');
                }

                if (question.questionType === 'sql') {
                    setSqlTables(
                        question.sqlTables.length > 0
                            ? question.sqlTables
                            : [{ name: '', columns: [''] }],
                    );
                    setQuestionType('sql');
                }
            } catch (error: any) {
                console.error('Fetch question error:', error);
                setErrorMessage(error.response?.data?.message || 'Failed to load question.');
            } finally {
                setLoading(false);
            }
        };

        if (questionId) {
            fetchQuestion();
        } else {
            setErrorMessage('Question ID is missing.');
            setLoading(false);
        }
    }, [questionId]);

    const addFunctionParam = () => setFunctionParams([...functionParams, { name: '', type: '' }]);
    const handleFunctionParamChange = (index: number, field: 'name' | 'type', value: string) => {
        const updatedParams = [...functionParams];
        updatedParams[index] = { ...updatedParams[index], [field]: value };
        setFunctionParams(updatedParams);
    };

    const addDesignConstructorParam = () =>
        setConstructorParams([...constructorParams, { name: '', type: '' }]);
    const handleDesignConstructorParamChange = (
        index: number,
        field: 'name' | 'type',
        value: string,
    ) => {
        const updatedParams = [...constructorParams];
        updatedParams[index] = { ...updatedParams[index], [field]: value };
        setConstructorParams(updatedParams);
    };

    const addDesignMethod = () =>
        setMethods([...methods, { name: '', returnType: '', params: [{ name: '', type: '' }] }]);
    const handleDesignMethodChange = (
        methodIndex: number,
        field: 'name' | 'returnType',
        value: string,
    ) => {
        const updatedMethods = [...methods];
        updatedMethods[methodIndex] = { ...updatedMethods[methodIndex], [field]: value };
        setMethods(updatedMethods);
    };

    const handleDesignMethodParamChange = (
        methodIndex: number,
        paramIndex: number,
        field: 'name' | 'type',
        value: string,
    ) => {
        const updatedMethods = [...methods];
        const updatedParams = [...updatedMethods[methodIndex].params];
        updatedParams[paramIndex] = { ...updatedParams[paramIndex], [field]: value };
        updatedMethods[methodIndex] = { ...updatedMethods[methodIndex], params: updatedParams };
        setMethods(updatedMethods);
    };

    const addSqlTable = () => setSqlTables([...sqlTables, { name: '', columns: [''] }]);
    const handleSqlTableChange = (index: number, value: string) => {
        const updatedTables = [...sqlTables];
        updatedTables[index].name = value;
        setSqlTables(updatedTables);
    };

    const handleSqlColumnChange = (tableIndex: number, columnIndex: number, value: string) => {
        const updatedTables = [...sqlTables];
        updatedTables[tableIndex].columns[columnIndex] = value;
        setSqlTables(updatedTables);
    };

    const addSqlColumn = (tableIndex: number) => {
        const updatedTables = [...sqlTables];
        updatedTables[tableIndex].columns.push('');
        setSqlTables(updatedTables);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage('');

        const parsedQuestionId = parseInt(formQuestionId, 10);
        if (Number.isNaN(parsedQuestionId)) {
            setErrorMessage('Question ID must be a valid number.');
            return;
        }

        try {
            // Ensure constraints is a string before calling split
            const constraintsArray =
                typeof constraints === 'string'
                    ? constraints
                          .split(',')
                          .map((c) => c.trim())
                          .filter(Boolean)
                    : [];
            const hintsArray =
                typeof hints === 'string'
                    ? hints
                          .split(',')
                          .map((h) => h.trim())
                          .filter(Boolean)
                    : [];
            const examplesArray =
                typeof examples === 'string'
                    ? examples
                          .split(',')
                          .map((e) => e.trim())
                          .filter(Boolean)
                    : [];
            const testCasesArray =
                typeof testCases === 'string'
                    ? testCases
                          .split(',')
                          .map((t) => t.trim())
                          .filter(Boolean)
                    : [];

            const payload: QuestionPayload = {
                questionId: parsedQuestionId,
                title: title.trim(),
                description: description.trim(),
                categories: categories
                    .split(',')
                    .map((c) => c.trim())
                    .filter(Boolean),
                difficulty,
                sourceUrl: sourceUrl.trim(),
                imageUrl: imageUrl.trim(),
                constraints: constraintsArray,
                hints: hintsArray,
                examples: examplesArray,
                testCases: testCasesArray,
                supportedLanguages,
                __v: version,
                executionSpec: executionSpec, // Adjust if necessary
            };

            // Handle function-specific fields (for function questions)
            if (questionType === 'function') {
                payload.functionSignature = {
                    name: functionName,
                    returnType,
                    params: functionParams.filter((p) => p.name.trim() && p.type.trim()),
                };
                payload.questionType = 'function';
            }

            // Handle design-specific fields (for design questions)
            if (questionType === 'design') {
                payload.designSignature = {
                    className,
                    constructorParams: constructorParams.filter(
                        (p) => p.name.trim() && p.type.trim(),
                    ),
                    methods: methods
                        .filter((m) => m.name.trim())
                        .map((m) => ({
                            name: m.name,
                            returnType: m.returnType,
                            params: m.params.filter((p) => p.name.trim() && p.type.trim()),
                        })),
                };
                payload.questionType = 'design';
            }

            // Handle SQL-specific fields (for SQL questions)
            if (questionType === 'sql') {
                payload.sqlTables = sqlTables
                    .filter((t) => t.name.trim())
                    .map((t) => ({
                        ...t,
                        columns: t.columns.filter((c) => c.trim()),
                    }));
                payload.questionType = 'sql';
            }

            const response = await questionAxios.put(`/questions/${questionId}`, payload);
            console.log('Question updated:', response.data);
            navigate('/admin/questions');
        } catch (error: any) {
            console.log('Update question error:', error);
            console.error('Update question error:', error);
            setErrorMessage(error.response?.data?.message || 'Failed to update question.');
        }
    };

    return (
        <div>
            <NavBar name={name} />
            <div className="d-flex min-vh-100 bg-dark text-white">
                <AdminNavBar />
                <div
                    className="flex-grow-1 p-4"
                    style={{ backgroundColor: '#686868', minHeight: '100vh' }}
                >
                    <div className="container py-5">
                        <div className="row justify-content-center">
                            <div className="col-md-8 col-lg-7">
                                <div className="card shadow-sm">
                                    <div className="card-body p-4">
                                        <h2 className="mb-4 text-center">Edit Question</h2>

                                        {errorMessage && (
                                            <div className="alert alert-danger">{errorMessage}</div>
                                        )}
                                        {loading ? (
                                            <div className="text-center">
                                                Loading question data...
                                            </div>
                                        ) : (
                                            <form onSubmit={handleSubmit}>
                                                <div className="mb-3">
                                                    <label
                                                        htmlFor="questionId"
                                                        className="form-label fw-bold"
                                                    >
                                                        Question ID
                                                    </label>
                                                    <input
                                                        id="questionId"
                                                        type="number"
                                                        className="form-control"
                                                        value={questionId}
                                                        disabled
                                                    />
                                                </div>

                                                <div className="mb-3">
                                                    <label
                                                        htmlFor="title"
                                                        className="form-label fw-bold"
                                                    >
                                                        Title{' '}
                                                        <span style={{ color: 'red' }}>*</span>
                                                    </label>
                                                    <input
                                                        id="title"
                                                        type="text"
                                                        className="form-control"
                                                        value={title}
                                                        onChange={(e) => setTitle(e.target.value)}
                                                        required
                                                    />
                                                </div>

                                                <div className="mb-3">
                                                    <label
                                                        htmlFor="description"
                                                        className="form-label fw-bold"
                                                    >
                                                        Description{' '}
                                                        <span style={{ color: 'red' }}>*</span>
                                                    </label>
                                                    <textarea
                                                        id="description"
                                                        className="form-control"
                                                        rows={4}
                                                        value={description}
                                                        onChange={(e) =>
                                                            setDescription(e.target.value)
                                                        }
                                                        required
                                                    />
                                                </div>

                                                <div className="mb-3">
                                                    <label
                                                        htmlFor="categories"
                                                        className="form-label fw-bold"
                                                    >
                                                        Categories{' '}
                                                        <span style={{ color: 'red' }}>*</span>
                                                    </label>
                                                    <input
                                                        id="categories"
                                                        type="text"
                                                        className="form-control"
                                                        value={categories}
                                                        onChange={(e) =>
                                                            setCategories(e.target.value)
                                                        }
                                                        required
                                                    />
                                                    <div className="form-text">
                                                        Separate multiple categories with commas.
                                                    </div>
                                                </div>

                                                <div className="mb-3">
                                                    <label
                                                        htmlFor="difficulty"
                                                        className="form-label fw-bold"
                                                    >
                                                        Difficulty{' '}
                                                        <span style={{ color: 'red' }}>*</span>
                                                    </label>
                                                    <select
                                                        id="difficulty"
                                                        className="form-select"
                                                        value={difficulty}
                                                        onChange={(e) =>
                                                            setDifficulty(e.target.value)
                                                        }
                                                        required
                                                    >
                                                        <option value="">Select difficulty</option>
                                                        <option value="Easy">Easy</option>
                                                        <option value="Medium">Medium</option>
                                                        <option value="Hard">Hard</option>
                                                    </select>
                                                </div>

                                                {/* Optional Fields */}
                                                <div className="mb-3">
                                                    <label
                                                        htmlFor="supportedLanguages"
                                                        className="form-label fw-bold"
                                                    >
                                                        Supported Languages
                                                    </label>
                                                    <select
                                                        id="supportedLanguages"
                                                        className="form-select"
                                                        multiple
                                                        value={supportedLanguages}
                                                        onChange={(e) => {
                                                            const selectedLanguages = Array.from(
                                                                e.target.selectedOptions,
                                                                (option) => option.value,
                                                            );
                                                            setSupportedLanguages(
                                                                selectedLanguages,
                                                            );
                                                        }}
                                                    >
                                                        <option value="python">Python</option>
                                                        <option value="javascript">
                                                            JavaScript
                                                        </option>
                                                        <option value="java">Java</option>
                                                        <option value="cpp">C++</option>
                                                    </select>
                                                    <div className="form-text">
                                                        Hold 'Ctrl' or 'Cmd' to select multiple
                                                        languages.
                                                    </div>
                                                </div>

                                                <div className="mb-3">
                                                    <label
                                                        htmlFor="sourceUrl"
                                                        className="form-label fw-bold"
                                                    >
                                                        Source URL
                                                    </label>
                                                    <input
                                                        id="sourceUrl"
                                                        type="text"
                                                        className="form-control"
                                                        value={sourceUrl}
                                                        onChange={(e) =>
                                                            setSourceUrl(e.target.value)
                                                        }
                                                    />
                                                </div>

                                                <div className="mb-3">
                                                    <label
                                                        htmlFor="imageUrl"
                                                        className="form-label fw-bold"
                                                    >
                                                        Image URL
                                                    </label>
                                                    <input
                                                        id="imageUrl"
                                                        type="text"
                                                        className="form-control"
                                                        value={imageUrl}
                                                        onChange={(e) =>
                                                            setImageUrl(e.target.value)
                                                        }
                                                    />
                                                </div>

                                                <div className="mb-3">
                                                    <label
                                                        htmlFor="constraints"
                                                        className="form-label fw-bold"
                                                    >
                                                        Constraints
                                                    </label>
                                                    <textarea
                                                        id="constraints"
                                                        className="form-control"
                                                        rows={3}
                                                        value={constraints}
                                                        onChange={(e) =>
                                                            setConstraints(e.target.value)
                                                        }
                                                    />
                                                </div>

                                                <div className="mb-3">
                                                    <label
                                                        htmlFor="hints"
                                                        className="form-label fw-bold"
                                                    >
                                                        Hints
                                                    </label>
                                                    <textarea
                                                        id="hints"
                                                        className="form-control"
                                                        rows={3}
                                                        value={hints}
                                                        onChange={(e) => setHints(e.target.value)}
                                                    />
                                                </div>

                                                <div className="mb-3">
                                                    <label
                                                        htmlFor="testCases"
                                                        className="form-label fw-bold"
                                                    >
                                                        Test Cases
                                                    </label>
                                                    <textarea
                                                        id="testCases"
                                                        className="form-control"
                                                        rows={3}
                                                        value={testCases}
                                                        onChange={(e) =>
                                                            setTestCases(e.target.value)
                                                        }
                                                    />
                                                </div>

                                                <div className="mb-3">
                                                    <label
                                                        htmlFor="examples"
                                                        className="form-label fw-bold"
                                                    >
                                                        Examples
                                                    </label>
                                                    <textarea
                                                        id="examples"
                                                        className="form-control"
                                                        rows={3}
                                                        value={examples}
                                                        onChange={(e) =>
                                                            setExamples(e.target.value)
                                                        }
                                                    />
                                                </div>

                                                {/* Conditional Fields for Function, Design, SQL */}
                                                <div className="mb-3">
                                                    <label
                                                        htmlFor="questionType"
                                                        className="form-label fw-bold"
                                                    >
                                                        Question Type{' '}
                                                        <span style={{ color: 'red' }}>*</span>
                                                    </label>
                                                    <select
                                                        id="questionType"
                                                        className="form-select"
                                                        value={questionType}
                                                        onChange={(e) =>
                                                            setQuestionType(
                                                                e.target.value as
                                                                    | 'function'
                                                                    | 'design'
                                                                    | 'sql',
                                                            )
                                                        }
                                                        required
                                                    >
                                                        <option value="function">Function</option>
                                                        <option value="design">Design</option>
                                                        <option value="sql">SQL</option>
                                                    </select>
                                                </div>

                                                {questionType === 'function' && (
                                                    <>
                                                        <div className="mb-3">
                                                            <label
                                                                htmlFor="functionName"
                                                                className="form-label fw-bold"
                                                            >
                                                                Function Name{' '}
                                                                <span style={{ color: 'red' }}>
                                                                    *
                                                                </span>
                                                            </label>
                                                            <input
                                                                id="functionName"
                                                                type="text"
                                                                className="form-control"
                                                                value={functionName}
                                                                onChange={(e) =>
                                                                    setFunctionName(e.target.value)
                                                                }
                                                                required
                                                            />
                                                        </div>

                                                        <div className="mb-3">
                                                            <label
                                                                htmlFor="returnType"
                                                                className="form-label fw-bold"
                                                            >
                                                                Return Type
                                                            </label>
                                                            <input
                                                                id="returnType"
                                                                type="text"
                                                                className="form-control"
                                                                value={returnType}
                                                                onChange={(e) =>
                                                                    setReturnType(e.target.value)
                                                                }
                                                            />
                                                        </div>

                                                        <div className="mb-3">
                                                            <label className="form-label fw-bold">
                                                                Parameters
                                                            </label>
                                                            {functionParams.map((param, index) => (
                                                                <div
                                                                    key={index}
                                                                    className="row g-2 mb-2"
                                                                >
                                                                    <div className="col">
                                                                        <input
                                                                            className="form-control"
                                                                            placeholder="Param name"
                                                                            value={param.name}
                                                                            onChange={(e) =>
                                                                                handleFunctionParamChange(
                                                                                    index,
                                                                                    'name',
                                                                                    e.target.value,
                                                                                )
                                                                            }
                                                                        />
                                                                    </div>
                                                                    <div className="col">
                                                                        <input
                                                                            className="form-control"
                                                                            placeholder="Param type"
                                                                            value={param.type}
                                                                            onChange={(e) =>
                                                                                handleFunctionParamChange(
                                                                                    index,
                                                                                    'type',
                                                                                    e.target.value,
                                                                                )
                                                                            }
                                                                        />
                                                                    </div>
                                                                </div>
                                                            ))}
                                                            <button
                                                                type="button"
                                                                className="btn btn-outline-secondary btn-sm"
                                                                onClick={addFunctionParam}
                                                            >
                                                                Add Parameter
                                                            </button>
                                                        </div>
                                                    </>
                                                )}

                                                {/* Design Fields */}
                                                {questionType === 'design' && (
                                                    <>
                                                        <div className="mb-3">
                                                            <label
                                                                htmlFor="className"
                                                                className="form-label fw-bold"
                                                            >
                                                                Class Name{' '}
                                                                <span style={{ color: 'red' }}>
                                                                    *
                                                                </span>
                                                            </label>
                                                            <input
                                                                id="className"
                                                                type="text"
                                                                className="form-control"
                                                                value={className}
                                                                onChange={(e) =>
                                                                    setClassName(e.target.value)
                                                                }
                                                                required
                                                            />
                                                        </div>

                                                        <div className="mb-3">
                                                            <label className="form-label fw-bold">
                                                                Constructor Parameters
                                                            </label>
                                                            {constructorParams.map(
                                                                (param, index) => (
                                                                    <div
                                                                        key={index}
                                                                        className="row g-2 mb-2"
                                                                    >
                                                                        <div className="col">
                                                                            <input
                                                                                className="form-control"
                                                                                placeholder="Param name"
                                                                                value={param.name}
                                                                                onChange={(e) =>
                                                                                    handleDesignConstructorParamChange(
                                                                                        index,
                                                                                        'name',
                                                                                        e.target
                                                                                            .value,
                                                                                    )
                                                                                }
                                                                            />
                                                                        </div>
                                                                        <div className="col">
                                                                            <input
                                                                                className="form-control"
                                                                                placeholder="Param type"
                                                                                value={param.type}
                                                                                onChange={(e) =>
                                                                                    handleDesignConstructorParamChange(
                                                                                        index,
                                                                                        'type',
                                                                                        e.target
                                                                                            .value,
                                                                                    )
                                                                                }
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                ),
                                                            )}
                                                            <button
                                                                type="button"
                                                                className="btn btn-outline-secondary btn-sm"
                                                                onClick={addDesignConstructorParam}
                                                            >
                                                                Add Constructor Param
                                                            </button>
                                                        </div>

                                                        <div className="mb-3">
                                                            <label className="form-label fw-bold">
                                                                Methods
                                                            </label>
                                                            {methods.map((method, methodIndex) => (
                                                                <div
                                                                    key={methodIndex}
                                                                    className="border rounded p-3 mb-3"
                                                                >
                                                                    <div className="mb-2">
                                                                        <input
                                                                            className="form-control"
                                                                            placeholder="Method name"
                                                                            value={method.name}
                                                                            onChange={(e) =>
                                                                                handleDesignMethodChange(
                                                                                    methodIndex,
                                                                                    'name',
                                                                                    e.target.value,
                                                                                )
                                                                            }
                                                                        />
                                                                    </div>
                                                                    <div className="mb-2">
                                                                        <input
                                                                            className="form-control"
                                                                            placeholder="Return type"
                                                                            value={
                                                                                method.returnType
                                                                            }
                                                                            onChange={(e) =>
                                                                                handleDesignMethodChange(
                                                                                    methodIndex,
                                                                                    'returnType',
                                                                                    e.target.value,
                                                                                )
                                                                            }
                                                                        />
                                                                    </div>
                                                                    {method.params.map(
                                                                        (param, paramIndex) => (
                                                                            <div
                                                                                key={paramIndex}
                                                                                className="row g-2 mb-2"
                                                                            >
                                                                                <div className="col">
                                                                                    <input
                                                                                        className="form-control"
                                                                                        placeholder="Param name"
                                                                                        value={
                                                                                            param.name
                                                                                        }
                                                                                        onChange={(
                                                                                            e,
                                                                                        ) =>
                                                                                            handleDesignMethodParamChange(
                                                                                                methodIndex,
                                                                                                paramIndex,
                                                                                                'name',
                                                                                                e
                                                                                                    .target
                                                                                                    .value,
                                                                                            )
                                                                                        }
                                                                                    />
                                                                                </div>
                                                                                <div className="col">
                                                                                    <input
                                                                                        className="form-control"
                                                                                        placeholder="Param type"
                                                                                        value={
                                                                                            param.type
                                                                                        }
                                                                                        onChange={(
                                                                                            e,
                                                                                        ) =>
                                                                                            handleDesignMethodParamChange(
                                                                                                methodIndex,
                                                                                                paramIndex,
                                                                                                'type',
                                                                                                e
                                                                                                    .target
                                                                                                    .value,
                                                                                            )
                                                                                        }
                                                                                    />
                                                                                </div>
                                                                            </div>
                                                                        ),
                                                                    )}
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-outline-secondary btn-sm"
                                                                        onClick={() =>
                                                                            addDesignMethod()
                                                                        }
                                                                    >
                                                                        Add Method
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </>
                                                )}

                                                {/* SQL Fields */}
                                                {questionType === 'sql' && (
                                                    <>
                                                        <div className="mb-3">
                                                            <label className="form-label fw-bold">
                                                                SQL Tables
                                                            </label>
                                                            {sqlTables.map((table, tableIndex) => (
                                                                <div
                                                                    key={tableIndex}
                                                                    className="border rounded p-3 mb-3"
                                                                >
                                                                    <div className="mb-2">
                                                                        <label className="form-label fw-bold">
                                                                            Table Name{' '}
                                                                            <span
                                                                                style={{
                                                                                    color: 'red',
                                                                                }}
                                                                            >
                                                                                *
                                                                            </span>
                                                                        </label>
                                                                        <input
                                                                            className="form-control"
                                                                            value={table.name}
                                                                            onChange={(e) =>
                                                                                handleSqlTableChange(
                                                                                    tableIndex,
                                                                                    e.target.value,
                                                                                )
                                                                            }
                                                                            required
                                                                        />
                                                                    </div>
                                                                    <div className="mb-2">
                                                                        <label className="form-label fw-bold">
                                                                            Columns
                                                                        </label>
                                                                        {table.columns.map(
                                                                            (
                                                                                column,
                                                                                columnIndex,
                                                                            ) => (
                                                                                <div
                                                                                    key={
                                                                                        columnIndex
                                                                                    }
                                                                                    className="mb-2"
                                                                                >
                                                                                    <input
                                                                                        className="form-control"
                                                                                        placeholder="Column name"
                                                                                        value={
                                                                                            column
                                                                                        }
                                                                                        onChange={(
                                                                                            e,
                                                                                        ) =>
                                                                                            handleSqlColumnChange(
                                                                                                tableIndex,
                                                                                                columnIndex,
                                                                                                e
                                                                                                    .target
                                                                                                    .value,
                                                                                            )
                                                                                        }
                                                                                    />
                                                                                </div>
                                                                            ),
                                                                        )}
                                                                        <button
                                                                            type="button"
                                                                            className="btn btn-outline-secondary btn-sm"
                                                                            onClick={() =>
                                                                                addSqlColumn(
                                                                                    tableIndex,
                                                                                )
                                                                            }
                                                                        >
                                                                            Add Column
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                            <button
                                                                type="button"
                                                                className="btn btn-outline-secondary btn-sm"
                                                                onClick={addSqlTable}
                                                            >
                                                                Add Table
                                                            </button>
                                                        </div>
                                                    </>
                                                )}

                                                <button
                                                    type="submit"
                                                    className="btn btn-primary w-100"
                                                >
                                                    Update
                                                </button>
                                            </form>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EditQuestion;
