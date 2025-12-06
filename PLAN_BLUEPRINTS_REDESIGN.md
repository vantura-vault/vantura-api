# Blueprints Page Redesign - Implementation Plan

## Overview
Redesign the Blueprints page to match the new design with card-based layout, chip filters, platform icons, and modal detail view.

---

## Modal Layout Reference (from screenshot)

### Header
- Title (editable): "Engaging LinkedIn Thought Leadership Post"
- Platform Icon (top-right): LinkedIn logo

### Left Column
1. **Visual Description**
   - Multi-line description of visual format
   - References: 3 avatars + "Inspired by top 3 industry leaders" + "See References" button

2. **Post Copy**
   - Hook (sparkle icon): Opening attention-grabber
   - Context (lightbulb icon): Main body with @mentions highlighted

3. **Hashtags & Mentions**
   - Chips showing: `#AIForWork · 12.3% Eng.`
   - Mentions showing: `@Vantura · 16.9% Eng.`

### Right Column
4. **Posting Intelligence**
   - Best Time to Post: "Tuesdays, 10 AM PST" (pill badge)
   - Recommended Format: "Carousel Post (Image + Text)" (pill badge)
   - Insight: Why this format works

5. **Data & Insights**
   - Data Sources: "Competitor Vault, Talkwater API, Brandwat"
   - Time Window: "Last 30 Days"
   - Confidence: "High (90%)"
   - You vs Competitors: Two progress bars

6. **Performance Forecast**
   - Vantura Score: Slider at 85%
   - Est. Reach: "8,500 - 10,000"
   - Est. Engagement: "1.2% - 1.8%"
   - Optimization Note

### Footer Actions
- Save as Draft | Copy to Clipboard | **Export to LinkedIn** (accent)
- Regenerate | Share with Team

---

## Phase 1: Backend Changes

### 1.1 Add `actionType` Field to Blueprint Model
**File:** `vantura-api/prisma/schema.prisma`

Add new field to Blueprint model:
```prisma
actionType String? // "post", "comment", "repost", "story", "video"
```

### 1.2 Run Migration
```bash
npx prisma migrate dev --name add_blueprint_action_type
```

### 1.3 Update Blueprint Controller
**File:** `vantura-api/src/controllers/blueprintController.ts`

- Add `actionType` to create/update validation schemas
- Add `actionType` filter parameter to list endpoint

### 1.4 Update Blueprint Service
**File:** `vantura-api/src/services/blueprint.ts`

- Include `actionType` in create operations
- Add filtering by `actionType` in list query

---

## Phase 2: Frontend Types & API

### 2.1 Update Blueprint Types
**File:** `vantura-app/src/types/blueprint.ts`

Add:
```typescript
export type ActionType = 'post' | 'comment' | 'repost' | 'story' | 'video';

// Add to Blueprint interface:
actionType?: ActionType;
```

### 2.2 Update API Endpoints
**File:** `vantura-app/src/api/endpoints.ts`

- Add `actionType` parameter to fetch/create blueprint functions

### 2.3 Update Hooks
**File:** `vantura-app/src/hooks/useBlueprints.ts`

- Add `actionType` filter to query params

---

## Phase 3: UI Components

### 3.1 Create Platform Icon Component
**File:** `vantura-app/src/components/shared/PlatformIcon.tsx`

```typescript
// Renders colored platform icons (LinkedIn blue, Instagram gradient, etc.)
// Props: platform: string, size?: number
// Uses SVG icons for each platform
```

### 3.2 Create Chip Filter Component
**File:** `vantura-app/src/components/shared/ChipFilter.tsx`

```typescript
// Reusable chip-style filter buttons
// Props: options: string[], selected: string, onSelect: (value) => void
// Styling: Selected = pink/accent, Unselected = dark gray
```

### 3.3 Create Blueprint Card Component
**File:** `vantura-app/src/components/blueprints/BlueprintCard.tsx`

Card design matching screenshot:
- Dark background (`#1a1a1a` or similar)
- Title (top-left, white text)
- Score badge (below title, outlined pill: "Score: 88%")
- Platform icon (bottom-right, large ~40px, platform-colored)
- Hover: subtle border glow, slight lift

### 3.4 Create Blueprint Detail Modal
**File:** `vantura-app/src/components/blueprints/BlueprintDetailModal.tsx`

Modal content (waiting for user instructions on layout):
- Full blueprint details
- Copy functionality
- Edit title
- Delete option
- Close button

---

## Phase 4: Page Redesign

