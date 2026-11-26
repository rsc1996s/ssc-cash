export default function Card({ className = "", children, ...props }) {
  return (
    <div
      className={`rounded-xl border border-paperLine bg-white shadow-card ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
