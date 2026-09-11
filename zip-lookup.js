// Bill metadata — used for the copy-message generator. The rich card content
// (subject, stage tracker, ask, sponsors) lives directly in bills.html now,
// shared between the My Bills and Other Bills sections; this file only needs
// enough per-bill data to build a personalized message and to know contact type.
const BILLS = {
  "bill-hr5169": { title: "H.R. 5169, the Retire Through Ownership Act", contact: "house",
    messageAsk: "please press House leadership to schedule a floor vote on H.R. 5169, the Retire Through Ownership Act. It already passed the Senate unanimously and cleared the House Education & Workforce Committee unanimously — it just needs to be scheduled." },
  "bill-s1728": { title: "S. 1728, the Employee Ownership Representation Act", contact: "house",
    messageAsk: "please introduce a House companion bill to S. 1728, the Employee Ownership Representation Act, which already passed the Senate unanimously but has no House counterpart yet." },
  "bill-s1727": { title: "H.R. 9792 / S. 1727, the Employee Ownership Fairness Act", contact: "both",
    messageAskSenate: "please push S. 1727, the Employee Ownership Fairness Act, out of the Senate HELP Committee for a floor vote — it's been stalled there without a vote.",
    messageAskHouse: "please cosponsor H.R. 9792, the House companion to the Employee Ownership Fairness Act." },
  "bill-hr3105": { title: "H.R. 3105 / S. 2461, the Promotion and Expansion of Private Employee Ownership Act", contact: "both",
    messageAsk: "please cosponsor H.R. 3105 / S. 2461, the Promotion and Expansion of Private Employee Ownership Act, and push for committee movement." },
  "bill-aora": { title: "H.R. 3248 / S. 1645, the American Ownership and Resilience Act", contact: "both",
    messageAsk: "please cosponsor H.R. 3248 / S. 1645, the American Ownership and Resilience Act." },
  "bill-s1101": { title: "S. 1101, the SHARE Plan Act", contact: "senate",
    messageAsk: "please cosponsor S. 1101, the SHARE Plan Act." },
  "bill-hr5778": { title: "H.R. 5778, the Improving SBA Engagement on Employee Ownership Act", contact: "house",
    messageAsk: "please press House leadership for a floor vote on H.R. 5778, which already passed the House Small Business Committee unanimously." },
  "bill-hr2993": { title: "H.R. 2993, the ESOP Funding for SBA Position Act", contact: "house",
    messageAsk: "please cosponsor H.R. 2993, the ESOP Funding for SBA Position Act." },
};

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

// Set by renderMyBills after every search (success or fallback) so the
// "Generate Script" buttons — triggered independently, later — know who to
// build a script for without re-running the lookup.
let currentLookup = null;

function lookupStateFallback(zip5) {
  const prefix = parseInt(zip5.slice(0, 3), 10);
  for (const [lo, hi, state] of ZIP3_RANGES) {
    if (prefix >= lo && prefix <= hi) return state;
  }
  return null;
}

// --- Script generation — both a spoken call script and a written email/
// message script, shown directly on the card (not just copyable blind) so
// there's something to actually read before or during the call. ---

function buildCallScript(billId, person, toSenate) {
  const bill = BILLS[billId];
  const ask = toSenate ? (bill.messageAskSenate || bill.messageAsk) : (bill.messageAskHouse || bill.messageAsk);
  return `Hi, my name is [your name] and I'm a constituent calling from [your zip code].

I'm calling to ask ${person.name} to ${ask}

[Add a sentence here about why this matters to you personally.]

Thank you for your time!`;
}

