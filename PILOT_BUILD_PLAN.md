# Shelter Prep Two-Week Pilot Build Plan

## Pilot Outcome

By pilot start, Shelter Prep should support:

- address-first property intake
- verified property profiles
- permit/map links for local research
- AI-assisted intake and scope drafts
- photo/document upload
- admin lead dashboard
- estimate review with labor/material memory
- contractor profile and QR intake foundation

## Week 1: Property Intelligence Spine

1. Upgrade property intake fields.
   - bedrooms
   - bathrooms
   - square feet
   - lot size
   - year built
   - property type
   - jurisdiction
   - zoning
   - parcel/account number
   - verified notes

2. Add permit/map links.
   - PortlandMaps
   - county GIS/search
   - ORMAP
   - permit office link

3. Save verified profile data.
   - create `property_profiles`
   - link leads to profiles by address
   - keep human verification status

4. Improve admin review.
   - show property profile on each lead
   - show missing property facts
   - show map/permit quick links

## Week 2: Pilot Funnel and Contractor Layer

1. Contractor profile foundation.
   - public slug
   - profile fields
   - trade list
   - service areas
   - QR intake URL

2. Contractor intake flow.
   - contractor-branded project submit link
   - lead attribution
   - photos/address/scope first

3. AI scope builder.
   - convert notes/photos into trade breakdown
   - flag missing info
   - suggest permit/risk checks

4. Pilot analytics.
   - lead count by area
   - work type demand
   - missing info patterns
   - estimate readiness
   - contractor response notes

## Build Rule

Every feature must help one of these pilot moments:

- "This property profile is useful."
- "This makes the contractor look more legitimate."
- "This lead is easier to estimate."
- "The admin knows what to do next."

## Pilot Must Feel Like The Whole Package

The pilot does not need perfect automation, but it must show the complete loop:

```text
property + photos + notes
-> verified property profile
-> scope and quantity assumptions
-> materials and labor assumptions
-> urgency, overhead, coordination, and risk buffers
-> contractor-ready packet
-> human-reviewed estimate workflow
```

Anything incomplete should be labeled as draft or needs human review, not hidden.
