function SettingsPage() {
  return (
    <>
      <header className="h-16 flex items-center justify-between px-4 md:px-8 border-b border-slate-800 bg-slate-950/60 backdrop-blur-xl">
        <div>
          <h2 className="text-base md:text-lg font-semibold text-slate-50">
            Settings
          </h2>
          <p className="text-[11px] text-slate-400">
            Runtime information and environment overview.
          </p>
        </div>
      </header>
      <section className="flex-1 px-4 md:px-8 py-5 md:py-6">
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-3 text-xs text-slate-300">
          <p>
            This panel intentionally avoids exposing any secrets or environment
            values. All connection details are managed via the backend&apos;s{" "}
            <span className="font-mono text-[11px] text-slate-200">.env</span>{" "}
            file and are not surfaced to the browser for security reasons.
          </p>
          <p>
            To adjust MongoDB or camera configuration, update the backend
            environment directly and restart the FastAPI server.
          </p>
        </div>
      </section>
    </>
  );
}

export default SettingsPage;

