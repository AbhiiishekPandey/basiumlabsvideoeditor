import { contactLinks, profile } from "@/content/profile";
import { ArrowUpRight } from "./icons";

export function About() {
  return (
    <section id="about" aria-labelledby="about-title" className="glass scroll-mt-6 rounded-[32px] p-6 sm:rounded-[40px] sm:p-10">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-14">
        <div>
          <p className="text-xs font-medium tracking-[0.14em] text-fg-faint uppercase">About</p>
          <h2 id="about-title" className="mt-3 text-[clamp(1.75rem,3.4vw,2.6rem)] leading-[1.08] font-semibold tracking-[-0.025em] text-balance">
            {profile.positioning.join(" · ")}
          </h2>
          <div className="mt-5 space-y-3 text-[15px] leading-relaxed text-pretty text-fg-dim sm:text-base">
            {profile.about.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <dl className="grid grid-cols-2 gap-3">
            {profile.facts.map((f) => (
              <div key={f.label} className="glass-panel rounded-[20px] p-4">
                <dt className="text-xs text-fg-faint">{f.label}</dt>
                <dd className="mt-1 text-[15px] font-semibold">{f.value}</dd>
              </div>
            ))}
          </dl>
          <div className="glass-panel rounded-[20px] p-4">
            <h3 className="text-xs text-fg-faint">Areas I work across</h3>
            <ul className="mt-3 flex flex-wrap gap-2">
              {profile.interests.map((t, i) => (
                <li key={t} className={`tag text-xs ${i === 0 ? "bg-white text-[#18181b]" : ""}`}>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Contact() {
  return (
    <section id="contact" aria-labelledby="contact-title" className="glass scroll-mt-6 rounded-[32px] p-6 sm:rounded-[40px] sm:p-10">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-xl">
          <p className="text-xs font-medium tracking-[0.14em] text-fg-faint uppercase">Contact</p>
          <h2 id="contact-title" className="mt-3 text-[clamp(1.9rem,4vw,3rem)] leading-[1.05] font-semibold tracking-[-0.03em] text-balance">
            Need an editor? Let&apos;s talk.
          </h2>
          <p className="mt-3 text-[15px] text-pretty text-fg-dim sm:text-base">
            I&apos;m open to conversations about video editing roles and projects.
          </p>
        </div>

        {contactLinks.length > 0 ? (
          <ul className="flex flex-wrap gap-2.5">
            {contactLinks.map((c, i) => {
              const external = /^https?:/.test(c.href);
              return (
                <li key={c.label}>
                  <a
                    href={c.href}
                    {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    className={i === 0 ? "pill-solid" : "pill-ghost"}
                  >
                    {c.display || c.label}
                    <ArrowUpRight size={15} />
                  </a>
                </li>
              );
            })}
          </ul>
        ) : (
          process.env.NODE_ENV !== "production" && (
            <p className="rounded-[20px] border border-dashed border-white/40 p-4 text-sm text-fg-dim">
              Dev note: add email / LinkedIn / résumé links in <code>src/content/profile.ts</code>.
              This box is hidden in production builds.
            </p>
          )
        )}
      </div>
    </section>
  );
}
