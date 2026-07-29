// The one-time password hand-off.
//
// There is no mail server, so the manager IS the delivery mechanism — which
// works because this is a handful of people in one building who know each
// other by sight. Shown once; only the hash is stored, so it cannot be looked
// up again if the manager navigates away.

export default function TemporaryPasswordPanel({ issued, onDismiss }) {
  if (!issued) return null;

  return (
    <div className="mt-6 bg-white rounded-2xl border-2 border-mbzuai-gold p-6">
      <h2 className="font-semibold text-mbzuai-navy">
        Temporary password for {issued.name}
      </h2>
      <p className="mt-1 text-sm text-mbzuai-navy/70">
        Give this to them directly. It is shown once and cannot be looked up
        again — they will be asked to choose their own at sign-in.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-mbzuai-navy/50">
            Email
          </p>
          <p className="font-mono text-mbzuai-navy">{issued.email}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-mbzuai-navy/50">
            Password
          </p>
          <p className="font-mono text-lg font-semibold text-mbzuai-navy">
            {issued.password}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onDismiss}
        className="mt-4 text-sm text-mbzuai-navy/60 hover:text-mbzuai-navy underline"
      >
        I have passed this on — hide it
      </button>
    </div>
  );
}
