export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-mbzuai-sand">
      {/* Gold header band */}
      <header className="bg-mbzuai-gold">
        <div className="mx-auto max-w-6xl px-6 py-5 flex items-center gap-4">
          {/* Logo mark — simple dotted motif placeholder , svg later*/}
          <div className="flex flex-col leading-tight">
            <span className="text-mbzuai-navy font-semibold text-lg">
              Mohamed bin Zayed University
            </span>
            <span className="text-mbzuai-navy/80 text-sm">
              of Artificial Intelligence
            </span>
          </div>
          <div className="ml-auto text-mbzuai-navy/70 text-sm">
            RLA Prepaid Card Reconciliation
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
