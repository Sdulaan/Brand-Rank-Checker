import { useEffect, useState } from 'react';

function ProfilePanel({ user, onUpdateProfile, onUpdatePassword }) {
  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setUsername(user?.username || '');
    setEmail(user?.email || '');
  }, [user]);

  const saveProfile = async () => {
    setMessage('');
    setError('');
    try {
      await onUpdateProfile({ username, email });
      setMessage('Profile updated.');
    } catch (err) {
      setError(err.message || 'Failed to update profile');
    }
  };

  const savePassword = async () => {
    setMessage('');
    setError('');
    try {
      await onUpdatePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setMessage('Password changed.');
    } catch (err) {
      setError(err.message || 'Failed to update password');
    }
  };

  return (
    <section className="p-4 lg:p-6">
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold">My Profile</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">Username</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Email</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={saveProfile}
            className="mt-3 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Save Profile
          </button>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold">Change Password</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={savePassword}
            className="mt-3 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Update Password
          </button>
        </div>

        {message && <p className="rounded bg-emerald-50 p-2 text-sm text-emerald-700">{message}</p>}
        {error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
      </div>
    </section>
  );
}

export default ProfilePanel;
