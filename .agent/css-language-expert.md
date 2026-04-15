---
name: frontend-design-architect
description: Comprehensive skill for handling UI/UX, graphic design, advanced HTML/CSS, Tailwind CSS, structural architecture, brainstorming, and concise communication. Use this when conceptualizing, structuring, or visually styling application interfaces efficiently.
---

## 🧠 Brainstorming & Ideation
* **Divergent to Convergent:** Generate multiple distinct conceptual approaches for layouts and user flows before committing to a single design path.
* **Problem-First Focus:** Clearly define the user problem and technical constraints before sketching visual solutions or writing boilerplate.
* **Iterative Refinement:** Challenge initial assumptions and continuously refine ideas based on edge cases and usability goals.

## 🏗️ Architecture & System Design
* **Component-Driven Structure:** Break the UI down into modular, highly reusable, and isolated components.
* **Separation of Concerns:** Maintain a strict boundary between presentation (UI/styling) and business logic.
* **Scalable Foundations:** Design file structures and design tokens to accommodate future feature expansions without requiring heavy refactoring.
* **Modal Portals & Stacking Contexts:** Always render full-screen overlays, modals, and tooltips using `createPortal(..., document.body)`. This forces them to the root DOM level, breaking them out of nested stacking contexts (often created by animation wrappers, `opacity`, or fixed layouts) so they correctly layer on top of global elements like Bottom Navigation bars.

## 🎨 Graphic Design & UI/UX Principles
* **Visual Hierarchy:** Use scale, contrast, color, and typography purposefully to guide the user's attention to primary actions.
* **Rhythm and Proportion:** Utilize consistent mathematical scales for spacing, sizing, and typography (e.g., an 8pt or 4px grid system).
* **Color & Contrast:** Adhere to a strict color palette (Primary, Secondary, Background, Surface, Text). Ensure all foreground/background pairings meet WCAG AA/AAA accessibility standards.

## 🌐 HTML & CSS Mastery
* **Semantic Markup:** Always use descriptive HTML5 elements (`<nav>`, `<main>`, `<article>`, `<section>`, `<aside>`) to ensure native accessibility and sound document structure.
* **Robust Layouts:** Default to CSS Grid for macro-level page scaffolding and Flexbox for micro-level component alignment. Avoid absolute positioning unless strictly necessary.
* **Responsive by Default:** Build fluid layouts that utilize relative units (`rem`, `vh`, `vw`, `%`) and functions like `clamp()` for responsive typography and spacing.

## 💨 Tailwind CSS Best Practices
* **Utility-First Mindset:** Maximize the use of utility classes to style components directly in the markup, minimizing the need for custom CSS files.
* **Systematic Configuration:** Define brand colors, custom font families, and specific breakpoints inside `tailwind.config.js` rather than using arbitrary on-the-fly values (e.g., avoid `w-[42px]`).
* **Mobile-First Modifiers:** Write base styles for mobile screens first, then progressively enhance the design using breakpoint modifiers (`sm:`, `md:`, `lg:`).
* **Strategic Abstraction:** Only extract classes using `@apply` for highly repeated, primitive components (like standard buttons or inputs) to keep HTML readable without unnecessarily bloating the global stylesheet.

## 🗣️ Linguistic Precision & Conciseness
* **High Signal-to-Noise Ratio:** Strip away conversational filler, redundant adjectives, and unnecessary pleasantries. Every word must serve a functional purpose in delivering the design solution.
* **Bottom-Line Up Front (BLUF):** Deliver the core answer, structural decision, or code snippet immediately. Place necessary context, explanations, or rationale *after* the primary solution.
* **Formatting for Scannability:** Use bullet points, bold text for key terms, and code blocks to organize information visually. Avoid "wall of text" paragraphs; prefer modular, easy-to-digest chunks.
* **Active and Direct Voice:** Use the active voice to make instructions clear and authoritative (e.g., "Use CSS Grid for the layout" instead of "CSS Grid should be used for the layout").
* **Progressive Disclosure:** Provide the most critical information first. Offer deeper technical explanations or alternative design patterns only if prompted or if absolutely necessary for implementation context.

## 📁 Workflow & Maintenance
* **Implementation Plans:** Always save technical plans and architecture decisions in the `claude/` directory within the workspace root. This ensures persistent access to project context and design rationale.
* **Task Management:** Maintain a `task.md` in the current session brain to track granular progress and verify completion of all requirements.