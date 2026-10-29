import { FilmIcon, HomeIcon, MailIcon, ReelIcon, UserIcon } from "./icons";

const LINKS = [
  { href: "#top", label: "Home", Icon: HomeIcon },
  { href: "#work", label: "Selected work", Icon: FilmIcon },
  { href: "#reels", label: "Reels", Icon: ReelIcon },
  { href: "#about", label: "About", Icon: UserIcon },
  { href: "#contact", label: "Contact", Icon: MailIcon },
];

// Floating icon rail beside the window, as in the reference. Wide screens only;
// the top bar carries the same links elsewhere.
export function SideRail() {
  return (
    <nav
      aria-label="Sections"
      className="glass fixed top-1/2 left-3 z-40 hidden -translate-y-1/2 flex-col gap-1.5 rounded-full p-1.5 xl:flex"
    >
      {LINKS.map(({ href, label, Icon }) => (
        <a
          key={href}
          href={href}
          title={label}
          className="group relative grid size-10 place-items-center rounded-full text-fg-dim transition-colors hover:bg-white/15 hover:text-fg"
        >
          <Icon size={18} />
          <span className="sr-only">{label}</span>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-full ml-3 rounded-full bg-black/60 px-2.5 py-1 text-xs whitespace-nowrap text-fg opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          >
            {label}
          </span>
        </a>
      ))}
    </nav>
  );
}
