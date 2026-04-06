---
name: tesco-grocery-shopping
description: "Optimised workflow for Tesco grocery shopping via the tesco-grocery MCP tools. Use this skill whenever the user asks to add items to their Tesco basket, do a  weekly shop, manage their grocery order, check delivery slots, or anything  involving Tesco online groceries. Also trigger when the user mentions their  shopping list, staple items, weekly essentials, or preferred brands in a  Tesco context. This skill enforces optimal sequencing to minimise round-trips  and avoid unnecessary \"Continue\" breaks."
---


# Tesco Grocery Shopping — Optimised Execution Plan

## Execution approach

Tool calls are executed sequentially (one at a time). The goal is to follow
the phase order below efficiently, making smart decisions at each gate to 
minimise total calls. Don't overthink — just move through the phases briskly.

---

## Execution phases

Every grocery shopping task follows this dependency graph. Phases are sequential 
(each depends on the previous).

### Phase 0 — Setup

1. view SKILL.md (this file)
2. bash: cat preferred_items.md (check if exists)
3. tool_search("tesco grocery...")

### Phase 1 — Context gathering

Call these in sequence:
1. get_favourites(count=48)
2. get_current_slot
3. get_basket
4. get_offers (if user has Clubcard)

**Why this comes first:** Favourites contain product IDs, preferred brands, and 
availability status. If a staple item is already in favourites and `isForSale: true`, 
you may not need to search for it at all — just use the ID directly. The basket 
check tells you if items are already there (avoid duplicates). The slot confirms 
delivery is booked.

**Decision gate after Phase 1:**
- Build a lookup map: `{item_keyword → favourite_product_id}` for any staples 
  matched in favourites
- Build an alias map from preferred_items.md (e.g. "sourdough" → specific product name)
- Note any favourites that are `isForSale: false` — search for these in Phase 2 
  using `search_products` (not `get_substitutions`; substitutions run in Phase 4)
- Note any items NOT found in favourites — these need product searches
- Check basket for items already present — adjust quantities, don't duplicate
- **Plan Phase 2 searches** — list every search query you need, then 
  work through them

### Phase 2 — Product discovery

For every item on the shopping list that was NOT resolved from favourites,
issue a **single batched `search_products` call** containing all the queries at
once. `search_products` takes a `queries` array (up to 20 entries) and fans
them out in one HTTP request — do NOT call `search_products` once per item.

```
search_products(queries: [
  { query: "Andrex quilted toilet roll 3 ply", count: 10 },
  { query: "lean beef mince 5% 1kg", count: 10 },
  { query: "bananas", count: 6 },
  ...
])
```

Each result in the response echoes the `query` and `index` from the input so
you can map results back to items. Per-query failures come back as
`{ ok: false, error }` entries — the rest still succeed.

**Search query guidelines:**
- Use the product alias from preferred_items.md if one exists
- Keep queries specific: include brand + size + key attribute (e.g. "5% fat")
- For branded items (toilet paper, coffee, cleaning products), ALWAYS lead 
  with the brand name (e.g. "Andrex quilted toilet roll 3 ply") — generic 
  queries like "toilet paper 3 ply" return overpriced marketplace bulk results
- Use `count: 6` for straightforward items (bananas, watermelon, pineapple — 
  usually only 1-2 relevant results)
- Use `count: 10` when comparison shopping is needed (coffee, mince, easy 
  peelers where deals and sizes vary); hard max is 24 per query
- Do NOT fire near-duplicate searches (e.g. "lean beef mince" then 
  "lean beef mince 5% 1kg") — get the query right first time
- For items where you need to compare deals, include enough in the first query
- If the shopping list exceeds 20 items, split into two batched calls

**Decision gate after Phase 2:**
- For each item, select the best product considering:
  1. Favourite status (prefer favourites)
  2. Clubcard deals (user has Clubcard — always factor in discounted price)
  3. Price per unit (compare £/kg, £/litre, £/each)
  4. Ratings and reviews
  5. Brand preference from preferred_items.md
  6. Availability (isForSale must be true)
- Flag quality/price trade-offs for user review (e.g. standard vs Finest)
- If any search returned poor results (e.g. marketplace bulk items), retry 
  with a refined query
- For items where `isForSale: false` in favourites, select the best available 
  match from search results — do NOT call `get_substitutions` yet (that 
  happens in Phase 4 if the item fails basket verification)

### Phase 3 — Add to basket (single call)

One `add_to_basket` call with ALL selected items:

```
add_to_basket(items: [{id, quantity}, {id, quantity}, ...])
```

