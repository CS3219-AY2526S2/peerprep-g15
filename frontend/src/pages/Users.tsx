import '../App.css';
import NavBar from '../components/NavBar.tsx';
import AdminNavBar from '../components/AdminNavBar.tsx';
import { useState, useEffect } from 'react';
import userAxios from '../userAxios.ts';

type User = {
    username: string;
    displayName: string;
    email: string;
    role: string;
    id: string;
};

const Users = () => {
    const name = localStorage.getItem('name') || 'Admin';
    const accessToken = localStorage.getItem('accessToken') || '';
    const [searchedUser, setSearchedUser] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const response = await userAxios.get('/admin/users');
            const mappedUsers = response.data.users.map((u: any) => ({
                username: u.username,
                displayName: u.displayName,
                email: u.email,
                role: u.role,
                id: u.id,
            }));
            const filteredUsers = mappedUsers.filter((u: User) => {
                const search = searchedUser.trim().toLowerCase();

                const matchesUser =
                    search === '' ||
                    u.username.toLowerCase().includes(search) ||
                    u.displayName.toLowerCase().includes(search) ||
                    u.email.toLowerCase().includes(search);

                const matchesRole =
                    roleFilter === '' || u.role.toLowerCase() === roleFilter.toLowerCase();

                return matchesUser && matchesRole;
            });
            setUsers(filteredUsers);
        } catch (error) {
            console.error('Error fetching users:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, [accessToken]);

    const handleSearch = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        fetchUsers();
    };

    const handlePromote = async (username: string) => {
        const confirmed = window.confirm('Are you sure you want to promote this user?');
        if (!confirmed) return;

        try {
            const response = await userAxios.post('/admin/promote', { username });
            console.log('Promote response:', response.data);
            fetchUsers();
        } catch (error) {
            console.error('Error promoting user:', error);
        }

        console.log('Promote user with username:', username);
    };

    const handleDemote = async (username: string) => {
        const confirmed = window.confirm('Are you sure you want to demote this user?');
        if (!confirmed) return;

        try {
            const response = await userAxios.post('/admin/demote', { username });
            console.log('Demote response:', response.data);
            fetchUsers();
        } catch (error) {
            console.error('Error demoting user:', error);
        }

        console.log('Demote user with username:', username);
    };

    const handleDelete = async (username: string) => {
        const confirmed = window.confirm('Are you sure you want to delete this user?');
        if (!confirmed) return;

        try {
            const response = await userAxios.delete(`/admin/users/${username}`);
            console.log('Delete response:', response.data);
            fetchUsers();
        } catch (error) {
            console.error('Error deleting user:', error);
        }

        // Implement delete logic here
        console.log('Delete user with username:', username);
    };
    return (
        <div>
            <NavBar name={name} />
            <div className="d-flex min-vh-100 bg-dark text-white">
                <AdminNavBar />

                <div
                    className="flex-grow-1 p-4"
                    style={{ backgroundColor: '#686868', minHeight: '100vh' }}
                >
                    <div className="d-flex justify-content-between align-items-center mb-4">
                        <h2 className="fw-bold text-warning">Users</h2>
                    </div>

                    <form onSubmit={handleSearch} className="bg-white rounded p-3 shadow-sm mb-4">
                        <div className="row g-3">
                            <div className="col-md-4">
                                <label className="form-label" htmlFor="username">
                                    Username
                                </label>
                                <input
                                    id="username"
                                    type="text"
                                    className="form-control"
                                    value={searchedUser}
                                    onChange={(e) => setSearchedUser(e.target.value)}
                                    placeholder="Username"
                                />
                            </div>
                            <div className="col-md-4">
                                <label className="form-label" htmlFor="role">
                                    Role
                                </label>
                                <select
                                    id="role"
                                    className="form-select"
                                    value={roleFilter}
                                    onChange={(e) => setRoleFilter(e.target.value)}
                                >
                                    <option value="">All Roles</option>
                                    <option value="user">User</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>
                            <div className="col-md-4 d-flex align-items-end">
                                <button type="submit" className="btn btn-dark w-100">
                                    Search
                                </button>
                            </div>
                        </div>
                    </form>

                    <div className="bg-white rounded p-3 shadow-sm">
                        {loading ? (
                            <p className="text-dark mb-0">Loading questions...</p>
                        ) : users.length === 0 ? (
                            <p className="text-dark mb-0">No users found.</p>
                        ) : (
                            <table className="table table-hover align-middle mb-0">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Email</th>
                                        <th>Role</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((user) => (
                                        <tr key={user.id}>
                                            <td>{user.username}</td>
                                            <td>{user.email}</td>
                                            <td>{user.role}</td>
                                            <td>
                                                <button
                                                    className="btn btn-sm btn-primary me-2"
                                                    onClick={() => handlePromote(user.username)}
                                                >
                                                    Promote
                                                </button>
                                                <button
                                                    className="btn btn-sm btn-secondary me-2"
                                                    onClick={() => handleDemote(user.username)}
                                                >
                                                    Demote
                                                </button>
                                                <button
                                                    className="btn btn-sm btn-danger"
                                                    onClick={() => handleDelete(user.username)}
                                                >
                                                    Delete
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Users;
