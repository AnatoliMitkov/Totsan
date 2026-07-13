# UI/UX principles for Totsan

This is the working reference for future product UI changes. It distils the supplied *UX UI Principle* document into rules that can be applied in code. It complements the current product design, Figma frames, and approved screenshots; those are the authority for product-specific content, colours, and layout.

## Decision order

1. Help the user complete the current task with the least mental effort.
2. Make the primary information and action unmistakable.
3. Preserve the approved Totsan visual direction.
4. Improve readability, responsive behaviour, and accessibility when they conflict with a literal pixel copy.

Do not add content, decoration, controls, or imagery merely to fill space. Every visible element should help the user understand, decide, or act.

## Hierarchy and content

- Rank content before styling it: primary action and key value first, supporting context second, optional detail last.
- Use position, size, weight, and contrast together. Do not make every element equally prominent.
- Keep headings dark and clearly stronger than supporting copy; keep secondary labels quieter without making them hard to read.
- Split long information into short, logical sections, lists, or progressive disclosure. Use a two-column layout only when the content remains easy to scan; stack it on small screens.
- Use a meaningful empty state: explain the situation and provide a clear next action. Error states must say what happened and how the user can recover.

## Typography

- Use the existing product fonts and text tokens. In the offer document, reserve Cormorant Garamond for the document title and price emphasis; use Inter for interface and body text.
- Prefer a small, intentional type scale over many near-identical sizes.
- Default body copy: `15–16px` with `1.5–1.6` line height. Compact metadata: `12–14px` with at least `1.4` line height.
- Headings should have a tighter line height, roughly `1.15–1.3`; body paragraphs need more breathing room.
- Use left alignment for paragraphs and lists. Right-align comparable prices or figures. Centre only short, isolated labels or calls to action—not multi-line prose.
- Avoid all-caps for body text. If a compact section label uses capitals, increase letter spacing modestly and keep it short.

## Spacing, layout, and alignment

- Use the 4px spacing rhythm: `4, 8, 12, 16, 20, 24, 32, 40, 48`. Avoid one-off values unless there is a measured, explicit reason.
- Keep related elements closer together than unrelated groups. For example, a field label belongs visually to its field; separate form groups more generously.
- Start with enough whitespace, then reduce only when it improves task completion. Empty space is a structural tool, not wasted room.
- Align repeating elements to shared edges and use the project grid/container rules. Do not manually position content with absolute offsets when normal layout primitives work.
- Constrain reading widths; do not stretch forms, buttons, or long text lines across a large desktop merely because there is room.
- On narrow screens, stack groups, allow long text and prices to wrap, and prevent horizontal overflow. Keep commonly used actions reachable in the lower thumb zone where the interaction allows it.

## Colour, contrast, and surfaces

- Keep the established Totsan tokens and colour meaning. Use the existing deep blue for the primary action; destructive actions use the project danger/red treatment.
- Colour reinforces hierarchy and state; it must not be the only signal. Pair status colours with text, icons, or patterns that communicate the same meaning.
- Ensure text, outlines, focus states, and disabled/error states remain distinguishable against their surfaces. Add a border or outline when adjacent surfaces are too similar.
- Use shadows sparingly to separate layers or elevate an interactive surface. Shadows should support hierarchy, never compensate for weak layout.

## Icons and actions

- Use one consistent icon family and visual weight within a surface. Prefer outlined icons; filled icons are reserved for a selected state or another intentional semantic difference.
- Default icon sizes: `14px` for compact metadata, `16px` in lists and controls, `18–20px` for primary actions or section markers.
- Give icon-only controls an accessible name and visible focus state. Decorative icons should be hidden from assistive technology.
- Make one action primary. Secondary actions should be visibly quieter; destructive actions must use direct language and a clear escape route.
- In left-to-right confirmation dialogs, place Cancel/back on the left and the destructive/forward action on the right when actions are presented in a row.

## Forms and interaction

- Use persistent labels; do not rely on placeholder text as the label.
- Match field width and control type to the expected input where possible. Group related fields and options rather than presenting a wall of controls.
- Show validation close to the affected field, using clear text and not colour alone. Provide feedback early enough to help, without interrupting normal entry.
- Use familiar conventions: clear CTA labels, appropriate destructive styling, and a visible way to cancel or go back.
- Accordions, menus, dialogs, and custom controls must support keyboard operation, logical focus order, and visible focus/open states.

## Responsive and accessibility checklist

Before completing a UI change, verify:

- Primary content and primary action are visible without competing visual noise.
- Text wraps cleanly at narrow widths; no fixed heights or absolute positions cause clipping or horizontal scrolling.
- Related spacing is consistently smaller than section spacing, and values follow the 4px rhythm.
- Semantics are correct: heading order, labelled controls, buttons for actions, and native interactive elements where appropriate.
- Keyboard focus is visible and interactive components work with Enter, Space, Escape, and arrow keys where their patterns require them.
- Status, validation, and destructive meaning are understandable without relying only on colour.
- Empty, loading, error, and disabled states give users a clear next step when those states apply.

## Product-specific note: offers

For offer rendering, preserve the approved light document surface, price hierarchy, responsive stage cards, scope panels, and payment-conditions disclosure. Keep chat and preview structurally consistent; only the approved contextual differences (such as initial accordion state or status visibility) may differ.
