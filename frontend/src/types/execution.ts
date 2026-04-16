export type ExecutionComparator = 'json' | 'float' | 'string';
export type PythonCodec = 'TreeNode' | 'ListNode';

export type FunctionExecutionSpec = {
    kind: 'function';
    className: string;
    methodName: string;
    paramOrder: string[];
    returnMode: 'return' | 'inplace';
    mutateParamIndex?: number;
    codecs?: PythonCodec[];
    comparator: ExecutionComparator;
};

export type DesignExecutionSpec = {
    kind: 'design';
    className: string;
    constructorParamNames: string[];
    methods: {
        name: string;
        paramNames: string[];
        returnType: string;
    }[];
    comparator: ExecutionComparator;
};

export type StdinExecutionSpec = {
    kind: 'stdin';
    comparator: ExecutionComparator;
};

export type SqlExecutionSpec = {
    kind: 'sql';
};

export type ExecutionSpec =
    | FunctionExecutionSpec
    | DesignExecutionSpec
    | StdinExecutionSpec
    | SqlExecutionSpec;

export type TestCase = {
    input: unknown;
    expectedOutput: unknown;
    isHidden: boolean;
    explanation: string;
    weight: number;
};
