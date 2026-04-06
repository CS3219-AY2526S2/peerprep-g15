export const sampleQuestions = [
    {
        questionId: 1,
        title: 'Repeated DNA Sequences',
        description:
            'The DNA sequence is composed of a series of nucleotides abbreviated as A, C, G, and T. Return all the 10-letter-long sequences that occur more than once in a DNA molecule.',
        categories: ['Algorithms', 'Bit Manipulation'],
        difficulty: 'Medium',
        questionType: 'function',
        imageUrl: '',
        sourceUrl: 'https://leetcode.com/problems/repeated-dna-sequences/',
        constraints: ['1 <= s.length <= 10^5', 's[i] is either A, C, G, or T'],
        hints: [],
        examples: [
            {
                input: 's = "AAAAACCCCCAAAAACCCCCCAAAAAGGGTTT"',
                output: '["AAAAACCCCC","CCCCCAAAAA"]',
                explanation: '',
            },
        ],
        testCases: [
            {
                input: { s: 'AAAAACCCCCAAAAACCCCCCAAAAAGGGTTT' },
                expectedOutput: ['AAAAACCCCC', 'CCCCCAAAAA'],
                isHidden: false,
                explanation: '',
                weight: 1,
            },
            {
                input: { s: 'AAAAAAAAAAAAA' },
                expectedOutput: ['AAAAAAAAAA'],
                isHidden: true,
                explanation: '',
                weight: 1,
            },
        ],
        supportedLanguages: ['python', 'javascript', 'java', 'cpp'],
        starterCode: new Map([
            [
                'python',
                'class Solution:\n    def findRepeatedDnaSequences(self, s: str) -> list[str]:\n        pass',
            ],
            ['javascript', 'var findRepeatedDnaSequences = function(s) {\n\n};'],
            [
                'java',
                'class Solution {\n    public List<String> findRepeatedDnaSequences(String s) {\n        \n    }\n}',
            ],
            [
                'cpp',
                'class Solution {\npublic:\n    vector<string> findRepeatedDnaSequences(string s) {\n        \n    }\n};',
            ],
        ]),
        functionSignature: {
            name: 'findRepeatedDnaSequences',
            returnType: 'string[]',
            params: [{ name: 's', type: 'string' }],
        },
        designSignature: null,
        sqlTables: [],
        timeLimitMs: 2000,
        memoryLimitMb: 256,
    },

    {
        questionId: 2,
        title: 'Course Schedule',
        description:
            'There are a total of numCourses courses you have to take, labeled from 0 to numCourses - 1. You are given an array prerequisites where prerequisites[i] = [ai, bi] indicates that you must take course bi first if you want to take course ai. Return true if you can finish all courses, otherwise return false.',
        categories: ['Data Structures', 'Algorithms'],
        difficulty: 'Medium',
        questionType: 'function',
        imageUrl: '',
        sourceUrl: 'https://leetcode.com/problems/course-schedule/',
        constraints: ['1 <= numCourses <= 2000', '0 <= prerequisites.length <= 5000'],
        hints: [],
        examples: [
            {
                input: 'numCourses = 2, prerequisites = [[1,0]]',
                output: 'true',
                explanation: '',
            },
        ],
        testCases: [
            {
                input: { numCourses: 2, prerequisites: [[1, 0]] },
                expectedOutput: true,
                isHidden: false,
                explanation: '',
                weight: 1,
            },
            {
                input: {
                    numCourses: 2,
                    prerequisites: [
                        [1, 0],
                        [0, 1],
                    ],
                },
                expectedOutput: false,
                isHidden: true,
                explanation: '',
                weight: 1,
            },
            {
                input: {
                    numCourses: 5,
                    prerequisites: [
                        [1, 4],
                        [2, 4],
                        [3, 1],
                        [3, 2],
                    ],
                },
                expectedOutput: true,
                isHidden: true,
                explanation: '',
                weight: 1,
            },
        ],
        supportedLanguages: ['python', 'javascript', 'java', 'cpp'],
        starterCode: new Map([
            [
                'python',
                'class Solution:\n    def canFinish(self, numCourses: int, prerequisites: list[list[int]]) -> bool:\n        pass',
            ],
            ['javascript', 'var canFinish = function(numCourses, prerequisites) {\n\n};'],
            [
                'java',
                'class Solution {\n    public boolean canFinish(int numCourses, int[][] prerequisites) {\n        \n    }\n}',
            ],
            [
                'cpp',
                'class Solution {\npublic:\n    bool canFinish(int numCourses, vector<vector<int>>& prerequisites) {\n        \n    }\n};',
            ],
        ]),
        functionSignature: {
            name: 'canFinish',
            returnType: 'boolean',
            params: [
                { name: 'numCourses', type: 'number' },
                { name: 'prerequisites', type: 'number[][]' },
            ],
        },
        designSignature: null,
        sqlTables: [],
        timeLimitMs: 2000,
        memoryLimitMb: 256,
    },

    {
        questionId: 3,
        title: 'LRU Cache Design',
        description: 'Design and implement an LRU (Least Recently Used) cache.',
        categories: ['Data Structures'],
        difficulty: 'Medium',
        questionType: 'design',
        imageUrl: '',
        sourceUrl: 'https://leetcode.com/problems/lru-cache/',
        constraints: ['1 <= capacity <= 3000'],
        hints: [],
        examples: [
            {
                input: '["LRUCache","put","put","get","put","get","put","get","get","get"] [[2],[1,1],[2,2],[1],[3,3],[2],[4,4],[1],[3],[4]]',
                output: '[null,null,null,1,null,-1,null,-1,3,4]',
                explanation: '',
            },
        ],
        testCases: [
            {
                input: {
                    operations: [
                        'LRUCache',
                        'put',
                        'put',
                        'get',
                        'put',
                        'get',
                        'put',
                        'get',
                        'get',
                        'get',
                    ],
                    arguments: [[2], [1, 1], [2, 2], [1], [3, 3], [2], [4, 4], [1], [3], [4]],
                },
                expectedOutput: [null, null, null, 1, null, -1, null, -1, 3, 4],
                isHidden: false,
                explanation: '',
                weight: 1,
            },
            {
                input: {
                    operations: ['LRUCache', 'put', 'put', 'get', 'put', 'get', 'get'],
                    arguments: [[1], [2, 1], [3, 2], [2], [4, 3], [3], [2]],
                },
                expectedOutput: [null, null, null, 1, null, 2, -1],
                isHidden: true,
                explanation: '',
                weight: 1,
            },
        ],
        supportedLanguages: ['python', 'javascript', 'java', 'cpp'],
        starterCode: new Map([
            [
                'python',
                'class LRUCache:\n    def __init__(self, capacity: int):\n        pass\n\n    def get(self, key: int) -> int:\n        pass\n\n    def put(self, key: int, value: int) -> None:\n        pass',
            ],
            [
                'javascript',
                'var LRUCache = function(capacity) {\n\n};\n\nLRUCache.prototype.get = function(key) {\n\n};\n\nLRUCache.prototype.put = function(key, value) {\n\n};',
            ],
            [
                'java',
                'class LRUCache {\n    public LRUCache(int capacity) {\n        \n    }\n\n    public int get(int key) {\n        \n    }\n\n    public void put(int key, int value) {\n        \n    }\n}',
            ],
            [
                'cpp',
                'class LRUCache {\npublic:\n    LRUCache(int capacity) {\n        \n    }\n    \n    int get(int key) {\n        \n    }\n    \n    void put(int key, int value) {\n        \n    }\n};',
            ],
        ]),
        functionSignature: null,
        designSignature: {
            className: 'LRUCache',
            constructorParams: [{ name: 'capacity', type: 'number' }],
            methods: [
                { name: 'get', returnType: 'number', params: [{ name: 'key', type: 'number' }] },
                {
                    name: 'put',
                    returnType: 'void',
                    params: [
                        { name: 'key', type: 'number' },
                        { name: 'value', type: 'number' },
                    ],
                },
            ],
        },
        sqlTables: [],
        timeLimitMs: 2500,
        memoryLimitMb: 256,
    },

    {
        questionId: 4,
        title: 'Longest Common Subsequence',
        description:
            'Given two strings text1 and text2, return the length of their longest common subsequence. If there is no common subsequence, return 0.',
        categories: ['Strings', 'Algorithms'],
        difficulty: 'Medium',
        questionType: 'function',
        imageUrl: '',
        sourceUrl: 'https://leetcode.com/problems/longest-common-subsequence/',
        constraints: ['1 <= text1.length, text2.length <= 1000'],
        hints: [],
        examples: [
            {
                input: 'text1 = "abcde", text2 = "ace"',
                output: '3',
                explanation: '',
            },
        ],
        testCases: [
            {
                input: { text1: 'abcde', text2: 'ace' },
                expectedOutput: 3,
                isHidden: false,
                explanation: '',
                weight: 1,
            },
            {
                input: { text1: 'abc', text2: 'abc' },
                expectedOutput: 3,
                isHidden: true,
                explanation: '',
                weight: 1,
            },
            {
                input: { text1: 'abc', text2: 'def' },
                expectedOutput: 0,
                isHidden: true,
                explanation: '',
                weight: 1,
            },
        ],
        supportedLanguages: ['python', 'javascript', 'java', 'cpp'],
        starterCode: new Map([
            [
                'python',
                'class Solution:\n    def longestCommonSubsequence(self, text1: str, text2: str) -> int:\n        pass',
            ],
            ['javascript', 'var longestCommonSubsequence = function(text1, text2) {\n\n};'],
            [
                'java',
                'class Solution {\n    public int longestCommonSubsequence(String text1, String text2) {\n        \n    }\n}',
            ],
            [
                'cpp',
                'class Solution {\npublic:\n    int longestCommonSubsequence(string text1, string text2) {\n        \n    }\n};',
            ],
        ]),
        functionSignature: {
            name: 'longestCommonSubsequence',
            returnType: 'number',
            params: [
                { name: 'text1', type: 'string' },
                { name: 'text2', type: 'string' },
            ],
        },
        designSignature: null,
        sqlTables: [],
        timeLimitMs: 2500,
        memoryLimitMb: 256,
    },

    {
        questionId: 5,
        title: 'Rotate Image',
        description:
            'You are given an n x n 2D matrix representing an image. Rotate the image by 90 degrees clockwise in-place.',
        categories: ['Arrays', 'Algorithms'],
        difficulty: 'Medium',
        questionType: 'function',
        imageUrl: '',
        sourceUrl: 'https://leetcode.com/problems/rotate-image/',
        constraints: ['n == matrix.length == matrix[i].length', '1 <= n <= 20'],
        hints: [],
        examples: [
            {
                input: 'matrix = [[1,2,3],[4,5,6],[7,8,9]]',
                output: '[[7,4,1],[8,5,2],[9,6,3]]',
                explanation: '',
            },
        ],
        testCases: [
            {
                input: {
                    matrix: [
                        [1, 2, 3],
                        [4, 5, 6],
                        [7, 8, 9],
                    ],
                },
                expectedOutput: [
                    [7, 4, 1],
                    [8, 5, 2],
                    [9, 6, 3],
                ],
                isHidden: false,
                explanation: '',
                weight: 1,
            },
            {
                input: {
                    matrix: [
                        [5, 1, 9, 11],
                        [2, 4, 8, 10],
                        [13, 3, 6, 7],
                        [15, 14, 12, 16],
                    ],
                },
                expectedOutput: [
                    [15, 13, 2, 5],
                    [14, 3, 4, 1],
                    [12, 6, 8, 9],
                    [16, 7, 10, 11],
                ],
                isHidden: true,
                explanation: '',
                weight: 1,
            },
        ],
        supportedLanguages: ['python', 'javascript', 'java', 'cpp'],
        starterCode: new Map([
            [
                'python',
                'class Solution:\n    def rotate(self, matrix: list[list[int]]) -> None:\n        pass',
            ],
            ['javascript', 'var rotate = function(matrix) {\n\n};'],
            [
                'java',
                'class Solution {\n    public void rotate(int[][] matrix) {\n        \n    }\n}',
            ],
            [
                'cpp',
                'class Solution {\npublic:\n    void rotate(vector<vector<int>>& matrix) {\n        \n    }\n};',
            ],
        ]),
        functionSignature: {
            name: 'rotate',
            returnType: 'void',
            params: [{ name: 'matrix', type: 'number[][]' }],
        },
        designSignature: null,
        sqlTables: [],
        timeLimitMs: 2000,
        memoryLimitMb: 256,
    },

    {
        questionId: 6,
        title: 'Airplane Seat Assignment Probability',
        description:
            'n passengers board an airplane with exactly n seats. The first passenger has lost the ticket and picks a seat randomly. Return the probability that the nth person gets his own seat.',
        categories: ['Brainteaser'],
        difficulty: 'Medium',
        questionType: 'function',
        imageUrl: '',
        sourceUrl: 'https://leetcode.com/problems/airplane-seat-assignment-probability/',
        constraints: ['1 <= n <= 10^5'],
        hints: [],
        examples: [
            {
                input: 'n = 1',
                output: '1.0',
                explanation: '',
            },
        ],
        testCases: [
            {
                input: { n: 1 },
                expectedOutput: 1.0,
                isHidden: false,
                explanation: '',
                weight: 1,
            },
            {
                input: { n: 2 },
                expectedOutput: 0.5,
                isHidden: true,
                explanation: '',
                weight: 1,
            },
            {
                input: { n: 10 },
                expectedOutput: 0.5,
                isHidden: true,
                explanation: '',
                weight: 1,
            },
        ],
        supportedLanguages: ['python', 'javascript', 'java', 'cpp'],
        starterCode: new Map([
            [
                'python',
                'class Solution:\n    def nthPersonGetsNthSeat(self, n: int) -> float:\n        pass',
            ],
            ['javascript', 'var nthPersonGetsNthSeat = function(n) {\n\n};'],
            [
                'java',
                'class Solution {\n    public double nthPersonGetsNthSeat(int n) {\n        \n    }\n}',
            ],
            [
                'cpp',
                'class Solution {\npublic:\n    double nthPersonGetsNthSeat(int n) {\n        \n    }\n};',
            ],
        ]),
        functionSignature: {
            name: 'nthPersonGetsNthSeat',
            returnType: 'number',
            params: [{ name: 'n', type: 'number' }],
        },
        designSignature: null,
        sqlTables: [],
        timeLimitMs: 1500,
        memoryLimitMb: 256,
    },

    {
        questionId: 7,
        title: 'Validate Binary Search Tree',
        description:
            'Given the root of a binary tree, determine if it is a valid binary search tree (BST).',
        categories: ['Data Structures', 'Algorithms'],
        difficulty: 'Medium',
        questionType: 'function',
        imageUrl: '',
        sourceUrl: 'https://leetcode.com/problems/validate-binary-search-tree/',
        constraints: [],
        hints: [],
        examples: [
            {
                input: 'root = [2,1,3]',
                output: 'true',
                explanation: '',
            },
        ],
        testCases: [
            {
                input: { root: [2, 1, 3] },
                expectedOutput: true,
                isHidden: false,
                explanation: '',
                weight: 1,
            },
            {
                input: { root: [5, 1, 4, null, null, 3, 6] },
                expectedOutput: false,
                isHidden: true,
                explanation: '',
                weight: 1,
            },
        ],
        supportedLanguages: ['python', 'javascript', 'java', 'cpp'],
        starterCode: new Map([
            ['python', 'class Solution:\n    def isValidBST(self, root) -> bool:\n        pass'],
            ['javascript', 'var isValidBST = function(root) {\n\n};'],
            [
                'java',
                'class Solution {\n    public boolean isValidBST(TreeNode root) {\n        \n    }\n}',
            ],
            [
                'cpp',
                'class Solution {\npublic:\n    bool isValidBST(TreeNode* root) {\n        \n    }\n};',
            ],
        ]),
        functionSignature: {
            name: 'isValidBST',
            returnType: 'boolean',
            params: [{ name: 'root', type: 'TreeNode' }],
        },
        designSignature: null,
        sqlTables: [],
        timeLimitMs: 2000,
        memoryLimitMb: 256,
    },

    {
        questionId: 8,
        title: 'Sliding Window Maximum',
        description:
            'You are given an array of integers nums, there is a sliding window of size k moving from the left of the array to the right. Return the max sliding window.',
        categories: ['Arrays', 'Algorithms'],
        difficulty: 'Hard',
        questionType: 'function',
        imageUrl: '',
        sourceUrl: 'https://leetcode.com/problems/sliding-window-maximum/',
        constraints: ['1 <= nums.length <= 10^5', '1 <= k <= nums.length'],
        hints: [],
        examples: [
            {
                input: 'nums = [1,3,-1,-3,5,3,6,7], k = 3',
                output: '[3,3,5,5,6,7]',
                explanation: '',
            },
        ],
        testCases: [
            {
                input: { nums: [1, 3, -1, -3, 5, 3, 6, 7], k: 3 },
                expectedOutput: [3, 3, 5, 5, 6, 7],
                isHidden: false,
                explanation: '',
                weight: 1,
            },
            {
                input: { nums: [1], k: 1 },
                expectedOutput: [1],
                isHidden: true,
                explanation: '',
                weight: 1,
            },
            {
                input: { nums: [9, 10, 9, -7, -4, -8, 2, -6], k: 5 },
                expectedOutput: [10, 10, 9, 2],
                isHidden: true,
                explanation: '',
                weight: 1,
            },
        ],
        supportedLanguages: ['python', 'javascript', 'java', 'cpp'],
        starterCode: new Map([
            [
                'python',
                'class Solution:\n    def maxSlidingWindow(self, nums: list[int], k: int) -> list[int]:\n        pass',
            ],
            ['javascript', 'var maxSlidingWindow = function(nums, k) {\n\n};'],
            [
                'java',
                'class Solution {\n    public int[] maxSlidingWindow(int[] nums, int k) {\n        \n    }\n}',
            ],
            [
                'cpp',
                'class Solution {\npublic:\n    vector<int> maxSlidingWindow(vector<int>& nums, int k) {\n        \n    }\n};',
            ],
        ]),
        functionSignature: {
            name: 'maxSlidingWindow',
            returnType: 'number[]',
            params: [
                { name: 'nums', type: 'number[]' },
                { name: 'k', type: 'number' },
            ],
        },
        designSignature: null,
        sqlTables: [],
        timeLimitMs: 3000,
        memoryLimitMb: 256,
    },

    {
        questionId: 9,
        title: 'N-Queen Problem',
        description:
            'The n-queens puzzle is the problem of placing n queens on an n x n chessboard such that no two queens attack each other. Given an integer n, return all distinct solutions.',
        categories: ['Algorithms'],
        difficulty: 'Hard',
        questionType: 'function',
        imageUrl: '',
        sourceUrl: 'https://leetcode.com/problems/n-queens/',
        constraints: ['1 <= n <= 9'],
        hints: [],
        examples: [
            {
                input: 'n = 4',
                output: '[[".Q..","...Q","Q...","..Q."],["..Q.","Q...","...Q",".Q.."]]',
                explanation: '',
            },
        ],
        testCases: [
            {
                input: { n: 4 },
                expectedOutput: [
                    ['.Q..', '...Q', 'Q...', '..Q.'],
                    ['..Q.', 'Q...', '...Q', '.Q..'],
                ],
                isHidden: false,
                explanation: '',
                weight: 1,
            },
            {
                input: { n: 1 },
                expectedOutput: [['Q']],
                isHidden: true,
                explanation: '',
                weight: 1,
            },
        ],
        supportedLanguages: ['python', 'javascript', 'java', 'cpp'],
        starterCode: new Map([
            [
                'python',
                'class Solution:\n    def solveNQueens(self, n: int) -> list[list[str]]:\n        pass',
            ],
            ['javascript', 'var solveNQueens = function(n) {\n\n};'],
            [
                'java',
                'class Solution {\n    public List<List<String>> solveNQueens(int n) {\n        \n    }\n}',
            ],
            [
                'cpp',
                'class Solution {\npublic:\n    vector<vector<string>> solveNQueens(int n) {\n        \n    }\n};',
            ],
        ]),
        functionSignature: {
            name: 'solveNQueens',
            returnType: 'string[][]',
            params: [{ name: 'n', type: 'number' }],
        },
        designSignature: null,
        sqlTables: [],
        timeLimitMs: 3000,
        memoryLimitMb: 256,
    },

    {
        questionId: 10,
        title: 'Serialize and Deserialize a Binary Tree',
        description:
            'Design an algorithm to serialize and deserialize a binary tree. Ensure that a binary tree can be serialized to a string and deserialized back to the original structure.',
        categories: ['Data Structures', 'Algorithms'],
        difficulty: 'Hard',
        questionType: 'design',
        imageUrl: '',
        sourceUrl: 'https://leetcode.com/problems/serialize-and-deserialize-binary-tree/',
        constraints: [],
        hints: [],
        examples: [
            {
                input: 'root = [1,2,3,null,null,4,5]',
                output: 'deserialized tree equals original tree',
                explanation: '',
            },
        ],
        testCases: [
            {
                input: { root: [1, 2, 3, null, null, 4, 5] },
                expectedOutput: [1, 2, 3, null, null, 4, 5],
                isHidden: false,
                explanation:
                    'serialize(root) then deserialize(serialized) should reconstruct the same tree',
                weight: 1,
            },
            {
                input: { root: [] },
                expectedOutput: [],
                isHidden: true,
                explanation: '',
                weight: 1,
            },
        ],
        supportedLanguages: ['python', 'javascript', 'java', 'cpp'],
        starterCode: new Map([
            [
                'python',
                'class Codec:\n    def serialize(self, root):\n        pass\n\n    def deserialize(self, data):\n        pass',
            ],
            [
                'javascript',
                'var Codec = function() {};\n\nCodec.prototype.serialize = function(root) {\n\n};\n\nCodec.prototype.deserialize = function(data) {\n\n};',
            ],
            [
                'java',
                'public class Codec {\n    public String serialize(TreeNode root) {\n        \n    }\n\n    public TreeNode deserialize(String data) {\n        \n    }\n}',
            ],
            [
                'cpp',
                'class Codec {\npublic:\n    string serialize(TreeNode* root) {\n        \n    }\n\n    TreeNode* deserialize(string data) {\n        \n    }\n};',
            ],
        ]),
        functionSignature: null,
        designSignature: {
            className: 'Codec',
            constructorParams: [],
            methods: [
                {
                    name: 'serialize',
                    returnType: 'string',
                    params: [{ name: 'root', type: 'TreeNode' }],
                },
                {
                    name: 'deserialize',
                    returnType: 'TreeNode',
                    params: [{ name: 'data', type: 'string' }],
                },
            ],
        },
        sqlTables: [],
        timeLimitMs: 3000,
        memoryLimitMb: 256,
    },

    {
        questionId: 11,
        title: 'Wildcard Matching',
        description:
            'Given an input string s and a pattern p, implement wildcard pattern matching with support for ? and * where ? matches any single character and * matches any sequence of characters, including the empty sequence.',
        categories: ['Strings', 'Algorithms'],
        difficulty: 'Hard',
        questionType: 'function',
        imageUrl: '',
        sourceUrl: 'https://leetcode.com/problems/wildcard-matching/',
        constraints: ['0 <= s.length, p.length <= 2000'],
        hints: [],
        examples: [
            {
                input: 's = "aa", p = "a"',
                output: 'false',
                explanation: '',
            },
        ],
        testCases: [
            {
                input: { s: 'aa', p: 'a' },
                expectedOutput: false,
                isHidden: false,
                explanation: '',
                weight: 1,
            },
            {
                input: { s: 'aa', p: '*' },
                expectedOutput: true,
                isHidden: true,
                explanation: '',
                weight: 1,
            },
            {
                input: { s: 'cb', p: '?a' },
                expectedOutput: false,
                isHidden: true,
                explanation: '',
                weight: 1,
            },
            {
                input: { s: 'adceb', p: '*a*b' },
                expectedOutput: true,
                isHidden: true,
                explanation: '',
                weight: 1,
            },
        ],
        supportedLanguages: ['python', 'javascript', 'java', 'cpp'],
        starterCode: new Map([
            [
                'python',
                'class Solution:\n    def isMatch(self, s: str, p: str) -> bool:\n        pass',
            ],
            ['javascript', 'var isMatch = function(s, p) {\n\n};'],
            [
                'java',
                'class Solution {\n    public boolean isMatch(String s, String p) {\n        \n    }\n}',
            ],
            [
                'cpp',
                'class Solution {\npublic:\n    bool isMatch(string s, string p) {\n        \n    }\n};',
            ],
        ]),
        functionSignature: {
            name: 'isMatch',
            returnType: 'boolean',
            params: [
                { name: 's', type: 'string' },
                { name: 'p', type: 'string' },
            ],
        },
        designSignature: null,
        sqlTables: [],
        timeLimitMs: 3000,
        memoryLimitMb: 256,
    },

    {
        questionId: 12,
        title: 'Chalkboard XOR Game',
        description:
            'You are given an array of integers nums written on a chalkboard. Alice and Bob take turns erasing exactly one number, with Alice starting first. Return true if and only if Alice wins the game assuming both players play optimally.',
        categories: ['Brainteaser'],
        difficulty: 'Hard',
        questionType: 'function',
        imageUrl: '',
        sourceUrl: 'https://leetcode.com/problems/chalkboard-xor-game/',
        constraints: ['1 <= nums.length <= 1000'],
        hints: [],
        examples: [
            {
                input: 'nums = [1,1,2]',
                output: 'false',
                explanation: '',
            },
        ],
        testCases: [
            {
                input: { nums: [1, 1, 2] },
                expectedOutput: false,
                isHidden: false,
                explanation: '',
                weight: 1,
            },
            {
                input: { nums: [0, 1] },
                expectedOutput: true,
                isHidden: true,
                explanation: '',
                weight: 1,
            },
            {
                input: { nums: [5, 5] },
                expectedOutput: true,
                isHidden: true,
                explanation: '',
                weight: 1,
            },
        ],
        supportedLanguages: ['python', 'javascript', 'java', 'cpp'],
        starterCode: new Map([
            [
                'python',
                'class Solution:\n    def xorGame(self, nums: list[int]) -> bool:\n        pass',
            ],
            ['javascript', 'var xorGame = function(nums) {\n\n};'],
            [
                'java',
                'class Solution {\n    public boolean xorGame(int[] nums) {\n        \n    }\n}',
            ],
            [
                'cpp',
                'class Solution {\npublic:\n    bool xorGame(vector<int>& nums) {\n        \n    }\n};',
            ],
        ]),
        functionSignature: {
            name: 'xorGame',
            returnType: 'boolean',
            params: [{ name: 'nums', type: 'number[]' }],
        },
        designSignature: null,
        sqlTables: [],
        timeLimitMs: 2500,
        memoryLimitMb: 256,
    },
];
