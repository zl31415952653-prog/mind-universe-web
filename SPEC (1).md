# INFINITY - Mental Universe System Specification

> **Version**: 3.0  
> **Date**: 2026-09-12  
> **Author**: 鱼鸟托邦 (Fishbird Utopia)  
> **Purpose**: Technical specification for AI-assisted development

---

## 1. Project Overview

### 1.1 What This Is

INFINITY is a **personal cognitive externalization system**. It is NOT a note-taking app, NOT an Obsidian alternative, NOT a 3D demo.

**Core principle**: Encoding. Recording serves encoding. The system externalizes the user's mental world—experiences, emotions, sensory impressions—and organizes them through the "Seven Empties" framework.

### 1.2 What This Is NOT

- ❌ Generic note-taking tool
- ❌ Another Obsidian/Notion clone
- ❌ Pure 3D visualization demo

### 1.3 Core Value Propositions

1. **Psychological therapy potential** - For people who struggle with expression, the system can analyze their note-taking patterns (with consent)
2. **Real-world cognitive simulation** - More data = better function
3. **Learning analytics** - Personalized learning paths based on cognitive patterns
4. **Intelligent cognitive deepening** - System evolves with user, revealing thinking patterns

---

## 2. System Architecture

### 2.1 Five Core Modules

```
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ Experience  │ │  Encoding   │ │ Knowledge   │ │    AI       │ │  Universe   │
│   Module    │ │   Module    │ │   Base      │ │   Module    │ │ Visualization│
│ (Notes)     │ │ (Rules)     │ │ (Cognition) │ │ (3 funcs)   │ │ (3D+Graph)  │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
     ↕               ↕               ↕               ↕               ↕
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Data Layer (IndexedDB + Server)                           │
│                   Offline-first + Sync + Privacy                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Module Responsibilities

| Module | Responsibility | Key Features |
|--------|---------------|--------------|
| **Experience** | Note-taking with bi-directional links | Markdown editor, 3 experience types, backlinks, tags |
| **Encoding** | Rule-based encoding engine | Chinese color palette, emotional encoding, sensory encoding |
| **Knowledge Base** | Structured knowledge with cognitive model | Default KB (offline), taxonomy, knowledge graph |
| **AI** | Three AI functions | Discovery, Learning, Encoding assistance |
| **Universe** | Visualization | 3D galaxies, stardust nodes, connection lines, graph view |

---

## 3. The Seven Empties Framework

### 3.1 Design Principle

Each "Empty" is not just a category—it represents a **fundamental worldview**. Users don't just classify experiences; they build their understanding of the world.

### 3.2 The Seven Empties Definition

| ID | Name | Color | Worldview | Core Question | Encoding Character |
|----|------|-------|-----------|---------------|-------------------|
| ∅₁ | **Void** | Deep indigo `#1a1a4e` | **The Unknown** - Unilluminated domains | "What's here?" | Diffuse, formless, misty |
| ∅₂ | **Silence** | Calm deep blue `#0d47a1` | **The Understood** - Digested certainties | "What do I know?" | Stable, clear, archived |
| ∅₃ | **Fracture** | Blazing red `#d32f2f` | **The Conflicting** - Cognitive rupture | "What tears at me?" | Sharp, broken, high contrast |
| ∅₄ | **Flow** | Flowing cyan-green `#00897b` | **The Changing** - In-process, not yet fixed | "What's forming?" | Fluid, gradient, continuous |
| ∅₅ | **Mirror** | Clear silver-white `#b0bec5` | **The Self** - Metacognition, reflection | "How do I think?" | Symmetric, self-referential |
| ∅₆ | **Nexus** | Warm gold `#f9a825` | **The Connected** - Relations, emergence | "What relates to what?" | Network, radiating, linking |
| ∅₇ | **Limit** | Mystical purple `#7b1fa2` | **The Extreme** - Boundaries, transcendence | "Where's the edge?" | Deep, infinite, transcendent |

### 3.3 Detailed Descriptions

#### ∅₁ Void - The Unknown
- **When to use**: Encountering unfamiliar domains, vague feelings, zero-basis situations
- **Example experiences**: "Heard a word I don't understand", "Something feels off but I can't say what"

#### ∅₂ Silence - The Understood
- **When to use**: Mastered concepts, integrated experiences, things you've let go of
- **Example experiences**: "Finally understood this concept", "I've made peace with that"

#### ∅₃ Fracture - The Conflicting
- **When to use**: Cognitive dissonance, broken expectations, contradictions
- **Example experiences**: "Something I believed got overturned", "These views contradict"