### 4.1 Update Blueprint Page
**File:** `vantura-app/src/pages/Blueprint.tsx`

**Generate Tab Changes:**
- Keep existing configuration panel (left side)
- Update results to use new `BlueprintCard` component
- Cards should show generated blueprints in grid layout

**Saved Tab Changes:**
- Replace dropdown filters with `ChipFilter` components
- Platform chips: All Platforms, LinkedIn (only for now)
- Action chips: All, Post, Comment, Repost, Story, Video
- 3-column responsive grid of `BlueprintCard` components
- Click card → open `BlueprintDetailModal`

### 4.2 Update CSS Module
**File:** `vantura-app/src/pages/Blueprint.module.css`

New styles:
- `.chipFilters` - Container for filter rows
- `.chipRow` - Single row of chips (Platform / Actions)
- `.blueprintGrid` - 3-column responsive grid
- `.blueprintCard` - Card styles matching design
- Modal styles (overlay, content, animations)

---

## Phase 5: Integration

### 5.1 Wire Up State Management
- Platform filter state (default: 'all')
- Action filter state (default: 'all')
- Selected blueprint for modal (null when closed)

### 5.2 Update Query Parameters
- Pass platform and actionType filters to useBlueprints hook
- Handle 'all' as undefined for API calls

### 5.3 Modal Open/Close Logic
- Click card → setSelectedBlueprint(blueprint)
- Close modal → setSelectedBlueprint(null)
- ESC key to close
- Click backdrop to close

---

## File Changes Summary

### Backend (vantura-api)
| File | Action |
|------|--------|
| `prisma/schema.prisma` | Add `actionType` field |
| `src/controllers/blueprintController.ts` | Add actionType handling |
| `src/services/blueprint.ts` | Add actionType to queries |

### Frontend (vantura-app)
| File | Action |
|------|--------|
| `src/types/blueprint.ts` | Add ActionType type |
| `src/api/endpoints.ts` | Add actionType param |
| `src/hooks/useBlueprints.ts` | Add actionType filter |
| `src/components/shared/PlatformIcon.tsx` | **NEW** |
| `src/components/shared/ChipFilter.tsx` | **NEW** |
| `src/components/blueprints/BlueprintCard.tsx` | **NEW** |
| `src/components/blueprints/BlueprintDetailModal.tsx` | **NEW** |
| `src/pages/Blueprint.tsx` | Major refactor |
| `src/pages/Blueprint.module.css` | Major updates |

---

## Design Tokens (from screenshot)

```css
/* Card */
--card-bg: #1a1a1a;
--card-border: transparent;
--card-border-hover: var(--color-accent-primary);

/* Chips */
--chip-active-bg: #dc143c; /* Crimson/pink */
--chip-active-text: white;
--chip-inactive-bg: #2a2a2a;
--chip-inactive-text: #888;
--chip-border-radius: 20px;

/* Score Badge */
--score-bg: transparent;
--score-border: #555;
--score-text: #888;

/* Platform Icons */
--linkedin-color: #0077b5;
--instagram-gradient: linear-gradient(...);
--tiktok-color: #000 with accent;
--twitter-color: #1da1f2;
--facebook-color: #1877f2;
--youtube-color: #ff0000;
```

---

## Next Steps

1. User to provide instructions for the Blueprint Detail Modal layout
2. Confirm starting with LinkedIn only (other platforms disabled/hidden)
3. Begin implementation in phases

---

## Questions Answered
- **Action field**: Add new `actionType` field to database ✓
- **Detail view**: Modal overlay ✓

---

## Phase 6: LLM Prompt Enhancement

### 6.1 Update JSON Schema in System Prompt
**File:** `vantura-api/src/controllers/suggestionsController.ts`

The current LLM prompt already generates most fields, but we need to enhance it for:

**Already Generated (✓):**
- `title` ✓
- `visualDescription` ✓
- `hook` ✓
- `context` ✓
- `hashtags` with engagement ✓
- `mentions` with engagement ✓
- `bestTimeToPost` ✓
- `recommendedFormat` ✓
- `postingInsight` ✓
- `dataSources` ✓
- `timeWindow` ✓
- `confidence` ✓
- `yourPerformanceScore` ✓
- `competitorScore` ✓
- `vanturaScore` ✓
- `estimatedReachMin/Max` ✓
- `estimatedEngagementMin/Max` ✓
- `optimizationNote` ✓
- `reasoning` ✓ (in variants)

