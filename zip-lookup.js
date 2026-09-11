// Bill metadata for "My Bills" and the personalized message generator.
// contact: "house" | "senate" | "both" — who to reach for this bill.
// messageAsk: second-person imperative, written to drop directly into a message body.
// leverage: set only when a SPECIFIC committee or leadership role has outsized power over
// this bill's next step. We can't automatically verify whether a given rep/senator holds
// that role (5 Calls doesn't return committee assignments, and hand-maintaining a full
// committee roster risks going stale/wrong) — this flags that it's worth checking yourself.
const BILLS = [
  { id: "bill-hr5169", title: "H.R. 5169, the Retire Through Ownership Act", number: "S. 2403 / H.R. 5169", contact: "house",
    ask: "Ask your House rep to press leadership for a floor vote.",
    messageAsk: "please press House leadership to schedule a floor vote on H.R. 5169, the Retire Through Ownership Act. It already passed the Senate unanimously and cleared the House Education & Workforce Committee unanimously — it just needs to be scheduled.",
    leverage: "Already cleared committee. The people who actually control what happens next are House leadership (Speaker's office, Majority Leader, Rules Committee chair) — if your rep holds one of those roles, their voice counts far more than an average member's." },
  { id: "bill-s1728", title: "S. 1728, the Employee Ownership Representation Act", number: "S. 1728", contact: "house",
    ask: "Ask your House rep to introduce a companion bill — none exists yet.",
    messageAsk: "please introduce a House companion bill to S. 1728, the Employee Ownership Representation Act, which already passed the Senate unanimously but has no House counterpart yet.",
    leverage: "A member of the House Education & Workforce Committee is the natural person to introduce this — if that's your rep, say so explicitly." },
  { id: "bill-s1727", title: "H.R. 9792 / S. 1727, the Employee Ownership Fairness Act", number: "S. 1727 / H.R. 9792", contact: "both",
    ask: "Ask your senator to push it out of committee; ask your House rep to cosponsor H.R. 9792.",
    messageAskSenate: "please push S. 1727, the Employee Ownership Fairness Act, out of the Senate HELP Committee for a floor vote — it's been stalled there without a vote.",
    messageAskHouse: "please cosponsor H.R. 9792, the House companion to the Employee Ownership Fairness Act." },
  { id: "bill-hr3105", title: "H.R. 3105 / S. 2461, the Promotion and Expansion of Private Employee Ownership Act", number: "H.R. 3105 / S. 2461", contact: "both",
    ask: "Ask your senator and House rep to cosponsor and push for committee movement.",
    messageAsk: "please cosponsor H.R. 3105 / S. 2461, the Promotion and Expansion of Private Employee Ownership Act, and push for committee movement.",
    leverage: "This is a tax bill sitting in House Ways & Means and Senate Finance. Members of those two committees control whether it even gets a markup — that's far more leverage than a cosponsorship from outside them." },
  { id: "bill-aora", title: "H.R. 3248 / S. 1645, the American Ownership and Resilience Act", number: "H.R. 3248 / S. 1645", contact: "both",
    ask: "Ask your senator and House rep to cosponsor.",
    messageAsk: "please cosponsor H.R. 3248 / S. 1645, the American Ownership and Resilience Act." },
  { id: "bill-s1101", title: "S. 1101, the SHARE Plan Act", number: "S. 1101", contact: "senate",
    ask: "Ask your senator to cosponsor.",
    messageAsk: "please cosponsor S. 1101, the SHARE Plan Act." },
  { id: "bill-hr5778", title: "H.R. 5778, the Improving SBA Engagement on Employee Ownership Act", number: "H.R. 5778", contact: "house",
    ask: "Ask your House rep to press for a floor vote.",
    messageAsk: "please press House leadership for a floor vote on H.R. 5778, which already passed the House Small Business Committee unanimously.",
    leverage: "Already cleared the House Small Business Committee — like H.R. 5169, this now needs House leadership specifically, not another committee member." },
  { id: "bill-hr2993", title: "H.R. 2993, the ESOP Funding for SBA Position Act", number: "H.R. 2993", contact: "house",
    ask: "Ask your House rep to cosponsor.",
    messageAsk: "please cosponsor H.R. 2993, the ESOP Funding for SBA Position Act." },
];

