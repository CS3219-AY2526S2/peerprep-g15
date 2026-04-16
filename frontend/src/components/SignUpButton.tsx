import { useNavigate } from 'react-router';

const SignUpButton = () => {
    const navigate = useNavigate();

    const navigateToSignUp = () => {
        navigate('/signup');
    };
    return (
        <div className="btn btn-outline-secondary" onClick={navigateToSignUp}>
            Sign Up
        </div>
    );
};

export default SignUpButton;