Include every item in one call. Never add items one at a time.

### Phase 4 — Verification & substitution

Phase 4 is where substitutions happen. Only after adding items to the basket 
and verifying their status can you confirm what is truly unavailable.

**Phase 4a — Verify basket:**

Single call: `get_basket` — verify all items added correctly.

Check every item in the basket response:
- `status: "AvailableForSale"` → good
- `status` is anything else, or item is missing → needs substitution
- Quantity mismatch → correct with add_to_basket (quantity overwrite)

**Phase 4b — Substitution search (only if needed):**

If ANY items failed verification, run `get_substitutions` for each:

```
get_substitutions(query: "<product title>", excludeId: "<id>")
```

One call per unavailable item. If `get_substitutions` returns poor results for 
any item, also run a `search_products` fallback query.

Evaluate each substitution against user preferences (brand, size, price).

**Phase 4c — Add replacements & re-verify (only if needed):**

1. Single `add_to_basket` call with all replacements + `quantity: 0` for items 
   being replaced
2. `get_basket` to re-verify everything

Always note substitutions in the Phase 5 summary so the user can review.

### Phase 5 — Summary (ALWAYS use show_widget)

**Never present the summary as plain text.** Always use `visualize:show_widget` 
to render an interactive HTML summary. The widget has four mandatory sections, 
described below. Call `visualize:read_me(modules: ["chart"])` before your first 
widget call if you haven't already in this conversation.

The summary widget is the final deliverable — it's what the user sees and 
interacts with. It must be comprehensive, scannable, and actionable.

---

## Summary widget template

The Phase 5 summary MUST be rendered as a `visualize:show_widget` call with 
`title: "tesco_basket_summary"`. The widget contains four sections in order:

### Section 1 — Metric cards (top row)

A responsive grid of 4 summary cards using `var(--color-background-secondary)`:

```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Basket total │ │ Items        │ │ Delivery     │ │ Clubcard     │
│ £57.93       │ │ 19           │ │ £4.50        │ │ savings      │
│              │ │              │ │              │ │ ~£4.65       │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

HTML pattern:
```html
<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 1.5rem;">
  <div style="background: var(--color-background-secondary); border-radius: var(--border-radius-md); padding: 1rem;">
    <p style="font-size: 13px; color: var(--color-text-secondary); margin: 0;">Basket total</p>
    <p style="font-size: 24px; font-weight: 500; margin: 4px 0 0;">£XX.XX</p>
  </div>
  <!-- repeat for Items, Delivery, Clubcard savings -->
  <!-- Clubcard savings value uses color: #0F6E56 (teal-600) -->
</div>
```

### Section 2 — Item tables (staples + extras)

Two separate tables: "Staple items" and "This week's extras" (only if extras exist).
Each table has 4 columns: Item, Qty, Price, Notes.

Column behaviour:
- **Item**: Product name, shortened to essentials (drop "Tesco" prefix where obvious)
- **Qty**: Centred, just the number
- **Price**: Right-aligned. If Clubcard price, wrap in `<span style="color: #0F6E56">`
- **Notes**: Short annotation — one of:
  - `Favourite` (gray) — item matched from favourites
  - `Clubcard price` (teal #0F6E56) — Clubcard deal applied
  - `Sub for unavailable [X]` (warning color) — substitution made
  - `Per alias` (gray) — resolved from preferred_items alias
  - `[quantity note]` (gray) — e.g. "= 1kg total" for split-pack items
  - Flagged with `⚖️` if there's a quality/price trade-off (see Section 3)

Both tables (staples and extras) MUST use identical `table-layout: fixed` and 
`<colgroup>` so columns align vertically across sections.

HTML pattern per table:
```html
<h2 style="font-size: 18px; font-weight: 500; margin: 0 0 12px;">Staple items</h2>
<div style="overflow-x: auto;">
<table style="width: 100%; font-size: 14px; border-collapse: collapse; table-layout: fixed;">
<colgroup>
  <col style="width: 42%;">
  <col style="width: 8%;">
  <col style="width: 12%;">
  <col style="width: 38%;">
</colgroup>
<thead><tr style="border-bottom: 0.5px solid var(--color-border-tertiary);">
  <th style="text-align: left; padding: 8px 4px; color: var(--color-text-secondary); font-weight: 400;">Item</th>
  <th style="text-align: center; padding: 8px 4px; color: var(--color-text-secondary); font-weight: 400;">Qty</th>
  <th style="text-align: right; padding: 8px 4px; color: var(--color-text-secondary); font-weight: 400;">Price</th>
  <th style="text-align: left; padding: 8px 4px; color: var(--color-text-secondary); font-weight: 400;">Notes</th>
