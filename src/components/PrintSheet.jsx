export default function PrintSheet({ children, actions, className = "" }) {
  return (
    <main className={`print-document mx-auto min-h-screen max-w-[210mm] bg-white p-4 text-ink sm:p-8 ${className}`}>
      {actions && (
        <div className="no-print mb-4 flex flex-wrap justify-end gap-2">
          {actions}
        </div>
      )}
      <article className="print-sheet">{children}</article>
    </main>
  );
}
