export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-16">
      <section className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">
          Travelling Agency Management System - V1
        </h1>
        <p className="max-w-3xl text-sm text-zinc-600 dark:text-zinc-300">
          Supabase-first baseline with server-side business rules for bookings,
          wallet ledger, commissions, hierarchy, and audit logs.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <FeatureCard
          title="Booking Engine"
          description="Deposit rule validation, multi-passenger booking, admin verification flow."
        />
        <FeatureCard
          title="Wallet Ledger"
          description="Immutable token ledger with top-up, deduction, and refund events."
        />
        <FeatureCard
          title="Commission Engine"
          description="Pending to confirmed lifecycle with downline and recruitment rules."
        />
        <FeatureCard
          title="Hierarchy Engine"
          description="Agent tree, level depth checks, and historical relationship snapshots."
        />
        <FeatureCard
          title="GL and Bonus"
          description="GL assignment and monthly individual/group bonus qualification."
        />
        <FeatureCard
          title="Audit and Notifications"
          description="Append-only action logs, PDF generation, and WhatsApp delivery tracking."
        />
      </section>

      <section className="flex gap-3">
        <a
          href="/login"
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-black"
        >
          Go to Login
        </a>
        <a
          href="/dashboard"
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-700"
        >
          Go to Dashboard
        </a>
      </section>
    </main>
  );
}

type FeatureCardProps = {
  title: string;
  description: string;
};

function FeatureCard({ title, description }: FeatureCardProps) {
  return (
    <article className="rounded-xl border border-zinc-200 p-4 shadow-sm dark:border-zinc-800">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
        {description}
      </p>
    </article>
  );
}