</tr></thead>
<tbody>
  <tr style="border-bottom: 0.5px solid var(--color-border-tertiary);">
    <td style="padding: 8px 4px;">Product name</td>
    <td style="text-align: center;">1</td>
    <td style="text-align: right;">£X.XX</td>
    <td style="padding: 8px 4px; font-size: 12px; color: var(--color-text-secondary);">Note</td>
  </tr>
  <!-- more rows -->
</tbody>
</table>
</div>
```

**Notes column guidance:** Keep notes under ~50 characters to avoid heavy 
wrapping in the fixed-width column. Prefer short forms like 
"Clubcard price (was £X)" over verbose explanations.

### Section 3 — Decision cards (trade-offs for user review)

For every item where Claude chose the value option but a quality upgrade exists 
(or vice versa), show a decision card. These MUST use `sendPrompt()` buttons 
so the user can swap with one tap.

When to show a decision card:
- Standard vs Finest variant exists with meaningful quality/price difference
- A Clubcard deal makes an alternative notably cheaper
- Claude chose a substitution the user might want to override
- Multiple coffee/speciality options with different deals

Each card shows:
- What was added and why (bold label + price)
- The alternative and what it costs
- A swap button that calls `sendPrompt('Swap [item] to [alternative]')`

HTML pattern:
```html
<h2 style="font-size: 18px; font-weight: 500; margin: 1.5rem 0 12px;">Decisions for your review</h2>
<div style="display: flex; flex-direction: column; gap: 12px;">

<div style="background: var(--color-background-primary); border-radius: var(--border-radius-lg); border: 0.5px solid var(--color-border-tertiary); padding: 1rem 1.25rem;">
  <p style="font-weight: 500; font-size: 14px; margin: 0 0 6px;">Item name</p>
  <p style="font-size: 13px; color: var(--color-text-secondary); margin: 0;">
    <b>Added:</b> Product A — £X.XX (reason)<br>
    <b>Alternative:</b> Product B — £Y.YY (reason, rating difference)
  </p>
  <button style="margin-top: 8px; font-size: 13px;" 
    onclick="sendPrompt('Swap [item] to [alternative description]')">
    Swap to [alternative] ↗
  </button>
</div>

<!-- more cards -->
</div>
```

If there are NO trade-offs to flag, omit Section 3 entirely — don't show an 
empty "Decisions" heading.

For information-only notes (e.g. "Caffè Crema not available, Rossa is best deal"), 
use a card WITHOUT a swap button — just the explanation text.

### Section 4 — Delivery footer

A muted bar at the bottom with slot details and estimated total:

```html
<div style="margin-top: 1.5rem; padding: 12px 16px; background: var(--color-background-secondary); border-radius: var(--border-radius-md); font-size: 13px; color: var(--color-text-secondary);">
  Delivery: [day] [date], [time] · Delivery charge: £X.XX · Est. total with delivery: £XX.XX
</div>
```

### Widget assembly rules

1. All four sections go in a single `show_widget` call — never split across 
   multiple calls
2. Wrap everything in `<div style="padding: 1rem 0;">` for breathing room
3. Use CSS variables for all colours except the teal Clubcard highlight (#0F6E56) 
   which is hardcoded for emphasis
4. Tables use `overflow-x: auto` wrapper for mobile safety
5. Both tables MUST use identical `table-layout: fixed` and `<colgroup>` with 
   the same column widths (42% / 8% / 12% / 38%) so columns align vertically
6. All borders are `0.5px solid var(--color-border-tertiary)`
6. The widget title is always `tesco_basket_summary`
7. Loading messages should be grocery-themed and playful, e.g.:
   `["Tallying the trolley totals", "Checking Clubcard savings", "Sorting the shopping"]`

### After the widget

Follow the widget with a SHORT prose summary (3-5 bullet points max) covering:
- Key substitutions made and why
- The best deal/Clubcard insight
- Any items that need user decision
- Offer to save/update preferred_items.md

Do NOT repeat the full item list in prose — the widget already shows everything. 
The prose should add context the widget can't (e.g. "No 1kg lean mince exists, 
so I combined 750g + 250g").

---

## Swaps use a single add_to_basket call

When swapping one product for another, use ONE `add_to_basket` call:
```json
{ "items": [
    { "id": "OLD_PRODUCT_ID", "quantity": 0 },
    { "id": "NEW_PRODUCT_ID", "quantity": 1 }
]}
```
Setting `quantity: 0` removes the old item. Never use `remove_from_basket` 
followed by `add_to_basket` — that's two round-trips for a one-call operation.

---

## Dependency rules

### Phase order (sequential)
```
Phase 0 → Phase 1:   MCP tools must be loaded before calling them
Phase 1 → Phase 2:   Searches depend on knowing what's in favourites
Phase 2 → Phase 3:   Adding depends on product selection
Phase 3 → Phase 4a:  Verification depends on add completing
Phase 4a → Phase 4b: Substitutions depend on knowing what's unavailable
Phase 4b → Phase 4c: Replacement adds depend on substitution selection
```

### Where get_substitutions belongs
```
❌ Phase 2 — too early, availability not yet confirmed by basket
✅ Phase 4b — after get_basket reveals which items are unavailable
```
`get_substitutions` must ONLY run after `get_basket` (Phase 4a) confirms 
that an item's status is not `AvailableForSale`. Favourites showing 
`isForSale: false` is a hint, but the basket is the source of truth — 
sometimes items show unavailable in favourites but are available when 
added. Always attempt to add first, then substitute based on basket 
verification results.

---

## Preferred items file

Location: `/mnt/user-data/uploads/preferred_items.md` or as specified by user.

### Format
```markdown
# Preferred Items