// --- Fallback: approximate 3-digit ZIP prefix -> state, used only if the live
// lookup (below) fails or hasn't been configured with an API token yet. ---
const ZIP3_RANGES = [
  [0, 5, null], [6, 9, "Puerto Rico"],
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
const NO_VOTING_MEMBER = new Set(["District of Columbia", "Puerto Rico", "Guam / Northern Mariana Islands / American Samoa"]);

function lookupStateFallback(zip5) {
  const prefix = parseInt(zip5.slice(0, 3), 10);
  for (const [lo, hi, state] of ZIP3_RANGES) {
    if (prefix >= lo && prefix <= hi) return state;
  }
  return null;
}

// --- Draft message generation ---

function buildMessage(bill, person, toSenate) {
  const ask = toSenate ? (bill.messageAskSenate || bill.messageAsk) : (bill.messageAskHouse || bill.messageAsk);
  return `Dear ${person.name},

I'm a constituent writing about ${bill.title}. As my representative, ${ask}

[Add a sentence here about why this matters to you personally — a specific, personalized message is far more likely to be read than a form letter.]

Thank you for your time and consideration.`;
}

function copyToClipboard(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const original = btn.textContent;
    btn.textContent = "Copied!";
    setTimeout(() => { btn.textContent = original; }, 1800);
  }).catch(() => {
    btn.textContent = "Couldn't copy — select the text manually";
  });
}

function personCard(person, bill, toSenate) {
  const card = document.createElement("div");
  card.className = "person-card";
  const message = buildMessage(bill, person, toSenate);
  card.innerHTML = `
    <div class="person-head">
      <span class="person-name">${person.name}</span>
      <span class="person-role">${person.area}${person.party ? " · " + person.party : ""}</span>
    </div>
    <a class="btn call-btn" href="tel:${(person.phone || "").replace(/[^\d+]/g, "")}">Call ${person.phone || ""}</a>
    <button type="button" class="btn secondary copy-btn">Copy a message to personalize</button>
    ${person.url ? `<a class="contact-page-link" href="${person.url}" target="_blank" rel="noopener">Or use their official contact form &rarr;</a>` : ""}
  `;
  card.querySelector(".copy-btn").addEventListener("click", (e) => copyToClipboard(message, e.target));
  return card;
}

function contactLabel(contact, state) {
  const suffix = state && state !== "both-generic" ? ` (${state})` : "";
  if (contact === "house") return `Your House rep${suffix}`;
  if (contact === "senate") return `Your senators${suffix}`;
  return `Your House rep &amp; senators${suffix}`;
}

// Generic (no live rep data) summary — used for the fallback path.
function appendGenericBillsList(container, state) {
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
    a.addEventListener("click", () => { document.getElementById("all-bills").open = true; });
    list.appendChild(a);
  });
  container.appendChild(list);
}

// Builds the "Extra Leverage" callout that sits above the bill list — only
// rendered when at least one of the visitor's actual reps/senators holds a
// leadership role or committee seat that specifically matters for one of our
// bills. Real, matched leverage, not the generic "if your rep happens to be
// on this committee" hint the fallback path uses.
function buildLeverageSection(allReps) {
  const hits = [];
  allReps.forEach((person) => {
    (person.leverage || []).forEach((lev) => {
      const bill = BILLS.find((b) => b.id === lev.billId);
      if (bill) hits.push({ person, bill, reason: lev.reason });
    });
  });
  if (!hits.length) return "";

  const items = hits.map((h) => `
    <li>
      <strong>${h.person.name}</strong> (your ${h.person.area === "US Senate" ? "senator" : "House rep"}) is <strong>${h.reason}</strong> —
      that's direct influence over <a href="#${h.bill.id}">${h.bill.number}</a>.
    </li>
  `).join("");

  return `
    <div class="leverage-section">
      <h3>⭐ Extra Leverage</h3>
      <p>One or more of your representatives sit on a committee or hold a leadership role that gives them outsized influence on specific bills below — worth mentioning explicitly when you contact them.</p>
      <ul>${items}</ul>
    </div>
  `;
}

