import { useState } from 'react';
import type { ChangeEvent } from 'react';
import './App.css';
import logo from './assets/logo.svg';
import arrows from './assets/arrows.svg';
import SubmitButton from './components/SubmitButton.tsx';
import SignUpButton from './components/SignUpButton.tsx';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function App() {
    const [error, setError] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    // const navigate = useNavigate();

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
            const response = await axios.post('http://localhost:3001/auth/login', {
                identifier,
                password,
            });

            // Handle successful login (e.g., store access token in state or localStorage)
            const accessToken: string = response.data.accessToken;
            localStorage.setItem('accessToken', accessToken); // Store access token in localStorage

            const name: string = response.data.user.displayName;
            localStorage.setItem('name', name); // Store user name in localStorage
            setName('Login successful: ' + name);
            console.log('Login successful: ', name);
            setError('');

            // navigate('/home');
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
                    <div className="container">
                        <a className="navbar-brand" href="#">
                            <img
                                src={arrows}
                                width="30"
                                height="30"
                                className="d-inline-block align-top"
                                alt=""
                            />
                            PeerPrep
                        </a>
                    </div>
                    <div className="button-container" style={{ marginRight: '15px' }}>
                        <SignUpButton />
                    </div>
                </nav>
            </div>
            <section id="center">
                <div className="logo">
                    <img src={logo} />
                </div>
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

                    <div
                        style={{
                            position: 'absolute',
                            bottom: '100px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            width: '100%',
                            textAlign: 'center',
                        }}
                    >
                        {error && <div style={{ color: 'red', marginTop: '10px' }}>{error}</div>}
                        {name && <div style={{ color: 'green', marginTop: '10px' }}>{name}</div>}
                    </div>

                    <div className="center-button gap-2">
                        <SubmitButton />
                    </div>
                </form>
            </section>
        </>
    );
}

export default App;