## Aliases
- alias - product name - product id (if known)

## Brand preferences
 - product name

## Staple items (add weekly unless excluded)
- 1 × Tesco Whole Milk 2L
- 1 × Arla Lactofree Whole Milk 2L
- 2 × Tesco Perfectly Ripe Mango
- 1 × Tesco Pink Lady Apples 5 Pack
- ... etc
```

### Using the file
- Check aliases BEFORE searching — search using the resolved product name
- If a product ID is stored, try adding directly via `add_to_basket` without 
  searching (but verify it's still available in the Phase 4 check)
- After user confirms the basket, offer to create/update this file with the 
  brands and products they chose this session

---

## Clubcard pricing logic

The user has a Tesco Clubcard. When comparing products:

1. Always use the Clubcard price (not shelf price) for comparison
2. The `promotion` field shows Clubcard deals:
   - `clubcardOnly: true` means the deal requires Clubcard
   - `discountedPrice` is the Clubcard price (if present)
   - Some deals are conditional (e.g. "Any 2 for £4") — factor in whether 
     the user is buying the qualifying quantity
3. Highlight savings in the summary: "£X.XX Clubcard price (saves £Y.YY)"
4. When two products are similar quality, prefer the one with the better 
   Clubcard deal

---

## Handling unavailable items

There are two scenarios where items may be unavailable. They are handled 
differently:

### Scenario A — Favourite shows `isForSale: false` (Phase 1)

When `get_favourites` returns a product with `isForSale: false`, this is a 
**hint** but NOT confirmation. The favourite listing can be stale.

**Action:** In Phase 2, search for the item normally using `search_products` 
(not `get_substitutions`). If the search returns the same product as available, 
add it to the basket. The basket verification in Phase 4a will confirm 
whether it's truly available.

### Scenario B — Basket item unavailable (Phase 4a)

After `add_to_basket` in Phase 3, `get_basket` in Phase 4a may reveal items 
with a status other than `AvailableForSale`, or items may be missing entirely. 
This is the source of truth.

**Action:**
1. Collect ALL unavailable item IDs and titles
2. Run `get_substitutions` for each unavailable item (Phase 4b)
3. Evaluate substitutions against user preferences (brand, size, price)
4. If `get_substitutions` returns nothing suitable for any item, run a 
   `search_products` fallback query
5. Add all replacements in a single `add_to_basket` call (use `quantity: 0` 
   for the unavailable items being replaced)
6. Re-verify with `get_basket`
7. Always note substitutions in the Phase 5 summary so the user can review

---

## Token budget awareness

A single batched `search_products` call with 15-20 queries × 10-12 products
× ~15 fields each is a sizeable result set. To stay within context:

- Use `count: 6` for straightforward items (bananas, watermelon, pineapple — 
  usually only 1-2 relevant results)
- Use `count: 10` when comparison shopping is needed (coffee, mince, easy 
  peelers where deals and sizes vary)
- Don't request `get_product_details` unless you specifically need nutritional 
  info or extended description — the search results contain enough for selection

---

## Handling swap requests

When the user taps a swap button (or asks to swap an item):

1. Use a SINGLE `add_to_basket` call with `quantity: 0` for the old item and 
   `quantity: N` for the new item
2. Follow with `get_basket` to verify the swap
3. Respond with a brief confirmation including the new price and any savings 
   difference — no need to re-render the full summary widget for a single swap