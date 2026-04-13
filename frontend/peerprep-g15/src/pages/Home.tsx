import { useEffect, useMemo, useState } from 'react';
import '../App.css';

import questionAxios from '../questionAxios.ts';
import matchAxios from '../matchAxios.ts';
import collabAxios from '../collabAxios.ts';
import NavBar from '../components/NavBar';
import { useNavigate } from 'react-router';

type Question = {
    questionId: number;
    title: string;
    difficulty: string;
    categories: string[];
};

const Home = () => {
    const name = localStorage.getItem('name') || 'User';

    const [difficulty, setDifficulty] = useState('');
    const [category, setCategory] = useState('');
    const [allQuestions, setAllQuestions] = useState<Question[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isMatching, setIsMatching] = useState(false);
    // const [matchedUser, setMatchedUser] = useState<string | null>(null);
    const [matchingMessage, setMatchingMessage] = useState<string | null>(null);
    const [queuedUserId, setQueuedUserId] = useState<string | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchQuestions = async () => {
            try {
                setLoading(true);
                setError('');

                const response = await questionAxios.get('/questions');

                const questions: Question[] = response.data.map((q: any) => ({
                    questionId: q.questionId,
                    title: q.title,
                    difficulty: q.difficulty,
                    categories: q.categories ?? [],
                }));

                setAllQuestions(questions);
            } catch (err: any) {
                console.error('Load questions error:', err);
                setError(err.response?.data?.message || 'Failed to load questions.');
            } finally {
                setLoading(false);
            }
        };

        fetchQuestions();
    }, []);

    useEffect(() => {
        if (!isMatching || !queuedUserId) return;

        const interval = setInterval(async () => {
            try {
                const response = await matchAxios.get(`/matching/status/${queuedUserId}`);
                console.log('Status response:', response.data);

                const data = response.data;

                if (data.state === 'queued') {
                    setMatchingMessage('Still waiting for another user to join...');
                    return;
                }

                if (data.state === 'matched') {
                    await handleMatched(data.match);
                    return;
                }

                if (data.state === 'timed_out') {
                    setMatchingMessage('Matching timed out. Please try again.');
                    setIsMatching(false);
                    setQueuedUserId(null);
                    return;
                }

                if (data.state === 'not_found') {
                    setMatchingMessage('Queue entry not found or cancelled.');
                    setIsMatching(false);
                    setQueuedUserId(null);
                    return;
                }
            } catch (err: any) {
                console.error('Status polling error:', err);
                setMatchingMessage(err.response?.data?.message || 'Failed to check match status.');
                setIsMatching(false);
                setQueuedUserId(null);
            }
        }, 3000);

        return () => clearInterval(interval);
    }, [isMatching, queuedUserId]);

    const uniqueCategories = useMemo(() => {
        return Array.from(
            new Set(
                allQuestions.flatMap((q) => q.categories.map((cat) => cat.trim()).filter(Boolean)),
            ),
        ).sort((a, b) => a.localeCompare(b));
    }, [allQuestions]);

    const filteredQuestions = useMemo(() => {
        return allQuestions.filter((q) => {
            const difficultyMatch = !difficulty || q.difficulty === difficulty;
            const categoryMatch = !category || q.categories.includes(category);
            return difficultyMatch && categoryMatch;
        });
    }, [allQuestions, difficulty, category]);

    const handleFindMatch = async () => {
        const userId = localStorage.getItem('userId');

        if (!userId) {
            setMatchingMessage('No user ID found. Please log in again.');
            return;
        }

        if (!category || !difficulty) {
            setMatchingMessage('Please choose both a category and difficulty first.');
            return;
        }

        try {
            setIsMatching(true);
            setQueuedUserId(null);
            setMatchingMessage(
                `Looking for a user with category "${category}" and difficulty "${difficulty}"...`,
            );

            const payload = {
                userId,
                topic: category,
                difficulty: difficulty.toLowerCase(),
            };

            const response = await matchAxios.post('/matching/join', payload);
            console.log('Matching response:', response.data);

            if (response.data.match) {
                await handleMatched(response.data.match);
                return;
            }

            if (response.data.entry || response.data.message === 'Queued successfully') {
                setMatchingMessage('Waiting for another user to join...');
                setQueuedUserId(userId);
                return;
            }

            setMatchingMessage('Matching request sent.');
        } catch (err: any) {
            console.error('Matching error:', err);
            setMatchingMessage(err.response?.data?.message || 'Failed to start matching.');
            setIsMatching(false);
            setQueuedUserId(null);
        }
    };

    const handleCancelMatch = async () => {
        const userId = queuedUserId || localStorage.getItem('userId');

        if (!userId) {
            setMatchingMessage('No queued user found.');
            setIsMatching(false);
            setQueuedUserId(null);
            return;
        }

        try {
            await matchAxios.post('/matching/leave', { userId });
            setMatchingMessage('Matching cancelled.');
        } catch (err: any) {
            console.error('Cancel matching error:', err);
            setMatchingMessage(err.response?.data?.message || 'Failed to cancel matching.');
        } finally {
            setIsMatching(false);
            setQueuedUserId(null);
        }
    };

    const getSession = async (roomId: string, userIds: string[], questionId: string) => {
        try {
            const response = await collabAxios.post('/collab/create', {
                roomId,
                userIds,
                questionId,
            });

            console.log('Session response:', response.data);

            // const { roomId } = response.data;

            navigate(`/collab/${roomId}`);
        } catch (err: any) {
            console.log('failed sess: ', err);
            setMatchingMessage(err.response?.data?.message || 'Failed to create collab session.');
        }
    };

    const handleMatched = async (matchData: any) => {
        const currentUserId = localStorage.getItem('userId');
        if (!currentUserId) {
            setMatchingMessage('No user ID found. Please log in again.');
            return;
        }

        // adjust these based on your actual match response shape
        const matchedUserId = matchData.userIds.find((id: string) => id !== currentUserId);
        const questionId = String(matchData.question.questionId);
        const roomId = String(matchData.matchId);

        const userIds = [currentUserId, matchedUserId];
        console.log('Question ID:', questionId);
        console.log('Room ID:', roomId);
        console.log('User IDs:', userIds);

        setMatchingMessage('Match found! Creating session...');
        setIsMatching(false);
        setQueuedUserId(null);

        await getSession(roomId, userIds, questionId);
    };

    return (
        <>
            <NavBar name={name} />

            <div className="container mt-4">
                <h1>Welcome, {name}!</h1>
                <p className="text-muted">
                    Choose a difficulty and category to match with another user
                </p>
            </div>

            <div className="container py-5">
                <div className="card shadow-sm mb-5">
                    <div className="card-body">
                        <div className="row g-3">
                            <div className="col-md-6">
                                <label htmlFor="difficulty" className="form-label fw-bold">
                                    Difficulty
                                </label>
                                <select
                                    id="difficulty"
                                    className="form-select"
                                    value={difficulty}
                                    onChange={(e) => setDifficulty(e.target.value)}
                                >
                                    <option value="">All</option>
                                    <option value="Easy">Easy</option>
                                    <option value="Medium">Medium</option>
                                    <option value="Hard">Hard</option>
                                </select>
                            </div>

                            <div className="col-md-6">
                                <label htmlFor="category" className="form-label fw-bold">
                                    Category
                                </label>
                                <select
                                    id="category"
                                    className="form-select"
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value)}
                                >
                                    <option value="">All</option>
                                    {uniqueCategories.map((cat) => (
                                        <option key={cat} value={cat}>
                                            {cat}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="center-button mt-4">
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={handleFindMatch}
                                    disabled={isMatching}
                                >
                                    {isMatching ? 'Matching...' : 'Find Match'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-4">
                    <div
                        className="alert alert-info d-flex align-items-center gap-3 mb-3"
                        role="alert"
                    >
                        {isMatching && (
                            <div
                                className="spinner-border spinner-border-sm text-primary"
                                role="status"
                            >
                                <span className="visually-hidden">Loading...</span>
                            </div>
                        )}

                        <div>
                            <strong>
                                {isMatching ? 'Matching in progress...' : 'Ready to match'}
                            </strong>
                            <div>{matchingMessage}</div>
                        </div>

                        {isMatching && (
                            <button
                                type="button"
                                className="btn btn-outline-danger btn-sm ms-auto"
                                onClick={handleCancelMatch}
                            >
                                Cancel
                            </button>
                        )}
                    </div>
                    <h3 className="mb-3">Matching Questions</h3>

                    {loading ? (
                        <p className="text-muted">Loading questions...</p>
                    ) : error ? (
                        <p className="text-danger">{error}</p>
                    ) : filteredQuestions.length === 0 ? (
                        <p className="text-muted">No questions found.</p>
                    ) : (
                        <div className="row g-4">
                            {filteredQuestions.map((q) => (
                                <div key={q.questionId} className="col-md-6 col-lg-4">
                                    <div className="card h-100 shadow-sm">
                                        <div className="card-body">
                                            <h5 className="card-title">{q.title}</h5>
                                            <p className="card-text text-muted mb-2">
                                                Difficulty: {q.difficulty}
                                            </p>
                                            <p className="card-text text-muted">
                                                Category: {q.categories.join(', ')}
                                            </p>
                                            <button className="btn btn-outline-primary btn-sm">
                                                View Question
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default Home;
