# 631 Solutions Owner-Operator Product Feedback

Review date: May 10, 2026  
Reviewer lens: brutally honest owner-operator of a Long Island exterior cleaning business around Huntington Station / Suffolk County  
Product reviewed: 631 Solutions Pricing Coach, including `/quote`, `/dashboard`, quote detail, cost assumptions, and actuals capture

## 1. First Reaction

My gut reaction: I would be curious, but I would not trust this to run my quoting yet.

The good part is obvious: it is trying to stop me from quoting below my floor. I like that. I like seeing labor, material, drive reserve, equipment wear, overhead, and margin broken out. That is more useful than a cute AI widget that guesses a number and calls itself smart.

But as a real exterior cleaning quoting tool, this is too thin right now. It handles a clean, simple house wash / window / roof wash estimate, but my real jobs are messier. The current quote flow does not know enough about access, photos, roof pitch, oxidation, window type, screens, storm windows, gutters, patio square footage, fence linear footage, paver condition, water source, ladder risk, chemical risk, travel zone, crew size, or schedule availability.

Would I pay today? Not much. Maybe I would test it if it were cheap and hooked into my lead flow. I would not replace my current intake or quoting process with it yet.

Would I care? Yes, because margin protection matters. But I would need it to move from "pricing calculator" to "close-ready quote system."

## 2. What I Actually Need

These are the real problems this product has to solve for my quoting workflow:

- I need to answer a homeowner fast, usually while I am between jobs or still on site somewhere.
- I need enough job detail to avoid underquoting jobs that look easy on paper but eat half a day.
- I need photos before I waste time driving out for a job that could have been quoted remotely.
- I need to know if this is a good lead or a price shopper.
- I need to protect minimum job pricing so I am not sending a crew for a low-ticket nuisance job.
- I need the system to handle bundled work: house wash plus windows, patio, fence, gutters, roof treatment, pavers, solar panels, and maybe lighting or painting leads.
- I need the quote to say exactly what is included and excluded.
- I need to know when I can actually schedule the work.
- I need follow-up automation because most homeowners do not book from the first reply.
- I need the quote to look professional without sounding like software wrote it.
- I need a way to collect deposits or at least get a clear "approve and book" action.
- I need to track whether my price was too high, too low, or if the lead was never serious.

The current product solves a small slice of this: base quote intake, deterministic floor, quote queue, outcome tracking, and calibration from actuals. That is a decent foundation, but it is not enough for daily production use.

## 3. What Would Make Me Say "This Is Worth Paying For"

I would pay if it clearly made me more money this month, not someday after a data science loop matures.

What would make it valuable:

- A homeowner sends address, photos, services wanted, and timing, and I can send a polished quote in under two minutes.
- The system flags risk before I quote: steep roof, three stories, no driveway access, heavy organic growth, oxidation risk, delicate surfaces, bad water access, long hose pull, ladder work, screens/storm windows, gutter guards, or paver restoration complexity.
- It recommends profitable package options, not just one service number.
- It gives me a "good / caution / bad lead" read based on geography, budget, urgency, service mix, and completeness of info.
- It creates a quote that can be approved by the customer with a clear button, deposit option, and preferred scheduling window.
- It tracks follow-up automatically by text/email until the customer books, says no, or goes cold.
- It learns from actual job duration and margin, but does not wait for AI unlocks before being operationally useful.
- It lets my helper use it without asking me what every field means.
- It prevents under-floor quotes at the API and UI level. This part already exists and is good.

The biggest paid value would be quote speed plus scope protection plus conversion. The math engine by itself is not enough.

## 4. What Is Weak, Confusing, or Unnecessary

The customer-facing copy talks too much like an internal pricing tool. "Protected floor" and "Dante gets the exact inputs" are owner language, not homeowner language. Homeowners care that the quote is fast, fair, insured, professional, and clear. They do not need to hear about my floor.

The source field is required from the customer. That is backwards. I care where the lead came from, but making the homeowner choose "Truck QR / Yard sign / Nextdoor / Google" creates friction. Auto-tag it from the link if possible. If not, make it optional or ask "How did you hear about us?" at the end.

The visible "Dashboard" link on the public quote page is wrong for a customer-facing intake. It makes the product feel like a demo or internal tool, not a polished quote form.

The form is simple, but too simple. It does not ask for the dangerous details that cause bad quotes. For exterior cleaning, missing risk inputs are not a minor issue. They are the difference between a profitable morning and a miserable underpriced job.

