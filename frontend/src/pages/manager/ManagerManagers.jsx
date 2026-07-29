import { useState } from "react";
import ManagerLayout from "../../components/ManagerLayout";
import TemporaryPasswordPanel from "../../components/TemporaryPasswordPanel";
import { useAuth } from "../../context/AuthContext";
import { useUserAdmin } from "../../hooks/useUserAdmin";

// Manager administration. No cards appear anywhere on this screen — managers
// review and administer spending, they never hold a prepaid card.
//
// Managers are exact peers: any manager can add, switch off or reset any
// other, including each other. There is no privilege for one to escalate to,
// and it means nobody is locked out waiting on one particular person.

export default function ManagerManagers() {
  const { user: signedInUser } = useAuth();
  const {
    users: managers,
    loading,
    error,
    issued,
    dismissIssued,
    createUser,
    deactivate,
    reactivate,
    resetPassword,
  } = useUserAdmin("manager");

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ fullName: "", email: "" });

  const handleCreate = async (event) => {
    event.preventDefault();
    const created = await createUser(form);
    if (created) {
      setForm({ fullName: "", email: "" });
      setShowForm(false);
    }
  };

  const handleDeactivate = async (target) => {
    if (
      !window.confirm(
        `Switch off ${target.fullName}? They will not be able to sign in. Anything they recorded stays in the record with their name on it.`
      )
    ) {
      return;
    }
    await deactivate(target);
  };

  const handleReset = async (target) => {
    if (
      !window.confirm(
        `Issue a new temporary password for ${target.fullName}? Their current password stops working immediately.`
      )
    ) {
      return;
    }
    await resetPassword(target);
  };

  const inputClass =
    "w-full rounded-lg border border-mbzuai-navy/20 px-3 py-2 text-mbzuai-navy focus:border-mbzuai-gold focus:outline-none focus:ring-1 focus:ring-mbzuai-gold";
  const labelClass = "block text-sm font-medium text-mbzuai-navy/70 mb-1";

  return (
    <ManagerLayout>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-mbzuai-gold font-medium tracking-wide uppercase text-sm">
            Administration
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-mbzuai-navy">
            Managers
          </h1>
          <p className="mt-1 text-sm text-mbzuai-navy/50">
            Everyone who reviews submissions and administers the system. Managers
            do not hold prepaid cards.
          </p>
        </div>
        <button
          onClick={() => setShowForm((open) => !open)}
          className="px-5 py-2.5 rounded-lg bg-mbzuai-navy text-white text-sm font-medium hover:bg-mbzuai-navy/80"
        >
          {showForm ? "Cancel" : "Add manager"}
        </button>
      </div>

      <TemporaryPasswordPanel issued={issued} onDismiss={dismissIssued} />

      {error && (
        <div className="mt-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mt-6 bg-white rounded-2xl border border-mbzuai-navy/10 p-6"
        >
          <h2 className="font-semibold text-mbzuai-navy">Add a manager</h2>
          <p className="mt-1 text-sm text-mbzuai-navy/60">
            They will see exactly what you see — all managers share one view.
          </p>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="fullName" className={labelClass}>
                Full name
              </label>
              <input
                id="fullName"
                required
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="newEmail" className={labelClass}>
                Email
              </label>
              <input
                id="newEmail"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>
          <button
            type="submit"
            className="mt-5 px-5 py-2.5 rounded-lg bg-mbzuai-navy text-white text-sm font-medium hover:bg-mbzuai-navy/80"
          >
            Create and issue password
          </button>
        </form>
      )}

      <div className="mt-6 bg-white rounded-2xl border border-mbzuai-navy/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-mbzuai-navy/50 bg-mbzuai-sand/50">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-mbzuai-navy/50">
                    Loading…
                  </td>
                </tr>
              ) : (
                managers.map((m) => {
                  const isMe = m.userId === signedInUser.userId;
                  return (
                    <tr
                      key={m.userId}
                      className={`border-t border-mbzuai-navy/5 ${
                        m.isActive ? "" : "bg-mbzuai-navy/[0.02] text-mbzuai-navy/50"
                      }`}
                    >
                      <td className="px-5 py-4 font-medium text-mbzuai-navy">
                        {m.fullName}
                        {isMe && (
                          <span className="ml-2 text-xs text-mbzuai-navy/50">
                            (you)
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-mbzuai-navy/70">{m.email}</td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                            m.isActive
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {m.isActive ? "active" : "switched off"}
                        </span>
                        {m.mustChangePassword && m.isActive && (
                          <span className="ml-2 inline-block px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                            temp password
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        {m.isActive ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleReset(m)}
                              className="text-sm text-mbzuai-navy/70 hover:text-mbzuai-navy underline"
                            >
                              Reset password
                            </button>
                            {/* You cannot switch yourself off — that is also
                                what makes lockout impossible, since whoever
                                switches a manager off is a manager who stays. */}
                            {!isMe && (
                              <button
                                type="button"
                                onClick={() => handleDeactivate(m)}
                                className="ml-4 text-sm text-red-600 hover:text-red-700 underline"
                              >
                                Switch off
                              </button>
                            )}
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => reactivate(m)}
                            className="text-sm text-mbzuai-navy/70 hover:text-mbzuai-navy underline"
                          >
                            Switch back on
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-4 text-sm text-mbzuai-navy/50">
        Managers reset each other’s passwords — there is no single administrator
        to wait on. If every manager is ever locked out, a developer can restore
        access with <code className="text-mbzuai-navy/70">manageAdmin.js</code>.
      </p>
    </ManagerLayout>
  );
}
