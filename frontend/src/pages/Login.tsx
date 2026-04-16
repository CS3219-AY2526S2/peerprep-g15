import { useState } from 'react';
import type { ChangeEvent } from 'react';
import '../App.css';
import logo from '../assets/logo.svg';
import arrows from '../assets/arrows.svg';
import SubmitButton from '../components/SubmitButton.tsx';
import SignUpButton from '../components/SignUpButton.tsx';
import authAxios from '../authAxios.ts';
import { useNavigate } from 'react-router';

const Login = () => {
    const [error, setError] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const navigate = useNavigate();

    const handleEmailChange = (event: ChangeEvent<HTMLInputElement>) => {
        setEmail(event.target.value);
    };
    const handlePasswordChange = (event: ChangeEvent<HTMLInputElement>) => {
        setPassword(event.target.value);
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault(); // Prevent form from submitting normally

        try {
            const identifier = email; // Using email as the identifier for login
            const response = await authAxios.post('http://localhost:3001/auth/login', {
                identifier,
                password,
            });

            // Handle successful login (e.g., store access token in state or localStorage)
            const accessToken: string = response.data.accessToken;
            localStorage.setItem('accessToken', accessToken); // Store access token in localStorage

            const name: string = response.data.user.displayName;
            localStorage.setItem('name', name); // Store user name in localStorage

            const userId: string = response.data.user.id;
            localStorage.setItem('userId', userId); // Store user ID in localStorage

            setName('Login successful: ' + name);
            console.log('Login successful: ', name);
            console.log('User ID:', userId);
            setError('');

            //check to navigate to admin or user home page based on role
            const role: string = response.data.user.role;
            localStorage.setItem('role', role); // Store user role in localStorage
            if (role === 'admin') {
                navigate('/admin/home');
            } else {
                navigate('/home');
            }

            console.log('Access Token:', accessToken);

            // Store tokens, user info, or handle navigation here
        } catch (err: any) {
            console.error('Login error:', err.response || err.message);
            setError('Login failed. Please try again.');
            setName('');
        }
        console.log('Email:', email);
        console.log('Password:', password);
    };

    return (
        <>
            <div>
                <nav className="navbar navbar-light " style={{ backgroundColor: '#dedede' }}>
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
                                alt=""
                            />
                            PeerPrep
                        </a>

                        <div className="button-container" style={{ marginRight: '15px' }}>
                            <SignUpButton />
                        </div>
                    </div>
                </nav>
            </div>
            <section id="center">
                <div className="logo">
                    <img src={logo} />
                </div>
                <div className="card shadow-sm mb-5">
                    <div className="card-body">
                        <form onSubmit={handleSubmit}>
                            <div className="form-floating mb-1">
                                <input
                                    type="email"
                                    className="form-control"
                                    id="floatingInput"
                                    placeholder="name@example.com"
                                    value={email}
                                    onChange={handleEmailChange}
                                />
                                <label htmlFor="floatingInput">Email address</label>
                            </div>
                            <div className="form-floating mb-3">
                                <input
                                    type="password"
                                    className="form-control"
                                    id="floatingPassword"
                                    placeholder="Password"
                                    value={password}
                                    onChange={handlePasswordChange}
                                />
                                <label htmlFor="floatingPassword">Password</label>
                            </div>

                            <div className="center-button gap-2">
                                <SubmitButton />
                            </div>
                        </form>
                    </div>
                </div>
                <div
                    style={{
                        position: 'absolute',
                        bottom: '130px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: '100%',
                        textAlign: 'center',
                    }}
                >
                    {error && <div style={{ color: 'red', marginTop: '10px' }}>{error}</div>}
                    {name && <div style={{ color: 'green', marginTop: '10px' }}>{name}</div>}
                </div>
            </section>
        </>
    );
};
export default Login;
