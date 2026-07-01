# Design

## Theme

The visual scene is a quiet equipment-room inventory console in daylight:
precise, low-glare, and built for repeated inspection. This is a product UI, so
the strategy is restrained. The surface is pure white; brand character comes
from mineral teal, compact typography, and structured table/inspector layouts.

## Color

Use OKLCH tokens only for the application palette.

```css
--color-bg: oklch(1 0 0);
--color-rail: oklch(0.965 0.006 205);
--color-panel: oklch(0.985 0.004 205);
--color-panel-strong: oklch(0.94 0.009 205);
--color-ink: oklch(0.18 0.015 210);
--color-muted: oklch(0.42 0.018 210);
--color-line: oklch(0.84 0.011 205);
--color-primary: oklch(0.43 0.075 200);
--color-primary-strong: oklch(0.35 0.085 200);
--color-accent: oklch(0.53 0.14 38);
--color-success: oklch(0.46 0.11 152);
--color-warning: oklch(0.62 0.14 76);
--color-danger: oklch(0.50 0.14 24);
```

Primary is for selected navigation, key actions, and recommendation evidence.
Accent is reserved for weather or attention states. Semantic colors always pair
with labels or icons.

## Typography

Use a single system UI stack: `Inter`, `ui-sans-serif`, `system-ui`, `Segoe UI`,
and platform fallbacks. Product typography uses fixed rem sizes, not fluid
display scales.

- Page title: 1.25rem, 700 weight
- Section heading: 0.95rem, 700 weight
- Table header: 0.72rem, 700 weight
- Body/data: 0.82rem to 0.9rem
- Caption/meta: 0.72rem to 0.78rem

No uppercase eyebrow system. Labels may use compact casing but not wide tracked
decorative treatment.

## Layout

The default desktop shell is a left navigation rail, top command bar, primary
workspace, and persistent right inspector. Inventory is table-first. Planner
results use a deterministic outfit board, not virtual try-on.

Spacing follows a 4px scale: 4, 8, 12, 16, 20, 24, 32, 40. Product density is
intentional: related controls stay tight, distinct regions separate with clear
dividers instead of shadows.

## Components

- Navigation rows are compact buttons with a 36px desktop height and 44px mobile
  touch target.
- Panels use 1px borders and 8px radius, no broad decorative shadows.
- Tables use sticky headers, selected rows, compact metadata, and horizontal
  overflow on small screens.
- Forms are inline panels or inspectors. Avoid modal-first flows.
- Status chips include text and icon meaning; color never stands alone.
- Outfit preview tiles show real item images when available and textile swatches
  otherwise.

## Motion

Motion is minimal and state-driven: 160ms to 220ms transitions for hover,
selection, inspector changes, and drawer entry. Respect
`prefers-reduced-motion: reduce`.

## Responsive Behavior

Below tablet width, the side rail becomes a top rail, the inspector stacks below
the main workspace, tables scroll horizontally, and all touch targets become at
least 44px. Mobile keeps information density but prioritizes row scanning and
single-column editing.