The current service list is too narrow. 631 Solutions appears to offer more than house wash, window cleaning, and roof wash. If I cannot quote gutters, patios, fences, pavers, solar panels, permanent lighting, painting, and add-ons, I still need another quoting process.

The dashboard is clean but underpowered. It shows quote queue, floor, ask, and outcomes. It does not show probability, margin, schedule date, photos, service bundle, assigned crew, follow-up stage, or customer urgency in a way that helps me triage.

The AI unlock gate is probably not the right thing to emphasize in the owner dashboard. I do not wake up thinking, "When does AI unlock?" I wake up thinking, "Who needs a quote, who is ready to book, and what is on the schedule?"

The actuals capture is a good idea, but "spot on / less time / more time" is not enough. I need actual hours, crew count, material notes, add-on dollars, and reason codes. Otherwise the calibration can learn the wrong lesson.

## 5. Missing Features

The product needs these before I would trust it for exterior cleaning quotes:

- Photo upload at intake: front, back, left, right, roof/gutters, patio/fence/pavers, problem areas, access points.
- Address intelligence: town, ZIP, drive distance from base, service zone, travel surcharge, parking/access flag.
- Measurement support: home square footage, roof square footage, patio square footage, fence linear footage, gutter linear footage, number of panels, window count, screen count, storm window count.
- Window details: interior/exterior, panes vs windows, screens, tracks, French panes, storms, hard water, ladder windows.
- Roof risk: roof size, pitch, height, walkability, moss severity, landscaping protection, runoff handling, water access, chemical volume.
- Surface condition: light/medium/heavy algae, oxidation, artillery fungus, efflorescence, rust, oil, organic staining, fragile paint, old cedar/vinyl/composite risk.
- Access risk: locked gates, tight side yards, no outdoor spigot, long hose pull, steep property, pool equipment, pets, detached structures.
- Bundle builder: house wash plus windows plus patio plus fence plus gutters plus roof treatment, with clear package savings.
- Minimum job price by service and travel zone.
- Seasonal demand multiplier tied to actual calendar capacity, not just "ASAP / this week / this month."
- Schedule-aware quoting: earliest available date, crew size, estimated job duration, route fit, and peak-season urgency.
- Bad-fit lead filters: outside service area, commercial/HOA complexity, renter without owner approval, no photos, no phone, unrealistic timing, bargain-hunting language.
- Quote approval flow: customer can approve, request call, choose preferred dates, and pay deposit.
- Scope exclusions: screens/tracks, oxidation removal, hard water, roof walking, gutter repairs, paint damage, paver sanding/sealing, moving furniture, water access.
- Follow-up automation: immediate confirmation, quote sent, 24-hour follow-up, 72-hour follow-up, seasonal urgency follow-up, lost reason capture.
- Before/after proof: attach relevant service photos or job examples to make the quote feel credible.
- Insurance/trust signals: insured, local, reviewed, professional equipment, soft wash language where appropriate.

## 6. Pricing Logic Feedback

The current pricing engine is pointed in the right direction because it starts with cost and protects a floor. I tested a standard one-story house wash in 11743 for this week. It returned $645-$760, with a $645 protected floor, 4.6 estimated labor hours, $115 materials, $20 drive reserve, $35 equipment wear, and a $545 overhead/margin floor. It also rejected a $500 send attempt below floor. That is good.

But the pricing logic is still too blunt for real exterior cleaning work.

Base service minimums:
Every service needs a configurable minimum. House wash, window cleaning, gutters, roof treatment, patio wash, fence wash, solar panels, and pavers should each have a minimum, plus a higher minimum for longer travel. A generic floor calculation is not enough.

Square footage:
House and roof square footage are not interchangeable. A 2,500 sqft house and a 2,500 sqft roof are different jobs. Roof pitch, stories, walkability, and chemical demand matter more than just size.

Linear footage:
Gutters and fences need linear footage. Fence cleaning also needs height, sides, material, and condition. Gutters need height, gutter guards, downspout issues, debris volume, and ladder access.

Number of windows:
Window pricing needs exterior only vs inside/outside, screens, tracks, storms, French panes, hard water, ladder windows, and high glass. "Per window" will underquote if all windows are treated equally.

Roof size and pitch:
Roof wash pricing needs roof area, pitch, height, moss severity, plant protection time, chemical mix, water access, and whether the roof can be walked. A three-story steep roof should not be only a 1.25x story multiplier.