#### ∅₄ Flow - The Changing
- **When to use**: In-progress states, ongoing growth, things not yet defined
- **Example experiences**: "Learning a new skill, still figuring it out", "My thoughts are shifting"

#### ∅₅ Mirror - The Self
- **When to use**: Self-observation, metacognition, reflecting on own patterns
- **Example experiences**: "I realize I always avoid conflict", "Why do I react this way?"

#### ∅₆ Nexus - The Connected
- **When to use**: Discovering similarities across domains, inspiration, analogies
- **Example experiences**: "These two things are actually the same!", "Sudden analogy"

#### ∅₇ Limit - The Extreme
- **When to use**: Boundary experiences, transcendent feelings, ineffable moments
- **Example experiences**: "Experience beyond words", "Touched my limit"

---

## 4. Experience Module (Notes)

### 4.1 Core Requirements

- **Markdown editor** with basic formatting
- **Bi-directional links** (basic version): `[[link]]` syntax + backlinks panel
- **Three experience types**: Emotional / Knowledge / Daily
- **Tag system**
- **Search** (full-text)
- **Attachments** (images, audio)

### 4.2 Experience Types

| Type | Purpose | Encoding Focus |
|------|---------|----------------|
| **Emotional** | Emotional experiences, relationship memories | Emotion encoding primary |
| **Knowledge** | Learning notes, reading insights | Knowledge taxonomy primary |
| **Daily** | Life events, observations | Time anchor primary, lightweight |

### 4.3 Data Model

```typescript
type ExperienceType = 'emotional' | 'knowledge' | 'daily';

interface ExperienceNode {
  id: string;
  type: ExperienceType;
  title: string;
  content: string;           // Markdown
  voidType: VoidType;        // Seven Empties assignment
  
  // Emotional encoding
  emotion: {
    valence: number;         // -1 to 1
    intensity: number;       // 0 to 1
    label?: string;
  };
  
  // Sensory encoding (user's unique style)
  sensory: {
    colors?: string[];
    shapes?: string[];
    textures?: string[];
    angles?: number[];
    lines?: string[];
  };
  
  // Color encoding (Chinese palette)
  colorEncoding?: {
    primaryColor: string;    // Color name from palette
    colorValue: string;      // Hex
    colorMeaning?: string;
  };
  
  // Knowledge encoding (for knowledge type)
  knowledgeEncoding?: {
    domain: string;
    taxonomy: string[];
    prerequisites: string[];
    relatedConcepts: string[];
  };
  
  tags: string[];
  links: string[];           // Bi-directional link targets
  attachments?: Attachment[];
  
  // Privacy
  privacy: {
    aiVisible: boolean;      // AI can see (default true)
    sharedWith: string[];
    allowAnalysis: boolean;  // Others can see AI analysis
  };
  
  connections: string[];     // Connection IDs
  createdAt: number;
  updatedAt: number;
}
```

---

## 5. Encoding Module

### 5.1 Chinese Color Palette

**Purpose**: User has strong visual memory. Colors are encoding tools, not decoration.

**Data source**: User has physical color cards. Will upload photos or source images.

**Requirements**:
- Color database with Chinese names, hex values, cultural meanings
- Color picker integrated with palette
- OCR support for card photo upload (future)
- Colors can be associated with Void types

### 5.2 Encoding Channels

| Channel | Fields | Purpose |
|---------|--------|---------|
| Void type | ∅₁-∅₇ | Categorization |
| Emotion | valence, intensity, label | Affective encoding |
| Sensory | colors, shapes, textures, angles, lines | User's unique perception |
| Color | palette color + hex + meaning | Visual memory encoding |
| Time | createdAt, updatedAt | Temporal anchor |
| Relations | connections | Network structure |

---

## 6. Knowledge Base Module

### 6.1 Requirements

- **Default knowledge base** - Pre-loaded, offline available
- **Cognitive model** - Based on learning science + taxonomy
- **Knowledge entries** - CRUD with Seven Empties assignment
- **Knowledge graph** - Node-edge visualization
- **Offline support** - PWA + IndexedDB

### 6.2 Default Knowledge Base Content

- Seven Empties usage guide
- Basic cognitive framework explanation
- Common emotion vocabulary
- Chinese color palette (full)
- Encoding rules manual
- Example experiences (each type)
- Learning science basics

### 6.3 Data Model

```typescript
interface KnowledgeEntry {
  id: string;
  title: string;
  content: string;
  domain: string;
  voidType: VoidType;
  taxonomy: string[];
  difficulty: number;        // 1-5
  prerequisites: string[];
  relatedEntries: string[];
  isDefault: boolean;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}
```

---

## 7. AI Module

### 7.1 Three Functions

