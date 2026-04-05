import { HouseFill, FileTextFill, PeopleFill, GearFill } from 'react-bootstrap-icons';

import { useNavigate } from 'react-router';
import NavBar from '../components/NavBar.tsx';
import { useState, useEffect } from 'react';
import questionAxios from '../questionAxios.ts';

type Question = {
    questionId: number;
    title: string;
    difficulty: string;
    category: string;
};

const Questions = () => {
    const navigate = useNavigate();
    const name = localStorage.getItem('name') || 'Admin';
    const accessToken = localStorage.getItem('accessToken') || '';
    const [questions, setQuestions] = useState<Question[]>([]);
    const [loading, setLoading] = useState(false);
    const [difficulty, setDifficulty] = useState('');
    const [category, setCategory] = useState('');

    const fetchQuestions = async () => {
        setLoading(true);
        try {
            const response = await questionAxios.get('/questions', {
                params: {
                    difficulty,
                    category,
                },
            });

            const mappedQuestions = response.data.map((q: any) => ({
                questionId: q.questionId,
                title: q.title,
                difficulty: q.difficulty,
                category: q.categories?.join(', ') ?? '',
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

    const handleSearch = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        fetchQuestions();
    };

    const handleAdd = () => {
        navigate('/admin/questions/add-question');
    };

    const handleEdit = (questionId: number) => {
        navigate(`/admin/questions/edit/${questionId}`);
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
                <div
                    className="d-flex flex-column flex-shrink-0 p-4"
                    style={{ width: '200px', backgroundColor: '#606060' }}
                >
                    <ul className="nav nav-pills flex-column mb-auto gap-2">
                        <li className="nav-item">
                            <button
                                className="btn text-light text-start"
                                onClick={() => navigate('/admin/home')}
                            >
                                <HouseFill className="me-2" />
                                Dashboard
                            </button>
                        </li>
                        <li>
                            <button
                                className="btn text-light text-start"
                                onClick={() => navigate('/admin/questions')}
                            >
                                <FileTextFill className="me-2" />
                                Questions
                            </button>
                        </li>
                        <li>
                            <button
                                className="btn text-light text-start"
                                onClick={() => navigate('/admin/users')}
                            >
                                <PeopleFill className="me-2" />
                                Users
                            </button>
                        </li>
                        <li>
                            <button
                                className="btn text-light text-start"
                                onClick={() => navigate('/admin/settings')}
                            >
                                <GearFill className="me-2" />
                                Settings
                            </button>
                        </li>
                    </ul>
                </div>

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
                                <label className="form-label">Difficulty</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    value={difficulty}
                                    onChange={(e) => setDifficulty(e.target.value)}
                                    placeholder="Easy / Medium / Hard"
                                />
                            </div>

                            <div className="col-md-4">
                                <label className="form-label">Category</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value)}
                                    placeholder="Category"
                                />
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
                            <p>Loading questions...</p>
                        ) : questions.length === 0 ? (
                            <p>No questions found.</p>
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
                                    {questions.map((q) => (
                                        <tr key={q.questionId}>
                                            <td>{q.questionId}</td>
                                            <td>{q.title}</td>
                                            <td>{q.difficulty}</td>
                                            <td>{q.category}</td>
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
