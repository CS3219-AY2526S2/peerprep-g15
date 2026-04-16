import '../App.css';
import { useNavigate } from 'react-router';
import NavBar from '../components/NavBar.tsx';
import { useState, useEffect } from 'react';
import questionAxios from '../questionAxios.ts';
import { useMemo } from 'react';
import AdminNavBar from '../components/AdminNavBar.tsx';

type Question = {
    questionId: number;
    title: string;
    difficulty: string;
    categories: string[];
};

const Questions = () => {
    const navigate = useNavigate();
    const name = localStorage.getItem('name') || 'Admin';
    const accessToken = localStorage.getItem('accessToken') || '';
    const [questions, setQuestions] = useState<Question[]>([]);
    const [loading, setLoading] = useState(false);
    const [difficulty, setDifficulty] = useState('');
    const [category, setCategory] = useState('');
    const [appliedDifficulty, setAppliedDifficulty] = useState('');
    const [appliedCategory, setAppliedCategory] = useState('');

    const fetchQuestions = async () => {
        setLoading(true);
        try {
            const response = await questionAxios.get('/questions');

            const mappedQuestions = response.data.map((q: any) => ({
                questionId: q.questionId,
                title: q.title,
                difficulty: q.difficulty,
                categories: q.categories ?? [],
            }));

            setQuestions(mappedQuestions);
        } catch (err) {
            console.error('Fetch questions error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchQuestions();
    }, []);

    const uniqueCategories = useMemo(() => {
        return Array.from(
            new Set(
                questions.flatMap((q) => q.categories.map((cat) => cat.trim()).filter(Boolean)),
            ),
        ).sort((a, b) => a.localeCompare(b));
    }, [questions]);

    const filteredQuestions = useMemo(() => {
        return questions.filter((q) => {
            const difficultyMatch = !appliedDifficulty || q.difficulty === appliedDifficulty;
            const categoryMatch = !appliedCategory || q.categories.includes(appliedCategory);
            return difficultyMatch && categoryMatch;
        });
    }, [questions, appliedDifficulty, appliedCategory]);

    const handleSearch = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setAppliedCategory(category);
        setAppliedDifficulty(difficulty);
    };

    const handleAdd = () => {
        navigate('/admin/questions/add-question');
    };

    const handleEdit = (questionId: number) => {
        navigate(`/admin/questions/edit-question/${questionId}`);
    };

    const handleDelete = async (questionId: number) => {
        const confirmed = window.confirm('Are you sure you want to delete this question?');
        if (!confirmed) return;

        try {
            await questionAxios.delete(`/questions/${questionId}`, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });

            setQuestions((prev) => prev.filter((q) => q.questionId !== questionId));
        } catch (err) {
            console.error('Delete question error:', err);
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
                    <div className="d-flex justify-content-between align-items-center mb-4">
                        <h2 className="fw-bold text-warning">Questions</h2>
                        <button className="btn btn-warning fw-semibold" onClick={handleAdd}>
                            Add Question
                        </button>
                    </div>

                    <form onSubmit={handleSearch} className="bg-white rounded p-3 shadow-sm mb-4 ">
                        <div className="row g-3">
                            <div className="col-md-4">
                                <label className="form-label" htmlFor="difficulty">
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

                            <div className="col-md-4">
                                <label className="form-label" htmlFor="category">
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

                            <div className="col-md-4 d-flex align-items-end">
                                <button type="submit" className="btn btn-dark w-100">
                                    Search
                                </button>
                            </div>
                        </div>
                    </form>

                    <div className="bg-white rounded p-3 shadow-sm">
                        {loading ? (
                            <p className="text-dark mb-0">Loading questions...</p>
                        ) : filteredQuestions.length === 0 ? (
                            <p className="text-dark mb-0">No questions found.</p>
                        ) : (
                            <table className="table table-hover align-middle mb-0">
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Title</th>
                                        <th>Difficulty</th>
                                        <th>Category</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredQuestions.map((q) => (
                                        <tr key={q.questionId}>
                                            <td>{q.questionId}</td>
                                            <td>{q.title}</td>
                                            <td>{q.difficulty}</td>
                                            <td>{q.categories.join(', ')}</td>
                                            <td>
                                                <button
                                                    className="btn btn-sm btn-primary me-2"
                                                    onClick={() => handleEdit(q.questionId)}
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    className="btn btn-sm btn-danger"
                                                    onClick={() => handleDelete(q.questionId)}
                                                >
                                                    Delete
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Questions;