| Function | Purpose | UI |
|----------|---------|-----|
| **AI Discovery** | Find hidden connections between nodes | Visualize in universe/graph view, proactively show |
| **AI Learning** | Personalized learning system | **Separate page** (not modal) |
| **AI Encoding** | Suggest void type, colors, tags, relations | Inline suggestions |

### 7.2 AI Learning - Detailed

**Key**: This is a major feature, not a small panel.

**Requirements**:
- **Separate page/interface** - Not a popup
- **Multi-modal input**: Images, videos, audio, URLs
- **Account linking** (future): Analyze Bilibili favorites, etc.
- **Learning material classification** - Organize by Seven Empties
- **Cognitive load optimization** - Reduce load for user
- **Progress tracking**
- **Content recommendation**

### 7.3 AI Discovery - Visualization

- AI-discovered links must be **visualized**
- **Proactively displayed** in universe view
- User can accept/reject/modify
- Connection strength scoring

---

## 8. Universe Visualization

### 8.1 Core Concept

The 3D universe is NOT just a background decoration. It is the **real-time visualization of user's cognitive data**:

- **Universe** = The face of user's data
- **Galaxies** = Seven Void regions (draggable, clickable)
- **Stardust** = Experience nodes (positioned by Void type)
- **Connection lines** = Relationships between nodes
- **Wormholes** = Cross-Void connections
- **Supernovas** = Insights/epiphanies

### 8.2 Layout & Navigation

#### Two-Screen Design
- **First screen**: Transparent area with 3D universe canvas. Pointer events pass through to canvas. User can interact with galaxies directly.
- **Scroll hint**: "向下滑动探索" (Scroll down to explore) with animated indicator
- **Second screen**: Functional area with background. Contains stats, action buttons, recent experiences.

#### Galaxy Interaction
- **Seven galaxies** represent the Seven Empties, positioned in 3D space
- **Draggable**: User can drag galaxies to reposition (saved to localStorage)
- **Clickable**: Click a galaxy → zoom in → see internal nodes (stardust)
- **Hover**: Show galaxy name, node count, recent activity
- **Visual style**: Each galaxy has its Void's color, glow effect, particle animation

### 8.3 Stardust Interaction

- **Generation**: Edit/create experience → new stardust appears near corresponding Void galaxy
- **Animation**: New stardust fades in with sparkle effect
- **Movement**: Stardust drifts slowly, creating living universe feel
- **Click**: View experience details in modal
- **Hover**: Show experience title, emotion label, Void type badge
- **Visual encoding**: Color = Void color + user's sensory encoding

### 8.4 Connection Visualization

- **Lines between stardust** = Relationships
- **Line style by type**:
  - Causal → solid arrow
  - Similar → parallel lines
  - Conflict → zigzag/lightning
  - Inspiration → star sparkle
  - Transform → circular arrow
  - Contrast → double arrow
- **AI-discovered links**: Distinct visual style (pulsing glow) to differentiate from user-created
- **Click line**: View relationship details

### 8.5 Special Effects

#### Wormholes 🕳️
- Visual: Swirling vortex connecting two distant galaxies
- Meaning: Cross-Void connections (e.g., Void ↔ Nexus)
- Interaction: Click to see what it connects

#### Supernovas 💥
- Visual: Bright flashing point of light
- Meaning: Insights, epiphanies, creative sparks
- Interaction: Click to read the insight

#### Universe Expansion
- As user adds more experiences, the universe slowly grows larger
- Visual feedback: Galaxies drift apart slightly, more space between nodes
- Metaphor: Cognitive growth = physical expansion

### 8.6 Additional Views

#### Knowledge Graph View (2D)
- Switchable from 3D universe
- Node-edge graph layout (force-directed)
- Filter by Void type, time range, emotion
- Better for seeing relationship structure

#### Dashboard
- Seven Empties distribution (bar/ring chart)
- Emotion heatmap per Void
- Recent activity per Void
- Flow trends (nodes moving between Voids)

#### Timeline
- Chronological view of all nodes
- Filter by Void type, emotion
- Zoom levels: day/week/month/year
- Show relationship lines between temporally close nodes

### 8.7 Immersive Mode (Flow Mode)

- Full-screen 3D universe only
- Ambient background sound (configurable)
- Hide all UI controls
- Just user and their cognitive universe
- Trigger: Button or keyboard shortcut

### 8.8 Technical Requirements

- **Three.js + React Three Fiber** for 3D rendering
- **Performance**: Handle 1000+ stardust particles smoothly
- **Persistence**: Galaxy positions saved, node positions computed from Void type
- **Responsive**: Works on desktop and mobile (touch gestures)

---

## 9. Technical Stack

