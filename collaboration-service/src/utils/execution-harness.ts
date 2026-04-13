import { ExecutionSpec, TestCase } from '../types/execution';

function escapePythonTripleQuotedString(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/"""/g, '\\"""');
}

function jsonLiteral(value: unknown): string {
    return JSON.stringify(value);
}

function pythonCodecHelpers(codecs?: string[]): string {
    const codecSet = new Set(codecs ?? []);
    const blocks: string[] = [];

    if (codecSet.has('TreeNode')) {
        blocks.push(
            `
class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

def build_tree(values):
    if values is None or len(values) == 0:
        return None
    nodes = [None if v is None else TreeNode(v) for v in values]
    kids = nodes[::-1]
    root = kids.pop()
    for node in nodes:
        if node is not None:
            if kids:
                node.left = kids.pop()
            if kids:
                node.right = kids.pop()
    return root

def serialize_tree(root):
    if root is None:
        return []
    out = []
    queue = [root]
    while queue:
        node = queue.pop(0)
        if node is None:
            out.append(None)
            continue
        out.append(node.val)
        queue.append(node.left)
        queue.append(node.right)
    while out and out[-1] is None:
        out.pop()
    return out
`.trim(),
        );
    }

    if (codecSet.has('ListNode')) {
        blocks.push(
            `
class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

def build_linked_list(values):
    dummy = ListNode()
    curr = dummy
    for value in values or []:
        curr.next = ListNode(value)
        curr = curr.next
    return dummy.next

def serialize_linked_list(head):
    out = []
    curr = head
    while curr is not None:
        out.append(curr.val)
        curr = curr.next
    return out
`.trim(),
        );
    }

    return blocks.join('\n\n');
}

function pythonDecodeValueByType(typeName: string, expression: string): string {
    if (typeName === 'TreeNode') return `build_tree(${expression})`;
    if (typeName === 'ListNode') return `build_linked_list(${expression})`;
    return expression;
}

function pythonSerializeValueByType(typeName: string, expression: string): string {
    if (typeName === 'TreeNode') return `serialize_tree(${expression})`;
    if (typeName === 'ListNode') return `serialize_linked_list(${expression})`;
    return expression;
}

function pythonComparatorPreamble(comparator: string): string {
    if (comparator === 'float') {
        return `
def normalize_output(value):
    if isinstance(value, float):
        return round(value, 10)
    return value
`.trim();
    }

    return `
def normalize_output(value):
    return value
`.trim();
}

function buildPythonFunctionHarness(
    userCode: string,
    testCase: TestCase,
    execution: Extract<ExecutionSpec, { kind: 'function' }>,
): { source_code: string; stdin?: string } {
    const rawInput = jsonLiteral(testCase.input);
    const className = execution.className || 'Solution';
    const methodName = execution.methodName;
    const paramOrder = execution.paramOrder ?? [];
    const codecs = execution.codecs ?? [];

    const decodeLines = paramOrder.map((paramName) => {
        const codec = codecs.find((c) => c === 'TreeNode' || c === 'ListNode');
        return `args.append(decoded_input[${JSON.stringify(paramName)}])`;
    });

    const typedDecodeLines = paramOrder.map((paramName) => {
        let typeName: string | undefined;
        if (paramName.toLowerCase().includes('root') && codecs.includes('TreeNode')) {
            typeName = 'TreeNode';
        } else if (
            (paramName.toLowerCase().includes('head') ||
                paramName.toLowerCase().includes('list')) &&
            codecs.includes('ListNode')
        ) {
            typeName = 'ListNode';
        }

        const baseExpr = `decoded_input[${JSON.stringify(paramName)}]`;
        const finalExpr = typeName ? pythonDecodeValueByType(typeName, baseExpr) : baseExpr;
        return `args.append(${finalExpr})`;
    });

    const outputExpr =
        execution.returnMode === 'inplace'
            ? pythonSerializeValueByType(
                  codecs.includes('TreeNode')
                      ? 'TreeNode'
                      : codecs.includes('ListNode')
                        ? 'ListNode'
                        : '',
                  `args[${execution.mutateParamIndex ?? 0}]`,
              )
            : `result`;

    const serializedReturnExpr =
        execution.returnMode === 'return' && codecs.length > 0
            ? (() => {
                  if (codecs.includes('TreeNode'))
                      return pythonSerializeValueByType('TreeNode', 'result');
                  if (codecs.includes('ListNode'))
                      return pythonSerializeValueByType('ListNode', 'result');
                  return 'result';
              })()
            : outputExpr;

    const sourceCode = `
import json
from typing import *

${pythonCodecHelpers(codecs)}

${pythonComparatorPreamble(execution.comparator)}

${userCode}

decoded_input = json.loads("""${escapePythonTripleQuotedString(rawInput)}""")
args = []
${typedDecodeLines.length > 0 ? typedDecodeLines.join('\n') : decodeLines.join('\n')}

solver = ${className}()
result = getattr(solver, "${methodName}")(*args)

final_output = ${execution.returnMode === 'inplace' ? outputExpr : serializedReturnExpr}
print(json.dumps(normalize_output(final_output), separators=(",", ":")))
`.trim();

    return { source_code: sourceCode };
}

