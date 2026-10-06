// Orbit hero data for brandonkeao.com, replacing the living-map proof's map-data.ts.
// Ids stay the proof's so its per-moon materials (basalt, rust, ivory) carry over.
// Copy is the decided Orbit deck (Brandon, 2026-10-06); Work with me has its own three (C-W6).
export type CategoryId = 'portfolio' | 'playbooks' | 'approach';
// `href` is where a step leads; `cta` names that destination on the step's label.
// Until public playbook pages exist, steps link to the nearest existing page
// (Brandon, 2026-10-06: "Link to existing pages for now").
export type ContentItem = { id: string; title: string; description: string; href: string; cta: string; locked?: boolean; placeholder?: boolean };
export type Category = { id: CategoryId; name: string; noun: string; singular: string; summary: string; items: ContentItem[] };
export type OrbitSet = 'home' | 'work';

const step = (id: string, title: string, description: string, href: string, cta: string): ContentItem => ({ id, title, description, href, cta });
const way = (id: CategoryId, name: string, summary: string, items: ContentItem[]): Category => ({ id, name, noun: 'steps', singular: 'step', summary, items });

export const SETS: Record<OrbitSet, Category[]> = {
  home: [
    way('portfolio', 'Find the real problem', 'A focused assessment when leadership knows something is wrong but the team does not yet agree on the cause or the next move.', [
      step('understand', 'Understand the customer', 'Start with customer and market needs.', '/writing/a-quest-for-shared-understanding/', "Read the article"),
      step('map', 'Map the system', 'Understand how the work really happens across product, engineering, finance, and operations.', '/services/#system', "Work with me"),
      step('constraint', 'Name the constraint', 'Make the problem clear enough to act on, and leave the team with a clear direction and next move.', '/writing/outcomes-over-outputs/', "Read the article"),
    ]),
    way('playbooks', 'Own the outcome', 'Time-bound leadership of an important initiative that needs one person to connect the problem, choices, teams, and delivery.', [
      step('connect', 'Connect the choices', 'One person connects the problem, choices, teams, and delivery.', '/consulting/#the-work', "Consulting"),
      step('align', 'Align the teams', 'Make the problem clear, build alignment, and help the team move together.', '/writing/retros-rumbles-and-trust/', "Read the article"),
      step('deliver', 'See it through', 'From the first difficult decision through delivery.', '/writing/the-hard-thing-about-hard-things-about-product-management/', "Read the article"),
    ]),
    way('approach', 'Lead through the change', 'Embedded senior product and growth leadership while the organization goes through a change or looks for a permanent leader.', [
      step('capability', 'Build capability', 'Embedded senior product and growth leadership while the organization builds capability.', '/manager-readme/#coaching', "Manager README"),
      step('change', 'Navigate change', 'Hands-on leadership for a critical initiative or transition.', '/writing/learning-to-fly-ai-rocket-ship/', "Read the article"),
      step('bridge', 'Bridge to a leader', 'Lead while the organization searches for a permanent leader.', '/consulting/#fit', "Consulting"),
    ]),
  ],
  work: [
    way('portfolio', 'Initial conversation', 'Tell me what you are trying to accomplish and where the work is getting stuck. I will give you an honest view of whether I can help and what a useful next step could be.', [
      step('understand', 'What you are trying to accomplish', 'Tell me what you are trying to accomplish.', '/contact/', "Let's talk"),
      step('map', 'Where the work is stuck', 'And where the work is getting stuck.', '/contact/', "Let's talk"),
      step('constraint', 'An honest next step', 'An honest view of whether I can help and what a useful next step could be.', '/contact/', "Let's talk"),
    ]),
    way('playbooks', 'Focused diagnostic', 'A focused engagement to understand the system and test the competing explanations. You finish with a clear direction and a next move.', [
      step('connect', 'Understand the system', 'A focused engagement to understand the system.', '/services/#system', "Where I can help"),
      step('align', 'Test the explanations', 'Test the competing explanations.', '/writing/outcomes-over-outputs/', "Read the article"),
      step('deliver', 'A clear next move', 'You finish with a clear direction and a next move.', '/contact/', "Let's talk"),
    ]),
    way('approach', 'Embedded product leadership', 'Hands-on senior leadership for a critical initiative or transition. I connect the decisions, teams, and delivery so the change actually happens.', [
      step('capability', 'Connect the decisions', 'I connect the decisions, teams, and delivery.', '/consulting/#the-work', "Consulting"),
      step('change', 'Lead the initiative', 'Hands-on senior leadership for a critical initiative or transition.', '/consulting/#fit', "Consulting"),
      step('bridge', 'Make the change happen', 'So the change actually happens.', '/contact/', "Let's talk"),
    ]),
  ],
};

/**
 * The renderer reads this array when createMap runs. Astro's client router keeps
 * modules alive across page swaps, so useSet refills it in place before each map.
 */
export const CATEGORIES: Category[] = SETS.home.map((c) => ({ ...c, items: c.items.map((i) => ({ ...i })) }));

export function useSet(set: OrbitSet): void {
  SETS[set].forEach((c, i) => Object.assign(CATEGORIES[i], { ...c, items: c.items.map((x) => ({ ...x })) }));
}
