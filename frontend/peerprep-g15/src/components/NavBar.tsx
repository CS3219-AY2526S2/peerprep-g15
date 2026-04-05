import arrows from '../assets/arrows.svg';
import avatar from '../assets/avatar.svg';
import { useNavigate } from 'react-router';
import authAxios from '../authAxios';

const NavBar = ({ name }: { name: string }) => {
    const navigate = useNavigate();
    const handleLogout = async () => {
        try {
            await authAxios.post('/auth/logout');
        } catch (error) {
            console.error('Logout failed:', error);
        } finally {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('name');
            navigate('/');
        }
    };

    return (
        <nav className="navbar navbar-light" style={{ backgroundColor: '#bdbdbd' }}>
            <div className="container-fluid d-flex justify-content-between align-items-center">
                <a
                    className="navbar-brand d-flex align-items-center"
                    href="#"
                    style={{ gap: '2px', marginBottom: 0 }}
                >
                    <img src={arrows} width="30" height="30" alt="logo" />
                    <span>PeerPrep</span>
                </a>

                <div
                    className="button-container dropdown d-flex align-items-center"
                    style={{ marginRight: '1px', gap: '6px' }}
                >
                    <img
                        src={avatar}
                        alt="avatar"
                        width="30"
                        height="30"
                        style={{ borderRadius: '50%' }}
                    />

                    <button
                        className="btn dropdown-toggle"
                        type="button"
                        id="userDropdown"
                        data-bs-toggle="dropdown"
                        aria-expanded="false"
                        style={{
                            fontSize: '15px',
                            border: 'none',
                            background: 'transparent',
                            padding: 0,
                            color: 'black',
                        }}
                    >
                        {name}
                    </button>

                    <ul className="dropdown-menu dropdown-menu-end" aria-labelledby="userDropdown">
                        <li>
                            <a className="dropdown-item" href="#">
                                Profile
                            </a>
                        </li>
                        <li>
                            <a className="dropdown-item" href="#">
                                Settings
                            </a>
                        </li>
                        <li>
                            <button
                                className="dropdown-item"
                                w-idth="100%"
                                onClick={handleLogout}
                                style={{ color: 'black' }}
                            >
                                Logout
                            </button>
                        </li>
                    </ul>
                </div>
            </div>
        </nav>
    );
};

export default NavBar;