Surface condition:
Light algae and heavy organic growth are different jobs. Oxidation risk should not be priced like normal vinyl. Pavers with weeds, moss, polymeric sand issues, or failed sealant need a separate path.

Chemicals/materials:
Material cost per unit is useful, but chemical usage should vary by service, severity, and surface. Roof treatment especially needs a stronger chemical/material model.

Drive time:
A fixed 30-minute or 40-minute reserve is not enough for Suffolk/Nassau realities. Use drive time from base, traffic buffer, route density, and whether the job fits an existing route.

Crew size:
Pricing needs crew size. Four labor hours by one guy is not the same as two hours with two people when scheduling, payroll, and opportunity cost matter.

Job duration:
The dashboard should show estimated duration in a scheduling-friendly way: "1 tech, half day" or "2 techs, 3-4 hours." Right now it shows labor hours, but not how that maps to a crew block.

Difficulty/access risk:
Risk should add dollars or force manual review. Examples: steep roof, three stories, ladder-heavy windows, no hose bib, tight access, fragile siding, oxidation, heavy furniture, no parking, landscaping exposure.

Customer urgency:
The current urgency multiplier is too weak if the schedule is packed. ASAP during peak season should either increase price meaningfully or show only premium slots.

Bundled discounts:
Discount bundles carefully. Do not blindly discount everything. Bundle discounts should come from saved setup/drive time, not from margin. House wash plus exterior windows might get a setup efficiency discount; roof wash plus house wash might need more chemical/risk, not less.

Premium add-ons:
The tool should suggest premium add-ons with clear value: exterior windows after house wash, gutter whitening, patio refresh, fence wash, paver treatment, solar panel cleaning, rust removal, maintenance plan.

Deposit requirements:
Require deposits for larger jobs, peak-season holds, roof work, restoration work, permanent lighting, painting, and anything requiring special materials or scheduling commitment.

Margin protection verdict:
Good first step, but not enough risk segmentation. The current engine can protect against obvious low numbers, but it can still underquote jobs because the intake does not capture the variables that make jobs expensive.

## 7. Customer Quote Experience

From a homeowner perspective, the form is clean and fast. That matters. It does not look sketchy.

But it does not yet feel like a professional quote experience from a top local exterior cleaning company. It feels like a calculator. The customer gets a range and is told someone confirms shortly. That is okay for first contact, but it does not close the job.

What needs to improve:

- Remove internal language like "protected floor" from the public experience.
- Remove the public dashboard link.
- Ask for photos naturally: "Upload a few quick photos so we can confirm without a site visit."
- Show trust cues near the form: local, insured, fast scheduling, before/after proof, reviewed, soft wash safe methods.
- After estimate, show package options instead of only a range.
- Give the homeowner a next action: approve quote, request call, upload more photos, pick preferred dates.
- Explain what is included and what is not.
- Use plain customer language: "House wash estimate" beats "deterministic ask."
- Avoid saying "Dante" everywhere unless the business wants quotes tied to one person. If helpers use this, it creates a bottleneck.

The customer quote should make the homeowner think, "These guys are organized. I can trust them." Right now it says, "We have a pricing tool."

## 8. Owner Dashboard Feedback

The dashboard is clean and easy to read. That is the good news.

What I would need as the owner:

- Lead status: new, needs photos, ready to quote, quote sent, follow-up due, booked, scheduled, won, lost, no response.
- Quote amount: range, final ask, floor, margin dollars, margin percent.
- Probability of closing: based on service mix, source, urgency, completeness, repeat/referral, price sensitivity, and follow-up history.
- Scheduled date: not just follow-up date. I need to know where this job fits.
- Job notes: access, risks, photos, customer preferences, crew notes.
- Photos: visible on quote detail, not buried elsewhere.
- Service bundle: show all requested services and recommended add-ons.
- Follow-up status: last contact, next follow-up, number of touches, customer replies.
- Quote history: previous quotes, booked jobs, lost reasons, final price vs original estimate.
- Crew/load view: estimated hours by day, route zone, open capacity, peak-season bottlenecks.
- Bad lead flag: outside area, incomplete info, low budget, no phone, high-risk job, manual review needed.

The current dashboard is more of a pricing ledger than an operating dashboard. It helps me see a quote. It does not yet help me run tomorrow.

## 9. Close Rate Improvements

To book more jobs, the product needs to do more than produce a number.

Specific changes:

