# Prompt for Claude Opus: Building a 1-to-1 Marimba Design Portfolio Clone

Use the following detailed specification and code prompt to build a pixel-perfect, motion-rich, 1-to-1 clone of the UX/UI and motion design found on **`https://marimba.design/work`**.

---

```markdown
You are a senior frontend developer and creative technologist specializing in premium, high-end motion design and interactive layouts (GSAP, ScrollTrigger, canvas/CSS clip-paths). 

Your task is to build a standalone, pixel-perfect web portfolio inspired directly by the UX/UI, color palette, typography, and scroll dynamics of **https://marimba.design/work**.

---

### 1. Visual Design System & Aesthetics (The "Marimba" Identity)
*   **Color Palette:**
    *   Main Page Background: Warm cream/gray (`#F0EFE9`).
    *   Primary Text & Borders: Pure black (`#000000`).
    *   Contrast Dark Elements & Footer: Deep dark forest green (`#212E02`) with cream text.
*   **Typography:**
    *   Pairing: A high-contrast editorial serif paired with a geometric sans-serif.
    *   Serif Font: **`Instrument Serif`** (from Google Fonts) or high-quality serif fallback. Used for big titles, brand logos, and italic emphasis.
    *   Sans-Serif Font: **`Jost`** (from Google Fonts). Used for navigation links, project metadata, body copy, and UI controls.
*   **Whitespace & Structure:** High margins, clean thin borders (`border-[#212E02]/10`), and minimal outlines.

---

### 2. Core Interactive Features (Detailed Specifications)

#### A. Trailing Inertia Custom Cursor
*   **Behavior:** A custom pointer that tracks the mouse with linear interpolation (`lerp`) to create a smooth trailing effect.
*   **Structure:**
    *   A small inner dot (`.cursor-dot`) and a larger outer ring (`.cursor-ring`).
*   **Math (use inside `requestAnimationFrame`):**
    ```javascript
    // Linear interpolation for smooth lag
    cursorX += (mouseX - cursorX) * 0.12;
    cursorY += (mouseY - cursorY) * 0.12;
    ```
*   **States:**
    *   *Default:* Outer ring is semi-transparent, inner dot is dark green.
    *   *Hovering Interactive Elements:* Outer ring expands to a solid background circle (`80px`), hides the inner dot, and reveals centered white text saying `"VIEW"` or `"EXPLORE"`.
    *   Ensure the cursor disappears on mobile devices (`pointer: coarse`).

#### B. Page Loader & Blur-to-Sharp Entrances
*   **Loader Wipe:** A full-screen dark forest green panel (`#212E02`) showing a loading percentage (`0%` to `100%`) using a large italic serif font. Once complete, the panel slides up vertically (`translateY(-100%)`) with a smooth GSAP `power4.inOut` ease.
*   **Entrance Reveal:** Text headers in the hero section must animate in with a staggered blur-to-sharp animation:
    *   CSS: Start with `filter: blur(40px); opacity: 0; transform: translateY(30px);`
    *   GSAP: Animates to `filter: blur(0px); opacity: 1; transform: translateY(0);`

#### C. Pinned Scroll-Driven Slideshow (The "/work" Slider)
This is the core mechanic. We want a horizontal-feeling transition mapped to the user's vertical scroll.
*   **Layout:**
    *   Grid structure: A mockup laptop frame on the left, project copy and metadata on the right.
*   **Pinning & Spacer:**
    *   Set the parent container height to `400vh` (for 4 showcase projects).
    *   Use GSAP `ScrollTrigger` to pin the outer layout wrapper (`height: 100vh`) for the duration of the scroll.
*   **Mockup Scaling & Translation:**
    *   As the user enters the section, the laptop mockup scales up from `0.6` to `1.0` and slides from the center to its pinned left-side position.
*   **Curtain Clip-Path Reveals:**
    *   The mockup screen contains HTML5 video elements (showing browser page previews) stacked on top of each other.
    *   As the scroll progress moves between projects, the active video is revealed using a sliding blind clip-path:
        *   Transition: `clip-path: inset(100% 0px 0px 0px)` -> `clip-path: inset(0px 0px 0px 0px)`.
*   **Metadata Crossfading:**
    *   On the right column, the Project Title, Role, Category, and Description fade in and out based on the active project index.
    *   Trigger staggered GSAP slide-up reveals for metadata items when their corresponding project becomes active.
*   **Scroll progress indicator:**
    *   A vertical progress bar on the right side that fills up linearly based on scroll position, showing indicators `01`, `02`, `03`, `04`.
*   **Mobile Fallback:**
    *   On window width `< 1024px`, completely disable the GSAP ScrollTrigger pinning and mockup scaling. Stack the items vertically as a clean, responsive mobile list.

#### D. The Process Timeline Accordion
*   An interactive vertical steps list (`01`, `02`, `03`, `04`).
*   Only one step is open at a time (Accordion behavior).
*   Active steps display details with a smooth slide-down and fade-in, while the inactive step numbers dim down.

#### E. Dark Green Contact Section
*   A footer section with `#212E02` background.
*   Includes a project brief form (Name, Email, Budget Select, Project details textarea).
*   Input fields must have custom minimal borders that animate their border-color on focus.

---

### 3. Implementation Code Boilerplate

Create the page component in `src/pages/Portfolio.jsx` and its styling in `src/pages/Portfolio.css`. Here is the structure to follow:

#### CSS Details (`Portfolio.css`):
```css
.portfolio-body {
  background-color: #F0EFE9;
  color: #000000;
  font-family: 'Jost', sans-serif;
  overflow-x: hidden;
}
.portfolio-serif {
  font-family: 'Instrument Serif', serif;
}
.portfolio-custom-cursor {
  position: fixed;
  pointer-events: none;
  z-index: 9999;
  transform: translate(-50%, -50%);
}
/* Custom clip path reveal */
.portfolio-laptop-slide {
  position: absolute;
  inset: 0;
  opacity: 0;
  clip-path: inset(100% 0px 0px 0px);
  transition: opacity 0.4s ease, clip-path 0.6s cubic-bezier(0.25, 1, 0.5, 1);
}
.portfolio-laptop-slide.active {
  opacity: 1;
  clip-path: inset(0px 0px 0px 0px);
}
```

#### React Logic (`Portfolio.jsx`):
```javascript
import React, { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './Portfolio.css';

// Register GSAP plugins
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

export default function Portfolio() {
  const containerRef = useRef(null);
  const pinWrapperRef = useRef(null);
  const laptopRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // Implement the custom cursor, loading state, ScrollTrigger pin,
  // and process accordions here.
  
  return (
    // Render the beautiful cream layout, hero, laptop mockup slider, services, process timeline, and contact form.
  );
}
```

---

### 4. Step-by-Step Instructions for VS Code Building:
1.  **Fonts Config:** Open `index.html` and verify the Google Fonts link imports:
    `family=Instrument+Serif:ital@0;1&family=Jost:wght@300;400;500;600;700`
2.  **Create Pages:** Write the JSX and CSS code files into your pages folder.
3.  **Route Config:** Wire up the `/portfolio` path in your router. Ensure it renders standalone (bypassing any default header/footer layouts so it is completely clean).
4.  **Verification:** Run the development server and scroll the page to verify that:
    *   The cursor trails beautifully.
    *   The laptop scales and pins on scroll.
    *   The video frames clip-reveal without glitches.
    *   Mobile layout is fully functional.
```