function buildEmailScript(billId, person, toSenate) {
  const bill = BILLS[billId];
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

function scriptBlock(label, text) {
  const details = document.createElement("details");
  details.className = "script-block";
  details.innerHTML = `
    <summary>${label}</summary>
    <p class="script-text">${text.replace(/\n/g, "<br>")}</p>
    <button type="button" class="btn secondary copy-btn">Copy this</button>
  `;
  details.querySelector(".copy-btn").addEventListener("click", (e) => copyToClipboard(text, e.target));
  return details;
}

function personCard(person, billId, toSenate, leverageReason) {
  const card = document.createElement("div");
  card.className = "person-card";
  card.innerHTML = `
    <div class="person-head">
      <span class="person-name">${person.name}</span>
      <span class="person-role">${person.area}${person.party ? " · " + person.party : ""}</span>
      ${leverageReason ? `<span class="person-leverage">&#9733; ${leverageReason}</span>` : ""}
    </div>
    <a class="btn call-btn" href="tel:${(person.phone || "").replace(/[^\d+]/g, "")}">Call ${person.phone || ""}</a>
    ${person.url ? `<a class="contact-page-link" href="${person.url}" target="_blank" rel="noopener">Or use their official contact form &rarr;</a>` : ""}
  `;
  card.appendChild(scriptBlock("&#128222; Call script — read before or during the call", buildCallScript(billId, person, toSenate)));
  card.appendChild(scriptBlock("&#9993; Email / message script — for their contact form", buildEmailScript(billId, person, toSenate)));
  return card;
}

function contactVerb(contact) {
  if (contact === "house") return "Ask your House rep";
  if (contact === "senate") return "Ask your senators";
  return "Ask your House rep &amp; senators";
}

// Populate every .person-cards-slot on the page with real, named contacts.
// leverageByBill (optional): { billId: [{person, reason}, ...] } — for a bill
// with a confirmed leverage match, show ONLY the specific person(s) who hold
// that leverage (e.g. just the senator who's actually on the relevant
// committee, not both senators) and state their role explicitly on the card,
// rather than the generic "everyone this contact-type would normally include."
function populatePersonCards(houseRep, senators, leverageByBill) {
  document.querySelectorAll(".person-cards-slot").forEach((slot) => {
    const billId = slot.dataset.bill;
    const contact = slot.dataset.contact;
    slot.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "person-cards";

    const leveraged = (leverageByBill && leverageByBill[billId]) || null;
    if (leveraged && leveraged.length) {
      leveraged.forEach(({ person, reason }) => {
        wrap.appendChild(personCard(person, billId, person.area === "US Senate", reason));
      });
    } else {
      if ((contact === "house" || contact === "both") && houseRep) {
        wrap.appendChild(personCard(houseRep, billId, false));
      }
      if ((contact === "senate" || contact === "both")) {
        senators.forEach((s) => wrap.appendChild(personCard(s, billId, true)));
      }
    }
    if (!wrap.children.length) {
      wrap.innerHTML = `<p class="zip-error">Couldn't find a matching representative for this bill from the lookup.</p>`;
    }
    slot.appendChild(wrap);
  });
}

// Fallback: no live data, just a state-level (or fully generic) text note per slot.
function populateGenericSlots(state) {
  document.querySelectorAll(".person-cards-slot").forEach((slot) => {
    const contact = slot.dataset.contact;
    const suffix = state && state !== "both-generic" ? ` from ${state}` : "";
    slot.innerHTML = `<p class="zip-generic-note">${contactVerb(contact)}${suffix} about this bill directly — see the ask above.</p>`;
  });
}

// Canonical "Other Bills" order — used to restore cards to their default
// home (and correct order) before reapplying leverage-based moves for a new
// zip search, so nothing gets stuck in My Bills from a previous lookup.
const OTHER_BILLS_ORDER = ["bill-s1728", "bill-s1727", "bill-hr3105", "bill-aora", "bill-s1101", "bill-hr5778", "bill-hr2993"];

function updateCountBadges() {
  const myCount = document.querySelectorAll("#my-bills-content .bill-card").length;
  const otherCount = document.querySelectorAll("#other-bills .all-bills-content .bill-card").length;
  document.getElementById("my-bills-count").textContent = `(${myCount})`;
  document.getElementById("other-bills-count").textContent = `(${otherCount})`;
}

