// Bill metadata for the "My Bills" personalized summary.
// contact: "house" | "senate" | "both" — matches data-contact on the full card in #all-bills.
// leverage: set only when a SPECIFIC committee or leadership role has outsized power over
// this bill's next step — contacting a rep/senator who actually holds that role matters far
// more than a generic cosponsorship ask. We can't yet tell whether a given visitor's own
// rep/senator holds it (that needs the real district-level lookup in a future update) — this
// just flags that the distinction exists and is worth checking.
const BILLS = [
  { id: "bill-hr5169", number: "S. 2403 / H.R. 5169", contact: "house",
    ask: "Ask your House rep to press leadership for a floor vote.",
    leverage: "Already cleared committee. The people who actually control what happens next are House leadership (Speaker's office, Majority Leader, Rules Committee chair) — if your rep holds one of those roles, their voice counts far more than an average member's." },
  { id: "bill-s1728", number: "S. 1728", contact: "house",
    ask: "Ask your House rep to introduce a companion bill — none exists yet.",
    leverage: "A member of the House Education & Workforce Committee is the natural person to introduce this — if that's your rep, say so explicitly." },
  { id: "bill-s1727", number: "S. 1727 / H.R. 9792", contact: "both",
    ask: "Ask your senator to push it out of committee; ask your House rep to cosponsor H.R. 9792." },
  { id: "bill-hr3105", number: "H.R. 3105 / S. 2461", contact: "both",
    ask: "Ask your senator and House rep to cosponsor and push for committee movement.",
    leverage: "This is a tax bill sitting in House Ways & Means and Senate Finance. Members of those two committees control whether it even gets a markup — that's far more leverage than a cosponsorship from outside them." },
  { id: "bill-aora", number: "H.R. 3248 / S. 1645", contact: "both",
    ask: "Ask your senator and House rep to cosponsor." },
  { id: "bill-s1101", number: "S. 1101", contact: "senate",
    ask: "Ask your senator to cosponsor." },
  { id: "bill-hr5778", number: "H.R. 5778", contact: "house",
    ask: "Ask your House rep to press for a floor vote.",
    leverage: "Already cleared the House Small Business Committee — like H.R. 5169, this now needs House leadership specifically, not another committee member." },
  { id: "bill-hr2993", number: "H.R. 2993", contact: "house",
    ask: "Ask your House rep to cosponsor." },
];

// Approximate 3-digit ZIP prefix -> state mapping (standard USPS regional blocks).
// State-level only — this is NOT precise enough for exact congressional district
// lookup (that needs real geocoding, planned as part of a future update). Boundary
// zips near state lines can occasionally fall on the wrong side; treat as "very
// likely your state," not a guarantee.
const ZIP3_RANGES = [
  [0, 5, null],        // unassigned / special
  [6, 9, "Puerto Rico"],
  [10, 27, "Massachusetts"], [28, 29, "Rhode Island"], [30, 38, "New Hampshire"],
  [39, 49, "Maine"], [50, 59, "Vermont"], [60, 69, "Connecticut"],
  [70, 89, "New Jersey"], [100, 149, "New York"], [150, 196, "Pennsylvania"],
  [197, 199, "Delaware"], [200, 205, "District of Columbia"], [206, 219, "Maryland"],
  [220, 246, "Virginia"], [247, 268, "West Virginia"], [270, 289, "North Carolina"],
  [290, 299, "South Carolina"], [300, 319, "Georgia"], [320, 349, "Florida"],
  [350, 369, "Alabama"], [370, 385, "Tennessee"], [386, 397, "Mississippi"],
  [398, 399, "Georgia"], [400, 427, "Kentucky"], [430, 459, "Ohio"],
  [460, 479, "Indiana"], [480, 499, "Michigan"], [500, 528, "Iowa"],
  [530, 549, "Wisconsin"], [550, 567, "Minnesota"], [570, 577, "South Dakota"],
  [580, 588, "North Dakota"], [590, 599, "Montana"], [600, 629, "Illinois"],
  [630, 658, "Missouri"], [660, 679, "Kansas"], [680, 693, "Nebraska"],
  [700, 714, "Louisiana"], [716, 729, "Arkansas"], [730, 749, "Oklahoma"],
  [750, 799, "Texas"], [800, 816, "Colorado"], [820, 831, "Wyoming"],
  [832, 838, "Idaho"], [840, 847, "Utah"], [850, 865, "Arizona"],
  [870, 884, "New Mexico"], [885, 885, "Texas"], [889, 898, "Nevada"],
  [900, 961, "California"], [967, 968, "Hawaii"], [969, 969, "Guam / Northern Mariana Islands / American Samoa"],
  [970, 979, "Oregon"], [980, 994, "Washington"], [995, 999, "Alaska"],
];