**Need to Add:**
1. `actionType` - "post", "comment", "repost", "story", "video"
2. `references` - Array of industry leaders who inspired the content:
   ```json
   {
     "references": [
       { "name": "Gary Vaynerchuk", "avatar": "url", "reason": "Storytelling style" },
       { "name": "Simon Sinek", "avatar": "url", "reason": "Hook pattern" },
       { "name": "Brené Brown", "avatar": "url", "reason": "Vulnerability angle" }
     ]
   }
   ```

### 6.2 Updated JSON Schema for LLM
```json
{
  "title": "string - descriptive blueprint name",
  "actionType": "post | comment | repost | story | video",
  "reasoning": "string - why this blueprint works",
  "visualDescription": "string - visual format description with slide breakdown",
  "references": [
    {
      "name": "string - industry leader name",
      "handle": "string - LinkedIn handle if known",
      "reason": "string - why this reference is relevant"
    }
  ],
  "hook": "string - opening attention grabber",
  "context": "string - main body with @mentions",
  "hashtags": [{"tag": "string", "engagement": "X.X% Eng."}],
  "mentions": [{"handle": "string", "engagement": "X.X% Eng."}],
  "bestTimeToPost": "string - e.g. Tuesdays, 10 AM PST",
  "recommendedFormat": "string - e.g. Carousel Post (Image + Text)",
  "postingInsight": "string - why this format drives engagement",
  "dataSources": ["array of source names"],
  "timeWindow": "string - e.g. Last 30 Days",
  "confidence": "number 0-100",
  "yourPerformanceScore": "number 0-100",
  "competitorScore": "number 0-100",
  "vanturaScore": "number 0-100",
  "estimatedReachMin": "number",
  "estimatedReachMax": "number",
  "estimatedEngagementMin": "number (percentage)",
  "estimatedEngagementMax": "number (percentage)",
  "optimizationNote": "string - optimization summary"
}
```

### 6.3 Update Prisma Schema for References
Add to Blueprint model:
```prisma
references Json? // Array of { name, handle?, avatar?, reason }
```

---

## Field Mapping: Modal → Database

| Modal Section | Field | DB Column | Status |
|--------------|-------|-----------|--------|
| Header | Title | `title` | ✓ Exists |
| Header | Platform Icon | `platform` | ✓ Exists |
| Visual Description | Description | `visualDescription` | ✓ Exists |
| Visual Description | References | `references` | **NEW** |
| Post Copy | Hook | `hook` | ✓ Exists |
| Post Copy | Context | `context` | ✓ Exists |
| Hashtags & Mentions | Hashtags w/ engagement | `hashtags` (JSON) | ✓ Exists |
| Hashtags & Mentions | Mentions w/ engagement | `mentions` (JSON) | ✓ Exists |
| Posting Intelligence | Best Time | `bestTimeToPost` | ✓ Exists |
| Posting Intelligence | Format | `recommendedFormat` | ✓ Exists |
| Posting Intelligence | Insight | `postingInsight` | ✓ Exists |
| Data & Insights | Sources | `dataSources` | ✓ Exists |
| Data & Insights | Time Window | `timeWindow` | ✓ Exists |
| Data & Insights | Confidence | `confidence` | ✓ Exists |
| Data & Insights | Your Score | `yourPerformanceScore` | ✓ Exists |
| Data & Insights | Competitor Score | `competitorScore` | ✓ Exists |
| Performance Forecast | Vantura Score | `vanturaScore` | ✓ Exists |
| Performance Forecast | Est. Reach | `estimatedReachMin/Max` | ✓ Exists |
| Performance Forecast | Est. Engagement | `estimatedEngagementMin/Max` | ✓ Exists |
| Performance Forecast | Optimization Note | `optimizationNote` | ✓ Exists |
| Filter | Action Type | `actionType` | **NEW** |

---

## Implementation Order

1. **Backend Schema** (30 min)
   - Add `actionType` and ensure `references` field exists
   - Run migration
   - Update controller/service

2. **LLM Prompt** (30 min)
   - Add `actionType` and `references` to JSON schema
   - Test generation

3. **Frontend Types** (15 min)
   - Update Blueprint interface
   - Update API endpoints

4. **UI Components** (2-3 hours)
   - PlatformIcon component
   - ChipFilter component
   - BlueprintCard component
   - BlueprintDetailModal component

5. **Page Integration** (1-2 hours)
   - Wire up state management
   - Connect filters to API
   - Modal open/close logic

6. **Styling & Polish** (1 hour)
   - Match design system
   - Responsive adjustments
   - Animations
