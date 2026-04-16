import { useState, useEffect } from 'react';
import NavBar from '../components/NavBar';
import historyAxios from '../historyAxios';
import '../App.css'; // Assuming a CSS file for styles

const History = () => {
    const name = localStorage.getItem('name') || 'User';
    const [history, setHistory] = useState<any[]>([]); // State to store attempts history
    const [loading, setLoading] = useState<boolean>(true); // State to track loading state
    const [error, setError] = useState<string | null>(null); // State to store error if occurs

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const userId = localStorage.getItem('userId'); // assuming userId is stored in localStorage
                if (!userId) {
                    setError('User ID not found');
                    setLoading(false);
                    return;
                }
                const response = await historyAxios.get(`/users/${userId}/attempts`);
                console.log('Fetched history:', response.data); // Log the response data for debugging
                setHistory(response.data.items); // Assuming the response contains items
                setLoading(false);
            } catch (err: any) {
                setError(err.message);
                setLoading(false);
            }
        };

        fetchHistory();
    }, []);

    return (
        <div className="history-container">
            <NavBar name={name} />
            <div className="history-header">
                <h1>Attempt History</h1>
            </div>
            {loading && <div className="loading">Loading...</div>}
            {error && <div className="error">Error: {error}</div>}
            {!loading && !error && (
                <div className="history-cards">
                    {history.map((attempt: any) => (
                        <div key={attempt.attemptId} className="attempt-card">
                            <h3>{attempt.questionTitle || 'No Title'}</h3>
                            <p>
                                <strong>Language:</strong> {attempt.language}
                            </p>
                            <p>
                                <strong>Status:</strong> {attempt.passed ? 'Passed' : 'Failed'}
                            </p>
                            <p>
                                <strong>Submitted At:</strong>{' '}
                                {new Date(attempt.submittedAt).toLocaleString()}
                            </p>
                            {attempt.error && (
                                <p className="error-text">
                                    <strong>Error:</strong> {attempt.error}
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default History;
