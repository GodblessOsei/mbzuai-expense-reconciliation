import { useState, useEffect } from "react";
import apiClient from "../../api/client";
import ManagerLayout from "../../components/ManagerLayout";
import TemporaryPasswordPanel from "../../components/TemporaryPasswordPanel";
import { useUserAdmin } from "../../hooks/useUserAdmin";

// RLA administration. Cards are the whole point of this screen: an RLA is a
// person who spends on a prepaid card, so every RLA must hold one. That single
// rule drives most of what is here — the card column, the required field on
// the form, and the "register a card" escape valve when none are free.

export default function ManagerRlas() {
  const {
    users: rlas,
    loading,
    error,
    setError,
    issued,
    dismissIssued,
    reload,
    createUser,
    deactivate,
    reactivate,
    resetPassword,
  } = useUserAdmin("rla");

  const [cards, setCards] = useState([]);
  const [showForm, setShowForm] = useState(false);

  // Which row is currently entering a brand-new card, and what they've typed.
  const [newCardFor, setNewCardFor] = useState(null);
  const [newCardDigits, setNewCardDigits] = useState("");

  // A new RLA arrives either with a brand new card, or with one already in the
  // system that nobody currently holds. Cards are not a fixed pool -- there is
  // no cap -- so "new card" is the default and adding an RLA is never blocked.
  const NEW_CARD = "new";
  const [form, setForm] = useState({
    fullName: "",
    username: "",
    cardSource: NEW_CARD,
    cardholderId: "",
    newCardLastFour: "",
  });

  const loadCards = () =>
    apiClient
      .get("/cardholders")
      .then((res) => setCards(res.data.cardholders || []))
      .catch((err) => console.error("Failed to load cards:", err));

  useEffect(() => {
    loadCards();
  }, []);

  const freeCards = cards.filter((c) => !c.assignedUserId);

  const refreshAll = async () => {
    await Promise.all([reload(), loadCards()]);
  };

  const handleCreate = async (event) => {
    event.preventDefault();

    // The card is created and handed over in the same request, so a failure
    // part-way cannot leave a cardless RLA behind.
    const created = await createUser({
      fullName: form.fullName,
      username: form.username,
      ...(form.cardSource === NEW_CARD
        ? { newCardLastFour: form.newCardLastFour }
        : { cardholderId: Number(form.cardSource) }),
    });

    if (created) {
      setForm({
        fullName: "",
        username: "",
        cardSource: NEW_CARD,
        cardholderId: "",
        newCardLastFour: "",
      });
      setShowForm(false);
      await loadCards();
    }
  };

  const handleDeactivate = async (rla) => {
    const card = rla.assignedCard
      ? ` Their card •••• ${rla.assignedCard.lastFourDigits} becomes free to hand to their replacement.`
      : "";
    if (
      !window.confirm(
        `Switch off ${rla.fullName}? They will not be able to sign in.${card} Everything they submitted stays in the record with their name on it.`
      )
    ) {
      return;
    }
    await deactivate(rla);
    await loadCards();
  };

  const handleReset = async (rla) => {
    if (
      !window.confirm(
        `Issue a new temporary password for ${rla.fullName}? Their current password stops working immediately.`
      )
    ) {
      return;
    }
    await resetPassword(rla);
  };

  // Swapping which card someone holds. Releasing the old one first stops
  // anybody ending up with two.
  const handleSwapCard = async (rla, nextCardId) => {
    const currentCardId = rla.assignedCard?.cardholderId;
    if (!nextCardId || String(currentCardId) === String(nextCardId)) return;

    setError("");
    try {
      if (currentCardId) {
        await apiClient.patch(`/cardholders/${currentCardId}/assign`, {
          userId: null,
        });
      }
      await apiClient.patch(`/cardholders/${nextCardId}/assign`, {
        userId: rla.userId,
      });
      await refreshAll();
    } catch (err) {
      setError(err.response?.data?.message || "Could not reassign that card");
      await refreshAll();
    }
  };

  // Give someone a card that is not in the system yet. Register then hand over
  // -- the same two steps the Add RLA form does in one request.
  const handleGiveNewCard = async (rla, lastFourDigits) => {
    setError("");
    try {
      const res = await apiClient.post("/cardholders", { lastFourDigits });
      const newCardId = res.data.cardholder.cardholderId;

      const currentCardId = rla.assignedCard?.cardholderId;
      if (currentCardId) {
        await apiClient.patch(`/cardholders/${currentCardId}/assign`, {
          userId: null,
        });
      }
      await apiClient.patch(`/cardholders/${newCardId}/assign`, {
        userId: rla.userId,
      });

      setNewCardFor(null);
      setNewCardDigits("");
      await refreshAll();
    } catch (err) {
      setError(err.response?.data?.message || "Could not register that card");
      await loadCards();
    }
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
          <h1 className="mt-2 text-3xl font-semibold text-mbzuai-navy">RLAs</h1>
          <p className="mt-1 text-sm text-mbzuai-navy/50">
            Cardholders who submit expenses. Every RLA holds a prepaid card.
          </p>
        </div>
        <button
          onClick={() => setShowForm((open) => !open)}
          className="px-5 py-2.5 rounded-lg bg-mbzuai-navy text-white text-sm font-medium hover:bg-mbzuai-navy/80"
        >
          {showForm ? "Cancel" : "Add RLA"}
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
          <h2 className="font-semibold text-mbzuai-navy">Add an RLA</h2>
          <p className="mt-1 text-sm text-mbzuai-navy/60">
            Give them a new card, or one already in the system that nobody is
            holding.
          </p>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
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
              <label htmlFor="newUsername" className={labelClass}>
                Username
              </label>
              <input
                id="newUsername"
                type="text"
                required
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="card" className={labelClass}>
                Card
              </label>
              <select
                id="card"
                value={form.cardSource}
                onChange={(e) => setForm({ ...form, cardSource: e.target.value })}
                className={inputClass}
              >
                {/* Always first, always available -- cards are not a fixed
                    pool, so this option can never leave the manager stuck. */}
                <option value={NEW_CARD}>A new card…</option>
                {freeCards.map((c) => (
                  <option key={c.cardholderId} value={c.cardholderId}>
                    •••• {c.lastFourDigits}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {form.cardSource === NEW_CARD && (
            <div className="mt-4 max-w-xs">
              <label htmlFor="lastFour" className={labelClass}>
                Last four digits of the new card
              </label>
              <input
                id="lastFour"
                inputMode="numeric"
                pattern="\d{4}"
                maxLength={4}
                required
                placeholder="1234"
                value={form.newCardLastFour}
                onChange={(e) =>
                  setForm({
                    ...form,
                    newCardLastFour: e.target.value.replace(/\D/g, ""),
                  })
                }
                className={inputClass}
              />
              <p className="mt-1 text-xs text-mbzuai-navy/50">
                Only the last four digits are ever stored.
              </p>
            </div>
          )}

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
                <th className="px-5 py-3 font-medium">Username</th>
                <th className="px-5 py-3 font-medium">Card</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-mbzuai-navy/50">
                    Loading…
                  </td>
                </tr>
              ) : rlas.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-mbzuai-navy/50">
                    No RLAs yet. Click “Add RLA” to create the first one.
                  </td>
                </tr>
              ) : (
                rlas.map((rla) => (
                  <tr
                    key={rla.userId}
                    className={`border-t border-mbzuai-navy/5 ${
                      rla.isActive ? "" : "bg-mbzuai-navy/[0.02] text-mbzuai-navy/50"
                    }`}
                  >
                    <td className="px-5 py-4 font-medium text-mbzuai-navy">
                      {rla.fullName}
                    </td>
                    <td className="px-5 py-4 text-mbzuai-navy/70">{rla.username}</td>
                    <td className="px-5 py-4">
                      {!rla.isActive ? (
                        <span className="text-sm text-mbzuai-navy/50">
                          card released
                        </span>
                      ) : newCardFor === rla.userId ? (
                        // Inline entry for a card not yet in the system.
                        <span className="flex items-center gap-2">
                          <input
                            autoFocus
                            inputMode="numeric"
                            maxLength={4}
                            placeholder="1234"
                            value={newCardDigits}
                            onChange={(e) =>
                              setNewCardDigits(e.target.value.replace(/\D/g, ""))
                            }
                            className="w-20 rounded-lg border border-mbzuai-navy/20 px-2 py-1 text-sm text-mbzuai-navy"
                          />
                          <button
                            type="button"
                            disabled={newCardDigits.length !== 4}
                            onClick={() => handleGiveNewCard(rla, newCardDigits)}
                            className="text-sm text-mbzuai-navy underline disabled:opacity-40"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setNewCardFor(null);
                              setNewCardDigits("");
                            }}
                            className="text-sm text-mbzuai-navy/50 underline"
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <select
                          value={rla.assignedCard?.cardholderId || ""}
                          onChange={(e) => {
                            if (e.target.value === NEW_CARD) {
                              setNewCardDigits("");
                              setNewCardFor(rla.userId);
                              return;
                            }
                            handleSwapCard(rla, e.target.value);
                          }}
                          className="rounded-lg border border-mbzuai-navy/20 px-2 py-1 text-sm text-mbzuai-navy"
                        >
                          {/* No "no card" option: an active RLA always holds
                              one. Swapping is allowed, removing is not. */}
                          {rla.assignedCard ? (
                            <option value={rla.assignedCard.cardholderId}>
                              •••• {rla.assignedCard.lastFourDigits}
                            </option>
                          ) : (
                            <option value="">No card — assign one</option>
                          )}
                          {freeCards.map((c) => (
                            <option key={c.cardholderId} value={c.cardholderId}>
                              •••• {c.lastFourDigits}
                            </option>
                          ))}
                          <option value={NEW_CARD}>A new card…</option>
                        </select>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                          rla.isActive
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {rla.isActive ? "active" : "switched off"}
                      </span>
                      {rla.mustChangePassword && rla.isActive && (
                        <span className="ml-2 inline-block px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                          temp password
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      {rla.isActive ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleReset(rla)}
                            className="text-sm text-mbzuai-navy/70 hover:text-mbzuai-navy underline"
                          >
                            Reset password
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeactivate(rla)}
                            className="ml-4 text-sm text-red-600 hover:text-red-700 underline"
                          >
                            Switch off
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => reactivate(rla)}
                          className="text-sm text-mbzuai-navy/70 hover:text-mbzuai-navy underline"
                        >
                          Switch back on
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-4 text-sm text-mbzuai-navy/50">
        RLAs are switched off, never deleted — their past submissions stay in the
        record with their name on them. Switching someone off releases their
        card so it can be handed to their replacement; the card keeps its number
        and its history.
      </p>

      <p className="mt-2 text-sm text-mbzuai-navy/50">
        A card another active RLA is holding cannot be taken — switch that
        person off, or give them a different card, to free it first.
        Reactivating someone does not give their old card back.
      </p>
    </ManagerLayout>
  );
}
