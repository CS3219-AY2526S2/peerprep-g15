import React, { useState, useEffect } from 'react';
import '../App.css';
import NavBar from '../components/NavBar.tsx';
import userAxios from '../userAxios.ts';
import { Button, Card, FormControl } from 'react-bootstrap';

type User = {
    username: string | null;
    displayName: string | null;
    email: string | null;
    role: string | null;
    id: string | null;
    updatedAt: string | null;
};

type UserFields = keyof User;

const Settings = () => {
    const name = localStorage.getItem('name') || 'User';

    const [userData, setUserData] = useState<User | null>(null); // State to store user information
    const [loading, setLoading] = useState(true); // Loading state
    const [editField, setEditField] = useState<string | null>(null); // Field currently being edited
    const [updatedData, setUpdatedData] = useState<Partial<User>>({}); // To store edited values
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [error, setError] = useState('');

    // Fetch user information on component mount
    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const response = await userAxios.get('/me');
                const user: User = {
                    username: response.data.user.username,
                    displayName: response.data.user.displayName,
                    email: response.data.user.email,
                    role: response.data.user.role,
                    id: response.data.user.id,
                    updatedAt: response.data.user.updatedAt,
                };
                setUserData(user);
                console.log('User data fetched successfully:', response.data.user);
            } catch (error) {
                console.error('Error fetching user data:', error);
            } finally {
                setLoading(false); // Set loading to false after fetching
            }
        };

        fetchUserData();
    }, []); // Empty dependency array means this runs once when the component mounts

    // Handle the edit button click to switch the field into editing mode
    const handleEditClick = (field: UserFields) => {
        setEditField(field);
        setUpdatedData({
            ...updatedData,
            [field]: userData ? userData[field] : '', // Use a fallback if userData is null
        });
    };

    // Handle change in the input field
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
        setUpdatedData({
            ...updatedData,
            [field]: e.target.value,
        });
    };

    // Save the updated data after editing
    const handleSaveClick = async (field: UserFields) => {
        try {
            if (userData) {
                const updatedValue =
                    field === 'username' ? updatedData[field]?.toLowerCase() : updatedData[field];
                console.log(`Saving updated ${field}:`, updatedValue);

                await userAxios.patch('/me', { [field]: updatedValue }); // Update only the changed field
                setUserData({
                    ...userData,
                    [field]: updatedData[field], // Update the userData with the new value
                });
                setEditField(null); // Exit edit mode
            }
            localStorage.setItem(
                'name',
                updatedData.displayName || userData?.displayName || 'User',
            ); // Update name in localStorage
        } catch (error) {
            console.error('Error saving user data:', error);
        }
    };

    // Save the password change
    const handlesavePasswordClick = async () => {
        const comfirmation = window.confirm('Are you sure you want to change your password?');
        if (!comfirmation) return;
        try {
            await userAxios.patch('/me', {
                currentPassword,
                newPassword,
            });
            setCurrentPassword('');
            setNewPassword('');
            alert('Password updated successfully');
            setError('');
        } catch (error) {
            console.error('Error updating password:', error);
            setError(
                'Failed to update password. Please check your current password and try again.',
            );
        }
    };

    if (loading) {
        return (
            <div className="d-flex justify-content-center align-items-center min-vh-100 bg-white text-dark">
                <h1 className="display-4">Loading...</h1>
            </div>
        );
    }

    return (
        <div>
            <NavBar name={name} />
            <div className="container mt-4">
                <div className="d-flex min-vh-100 bg-white text-dark">
                    <div className="text w-100">
                        <h1 className="display-4">Settings Page</h1>
                        {userData ? (
                            <div>
                                {/* Username */}
                                <Card className="mb-3">
                                    <Card.Body>
                                        <Card.Title>Username</Card.Title>
                                        <Card.Text>
                                            {editField === 'username' ? (
                                                <FormControl
                                                    value={
                                                        updatedData.username ||
                                                        userData.username ||
                                                        ''
                                                    }
                                                    onChange={(e: any) =>
                                                        handleChange(e, 'username')
                                                    }
                                                />
                                            ) : (
                                                userData.username?.toLowerCase()
                                            )}
                                        </Card.Text>
                                        <Button
                                            variant="primary"
                                            onClick={() =>
                                                editField === 'username'
                                                    ? handleSaveClick('username')
                                                    : handleEditClick('username')
                                            }
                                        >
                                            {editField === 'username' ? 'Save' : 'Edit'}
                                        </Button>
                                    </Card.Body>
                                </Card>

                                {/* Display Name */}
                                <Card className="mb-3">
                                    <Card.Body>
                                        <Card.Title>Display Name</Card.Title>
                                        <Card.Text>
                                            {editField === 'displayName' ? (
                                                <FormControl
                                                    value={
                                                        updatedData.displayName ||
                                                        userData.displayName ||
                                                        ''
                                                    }
                                                    onChange={(
                                                        e: React.ChangeEvent<HTMLInputElement>,
                                                    ) => handleChange(e, 'displayName')}
                                                />
                                            ) : (
                                                userData.displayName
                                            )}
                                        </Card.Text>
                                        <Button
                                            variant="primary"
                                            onClick={() =>
                                                editField === 'displayName'
                                                    ? handleSaveClick('displayName')
                                                    : handleEditClick('displayName')
                                            }
                                        >
                                            {editField === 'displayName' ? 'Save' : 'Edit'}
                                        </Button>
                                    </Card.Body>
                                </Card>

                                {/* Email */}
                                <Card className="mb-3">
                                    <Card.Body>
                                        <Card.Title>Email</Card.Title>
                                        <Card.Text>
                                            {editField === 'email' ? (
                                                <FormControl
                                                    value={
                                                        updatedData.email || userData.email || ''
                                                    }
                                                    onChange={(
                                                        e: React.ChangeEvent<HTMLInputElement>,
                                                    ) => handleChange(e, 'email')}
                                                />
                                            ) : (
                                                userData.email
                                            )}
                                        </Card.Text>
                                        <Button
                                            variant="primary"
                                            onClick={() =>
                                                editField === 'email'
                                                    ? handleSaveClick('email')
                                                    : handleEditClick('email')
                                            }
                                        >
                                            {editField === 'email' ? 'Save' : 'Edit'}
                                        </Button>
                                    </Card.Body>
                                </Card>

                                {/* Password */}
                                <Card className="mb-3">
                                    <Card.Body>
                                        <Card.Title>Password</Card.Title>
                                        <Card.Text>
                                            <FormControl
                                                type="password"
                                                placeholder="Current Password"
                                                value={currentPassword}
                                                onChange={(e) => setCurrentPassword(e.target.value)}
                                            />
                                            <FormControl
                                                type="password"
                                                placeholder="New Password"
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                            />
                                        </Card.Text>
                                        {error && <p style={{ color: 'red' }}>{error}</p>}
                                        <Button variant="primary" onClick={handlesavePasswordClick}>
                                            Save Password
                                        </Button>
                                    </Card.Body>
                                </Card>
                            </div>
                        ) : (
                            <p>No user data found</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;
