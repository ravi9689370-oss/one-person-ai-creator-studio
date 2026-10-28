export const metadata = {
  title: "AI Creator Studio",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0b1020] text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center px-4 py-10">
        {children}
      </div>
    </div>
  );
}
