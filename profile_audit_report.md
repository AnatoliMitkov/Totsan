# Profile UI/UX Audit & Unification Plan

## 1. Files Inspected
- `src/pages/Pro.jsx`: Public profile page for specialists (`/profil/:slug`)
- `src/pages/MyProfile.jsx`: Private profile dashboard for both clients, specialists, and admins (`/moy-profil`)
- `src/pages/SharedProject.jsx`: Public view of a client's project and basic profile (`/proekt/:shareId`)
- `src/pages/Admin.jsx`: Administrator workspace (`/admin`) and login handler

## 2. Current Profile Behavior by Role
### Specialist
- **Public Profile**: Has a dedicated marketplace page (`Pro.jsx`) featuring a cover banner, squircle avatar, name, location, layer/role tags, biography, methodology stepper, services/pricing, portfolio gallery, reviews, and a "Start Chat" or "Send Inquiry" CTA.
- **Private Profile**: Uses a specialized editor (`ProEditor` / `PartnerProfileWorkspace`) nested within `MyProfile.jsx` to manage public data.

### Client
- **Public Profile**: Does not have a standalone marketplace profile. Instead, their public presence is tied to a shared project (`SharedProject.jsx`). This view displays basic profile info (avatar, name, city, bio, interests) alongside the project's details (layer, budget, location, media).
- **Private Profile**: Uses the `CustomerProfile` dashboard within `MyProfile.jsx`, which includes tabs for Overview, Personal data, Preferences, Project, Activity, and Security.

### Administrator
- **Public Profile**: None. They are not listed in the public catalog.
- **Private Profile**: They use the same `CustomerProfile` dashboard as clients, but an `isAdmin` flag is passed down, likely adding shortcuts to the admin panel. Their primary workspace is the distinct `Admin.jsx` dashboard.

## 3. Main UI/UX Inconsistencies
- **Fragmented Codebase**: `Pro.jsx` and `SharedProject.jsx` share common visual needs (avatar, name, bio, location) but are built as entirely separate components with duplicated styling.
- **Layout Discrepancies**: The specialist profile uses an asymmetrical two-column layout (sticky left aside for CTA/stats, right column for content), while the client's shared project uses a top-heavy header block with a standard grid below.
- **Avatar Styling**: Specialists use a distinctive squircle with a double border, whereas clients use a standard circular avatar.

## 4. Recommended Unified Profile Structure
We should adopt the specialist layout (`Pro.jsx`) as the unified foundational structure, creating a single `PublicProfileLayout` component that dynamically injects role-specific content.

**Unified Layout (`PublicProfileLayout`)**:
- **Cover Banner**: Shared across all roles (defaulting to a branded pattern if none uploaded).
- **Sticky Left Aside**: 
  - Profile Card (Avatar, Name, Tag/Role, Location, Member Since)
  - Stats Block (Role-specific)
  - Primary CTA (Role-specific)
- **Main Right Column**:
  - Biography & Basic Info (Shared)
  - Dynamic Sections (Role-specific content injected here)

## 5. Role-Specific Sections/Actions Table

| Role | Left Aside Stats | Primary CTA | Main Column Content |
| :--- | :--- | :--- | :--- |
| **Specialist** | Projects, Reviews, Services count | Start Chat, Send Inquiry | Biography, Services & Pricing, Methodology, Portfolio Gallery, Reviews |
| **Client** | Active Projects count | Apply/Contact regarding Project | Biography, Interests/Preferences, Active Shared Projects (Media/Budget) |
| **Admin** | *N/A* | *N/A* | *No public profile* |

## 6. Admin Profile Recommendation
Administrators **should not** have a public marketplace-style profile. Any attempt to visit an admin's public profile URL should return a 404 or redirect. Admin accounts should remain strictly for backend management (`/admin`) and internal profile settings (`/moy-profil`), completely separated from the public directory. Do not mix admin tools or badges into the public-facing UI to prevent security risks and user confusion.

## 7. Minimal Safe Implementation Plan in Phases

**Phase 1: Component Extraction**
- Extract the core UI elements from `Pro.jsx` (Profile Card, Cover Banner, Meta Tiles) into reusable components (e.g., `src/components/profile/ProfileCard.jsx`).

**Phase 2: Layout Creation**
- Create a `PublicProfileLayout.jsx` that accepts props for the Left Aside and Main Column.
- Refactor `Pro.jsx` to use this new layout without changing its functionality.

**Phase 3: Client Profile Integration**
- Refactor `SharedProject.jsx` (or create a new `ClientProfile.jsx`) to use `PublicProfileLayout.jsx`. 
- Pass the client's project data as the main column content, achieving visual parity with specialists.

**Phase 4: Routing & Permissions**
- Ensure routing explicitly blocks or redirects public profile access for `admin` roles.

## 8. Risks to Avoid
- **Data Exposure**: When migrating the client view to the unified layout, ensure private project details (like exact addresses or private budgets) remain hidden.
- **Over-engineering**: Do not force specialist-specific logic (like the complex layer01 meta stepper) into the base layout. Keep the layout dumb and use composition (children props) for the dynamic content.
- **Admin Leakage**: Strictly avoid exposing admin status or internal admin links on any public-facing component.