### 9.1 Frontend

| Component | Technology |
|-----------|-----------|
| Framework | React 18 + TypeScript |
| 3D | Three.js + React Three Fiber |
| State | Zustand |
| Styling | Tailwind CSS |
| Animation | Framer Motion |
| Build | Vite |
| Router | React Router (needed for multi-page) |
| Markdown | Milkdown / Tiptap / MDXEditor (TBD) |
| Graph viz | D3.js / Cytoscape.js / react-force-graph |
| Offline | PWA + Workbox + IndexedDB (Dexie.js) |
| Search | FlexSearch / MiniSearch |

### 9.2 Backend

| Component | Technology |
|-----------|-----------|
| Server | Node.js + Express |
| Database | SQLite (migrate from JSON) |
| AI API | TBD (user may use foreign models) |

### 9.3 Deployment

- Alibaba Cloud lightweight server (2G 4-core)
- IP: 106.15.125.176
- PM2 + Nginx

---

## 10. Privacy Model

### 10.1 Default Rules

- Experiences are **AI-visible** by default (for analysis)
- Experiences are **private to user** - others cannot see without consent
- User can **grant access** to AI analysis conclusions for others (therapists, researchers)

### 10.2 Consent Flow

```
User creates experience
    ↓
AI can analyze (default)
    ↓
Third party requests access
    ↓
User grants/denies
    ↓
If granted: third party sees AI analysis, NOT raw experience
```

---

## 11. Development Phases

### Phase 0: Design Finalization (Current)
- [x] Seven Empties worldview definition
- [x] Bi-directional links (basic)
- [x] AI Learning multi-modal scope
- [x] Color palette purpose
- [ ] Three experience types: mandatory or optional?
- [ ] Can one experience belong to multiple Voids?

### Phase 1: Architecture Restructure (2-3 weeks)
- [ ] Data model redesign
- [ ] Frontend routing (multi-page)
- [ ] Markdown editor integration
- [ ] Three experience types CRUD
- [ ] IndexedDB offline storage
- [ ] PWA basics

### Phase 2: Encoding System (2-3 weeks)
- [ ] Chinese color palette database
- [ ] Color block encoder
- [ ] Emotional encoding engine
- [ ] Sensory encoding UI
- [ ] Encoding rule configuration

### Phase 3: Knowledge Base (2-3 weeks)
- [ ] Cognitive model implementation
- [ ] Default knowledge base construction
- [ ] Knowledge entry management
- [ ] Knowledge graph visualization
- [ ] Offline verification

### Phase 4: AI Integration (3-4 weeks)
- [ ] AI Encoding assistance
- [ ] AI Discovery (relation finding + visualization)
- [ ] AI Learning (separate page + personalization)
- [ ] Semantic search

### Phase 5: Universe Visualization Upgrade (2-3 weeks)
- [ ] Stardust generation animation
- [ ] Connection line visualization
- [ ] AI-discovered links proactive display
- [ ] Graph view
- [ ] Dashboard upgrade

### Phase 6: Polish & Deploy (2 weeks)
- [ ] Privacy/consent model
- [ ] Multi-device sync
- [ ] Performance optimization
- [ ] Testing
- [ ] Deploy update

---

## 12. Existing Code Assets

### Files That Can Be Reused

| File | Path | Reuse Level |
|------|------|-------------|
| Type definitions | `src/types/index.ts` | Modify significantly |
| Store | `src/store/useStore.ts` | Extend |
| 3D Canvas | `src/components/Universe/UniverseCanvas.tsx` | Keep base, extend |
| Void configs | `src/types/index.ts` (VOID_CONFIGS) | Keep, enrich |
| Backend API | `server/index.js` | Extend, migrate storage |

### Files That Need Rewrite

| File | Reason |
|------|--------|
| `App.tsx` | Multi-page routing needed |
| `CreateNodeModal.tsx` | Becomes full note editor |
| All UI panels | Major feature additions |

---

## 13. Key Design Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Note system | Bi-directional links (basic) | User confirmed |
| AI Learning | Full multi-modal support | Images/videos/audio/URLs |
| Color palette | For visual memory encoding | User's strength |
| Seven Empties | Worldview-based definition | Each = a way of seeing |
| Default KB | Offline-first, pre-loaded | Must work without network |

---

## 14. Open Questions

1. Three experience types: mandatory selection or optional?
2. Can one experience belong to multiple Voids?
3. Specific content for default knowledge base?
4. How does "simulate optimal Seven Empties method" work in AI Learning?
5. Detailed privacy rules?

---

*Specification v3.0 | 2026-09-12*  
*"Encoding is the core. Recording serves encoding."*
