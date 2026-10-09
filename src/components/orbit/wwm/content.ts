// Work with me (ticket #8, Direction B): the per-model detail copy.
// Verbatim from Brandon OS projects/personal-website/analysis/2026-10-09-hifi-directions/COPY_PACK.md.
// DRAFT COPY: all of it is under Brandon's review; do not improve, extend or invent.
// Names, situation tags and one-line descriptions come from SETS.work (orbit-data.ts) so the
// orbit, the overview rows and the switcher share one source.
import { SETS, type EngagementSlug } from '../../../lib/orbit/orbit-data';

export type Evidence = { title: string; note: string; href: string; origin?: string };
export type Engagement = {
  slug: EngagementSlug;
  dot: 1 | 2 | 3;
  tag: string;
  name: string;
  summary: string;
  intro: string;
  fits: string[];
  takeOn: string;
  together: string;
  evidenceLead: string;
  portfolio: Evidence[];
  // A reserved slot renders as a dashed placeholder (Advisory's second example).
  reserved?: { title: string; note: string };
  playbooks: Evidence[];
  // Advisory links to the Playbooks page instead of forcing method symmetry.
  playbooksLink?: { label: string; href: string };
  cta: { title: string; button: string; href: string };
};

// Fixed origin chips (hard rule: never vary by context).
const ORIGIN_FULL_TIME = 'Origin: full-time product role';
const ORIGIN_CONSULTING = 'Origin: consulting-team role';

const base = (slug: EngagementSlug) => {
  const i = SETS.work.findIndex((w) => w.slug === slug);
  const w = SETS.work[i];
  return { slug, dot: (i + 1) as 1 | 2 | 3, tag: w.tag ?? '', name: w.name, summary: w.summary };
};

export const ENGAGEMENTS: Engagement[] = [
  {
    ...base('full-time'),
    intro: "I'm looking for a full time senior IC role where I can shape direction, take responsibility for important product work, and build alongside the team.",
    fits: [
      'You have a product area or business problem that needs a clear owner.',
      'The work crosses teams and needs someone who can connect the decisions without losing the details.',
      'You need senior judgment and hands-on contribution in the same role.',
    ],
    takeOn: 'I would work with the team to understand the problem, decide where to focus, and turn that direction into work we can deliver and learn from. That includes customer discovery, product strategy, prioritization and the decisions that come up along the way.',
    together: "I'd join your team with ongoing ownership of a product area or initiative. We'd be clear about the outcomes, the decisions I own, and how I work with the people around me. I want to stay involved as the work moves from an idea into something customers can use.",
    evidenceLead: 'Examples of product ownership, cross-functional decisions and work carried through to delivery.',
    portfolio: [
      { title: 'Core product and growth at Bitly', note: 'Product ownership — judgment and execution across teams.', href: '/portfolio/?story=bitly', origin: ORIGIN_FULL_TIME },
      { title: 'Carrier-platform work at Pie', note: 'Cross-functional scope on complex platform work.', href: '/portfolio/?story=pie', origin: ORIGIN_FULL_TIME },
    ],
    playbooks: [
      { title: 'Opportunity Solution Trees', note: 'Exploring customer needs.', href: '/playbooks/?playbook=ost' },
      { title: 'RICE with an opportunity backlog', note: 'Making prioritization choices explicit.', href: '/playbooks/?playbook=rice' },
    ],
    cta: { title: 'Have a role in mind? Tell me what the team is working on and what you need this person to own.', button: 'Talk about a role', href: '/contact/' },
  },
  {
    ...base('fractional'),
    intro: "Bring me in to lead a product outcome or initiative. I'll work with your team on the problem, the decisions and the delivery, with a scope we agree together.",
    fits: [
      'An important product initiative needs experienced ownership.',
      'Your team needs help deciding what to pursue and making progress on it.',
      'You need product leadership for a defined piece of work rather than a new full time role.',
    ],
    takeOn: 'The work could include understanding customer needs, defining the outcome, setting priorities, and working with design and engineering to move an initiative forward. The scope follows the product problem, not a preset package of deliverables.',
    together: "We'd agree on the outcome, my responsibilities and the decisions that stay with your team. I'd work alongside the people doing the work, with a regular way to review progress and adjust the plan. We'd also be clear about what your team needs to continue when the engagement ends.",
    evidenceLead: 'Examples of embedded product work, difficult tradeoffs and coordination across teams.',
    portfolio: [
      { title: 'Embedded product work with Ora / Sears', note: 'Working inside a client team.', href: '/portfolio/?story=ora', origin: ORIGIN_CONSULTING },
      { title: 'Carrier-platform work at Pie', note: 'Coordinating a defined product initiative.', href: '/portfolio/?story=pie', origin: ORIGIN_FULL_TIME },
    ],
    playbooks: [
      { title: 'Opportunity Solution Trees', note: 'Framing the product opportunity.', href: '/playbooks/?playbook=ost' },
      { title: 'Design Sprints', note: 'Testing a bounded product direction.', href: '/playbooks/?playbook=sprints' },
    ],
    cta: { title: 'What product outcome needs an owner? Tell me where the work stands and where your team needs help.', button: 'Talk about a product engagement', href: '/contact/' },
  },
  {
    ...base('advisory'),
    intro: "Some problems sit across the business rather than inside a product roadmap. I can help you understand what's happening, decide what to change, and work with your team to put it into practice.",
    fits: [
      'A process is creating friction, delays or work that has to be done twice.',
      'You need a clearer picture of performance before making a business decision.',
      'A change crosses functions and needs someone to connect the analysis with the work that follows.',
    ],
    takeOn: "We'd look at the process, the data and the decisions around the problem. The work might be a focused assessment, a recommendation, or helping your team make and evaluate a change. We'd choose the approach based on what you need to accomplish.",
    together: "We'd start by agreeing on the question, who needs to be involved, and how we'll know whether the work helped. Advisory can mean working through decisions with you. Consulting can include doing the analysis and helping implement the changes. We'll define that responsibility up front.",
    evidenceLead: 'Examples of business analysis, process improvement and changes that needed several teams to work together.',
    portfolio: [
      { title: 'Embedded product work with Ora / Sears', note: 'Client-team context and business-to-product translation.', href: '/portfolio/?story=ora', origin: ORIGIN_CONSULTING },
    ],
    // Copy-pack placeholder line for the reserved slot; it is the honest visitor-facing text.
    reserved: { title: 'Second example to be selected', note: 'Reserved for an operations / analytics case.' },
    playbooks: [],
    playbooksLink: { label: 'Explore the Playbooks', href: '/playbooks/' },
    cta: { title: "What isn't working as well as it should? Tell me about the decision, process or business problem you want to tackle.", button: 'Talk through a business problem', href: '/contact/' },
  },
];
