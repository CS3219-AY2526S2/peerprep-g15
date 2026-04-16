import '../App.css';
import NavBar from '../components/NavBar.tsx';
import AdminNavBar from '../components/AdminNavBar.tsx';
import questionAxios from '../questionAxios.ts';
import { useState, useEffect, useMemo } from 'react';
import userAxios from '../userAxios.ts';

type Question = {
    questionId: number;
    title: string;
    difficulty: string;
    category: string[];
};

type User = {
    username: string;
    displayName: string;
    email: string;
    role: string;
    id: string;
    updatedAt: string;
};

const Admin = () => {
    const name = localStorage.getItem('name') || 'Admin';

    const [questions, setQuestions] = useState<Question[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchDashboardData = async () => {
        try {
            const [questionResponse, userResponse] = await Promise.all([
                questionAxios.get('/questions'),
                userAxios.get('/admin/users'),
            ]);

            console.log('questionResponse.data:', questionResponse.data);
            console.log('userResponse.data:', userResponse.data);

            const mappedQuestions: Question[] = questionResponse.data.map((q: any) => ({
                questionId: q.questionId,
                title: q.title,
                difficulty: q.difficulty,
                category: q.categories,
            }));
            const mappedUsers = userResponse.data.users.map((u: any) => ({
                username: u.username,
                displayName: u.displayName,
                email: u.email,
                role: u.role,
                id: u.id,
                updatedAt: u.updatedAt,
            }));

            setQuestions(mappedQuestions);
            setUsers(mappedUsers);
        } catch (error) {
            console.log('Error fetching dashboard data:', error);
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const totalQuestions = questions.length;
    const totalUsers = users.length;

    const easyCount = questions.filter((q) => q.difficulty === 'Easy').length;
    const mediumCount = questions.filter((q) => q.difficulty === 'Medium').length;
    const hardCount = questions.filter((q) => q.difficulty === 'Hard').length;

    const totalCategories = useMemo(() => {
        const uniqueCategories = new Set<string>();

        questions.forEach((q) => {
            q.category?.forEach((cat) => uniqueCategories.add(cat));
        });

        return uniqueCategories.size;
    }, [questions]);

    const recentQuestions = [...questions].sort((a, b) => b.questionId - a.questionId).slice(0, 5);

    const recentUsers = [...users]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 5);

    const stats = [
        { title: 'Total Questions', value: totalQuestions },
        { title: 'Total Users', value: totalUsers },
        { title: 'Categories', value: totalCategories },
    ];

    return (
        <div>
            <NavBar name={name} />
            <div className="d-flex min-vh-100 bg-dark text-white">
                <AdminNavBar />
                <div className="flex-grow-1 p-4" style={{ backgroundColor: '#686868' }}>
                    <div className="d-flex justify-content-between align-items-center mb-4">
                        <h2 className="fw-bold text-warning">Admin Dashboard</h2>
                    </div>

                    {loading ? (
                        <p>Loading dashboard...</p>
                    ) : (
                        <>
                            <div className="row g-4 mb-4">
                                {stats.map((stat, index) => (
                                    <div key={index} className="col-md-6 col-xl-3">
                                        <div
                                            className="card border-0 shadow-sm h-100"
                                            style={{ backgroundColor: '#979797', color: 'white' }}
                                        >
                                            <div className="card-body">
                                                <h6 className="text-muted">{stat.title}</h6>
                                                <h2 className="fw-bold">{stat.value}</h2>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="row g-4 mb-4">
                                <div className="col-lg-8">
                                    <div
                                        className="card border-0 shadow-sm h-100"
                                        style={{ backgroundColor: '#979797', color: 'white' }}
                                    >
                                        <div className="card-body">
                                            <h5 className="mb-3">Difficulty Breakdown</h5>
                                            <div className="d-flex gap-3 flex-wrap">
                                                <div
                                                    className="p-3 rounded"
                                                    style={{
                                                        backgroundColor: '#198754',
                                                        minWidth: '120px',
                                                    }}
                                                >
                                                    <h6>Easy</h6>
                                                    <h3>{easyCount}</h3>
                                                </div>
                                                <div
                                                    className="p-3 rounded"
                                                    style={{
                                                        backgroundColor: '#ffc107',
                                                        color: '#000',
                                                        minWidth: '120px',
                                                    }}
                                                >
                                                    <h6>Medium</h6>
                                                    <h3>{mediumCount}</h3>
                                                </div>
                                                <div
                                                    className="p-3 rounded"
                                                    style={{
                                                        backgroundColor: '#dc3545',
                                                        minWidth: '120px',
                                                    }}
                                                >
                                                    <h6>Hard</h6>
                                                    <h3>{hardCount}</h3>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="col-lg-4">
                                    <div
                                        className="card border-0 shadow-sm h-100"
                                        style={{ backgroundColor: '#979797', color: 'white' }}
                                    >
                                        <div className="card-body">
                                            <h5 className="mb-3">Recent Users</h5>
                                            {recentUsers.map((user) => (
                                                <div
                                                    key={user.id}
                                                    className="mb-3 border-bottom pb-2"
                                                >
                                                    <div className="text-black">
                                                        {user.displayName}
                                                    </div>
                                                    <small className="text-warning">
                                                        {user.email}
                                                    </small>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div
                                className="card border-0 shadow-sm"
                                style={{ backgroundColor: '#979797', color: 'white' }}
                            >
                                <div className="card-body">
                                    <h5 className="mb-3">Recent Questions</h5>
                                    <div className="table-responsive">
                                        <table className="table table-striped align-middle">
                                            <thead>
                                                <tr>
                                                    <th>ID</th>
                                                    <th>Title</th>
                                                    <th>Difficulty</th>
                                                    <th>Category</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {recentQuestions.map((q) => (
                                                    <tr key={q.questionId}>
                                                        <td>{q.questionId}</td>
                                                        <td>{q.title}</td>
                                                        <td>{q.difficulty}</td>
                                                        <td>{q.category}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Admin;
