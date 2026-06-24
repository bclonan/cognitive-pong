import { PresetScenario } from "../types";

export const PRESET_SCENARIOS: PresetScenario[] = [
  {
    title: "Mars circular Greenhouse Design",
    topic: "Design a fully circular and self-sufficient agricultural dome on Mars that can support 50 crew members indefinitely.",
    agentA: {
      name: "Commander Ares (Advocate)",
      role: "Astrobiologist specializing in high-density aeroponics and engineered bio-reactors, pushing for fast production and resource optimization.",
      color: "emerald",
      avatar: "👩‍🚀"
    },
    agentB: {
      name: "Architect Vance (Critic)",
      role: "Life Support / Structural Engineer specializing in thermodynamic stress, filtration systems, and safety failures under radiation.",
      color: "amber",
      avatar: "🤖"
    }
  },
  {
    title: "Legacy Monolith Migration",
    topic: "Determine the step-by-step strategy to migrate a 15-year-old banking monolith to a distributed Serverless microservices architecture with zero downtime.",
    agentA: {
      name: "Dev Lead Nova (Advocate)",
      role: "Fast-moving DevOps engineer pushing for containerized clusters, reactive routing, and complete isolation of storage endpoints.",
      color: "cyan",
      avatar: "⚡"
    },
    agentB: {
      name: "Guardian Core (Critic)",
      role: "Risk Management & Secure Transactions auditor, focused on database race conditions, single points of failure, and latency overhead.",
      color: "rose",
      avatar: "🛡️"
    }
  },
  {
    title: "The Ultimate Scientific Cookie",
    topic: "Formulate a chemically perfect, repeatable recipe for chocolate chip cookies that balances caramelized crisp borders with an ultra-fudgy, chewy core.",
    agentA: {
      name: "Chef Alchemy (Advocate)",
      role: "Molecular Gastronomist experimenting with browned milk solids, reverse hydration, and multi-day chilled fermentation curves.",
      color: "purple",
      avatar: "🍳"
    },
    agentB: {
      name: "Patisserie Orthodoxy (Critic)",
      role: "Classical French Pastry Master insisting on precise gluten boundaries, fat-to-protein indices, and thermodynamic oven-spring ratios.",
      color: "orange",
      avatar: "🧑‍🍳"
    }
  },
  {
    title: "Metropolitan Robot Security",
    topic: "Establish policies and boundaries for deploying autonomous patrol and sanitization drones around metropolitan central plazas.",
    agentA: {
      name: "Director Sentinel (Advocate)",
      role: "Smart City Infrastructure advocate, optimizing for patrol density, battery grid loops, and immediate spatial threat mitigation.",
      color: "indigo",
      avatar: "🛰️"
    },
    agentB: {
      name: "Human Right Advocate (Critic)",
      role: "Privacy rights specialist, auditing model bias, behavioral false-positives, facial tracking boundaries, and secure decentralized telemetry logs.",
      color: "red",
      avatar: "🗽"
    }
  }
];
