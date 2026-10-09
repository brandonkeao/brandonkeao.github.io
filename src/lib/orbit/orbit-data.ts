// Orbit hero data for brandonkeao.com, replacing the living-map proof's map-data.ts.
// Ids stay the proof's so its per-moon materials (basalt, rust, ivory) carry over.
// Copy is the decided Orbit deck (Brandon, 2026-10-06); Work with me has its own three (C-W6).
export type CategoryId = 'portfolio' | 'playbooks' | 'approach';
// `href` is where a step leads; `cta` names that destination on the step's label.
// Until public playbook pages exist, steps link to the nearest existing page
// (Brandon, 2026-10-06: "Link to existing pages for now"; Writing is off the site for now).
export type ContentItem = { id: string; title: string; description: string; href: string; cta: string; locked?: boolean; placeholder?: boolean };
// `tag` and `slug` are optional and only set on the Work with me set (the engagement models);
// the renderer never reads them, so the Home hero is unaffected.
export type EngagementSlug = 'full-time' | 'fractional' | 'advisory';
export type Category = { id: CategoryId; name: string; noun: string; singular: string; summary: string; items: ContentItem[]; tag?: string; slug?: EngagementSlug };
export type OrbitSet = 'home' | 'work';

const step = (id: string, title: string, description: string, href: string, cta: string): ContentItem => ({ id, title, description, href, cta });
const way = (id: CategoryId, name: string, summary: string, items: ContentItem[]): Category => ({ id, name, noun: 'steps', singular: 'step', summary, items });

// Work with me (ticket #8, Direction B): the three engagement models. Copy is verbatim from
// analysis/2026-10-09-hifi-directions/COPY_PACK.md (draft under Brandon's review). The moon ids
// stay the proof's so the per-moon materials carry over: portfolio = full time, playbooks =
// fractional, approach = advisory. Each moon's three children are the sections of that model's
// detail on /services/ (AI-made, reversible), and link into the in-page selected state.
const model = (id: CategoryId, slug: EngagementSlug, tag: string, name: string, summary: string, sections: [string, string, string]): Category => ({
  ...way(id, name, summary, [
    step('fits', 'When this fits', sections[0], `/services/?engagement=${slug}#wwm-${slug}-fits`, 'When this fits'),
    step('take-on', 'What I would take on', sections[1], `/services/?engagement=${slug}#wwm-${slug}-work`, 'What I would take on'),
    step('together', 'How we would work together', sections[2], `/services/?engagement=${slug}#wwm-${slug}-work`, 'How we would work together'),
  ]),
  tag,
  slug,
});

export const SETS: Record<OrbitSet, Category[]> = {
  home: [
    way('portfolio', 'Find the real problem', 'A focused assessment when leadership knows something is wrong but the team does not yet agree on the cause or the next move.', [
      step('understand', 'Understand the customer', 'Start with customer and market needs.', '/services/', "Work with me"),
      step('map', 'Map the system', 'Understand how the work really happens across product, engineering, finance, and operations.', '/services/#system', "Work with me"),
      step('constraint', 'Name the constraint', 'Make the problem clear enough to act on, and leave the team with a clear direction and next move.', '/services/#system', "Work with me"),
    ]),
    way('playbooks', 'Own the outcome', 'Time-bound leadership of an important initiative that needs one person to connect the problem, choices, teams, and delivery.', [
      step('connect', 'Connect the choices', 'One person connects the problem, choices, teams, and delivery.', '/services/', "Work with me"),
      step('align', 'Align the teams', 'Make the problem clear, build alignment, and help the team move together.', '/manager-readme/#philosophy', "Manager README"),
      step('deliver', 'See it through', 'From the first difficult decision through delivery.', '/contact/', "Let's talk"),
    ]),
    way('approach', 'Lead through the change', 'Embedded senior product and growth leadership while the organization goes through a change or looks for a permanent leader.', [
      step('capability', 'Build capability', 'Embedded senior product and growth leadership while the organization builds capability.', '/manager-readme/#coaching', "Manager README"),
      step('change', 'Navigate change', 'Hands-on leadership for a critical initiative or transition.', '/about/', "About"),
      step('bridge', 'Bridge to a leader', 'Lead while the organization searches for a permanent leader.', '/contact/', "Let's talk"),
    ]),
  ],
  work: [
    model('portfolio', 'full-time', 'Hiring into the team', 'Full time Senior IC Roles',
      'A senior product role with room to shape direction, own meaningful work, and stay close to the details.', [
        'You have a product area or business problem that needs a clear owner.',
        'I would work with the team to understand the problem, decide where to focus, and turn that direction into work we can deliver and learn from. That includes customer discovery, product strategy, prioritization and the decisions that come up along the way.',
        "I'd join your team with ongoing ownership of a product area or initiative. We'd be clear about the outcomes, the decisions I own, and how I work with the people around me. I want to stay involved as the work moves from an idea into something customers can use.",
      ]),
    model('playbooks', 'fractional', 'A product engagement', 'Fractional Product Leadership',
      'Experienced product leadership for a defined outcome or initiative, from framing the problem through delivery.', [
        'An important product initiative needs experienced ownership.',
        'The work could include understanding customer needs, defining the outcome, setting priorities, and working with design and engineering to move an initiative forward. The scope follows the product problem, not a preset package of deliverables.',
        "We'd agree on the outcome, my responsibilities and the decisions that stay with your team. I'd work alongside the people doing the work, with a regular way to review progress and adjust the plan. We'd also be clear about what your team needs to continue when the engagement ends.",
      ]),
    model('approach', 'advisory', 'A business engagement', 'Advisory and Consulting',
      'Focused help with business, operations and analytics, including putting changes into practice.', [
        'A process is creating friction, delays or work that has to be done twice.',
        "We'd look at the process, the data and the decisions around the problem. The work might be a focused assessment, a recommendation, or helping your team make and evaluate a change. We'd choose the approach based on what you need to accomplish.",
        "We'd start by agreeing on the question, who needs to be involved, and how we'll know whether the work helped. Advisory can mean working through decisions with you. Consulting can include doing the analysis and helping implement the changes. We'll define that responsibility up front.",
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
