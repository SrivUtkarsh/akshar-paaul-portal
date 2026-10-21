
import { useEffect, useState } from 'react';
import {
  UserPlus,
  Users,
  UserX,
  UserCheck,
  RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api, jsonBody } from '../api.js';
import Loading from '../components/Loading.jsx';

const emptyForm = {
  name: '',
  username: '',
  email: '',
  password: '',
};

export default function TeamPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  // Load administrator and faculty accounts.
  async function loadUsers() {
    try {
      const result = await api('/users');
      setUsers(result.users || []);
    } catch (error) {
      toast.error(error.message || 'Could not load accounts.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  // Create a new faculty account.
  async function createFaculty(event) {
    event.preventDefault();

    const username = form.username.trim();

    if (!/^[a-zA-Z0-9]{3,80}$/.test(username)) {
      toast.error('Username must contain 3–80 letters and numbers only.');
      return;
    }

    if (form.password.length < 12) {
      toast.error('Password must contain at least 12 characters.');
      return;
    }

    setSaving(true);

    try {
      await api('/users/faculty', {
        method: 'POST',
        body: jsonBody({
          ...form,
          username,
          name: form.name.trim(),
          email: form.email.trim(),
        }),
      });

      setForm(emptyForm);

      toast.success('Faculty account created successfully.');
      await loadUsers();
    } catch (error) {
      toast.error(error.message || 'Could not create faculty account.');
    } finally {
      setSaving(false);
    }
  }

  // Activate or deactivate an existing faculty account.
  async function toggleActive(user) {
    if (updatingUserId !== null) return;

    setUpdatingUserId(user.id);

    try {
      const result = await api(`/users/${user.id}/active`, {
        method: 'PATCH',
        body: jsonBody({ active: !user.active }),
      });

      // Update the account status immediately in the displayed list.
      setUsers((currentUsers) =>
        currentUsers.map((currentUser) =>
          currentUser.id === user.id
            ? { ...currentUser, ...result.user }
            : currentUser
        )
      );

      toast.success(
        result.user.active
          ? 'Faculty account reactivated successfully.'
          : 'Faculty account deactivated successfully.'
      );
    } catch (error) {
      toast.error(error.message || 'Could not update faculty account.');
    } finally {
      setUpdatingUserId(null);
    }
  }

  if (loading) {
    return <Loading label="Loading accounts…" />;
  }

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[.8fr_1.2fr]">
      {/* Form for creating faculty accounts */}
      <section className="card">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-forest/10 text-forest">
            <UserPlus size={20} />
          </div>

          <div>
            <h2 className="section-title">Add a faculty account</h2>
            <p className="muted mt-1">
              Create an account for a faculty member.
            </p>
          </div>
        </div>

        <form onSubmit={createFaculty} className="space-y-4">
          <div>
            <label className="label" htmlFor="faculty-name">
              Faculty name
            </label>

            <input
              id="faculty-name"
              className="field"
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
              required
              maxLength={120}
              placeholder="Full name"
              autoComplete="name"
            />
          </div>

          <div>
            <label className="label" htmlFor="faculty-username">
              Username
            </label>

            <input
              id="faculty-username"
              className="field"
              value={form.username}
              onChange={(event) =>
                setForm({
                  ...form,
                  username: event.target.value.replace(/[^a-zA-Z0-9]/g, ''),
                })
              }
              required
              minLength={3}
              maxLength={80}
              pattern="[a-zA-Z0-9]{3,80}"
              title="Use 3–80 letters and numbers only."
              placeholder="e.g. Anita123"
              autoComplete="off"
            />

            <p className="mt-1 text-xs text-slate-400">
              Letters and numbers only. No spaces or special characters.
            </p>
          </div>

          <div>
            <label className="label" htmlFor="faculty-email">
              Email (optional)
            </label>

            <input
              id="faculty-email"
              className="field"
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm({ ...form, email: event.target.value })
              }
              placeholder="name@example.org"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="label" htmlFor="faculty-password">
              Temporary password
            </label>

            <input
              id="faculty-password"
              className="field"
              type="password"
              value={form.password}
              onChange={(event) =>
                setForm({ ...form, password: event.target.value })
              }
              required
              minLength={12}
              placeholder="At least 12 characters"
              autoComplete="new-password"
            />

            <p className="mt-1 text-xs text-slate-400">
              Share the password privately with the faculty member.
            </p>
          </div>

          <button
            type="submit"
            className="btn-primary w-full"
            disabled={saving}
          >
            {saving ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                Creating account…
              </>
            ) : (
              <>
                <UserPlus size={16} />
                Create faculty account
              </>
            )}
          </button>
        </form>
      </section>

      {/* List of existing accounts */}
      <section className="card">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
            <Users size={20} />
          </div>

          <div>
            <h2 className="section-title">Portal users</h2>
            <p className="muted mt-1">
              Manage access without deleting faculty records.
            </p>
          </div>
        </div>

        {users.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
            <Users size={28} className="mx-auto text-slate-400" />
            <p className="mt-3 font-semibold text-slate-700">
              No accounts found
            </p>
            <p className="muted mt-1">
              Create a faculty account using the form.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-extrabold ${
                      user.role === 'admin'
                        ? 'bg-sun/40 text-amber-900'
                        : 'bg-forest/10 text-forest'
                    }`}
                  >
                    {user.name?.charAt(0)?.toUpperCase() || '?'}
                  </div>

                  <div className="min-w-0">
                    <p className="truncate font-bold text-slate-900">
                      {user.name}
                    </p>

                    <p className="mt-0.5 truncate text-sm text-slate-500">
                      @{user.username}
                      {user.email ? ` · ${user.email}` : ''}
                    </p>

                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-xs capitalize text-slate-400">
                        {user.role}
                      </span>

                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          user.active
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {user.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>

                {user.role === 'faculty' && (
                  <button
                    type="button"
                    onClick={() => toggleActive(user)}
                    disabled={updatingUserId !== null}
                    className="btn-secondary shrink-0"
                  >
                    {updatingUserId === user.id ? (
                      <>
                        <RefreshCw size={15} className="animate-spin" />
                        Updating…
                      </>
                    ) : user.active ? (
                      <>
                        <UserX size={15} />
                        Deactivate
                      </>
                    ) : (
                      <>
                        <UserCheck size={15} />
                        Reactivate
                      </>
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
