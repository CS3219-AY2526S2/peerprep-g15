import '../App.css';
import { HouseFill, FileTextFill, PeopleFill, GearFill } from 'react-bootstrap-icons';

import { useNavigate } from 'react-router';
import NavBar from '../components/NavBar.tsx';
import questionAxios from '../questionAxios.ts';
import { useState } from 'react';

const AddQuestion = () => {
    const navigate = useNavigate();
    const name = localStorage.getItem('name') || 'Admin';

    const [questionId, setQuestionId] = useState('');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [categories, setCategories] = useState('');
    const [difficulty, setDifficulty] = useState('');
    const [sourceUrl, setSourceUrl] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSuccessMessage('');
        setErrorMessage('');

        try {
            const payload = {
                questionId: Number(questionId),
                title,
                description,
                categories: categories
                    .split(',')
                    .map((c) => c.trim())
                    .filter((c) => c !== ''),
                difficulty,
                sourceUrl,
            };

            const response = await questionAxios.post('/questions', payload);

            console.log('Question created:', response.data);
            setSuccessMessage('Question added successfully.');

            setQuestionId('');
            setTitle('');
            setDescription('');
            setCategories('');
            setDifficulty('');
            setSourceUrl('');
        } catch (error: any) {
            console.error('Create question error:', error);
            setErrorMessage(error.response?.data?.message || 'Failed to add question.');
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
                    <div className="container py-5">
                        <div className="row justify-content-center">
                            <div className="col-md-8 col-lg-7">
                                <div className="card shadow-sm">
                                    <div className="card-body p-4">
                                        <h2 className="mb-4 text-center">Add Question</h2>

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
                                                    onChange={(e) => setQuestionId(e.target.value)}
                                                    required
                                                />
                                            </div>

                                            <div className="mb-3">
                                                <label
                                                    htmlFor="title"
                                                    className="form-label fw-bold"
                                                >
                                                    Title
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
                                                    Description
                                                </label>
                                                <textarea
                                                    id="description"
                                                    className="form-control"
                                                    rows={4}
                                                    value={description}
                                                    onChange={(e) => setDescription(e.target.value)}
                                                    required
                                                />
                                            </div>

                                            <div className="mb-3">
                                                <label
                                                    htmlFor="categories"
                                                    className="form-label fw-bold"
                                                >
                                                    Categories
                                                </label>
                                                <input
                                                    id="categories"
                                                    type="text"
                                                    className="form-control"
                                                    placeholder="e.g. Array, String"
                                                    value={categories}
                                                    onChange={(e) => setCategories(e.target.value)}
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
                                                    Difficulty
                                                </label>
                                                <select
                                                    id="difficulty"
                                                    className="form-select"
                                                    value={difficulty}
                                                    onChange={(e) => setDifficulty(e.target.value)}
                                                    required
                                                >
                                                    <option value="">Select difficulty</option>
                                                    <option value="Easy">Easy</option>
                                                    <option value="Medium">Medium</option>
                                                    <option value="Hard">Hard</option>
                                                </select>
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
                                                    onChange={(e) => setSourceUrl(e.target.value)}
                                                />
                                            </div>

                                            <button type="submit" className="btn btn-primary w-100">
                                                Add Question
                                            </button>

                                            {successMessage && (
                                                <div className="alert alert-success mt-3 mb-0">
                                                    {successMessage}
                                                </div>
                                            )}

                                            {errorMessage && (
                                                <div className="alert alert-danger mt-3 mb-0">
                                                    {errorMessage}
                                                </div>
                                            )}
                                        </form>
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

export default AddQuestion;
