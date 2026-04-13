export type ExecutionComparator = 'json' | 'float' | 'string';
export type PythonCodec = 'TreeNode' | 'ListNode';

export interface FunctionParam {
    name: string;
    type: string;
}

export interface FunctionSignature {
    name: string;
    returnType: string;
    params: FunctionParam[];
}

export interface DesignMethod {
    name: string;
    returnType: string;
    params: FunctionParam[];
}

export interface DesignSignature {
    className: string;
    constructorParams: FunctionParam[];
    methods: DesignMethod[];
}

export interface FunctionExecutionSpec {
    kind: 'function';
    className: string;
    methodName: string;
    paramOrder: string[];
    returnMode: 'return' | 'inplace';
    mutateParamIndex?: number;
    codecs?: PythonCodec[];
    comparator: ExecutionComparator;
}

export interface DesignExecutionSpec {
    kind: 'design';
    className: string;
    constructorParamNames: string[];
    methods: {
        name: string;
        paramNames: string[];
        returnType: string;
    }[];
    comparator: ExecutionComparator;
}

export interface StdinExecutionSpec {
    kind: 'stdin';
    comparator: ExecutionComparator;
}

export interface SqlExecutionSpec {
    kind: 'sql';
}

export type ExecutionSpec =
    | FunctionExecutionSpec
    | DesignExecutionSpec
    | StdinExecutionSpec
    | SqlExecutionSpec;

export interface BaseSeedQuestion {
    questionId: number;
    title: string;
    description: string;
    categories: string[];
    difficulty: 'Easy' | 'Medium' | 'Hard';
    questionType: 'function' | 'design' | 'sql';
    imageUrl: string;
    sourceUrl: string;
    constraints: string[];
    hints: string[];
    examples: {
        input: string;
        output: string;
        explanation: string;
    }[];
    testCases: {
        input: unknown;
        expectedOutput: unknown;
        isHidden: boolean;
        explanation: string;
        weight: number;
    }[];
    supportedLanguages: string[];
    starterCode: Map<string, string>;
    sqlTables: {
        name: string;
        columns: string[];
    }[];
    timeLimitMs: number;
    memoryLimitMb: number;
}

export interface FunctionSeedQuestion extends BaseSeedQuestion {
    questionType: 'function';
    functionSignature: FunctionSignature;
    designSignature: null;
}

export interface DesignSeedQuestion extends BaseSeedQuestion {
    questionType: 'design';
    functionSignature: null;
    designSignature: DesignSignature;
}

export interface SqlSeedQuestion extends BaseSeedQuestion {
    questionType: 'sql';
    functionSignature: null;
    designSignature: null;
}

export type SeedQuestion = FunctionSeedQuestion | DesignSeedQuestion | SqlSeedQuestion;

function inferComparator(returnType: string): ExecutionComparator {
    const normalized = returnType.trim().toLowerCase();

    if (normalized === 'float' || normalized === 'double' || normalized === 'number') {
        return 'float';
    }

    return 'json';
}

function inferCodecs(params: FunctionParam[]): PythonCodec[] {
    const codecs = new Set<PythonCodec>();

    for (const param of params) {
        if (param.type === 'TreeNode') codecs.add('TreeNode');
        if (param.type === 'ListNode') codecs.add('ListNode');
    }

    return Array.from(codecs);
}

function inferReturnMode(signature: FunctionSignature): 'return' | 'inplace' {
    return signature.returnType.trim().toLowerCase() === 'void' ? 'inplace' : 'return';
}

function inferMutateParamIndex(signature: FunctionSignature): number | undefined {
    return inferReturnMode(signature) === 'inplace' ? 0 : undefined;
}

export function inferExecutionSpec(question: SeedQuestion): ExecutionSpec {
    if (question.questionType === 'sql') {
        return { kind: 'sql' };
    }

    if (question.questionType === 'design') {
        return {
            kind: 'design',
            className: question.designSignature.className,
            constructorParamNames: question.designSignature.constructorParams.map((p) => p.name),
            methods: question.designSignature.methods.map((method) => ({
                name: method.name,
                paramNames: method.params.map((p) => p.name),
                returnType: method.returnType,
            })),
            comparator: 'json',
        };
    }

    const returnMode = inferReturnMode(question.functionSignature);
    const codecs = inferCodecs(question.functionSignature.params);
    const comparator = inferComparator(question.functionSignature.returnType);

    return {
        kind: 'function',
        className: 'Solution',
        methodName: question.functionSignature.name,
        paramOrder: question.functionSignature.params.map((p) => p.name),
        returnMode,
        mutateParamIndex: inferMutateParamIndex(question.functionSignature),
        codecs: codecs.length > 0 ? codecs : undefined,
        comparator,
    };
}