- Show three quote options: "Essential," "Best Value," and "Full Exterior Refresh." For example: house wash only, house wash plus exterior windows, house wash plus exterior windows plus patio/fence.
- Add "approve and book" directly in the customer quote.
- Add deposit collection for jobs over a configurable threshold.
- Add preferred date/time selection after quote approval.
- Send a text to the owner immediately with a one-tap quote review link and key risk notes.
- Send the customer a professional quote email/text with scope, price, photos, proof, and booking CTA.
- Automate follow-ups: same day, next day, three days, and one week, with different copy for urgent leads.
- Add "complete your quote" reminders when photos are missing.
- Add local trust: Huntington/Suffolk language, insurance, reviews, before/after images, "soft wash safe for siding/roof" where appropriate.
- Add reason-coded lost outcomes: price too high, booked competitor, no response, outside area, not ready, wanted service not offered, bad fit.
- Add owner override reasons when price changes: access, height, heavy buildup, bundled discount, repeat customer, premium urgency.
- Add a booking pipeline view so I know what to chase today.

The goal should be: fewer site visits, faster quote confirmation, higher average ticket, and fewer jobs I regret taking.

## 10. Final Verdict

Scores:

| Category | Score | Honest take |
| --- | ---: | --- |
| Usefulness | 5/10 | Useful pricing skeleton, not yet a daily quoting system. |
| Ease of use | 7/10 | Simple and clean, but oversimplified for real jobs. |
| Quote accuracy | 4/10 | Good cost-floor idea, weak job-risk intake. |
| Profit protection | 6/10 | Blocks below-floor quotes, but missing risk multipliers can still underprice. |
| Customer trust | 5/10 | Clean UI, but too much internal language and not enough proof/scope. |
| Likelihood I would pay | 4/10 | I would not pay serious money until it helps me book and schedule. |
| Likelihood I would use weekly | 5/10 | I might use it for simple house wash quotes, but not as my main system yet. |

Overall verdict: promising foundation, not owner-ready.

This is better than a generic AI quote guesser because it respects margin. It is not yet better than a strong QuoteIQ-style intake because it lacks photos, measurement depth, packages, quote approval, scheduling, and follow-up conversion.

## Top 5 Changes Before Showing The Real Owner

1. Build a real exterior cleaning intake

Add photos, measurements, access questions, service-specific risk fields, and add-on interest. House wash, windows, roof, gutters, patio, fence, solar, pavers, lighting, and painting cannot share one generic size/stories form.

2. Turn the quote result into a booking flow

After the range, show clear package options, scope, exclusions, preferred dates, and an approval/deposit action. A number without a booking path is not enough.

3. Add scheduling reality

Show earliest availability, route zone, estimated crew block, drive time, and peak-season urgency. The quote should know whether I can actually do the job.

4. Upgrade pricing rules for risk and margins

Add configurable service minimums, travel zones, crew size, roof pitch, access risk, surface condition, chemical severity, bundle logic, urgency premiums, and deposit thresholds.

5. Make the owner dashboard operational

Add photos, lead quality, quote probability, margin estimate, follow-up stage, scheduled date, service bundle, last contact, and lost reason. I need to know what to do next, not just what the calculator produced.

## Fix-Later Punch List

- Remove public dashboard link from `/quote`.
- Replace customer-facing "protected floor" language with homeowner-friendly copy.
- Make source optional or auto-tagged by URL/campaign.
- Add photo upload before estimate confirmation.
- Add service-specific intake modules.
- Add package builder and add-on recommendations.
- Add scope inclusions/exclusions to every sent quote.
- Add customer approval and booking CTA.
- Add deposit rules and payment integration.
- Add preferred scheduling windows.
- Add route/travel zone pricing.
- Add minimum job pricing per service.
- Add risk multipliers and manual-review triggers.
- Add owner quote probability and lead quality score.
- Add follow-up automation and follow-up status.
- Add lost reason tracking.
- Expand actuals capture to include crew size, actual hours, added services, material notes, and reason codes.
- Keep the below-floor guard. That part is worth protecting.

## Verification Notes

- Ran `pnpm lint`: passed.
- Ran `pnpm build`: passed.
- Started local app with `LOCAL_DATA_PATH=/tmp/mas-631-review-store.json pnpm exec next dev -p 3000`.
- Reviewed `/quote`, `/dashboard`, `/dashboard/quotes/[id]`, `/dashboard/costs`, and actuals capture.
- Created a fake local quote through the API to inspect owner screens.
- Tested below-floor quote sending with `$500` against a `$645` floor; the API rejected it.
