import { useState, useEffect } from "react";
import apiClient from "../../api/client";
import ManagerLayout from "../../components/ManagerLayout";

const inputClass =
  "w-full rounded-lg border border-mbzuai-navy/20 px-3 py-2 text-sm text-mbzuai-navy";

export default function ManagerBudgetItems() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [newItemName, setNewItemName] = useState("");
  const [adding, setAdding] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [savingId, setSavingId] = useState(null);

  const loadItems = () => {
    setLoading(true);
    apiClient
      .get("/budget-items/all")
      .then((res) => setItems(res.data.budgetItems || []))
      .catch((err) => console.error("Failed to load budget items:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadItems(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newItemName.trim()) return;
    setAdding(true);
    setError("");
    try {
      await apiClient.post("/budget-items", { item_name: newItemName.trim() });
      setNewItemName("");
      loadItems();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to add item.");
    } finally {
      setAdding(false);
    }
  };

  const startEditing = (item) => {
    setEditingId(item.budget_item_id);
    setEditingName(item.item_name);
    setError("");
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingName("");
  };

  const saveEditing = async (id) => {
    if (!editingName.trim()) return;
    setSavingId(id);
    setError("");
    try {
      await apiClient.patch(`/budget-items/${id}`, { item_name: editingName.trim() });
      setEditingId(null);
      loadItems();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to rename item.");
    } finally {
      setSavingId(null);
    }
  };

  const toggleActive = async (item) => {
    setSavingId(item.budget_item_id);
    setError("");
    try {
      await apiClient.patch(`/budget-items/${item.budget_item_id}`, { is_active: !item.is_active });
      loadItems();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update item.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <ManagerLayout>
      <p className="text-mbzuai-gold font-medium tracking-wide uppercase text-sm">Manager</p>
      <h1 className="mt-2 text-3xl font-semibold text-mbzuai-navy">Manage Budget Items</h1>
      <p className="mt-1 text-sm text-mbzuai-navy/50">
        Manage the "Purchase For" options RLAs and managers choose from when logging a transaction or additional spending.
      </p>

      <form onSubmit={handleAdd} className="mt-6 max-w-md rounded-2xl border border-mbzuai-navy/10 bg-white p-6">
        <h2 className="text-base font-semibold text-mbzuai-navy mb-4">Add New Item</h2>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-mbzuai-navy/60 mb-1.5 uppercase tracking-wide">
              Item Name
            </label>
            <input
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              className={inputClass}
              placeholder="e.g. Alumni Weekend"
            />
          </div>
          <button
            type="submit"
            disabled={adding}
            className="px-5 py-2.5 rounded-lg bg-mbzuai-navy text-white text-sm font-medium hover:bg-mbzuai-navy/80 disabled:opacity-50"
          >
            {adding ? "Adding…" : "Add"}
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </form>

      <div className="mt-6 bg-white rounded-2xl border border-mbzuai-navy/10 overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-mbzuai-navy/50 bg-mbzuai-sand/50">
              <th className="px-5 py-3 font-medium">Item Name</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={3} className="px-5 py-10 text-center text-mbzuai-navy/50">Loading…</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-5 py-10 text-center text-mbzuai-navy/50">No items yet.</td>
              </tr>
            ) : (
              items.map((item) => {
                const isEditing = editingId === item.budget_item_id;
                const isSaving = savingId === item.budget_item_id;
                return (
                  <tr key={item.budget_item_id} className="border-t border-mbzuai-navy/5">
                    <td className="px-5 py-3">
                      {isEditing ? (
                        <input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className={inputClass}
                          autoFocus
                        />
                      ) : (
                        <span className={`font-medium ${item.is_active ? "text-mbzuai-navy" : "text-mbzuai-navy/40"}`}>
                          {item.item_name}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                          item.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {item.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {isEditing ? (
                        <div className="flex justify-end gap-3">
                          <button
                            onClick={cancelEditing}
                            className="text-sm text-mbzuai-navy/50 hover:text-mbzuai-navy"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => saveEditing(item.budget_item_id)}
                            disabled={isSaving}
                            className="text-sm font-medium text-mbzuai-navy hover:text-mbzuai-gold disabled:opacity-50"
                          >
                            {isSaving ? "Saving…" : "Save"}
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-4">
                          <button
                            onClick={() => startEditing(item)}
                            className="text-sm text-mbzuai-navy underline hover:text-mbzuai-gold"
                          >
                            Rename
                          </button>
                          <button
                            onClick={() => toggleActive(item)}
                            disabled={isSaving}
                            className="text-sm text-mbzuai-navy underline hover:text-mbzuai-gold disabled:opacity-50"
                          >
                            {isSaving ? "…" : item.is_active ? "Deactivate" : "Activate"}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </ManagerLayout>
  );
}