function buildPythonDesignHarness(
    userCode: string,
    testCase: TestCase,
    execution: Extract<ExecutionSpec, { kind: 'design' }>,
): { source_code: string; stdin?: string } {
    const rawInput = jsonLiteral(testCase.input);
    const className = execution.className;

    const sourceCode = `
import json
from typing import *

${userCode}

payload = json.loads("""${escapePythonTripleQuotedString(rawInput)}""")
operations = payload["operations"]
arguments = payload["arguments"]

results = []
instance = None

for i, op in enumerate(operations):
    args = arguments[i]

    if op == "${className}":
        instance = ${className}(*args)
        results.append(None)
    else:
        method = getattr(instance, op)
        value = method(*args)
        results.append(value)

print(json.dumps(results, separators=(",", ":")))
`.trim();

    return { source_code: sourceCode };
}

function buildPythonStdinHarness(
    userCode: string,
    testCase: TestCase,
): { source_code: string; stdin?: string } {
    let stdin = '';

    if (typeof testCase.input === 'string') {
        stdin = testCase.input;
    } else {
        stdin = JSON.stringify(testCase.input);
    }

    return {
        source_code: userCode,
        stdin,
    };
}

function buildSubmissionPayloadPython(
    code: string,
    testCase: TestCase,
    execution: ExecutionSpec,
): { source_code: string; stdin?: string } {
    if (execution.kind === 'stdin') {
        return buildPythonStdinHarness(code, testCase);
    }

    if (execution.kind === 'function') {
        return buildPythonFunctionHarness(code, testCase, execution);
    }

    if (execution.kind === 'design') {
        return buildPythonDesignHarness(code, testCase, execution);
    }

    throw new Error(`Unsupported python execution kind: ${execution.kind}`);
}

export function buildSubmissionPayload(
    code: string,
    language: string,
    testCase: TestCase,
    execution: ExecutionSpec,
): { source_code: string; stdin?: string } {
    if (execution.kind === 'sql') {
        throw new Error('SQL execution is not supported by this harness');
    }

    if (language !== 'python') {
        if (execution.kind === 'stdin') {
            let stdin = '';
            if (typeof testCase.input === 'string') {
                stdin = testCase.input;
            } else {
                stdin = JSON.stringify(testCase.input);
            }

            return {
                source_code: code,
                stdin,
            };
        }

        throw new Error(
            `Execution kind "${execution.kind}" is not yet implemented for language "${language}"`,
        );
    }

    return buildSubmissionPayloadPython(code, testCase, execution);
}

export function parseActualOutput(stdout: string | null | undefined): unknown {
    const trimmed = (stdout ?? '').trim();
    if (!trimmed) return '';

    try {
        return JSON.parse(trimmed);
    } catch {
        return trimmed;
    }
}

function normalizeFloat(value: unknown): unknown {
    if (typeof value === 'number') {
        return Number(value.toFixed(10));
    }

    if (Array.isArray(value)) {
        return value.map(normalizeFloat);
    }

    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>).map(([k, v]) => [
                k,
                normalizeFloat(v),
            ]),
        );
    }

    return value;
}

export function getComparator(execution: ExecutionSpec): 'json' | 'float' | 'string' {
    if (execution.kind === 'sql') {
        return 'string';
    }

    return execution.comparator;
}

export function normalizeComparable(
    value: unknown,
    comparator: 'json' | 'float' | 'string' = 'json',
): string {
    if (value === null || value === undefined) return '';

    if (comparator === 'string') {
        return String(value).trim();
    }

    if (comparator === 'float') {
        const normalized = normalizeFloat(value);
        return JSON.stringify(normalized);
    }

    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return JSON.stringify(parsed);
        } catch {
            return value.trim();
        }
    }

    return JSON.stringify(value);
}