// Move every non-HR5169 card back to Other Bills, in its normal order, and
// clear leverage highlighting — run at the start of every zip search so a
// previous search's moves don't linger when this one finds something different.
function resetBillPlacement() {
  const otherContainer = document.querySelector("#other-bills .all-bills-content");
  OTHER_BILLS_ORDER.forEach((id) => {
    const card = document.getElementById(id);
    if (card) otherContainer.appendChild(card);
  });
  document.querySelectorAll(".bill-card.has-leverage").forEach((el) => el.classList.remove("has-leverage"));
  updateCountBadges();
}

// "Extra Leverage" box at the top of My Bills, AND physically moves any bill
// where a real match was found into My Bills (bordered in orange) — only
// rendered/moved when at least one of the visitor's actual reps/senators
// holds a leadership role or committee seat that specifically matters for
// one of our bills.
function renderLeverageSlot(allReps) {
  const slot = document.getElementById("leverage-slot");
  const hits = [];
  allReps.forEach((person) => {
    (person.leverage || []).forEach((lev) => {
      const bill = BILLS[lev.billId];
      if (bill) hits.push({ person, billId: lev.billId, title: bill.title, reason: lev.reason });
    });
  });
  if (!hits.length) { slot.innerHTML = ""; return {}; }

  // No itemized list here anymore — each moved card below states its own
  // leveraged person and role explicitly (via the ★ badge on the card), so
  // repeating the same names/reasons here would just be duplicate text.
  slot.innerHTML = `
    <div class="leverage-section">
      <h3>&#9733; Extra Leverage</h3>
      <p>One or more of your representatives sit on a committee or hold a leadership role that gives them outsized influence on a specific bill — those bills have been moved into My Bills and bordered in orange below, with the specific person and role called out on the card.</p>
    </div>
  `;

  // Move each matched bill into My Bills, in canonical order, bordered.
  const myBillsContainer = document.getElementById("my-bills-content");
  const matchedIds = [...new Set(hits.map((h) => h.billId))]
    .sort((a, b) => OTHER_BILLS_ORDER.indexOf(a) - OTHER_BILLS_ORDER.indexOf(b));
  matchedIds.forEach((id) => {
    const card = document.getElementById(id);
    if (card) {
      myBillsContainer.appendChild(card);
      card.classList.add("has-leverage");
    }
  });
  updateCountBadges();

  // Build { billId: [{person, reason}] } so populatePersonCards can show only
  // the specific leveraged person(s) on a matched bill's card, not the full
  // generic contact-type list (e.g. just Kaine, not Kaine + Warner, if only
  // Kaine actually sits on the committee that bill needs).
  const leverageByBill = {};
  hits.forEach((h) => {
    (leverageByBill[h.billId] ||= []).push({ person: h.person, reason: h.reason });
  });
  return leverageByBill;
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
  const statusEl = document.getElementById("zip-status");
  statusEl.innerHTML = `<p class="my-bills-state">Looking up ${zip5}&hellip;</p>`;
  resetBillPlacement(); // undo any moves from a previous search before this one runs

  try {
    const data = await fetchLiveReps(zip5);
    const houseRep = data.representatives.find((r) => r.area === "US House") || null;
    const senators = data.representatives.filter((r) => r.area === "US Senate");

    if (!houseRep && senators.length === 0) {
      throw new Error("No federal representatives returned for this zip.");
    }

    statusEl.innerHTML = `
      <p class="my-bills-state">Zip ${zip5}${data.state ? " — " + data.state : ""}</p>
      ${data.lowAccuracy ? `<div class="note-box"><strong>Heads up:</strong> this zip code may span more than one congressional district — we've matched you to the closest one, but double-check your House rep if you're near a district border.</div>` : ""}
    `;
    const leverageByBill = renderLeverageSlot([houseRep, ...senators].filter(Boolean));
    populatePersonCards(houseRep, senators, leverageByBill);
    currentLookup = { live: true, houseRep, senators, leverageByBill };
  } catch (err) {
    const state = lookupStateFallback(zip5);
    if (!state) {
      statusEl.innerHTML = `
        <p class="my-bills-state">Zip ${zip5}</p>
        <div class="note-box"><strong>Couldn't look this up right now</strong> (${err.message}), and our backup table doesn't cover this zip either. These bills are federal and apply to you regardless.</div>
      `;
      document.getElementById("leverage-slot").innerHTML = "";
      populateGenericSlots("both-generic");
      currentLookup = { live: false, state: null };
      return;
    }
    if (NO_VOTING_MEMBER.has(state)) {
      statusEl.innerHTML = `
        <p class="my-bills-state">Zip ${zip5} — ${state}</p>
        <div class="note-box"><strong>Worth knowing:</strong> ${state} does not have voting representation in Congress the way states do — your delegate can still advocate on these bills, but doesn't cast a floor vote.</div>
      `;
    } else {
      statusEl.innerHTML = `
        <p class="my-bills-state">Zip ${zip5} — likely ${state}.</p>
        <div class="note-box">Live representative lookup isn't available right now (${err.message}), so here's the general version.</div>
      `;
    }
    currentLookup = { live: false, state };
    document.getElementById("leverage-slot").innerHTML = "";
    populateGenericSlots(state);
  }
}