// Full personalized version — used when the live lookup succeeds.
function appendPersonalizedBillsList(container, houseRep, senators) {
  const allReps = [houseRep, ...senators].filter(Boolean);
  // Insert before .mb-list specifically, not at the end of the container —
  // this needs to appear at the TOP of My Bills, above the per-bill list.
  container.querySelector(".mb-list").insertAdjacentHTML("beforebegin", buildLeverageSection(allReps));

  BILLS.forEach((bill) => {
    const block = document.createElement("div");
    block.className = "my-bills-summary personalized";

    // Prefer a real, matched leverage reason over the generic static hint.
    const realLeverage = allReps
      .map((p) => (p.leverage || []).find((l) => l.billId === bill.id))
      .find(Boolean);
    const leverageHtml = realLeverage
      ? `<div class="mb-leverage matched"><strong>&#9733; Confirmed leverage:</strong> see above — one of your reps holds real influence here.</div>`
      : (bill.leverage ? `<div class="mb-leverage"><strong>Extra leverage:</strong> ${bill.leverage}</div>` : "");

    block.innerHTML = `
      <div class="mb-top">
        <a href="#${bill.id}" class="mb-number">${bill.number}</a>
        <span class="contact-tag ${bill.contact === "both" ? "senate" : bill.contact}">${contactLabel(bill.contact, null)}</span>
      </div>
      <div class="mb-ask">${bill.ask}</div>
      ${leverageHtml}
    `;
    const people = document.createElement("div");
    people.className = "person-cards";
    if ((bill.contact === "house" || bill.contact === "both") && houseRep) {
      people.appendChild(personCard(houseRep, bill, false));
    }
    if ((bill.contact === "senate" || bill.contact === "both")) {
      senators.forEach((s) => people.appendChild(personCard(s, bill, true)));
    }
    if (!people.children.length) {
      people.innerHTML = `<p class="zip-error">Couldn't find a matching representative for this bill from the lookup — try the "All Bills" section below for the generic contact info.</p>`;
    }
    block.appendChild(people);
    container.querySelector(".mb-list").appendChild(block);
  });
}

async function fetchLiveReps(zip5) {
  const res = await fetch(`/api/reps?zip=${zip5}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Lookup failed (${res.status})`);
  }
  return res.json();
}

async function renderMyBills(zip5) {
  const container = document.getElementById("my-bills-content");
  container.innerHTML = `<p class="my-bills-state">Looking up ${zip5}&hellip;</p>`;

  try {
    const data = await fetchLiveReps(zip5);
    const houseRep = data.representatives.find((r) => r.area === "US House") || null;
    const senators = data.representatives.filter((r) => r.area === "US Senate");

    if (!houseRep && senators.length === 0) {
      throw new Error("No federal representatives returned for this zip.");
    }

    container.innerHTML = `
      <p class="my-bills-state">Zip ${zip5}${data.state ? " — " + data.state : ""}</p>
      ${data.lowAccuracy ? `<div class="note-box"><strong>Heads up:</strong> this zip code may span more than one congressional district — we've matched you to the closest one, but double-check your House rep if you're near a district border.</div>` : ""}
      <div class="mb-list"></div>
    `;
    appendPersonalizedBillsList(container, houseRep, senators);
  } catch (err) {
    // Live lookup unavailable (no token configured yet, rate-limited, network error, etc).
    // Fall back to the approximate state-level table rather than showing nothing.
    const state = lookupStateFallback(zip5);
    if (!state) {
      container.innerHTML = `
        <p class="my-bills-state">Zip ${zip5}</p>
        <div class="note-box"><strong>Couldn't look this up right now</strong> (${err.message}), and our backup table doesn't cover this zip either. These bills are federal and apply to you regardless — see "All Bills" below.</div>
      `;
      appendGenericBillsList(container, "both-generic");
      return;
    }
    if (NO_VOTING_MEMBER.has(state)) {
      container.innerHTML = `
        <p class="my-bills-state">Zip ${zip5} — ${state}</p>
        <div class="note-box"><strong>Worth knowing:</strong> ${state} does not have voting representation in Congress the way states do — your delegate can still advocate on these bills, but doesn't cast a floor vote.</div>
      `;
    } else {
      container.innerHTML = `
        <p class="my-bills-state">Zip ${zip5} — likely ${state}.</p>
        <div class="note-box">Live representative lookup isn't available right now (${err.message}), so here's the general version — contact your House rep and senators from ${state}.</div>
      `;
    }
    appendGenericBillsList(container, state);
  }
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
