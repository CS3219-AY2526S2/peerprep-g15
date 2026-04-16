import { HouseFill, FileTextFill, PeopleFill } from 'react-bootstrap-icons';
import { useNavigate } from 'react-router';

const AdminNavBar = () => {
    const navigate = useNavigate();
    return (
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
            </ul>
        </div>
    );
};

export default AdminNavBar;