// --- "Generate Script" toolbar: one combined script per person, covering
// every checked bill relevant to them — not one script repeated per bill. ---

function getCheckedBillIds() {
  return Array.from(document.querySelectorAll(".bill-select input:checked")).map((cb) => cb.dataset.bill);
}

function updateSelectedCount() {
  const n = getCheckedBillIds().length;
  document.getElementById("selected-count").textContent = `for ${n} selected item${n === 1 ? "" : "s"}`;
}

// Groups checked bills by the specific person(s) relevant to each — reusing
// the same leverage-aware logic as the per-card view (only the actually-
// leveraged person for a matched bill, otherwise the generic contact-type set).
function groupCheckedByPerson(billIds, houseRep, senators, leverageByBill) {
  const groups = new Map(); // key: "name|phone" -> {person, items: [{billId, title, ask, toSenate}]}
  const add = (person, billId, ask, toSenate) => {
    const key = `${person.name}|${person.phone}`;
    if (!groups.has(key)) groups.set(key, { person, items: [] });
    groups.get(key).items.push({ billId, title: BILLS[billId].title, ask, toSenate });
  };

  billIds.forEach((billId) => {
    const bill = BILLS[billId];
    const leveraged = leverageByBill && leverageByBill[billId];
    if (leveraged && leveraged.length) {
      leveraged.forEach(({ person }) => {
        const toSenate = person.area === "US Senate";
        add(person, billId, toSenate ? (bill.messageAskSenate || bill.messageAsk) : (bill.messageAskHouse || bill.messageAsk), toSenate);
      });
    } else {
      if ((bill.contact === "house" || bill.contact === "both") && houseRep) {
        add(houseRep, billId, bill.messageAskHouse || bill.messageAsk, false);
      }
      if (bill.contact === "senate" || bill.contact === "both") {
        senators.forEach((s) => add(s, billId, bill.messageAskSenate || bill.messageAsk, true));
      }
    }
  });
  return groups;
}

function buildCombinedCallScript(person, items) {
  const list = items.map((it) => `- ${it.title}: ${it.ask}`).join("\n");
  return `Hi, my name is [your name] and I'm a constituent calling from [your zip code].

I'm calling about ${items.length > 1 ? "a few things" : "the following"}:
${list}

[Add a sentence here about why this matters to you personally.]

Thank you for your time!`;
}

