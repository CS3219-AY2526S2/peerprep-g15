import { BrowserRouter, Routes, Route } from 'react-router';
import './App.css';
import Login from './pages/Login';
import Home from './pages/Home';
import Admin from './pages/Admin';
import AddQuestion from './pages/AddQuestion';
import Questions from './pages/Questions';
import Collab from './pages/Collab';
import Users from './pages/Users';
import SignUp from './pages/SignUp';
import EditQuestion from './pages/EditQuestion';
import Settings from './pages/Settings';
import History from './pages/History';

const App = () => {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Login />} />
                <Route path="/signup" element={<SignUp />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/home" element={<Home />} />
                <Route path="/collab/:roomId" element={<Collab />} />
                <Route path="/history" element={<History />} />
                <Route path="/admin/home" element={<Admin />} />
                <Route path="/admin/questions" element={<Questions />} />
                <Route path="/admin/questions/add-question" element={<AddQuestion />} />
                <Route
                    path="/admin/questions/edit-question/:questionId"
                    element={<EditQuestion />}
                />
                <Route path="/admin/users" element={<Users />} />
            </Routes>
        </BrowserRouter>
    );
};

export default App;
