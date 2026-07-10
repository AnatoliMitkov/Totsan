---
name: totsan-project-overview
description: Totsan — guided marketplace and PM platform for construction, renovation, furnishing; connects clients with vetted specialists across five layers
metadata:
  type: project
---

Totsan is a guided marketplace and project-management platform for construction, renovation, and furnishing. It connects clients with vetted specialists and organizes the entire path from initial idea through five logical layers to a completed project.

## Five layers
1. Idea and vision — architects, interior designers, 3D visualization
2. Construction and renovations — structural, MEP, finishing
3. Materials selection — paints, tiles, flooring, windows
4. Furnishings — custom furniture, kitchens, lighting
5. Decoration and finishing — textiles, wallpapers, plants, terraces

## Core flow
idea → project context → specialist → inquiry → chat → offer → order → payment → execution → completed project

## Client profile
Personal project space: property type, city, layer, budget, timeline, access, photos, documents. Shareable link. Sections: Overview, Personal Data, Preferences, My Space, Activity, Security.

## Partner profile (Totsan Pro)
Professional workspace for contractors, architects, designers, manufacturers, brands. Paid subscription model. Visible profile requires admin approval. Sections: Overview, Profile, Vision, Portfolio, Services, Materials & Brands, Orders, Inquiries, Contact, Security. Portfolio is the primary trust-building tool.

## Header navigation
Five layers visible on large screens. Additional menu: Services, Catalog, 3D Visualization, Totsan Pro. Mobile: "Start Project" button. Authenticated users see Inbox, Orders, Profile.

## Key pages
- Home — "From idea to completed home," quiz helper, five layers, services, examples, partners, steps, Totsan Pro
- Inbox — conversations with chat, offers, service requests
- Order — order details, timeline, evidence trail, review
- Checkout — payment flow for offers and services
- Profile — client and partner profiles (MyProfile.jsx, PartnerProfileWorkspace.jsx)
- Portfolio — partner portfolio projects

## Current tech stack
React 18, Vite, Tailwind CSS, lucide-react, Supabase (PostgreSQL, Edge Functions, Realtime), Stripe for payments (mock and Connect), React Router DOM.

## Offer system (current)
OfferComposer creates offers with rich local objects. Offers stored with partial data in columns, partial in offer_details JSON. Accepting an offer creates orders row. Order and checkout later reread mutable offer row for missing details. No immutable accepted-offer snapshot.

## Brand / tone
Modern, minimal, light UX, supporting animations and effects. Bulgarian language throughout. Clean, calm, compact, easy to scan UI.