function buildCombinedEmailScript(person, items) {
  const list = items.map((it) => `- ${it.title}: ${it.ask}`).join("\n");
  return `Dear ${person.name},

I'm a constituent writing about ${items.length > 1 ? "the following" : "this"}:
${list}

[Add a sentence here about why this matters to you personally — a specific, personalized message is far more likely to be read than a form letter.]

Thank you for your time and consideration.`;
}

function combinedPersonCard(person, items, kind) {
  const card = document.createElement("div");
  card.className = "person-card";
  const script = kind === "call" ? buildCombinedCallScript(person, items) : buildCombinedEmailScript(person, items);
  card.innerHTML = `
    <div class="person-head">
      <span class="person-name">${person.name}</span>
      <span class="person-role">${person.area}${person.party ? " · " + person.party : ""}</span>
    </div>
    <a class="btn call-btn" href="tel:${(person.phone || "").replace(/[^\d+]/g, "")}">Call ${person.phone || ""}</a>
    ${person.url ? `<a class="contact-page-link" href="${person.url}" target="_blank" rel="noopener">Or use their official contact form &rarr;</a>` : ""}
    <p class="script-text">${script.replace(/\n/g, "<br>")}</p>
    <button type="button" class="btn secondary copy-btn">Copy this ${kind === "call" ? "call script" : "message"}</button>
  `;
  card.querySelector(".copy-btn").addEventListener("click", (e) => copyToClipboard(script, e.target));
  return card;
}

function generateScript(kind) {
  const output = document.getElementById("script-output");
  const billIds = getCheckedBillIds();

  if (!billIds.length) {
    output.innerHTML = `<p class="zip-error">Check at least one bill below first.</p>`;
    return;
  }
  if (!currentLookup) {
    output.innerHTML = `<p class="zip-error">Enter your zip code above first, so we know who to generate a script for.</p>`;
    return;
  }
  if (!currentLookup.live) {
    output.innerHTML = `<p class="zip-error">Live representative lookup isn't available for your zip right now, so a named, per-person script can't be generated — see the generic ask text on each checked bill's card instead.</p>`;
    return;
  }

  const groups = groupCheckedByPerson(billIds, currentLookup.houseRep, currentLookup.senators, currentLookup.leverageByBill);
  if (!groups.size) {
    output.innerHTML = `<p class="zip-error">Couldn't find a matching representative for the checked bills.</p>`;
    return;
  }

  const wrap = document.createElement("div");
  wrap.className = "person-cards";
  groups.forEach(({ person, items }) => wrap.appendChild(combinedPersonCard(person, items, kind)));
  output.innerHTML = "";
  output.appendChild(wrap);
  output.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("zip-input");
  const button = document.getElementById("zip-submit");

  const submit = () => {
    const zip5 = input.value.trim();
    if (!/^\d{5}$/.test(zip5)) {
      document.getElementById("zip-status").innerHTML = `<p class="zip-error">Enter a valid 5-digit zip code.</p>`;
      return;
    }
    renderMyBills(zip5);
  };

  button.addEventListener("click", submit);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") submit();
  });

  // Per-bill checkboxes: keep the live "for N selected items" count in sync.
  // Delegated on document since checked cards can move between sections.
  document.addEventListener("change", (e) => {
    if (e.target.matches(".bill-select input[type=checkbox]")) {
      updateSelectedCount();
    }
  });

  // Select-all toggles operate on whatever's currently inside that section's
  // container at click time — correct even after leverage-matched bills move.
  document.querySelectorAll(".select-all-cb").forEach((cb) => {
    cb.addEventListener("change", () => {
      const section = cb.dataset.section;
      const containerSelector = section === "my-bills"
        ? "#my-bills-content .bill-select input[type=checkbox]"
        : "#other-bills .all-bills-content .bill-select input[type=checkbox]";
      document.querySelectorAll(containerSelector).forEach((box) => { box.checked = cb.checked; });
      updateSelectedCount();
    });
  });

  document.getElementById("generate-call").addEventListener("click", () => generateScript("call"));
  document.getElementById("generate-email").addEventListener("click", () => generateScript("email"));
});
