// import { useState } from 'react';
import '../App.css';
import NavBar from '../components/NavBar';
// import { useNavigate } from 'react-router';

const MatchPage = () => {
    // const navigate = useNavigate();
    const name = localStorage.getItem('name') || 'User';

    return (
        <div>
            <NavBar name={name} />
            <div className="container mt-4">
                <h1>Match Page</h1>
                <p className="text-muted">
                    This is where the matching functionality will be implemented.
                </p>
            </div>
        </div>
    );
};

export default MatchPage;
