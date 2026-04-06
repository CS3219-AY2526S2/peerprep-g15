import { BrowserRouter, Routes, Route } from 'react-router';
import './App.css';
import Login from './pages/Login';
import Home from './pages/Home';
import Admin from './pages/Admin';
import AddQuestion from './pages/AddQuestion';
import Questions from './pages/Questions';
import MatchPage from './pages/MatchPage';
import Collab from './pages/Collab';

const App = () => {
    return (
        <BrowserRouter>
            <Routes>
                {/* <Route path="/" element={<Login />} /> */}
                <Route path="/home" element={<Home />} />
                <Route path="/home/match" element={<MatchPage />} />
                <Route path="/" element={<Collab />} />
                <Route path="/admin/home" element={<Admin />} />
                <Route path="/admin/questions" element={<Questions />} />
                <Route path="/admin/questions/add-question" element={<AddQuestion />} />
                {/* <Route path="/dashboard" element={<Dashboard />} /> */}
            </Routes>
        </BrowserRouter>
    );
};

export default App;