const NO_VOTING_MEMBER = new Set([
  "District of Columbia",
  "Puerto Rico",
  "Guam / Northern Mariana Islands / American Samoa",
]);

function lookupState(zip5) {
  const prefix = parseInt(zip5.slice(0, 3), 10);
  for (const [lo, hi, state] of ZIP3_RANGES) {
    if (prefix >= lo && prefix <= hi) return state;
  }
  return null;
}

function contactLabel(contact, state) {
  const suffix = state && state !== "both-generic" ? ` (${state})` : "";
  if (contact === "house") return `Your House rep${suffix}`;
  if (contact === "senate") return `Your senators${suffix}`;
  return `Your House rep &amp; senators${suffix}`;
}

function appendBillsList(container, state) {
  const list = document.createElement("div");
  BILLS.forEach((bill) => {
    const a = document.createElement("a");
    a.className = "my-bills-summary";
    a.href = `#${bill.id}`;
    a.innerHTML = `
      <div class="mb-top">
        <span class="mb-number">${bill.number}</span>
        <span class="contact-tag ${bill.contact === "both" ? "senate" : bill.contact}">${contactLabel(bill.contact, state)}</span>
      </div>
      <div class="mb-ask">${bill.ask}</div>
      ${bill.leverage ? `<div class="mb-leverage"><strong>Extra leverage:</strong> ${bill.leverage}</div>` : ""}
    `;
    a.addEventListener("click", () => {
      document.getElementById("all-bills").open = true;
    });
    list.appendChild(a);
  });
  container.appendChild(list);
}

function renderMyBills(zip5) {
  const container = document.getElementById("my-bills-content");
  const state = lookupState(zip5);

  if (!state) {
    // The zip is validly formatted (already checked before this is called) but our
    // approximate table doesn't cover this 3-digit prefix — could be a genuinely
    // unused block, or a gap in this table. Don't claim the zip itself is invalid;
    // just say we can't confirm the state, and show all 8 bills anyway since they're
    // federal and apply regardless of state.
    container.innerHTML = `
      <p class="my-bills-state">Zip ${zip5}</p>
      <div class="note-box">
        <strong>Couldn't confirm your state</strong> from this zip with our simple
        lookup table — that's a limitation on our end, not necessarily a problem with
        your zip code. These bills are federal, so they're actionable for you either way.
      </div>
    `;
    appendBillsList(container, "both-generic");
    return;
  }

  if (NO_VOTING_MEMBER.has(state)) {
    container.innerHTML = `
      <p class="my-bills-state">Zip ${zip5} — ${state}</p>
      <div class="note-box">
        <strong>Worth knowing:</strong> ${state} does not have voting representation in
        Congress the way states do — your delegate can still advocate on these bills, but
        doesn't cast a floor vote. Every bill below is still worth contacting them about.
      </div>
    `;
  } else {
    container.innerHTML = `<p class="my-bills-state">Zip ${zip5} — likely ${state}. Here's what's actionable for you:</p>`;
  }

  appendBillsList(container, state);
}

document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("zip-input");
  const button = document.getElementById("zip-submit");

  const submit = () => {
    const zip5 = input.value.trim();
    if (!/^\d{5}$/.test(zip5)) {
      document.getElementById("my-bills-content").innerHTML =
        `<p class="zip-error">Enter a valid 5-digit zip code.</p>`;
      return;
    }
    renderMyBills(zip5);
  };

  button.addEventListener("click", submit);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") submit();
  });
});
