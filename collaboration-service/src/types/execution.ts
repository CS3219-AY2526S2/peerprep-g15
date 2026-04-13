export type ExecutionComparator = 'json' | 'float' | 'string';
export type PythonCodec = 'TreeNode' | 'ListNode';

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

export interface TestCase {
    input: unknown;
    expectedOutput: unknown;
    isHidden: boolean;
    explanation: string;
    weight: number;
}

export interface SubmissionCaseResult {
    input: unknown;
    expected: unknown;
    actual: unknown;
    passed: boolean;
    stderr: string | null;
    compileOutput: string | null;
    message: string | null;
    status: string;
}
