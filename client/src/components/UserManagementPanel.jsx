import { useEffect, useState } from 'react';

function UserManagementPanel({ onLoadUsers, onCreateUser, onUpdateUser, onDeleteUser }) {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('user');
  const [password, setPassword] = useState('');

  const [editingId, setEditingId] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState('user');
  const [editIsActive, setEditIsActive] = useState(true);
  const [editPassword, setEditPassword] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const refreshUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const list = await onLoadUsers();
      setUsers(list);
    } catch (err) {
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUsers();
  }, []);

  const submit = async () => {
    setError('');
    setActionLoading(true);
    try {
      await onCreateUser({ username, email, role, password });
      setUsername('');
      setEmail('');
      setRole('user');
      setPassword('');
      await refreshUsers();
    } catch (err) {
      setError(err.message || 'Failed to create user');
    } finally {
      setActionLoading(false);
    }
  };

  const startEdit = (user) => {
    setEditingId(user._id);
    setEditUsername(user.username || '');
    setEditEmail(user.email || '');
    setEditRole(user.role || 'user');
    setEditIsActive(!!user.isActive);
    setEditPassword('');
    setError('');
  };

  const cancelEdit = () => {
    setEditingId('');
    setEditUsername('');
    setEditEmail('');
    setEditRole('user');
    setEditIsActive(true);
    setEditPassword('');
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setError('');
    setActionLoading(true);
    try {
      await onUpdateUser(editingId, {
        username: editUsername,
        email: editEmail,
        role: editRole,
        isActive: editIsActive,
        ...(editPassword ? { password: editPassword } : {}),
      });
      cancelEdit();
      await refreshUsers();
    } catch (err) {
      setError(err.message || 'Failed to update user');
    } finally {
      setActionLoading(false);
    }
  };

  const removeUser = async (user) => {
    if (!window.confirm(`Delete user \"${user.username}\"?`)) return;
    setError('');
    setActionLoading(true);
    try {
      await onDeleteUser(user._id);
      if (editingId === user._id) cancelEdit();
      await refreshUsers();
    } catch (err) {
      setError(err.message || 'Failed to delete user');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <section className="p-4 lg:p-6">
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold">Add User</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={actionLoading}
            className="mt-3 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {actionLoading ? 'Processing...' : 'Create User'}
          </button>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">User Management</h2>
            <button type="button" onClick={refreshUsers} className="rounded bg-slate-100 px-3 py-1 text-sm">
              Refresh
            </button>
          </div>

          {loading && <p className="text-sm text-slate-500">Loading users...</p>}

          <div className="overflow-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left">Username</th>
                  <th className="px-3 py-2 text-left">Email</th>
                  <th className="px-3 py-2 text-left">Role</th>
                  <th className="px-3 py-2 text-left">Active</th>
                  <th className="px-3 py-2 text-left">Password</th>
                  <th className="px-3 py-2 text-left">Created</th>
                  <th className="px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((user) => {
                  const isEditing = editingId === user._id;

                  return (
                    <tr key={user._id}>
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <input
                            value={editUsername}
                            onChange={(e) => setEditUsername(e.target.value)}
                            className="w-44 rounded border border-slate-300 px-2 py-1 text-sm"
                          />
                        ) : (
                          user.username
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <input
                            value={editEmail}
                            onChange={(e) => setEditEmail(e.target.value)}
                            className="w-56 rounded border border-slate-300 px-2 py-1 text-sm"
                          />
                        ) : (
                          user.email
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <select
                            value={editRole}
                            onChange={(e) => setEditRole(e.target.value)}
                            className="rounded border border-slate-300 px-2 py-1 text-sm"
                          >
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                          </select>
                        ) : (
                          <span className="uppercase">{user.role}</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={editIsActive}
                              onChange={(e) => setEditIsActive(e.target.checked)}
                            />
                            <span>{editIsActive ? 'Yes' : 'No'}</span>
                          </label>
                        ) : (
                          user.isActive ? 'Yes' : 'No'
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <input
                            type="password"
                            value={editPassword}
                            onChange={(e) => setEditPassword(e.target.value)}
                            placeholder="Optional new"
                            className="w-32 rounded border border-slate-300 px-2 py-1 text-sm"
                          />
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-3 py-2">{new Date(user.createdAt).toLocaleString()}</td>
                      <td className="px-3 py-2">
                        <div className="flex gap-2">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={saveEdit}
                                disabled={actionLoading}
                                className="rounded bg-emerald-100 px-2 py-1 text-xs text-emerald-700"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={cancelEdit}
                                disabled={actionLoading}
                                className="rounded bg-slate-100 px-2 py-1 text-xs"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => startEdit(user)}
                                className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-700"
                              >
                                Update
                              </button>
                              <button
                                type="button"
                                onClick={() => removeUser(user)}
                                disabled={actionLoading}
                                className="rounded bg-red-100 px-2 py-1 text-xs text-red-700 disabled:opacity-60"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
      </div>
    </section>
  );
}

export default UserManagementPanel;
