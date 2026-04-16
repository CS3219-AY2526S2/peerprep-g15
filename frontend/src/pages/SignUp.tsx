import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import '../App.css';
import arrows from '../assets/arrows.svg';
import authAxios from '../authAxios';
import { useNavigate } from 'react-router';

const SignUp = () => {
    const [username, setUsername] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();

    const handleSignUp = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await authAxios.post(
                '/auth/register',
                {
                    username,
                    displayName,
                    email,
                    password,
                },
                {
                    withCredentials: true,
                },
            );

            console.log('Registration successful:', response.data);

            // backend returns { user, accessToken }
            localStorage.setItem('accessToken', response.data.accessToken);

            navigate('/');
        } catch (err: any) {
            console.error('Registration failed:', err);

            const message =
                err?.response?.data?.message || 'Registration failed. Please try again.';

            setError(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <nav className="navbar navbar-light" style={{ backgroundColor: '#dedede' }}>
                <div className="container-fluid d-flex justify-content-between align-items-center">
                    <a
                        className="navbar-brand d-flex align-items-center"
                        href="#"
                        style={{ gap: '2px', marginBottom: 0 }}
                    >
                        <img
                            src={arrows}
                            width="30"
                            height="30"
                            className="d-inline-block align-top"
                            alt="logo"
                        />
                        PeerPrep
                    </a>
                </div>
            </nav>

            <div className="container mt-5" style={{ maxWidth: '400px' }}>
                <h2 className="mb-4">Sign Up</h2>

                <form onSubmit={handleSignUp}>
                    <div className="mb-3">
                        <label htmlFor="username" className="form-label">
                            Username
                        </label>
                        <input
                            id="username"
                            type="text"
                            className="form-control"
                            value={username}
                            onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                setUsername(e.target.value)
                            }
                            required
                        />
                    </div>
                    <div className="mb-3">
                        <label htmlFor="displayName" className="form-label">
                            Display Name
                        </label>
                        <input
                            id="displayName"
                            type="text"
                            className="form-control"
                            value={displayName}
                            onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                setDisplayName(e.target.value)
                            }
                            required
                        />
                    </div>
                    <div className="mb-3">
                        <label htmlFor="email" className="form-label">
                            Email
                        </label>
                        <input
                            id="email"
                            type="email"
                            className="form-control"
                            value={email}
                            onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                setEmail(e.target.value)
                            }
                            required
                        />
                    </div>
                    <div className="mb-3">
                        <label htmlFor="password" className="form-label">
                            Password
                        </label>
                        <input
                            id="password"
                            type="password"
                            className="form-control"
                            value={password}
                            onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                setPassword(e.target.value)
                            }
                            required
                        />
                    </div>
                    {error && <div className="alert alert-danger">{error}</div>}
                    <button type="submit" className="btn btn-primary w-100" disabled={loading}>
                        {loading ? 'Signing up...' : 'Sign Up'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default SignUp;
