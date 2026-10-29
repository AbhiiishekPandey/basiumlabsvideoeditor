// Personal details shown across the site. Everything here is factual; fields
// left empty are not rendered. Fill in the TODOs before sharing the link.

export type ContactLink = { label: string; href: string; display: string };

export const profile = {
  name: "Abhishek Pandey",
  role: "Video Editor",
  positioning: ["Technology Builder", "Creative Thinker", "Problem Solver"],
  /** One line under the name in the hero. */
  intro:
    "I edit product films, event promos and short-form reels — cutting for rhythm, pacing and a clear story.",
  about: [
    "I'm a B.Tech Data Science student who works on video editing and creative work with Basium Labs.",
    "The edits here are product launches and walkthroughs, TEDx trailers and event promos, and vertical reels for social. I'm also an organiser of TEDxGGI.",
    "Beyond the edit I'm interested in content creation, personal branding, campaigns and growth, and in where technology meets creative execution.",
  ],
  facts: [
    { label: "Focus", value: "Video editing" },
    { label: "Studying", value: "B.Tech, Data Science" },
    { label: "Works with", value: "Basium Labs" },
    { label: "Organiser", value: "TEDxGGI" },
  ],
  interests: [
    "Video Editing",
    "Content Creation",
    "Graphic Design",
    "Campaigns",
    "Social Media",
    "Growth",
    "Creative Strategy",
    "Technology",
  ],
  // TODO(Abhishek): add real links. Empty hrefs are hidden.
  contact: [
    { label: "Email", href: "", display: "" }, // e.g. href "mailto:you@example.com"
    { label: "LinkedIn", href: "", display: "" },
    { label: "Instagram", href: "", display: "" },
    { label: "Résumé", href: "", display: "" }, // e.g. "/abhishek-pandey-resume.pdf" in public/
  ] satisfies ContactLink[],
};

export const contactLinks = profile.contact.filter((c) => c.href);
