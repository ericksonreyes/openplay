export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-6 text-sm text-slate-500">
        <p>&copy; {new Date().getFullYear()} OpenPlay</p>
        <p>Find and book open play venues.</p>
      </div>
    </footer>
  );
}
