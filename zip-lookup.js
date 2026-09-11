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

function copyToClipboard(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const original = btn.textContent;
    btn.textContent = "Copied!";
    setTimeout(() => { btn.textContent = original; }, 1800);
  }).catch(() => {
    btn.textContent = "Couldn't copy — select the text manually";
  });
}

// Renders script text with the [bracketed placeholder] visually flagged in
// red in the ON-PAGE PREVIEW only — this is a genuine limitation, not an
// oversight: clipboard copies are plain text, so there's no way to carry
// color into the actual message once it's pasted elsewhere. The red here is
// purely to catch it before copying or submitting.
function highlightPlaceholder(text) {
  const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return escaped
    .replace(/\n/g, "<br>")
    .replace(/(\[[^\]]*\])/g, '<span class="script-placeholder">$1</span>');
}

// Note: per-bill-card contact display (individual person cards, call/form
// scripts on each card) was removed — all script generation now happens once,
// at the top, via the Generate Call/Contact Form Script toolbar, combining
// whichever bills are checked into one script per person instead of
// repeating per bill.
//
// There's no email option at all — 5 Calls doesn't provide a verified email
// address for any office, and most congressional offices deliberately route
// constituent correspondence through their web contact form specifically
// (verification, spam control, and a mail-security protocol dating to the
// 2001 anthrax letters) rather than a monitored inbox, so a guessed address
// would likely just go unread even if syntactically valid.

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
  document.querySelectorAll(".card-leverage-note").forEach((el) => el.remove());
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

  // Short header only — the actual "why" now lives inside each bordered
  // card itself (see below), not duplicated in a list up here.
  slot.innerHTML = `
    <div class="leverage-section">
      <h3>&#9733; Extra Leverage</h3>
      <p>One or more of your representatives sit on a committee or hold a leadership role that gives them outsized influence on a specific bill — those bills have been moved into My Bills and bordered in orange below, with the reason stated on the card.</p>
    </div>
  `;

  // Group hits by bill so each card gets exactly the reason(s) that apply to it.
  const hitsByBill = new Map();
  hits.forEach((h) => {
    if (!hitsByBill.has(h.billId)) hitsByBill.set(h.billId, []);
    hitsByBill.get(h.billId).push(h);
  });

  // Move each matched bill into My Bills, in canonical order, bordered, with
  // the reason spelled out directly on the card.
  const myBillsContainer = document.getElementById("my-bills-content");
  const matchedIds = [...new Set(hits.map((h) => h.billId))]
    .sort((a, b) => OTHER_BILLS_ORDER.indexOf(a) - OTHER_BILLS_ORDER.indexOf(b));
  matchedIds.forEach((id) => {
    const card = document.getElementById(id);
    if (!card) return;
    myBillsContainer.appendChild(card);
    card.classList.add("has-leverage");

    const note = document.createElement("div");
    note.className = "card-leverage-note";
    note.innerHTML = hitsByBill.get(id).map((h) => `
      <p>&#9733; <strong>${h.person.name}</strong> (your ${h.person.area === "US Senate" ? "senator" : "House rep"}) sits ${naturalRolePhrase(h.reason)} — direct influence here.</p>
    `).join("");
    card.appendChild(note);
  });
  updateCountBadges();

  // Build { billId: [{person, reason}] } — consumed by groupCheckedByPerson
  // below so the Generate Script toolbar shows only the specific leveraged
  // person for a matched bill (e.g. just Kaine, not Kaine + Warner, if only
  // Kaine actually sits on the committee that bill needs), and can border
  // their combined card orange too.
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
    currentLookup = { live: true, houseRep, senators, leverageByBill };
  } catch (err) {
    const state = lookupStateFallback(zip5);
    if (!state) {
      statusEl.innerHTML = `
        <p class="my-bills-state">Zip ${zip5}</p>
        <div class="note-box"><strong>Couldn't look this up right now</strong> (${err.message}), and our backup table doesn't cover this zip either. These bills are federal and apply to you regardless.</div>
      `;
      document.getElementById("leverage-slot").innerHTML = "";
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

  // Any change to which bills are checked invalidates whatever script is
  // currently shown — clear it and un-highlight both buttons so it's obvious
  // a fresh Generate click is needed rather than looking at a stale result.
  document.getElementById("script-output").innerHTML = "";
  document.getElementById("generate-call").classList.remove("active");
  document.getElementById("generate-contact").classList.remove("active");
}

// Groups checked bills by the specific person(s) relevant to each — reusing
// the same leverage-aware logic as the per-card view (only the actually-
// leveraged person for a matched bill, otherwise the generic contact-type
// set) — and tracks *why* (leverageReasons) so the combined card can be
// bordered orange and state the role explicitly, same as the individual
// bill-card treatment.
// Turns a raw reason string like "Member, Senate Finance" into a natural
// sentence fragment: "as a Member of the Senate Finance Committee".
function naturalRolePhrase(reason) {
  const [title, committee] = reason.split(", ");
  if (!committee) return `as ${reason}`;
  const article = /^(member)$/i.test(title) ? "a " : "";
  return `as ${article}${title} of the ${committee} Committee`;
}

function groupCheckedByPerson(billIds, houseRep, senators, leverageByBill) {
  const groups = new Map(); // key: "name|phone" -> {person, items: [], leverageReasons: Set}
  const add = (person, billId, ask, toSenate, leverageReason) => {
    const key = `${person.name}|${person.phone}`;
    if (!groups.has(key)) groups.set(key, { person, items: [], leverageReasons: new Set() });
    const g = groups.get(key);
    g.items.push({ billId, title: BILLS[billId].title, ask, toSenate });
    if (leverageReason) g.leverageReasons.add(leverageReason);
  };

  billIds.forEach((billId) => {
    const bill = BILLS[billId];
    const leveraged = leverageByBill && leverageByBill[billId];
    if (leveraged && leveraged.length) {
      leveraged.forEach(({ person, reason }) => {
        const toSenate = person.area === "US Senate";
        const baseAsk = toSenate ? (bill.messageAskSenate || bill.messageAsk) : (bill.messageAskHouse || bill.messageAsk);
        // Name the actual committee, not just generic "committee" — the base
        // ask text alone (e.g. "...push for committee movement") doesn't say
        // which one, but we know exactly which one gave them this leverage.
        const leverageAsk = `${baseAsk} You sit ${naturalRolePhrase(reason)}, which gives you direct influence here.`;
        add(person, billId, leverageAsk, toSenate, reason);
      });
    } else {
      if ((bill.contact === "house" || bill.contact === "both") && houseRep) {
        add(houseRep, billId, bill.messageAskHouse || bill.messageAsk, false, null);
      }
      if (bill.contact === "senate" || bill.contact === "both") {
        senators.forEach((s) => add(s, billId, bill.messageAskSenate || bill.messageAsk, true, null));
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

[Optional: add a sentence about why wealth disparity matters to you personally.]

Thank you for your time!`;
}

function buildCombinedFormScript(person, items) {
  const list = items.map((it) => `- ${it.title}: ${it.ask}`).join("\n");
  return `Dear ${person.name},

I'm a constituent writing about ${items.length > 1 ? "the following" : "this"}:
${list}

[Optional: add a sentence about why wealth disparity matters to you personally — a specific, personalized message is far more likely to be read than a form letter.]

Thank you for your time and consideration.`;
}

function combinedPersonCard(person, items, kind, leverageReasons) {
  const card = document.createElement("div");
  const hasLeverage = leverageReasons && leverageReasons.size > 0;
  card.className = "person-card" + (hasLeverage ? " has-leverage" : "");
  const script = kind === "call" ? buildCombinedCallScript(person, items) : buildCombinedFormScript(person, items);
  const telHref = `tel:${(person.phone || "").replace(/[^\d+]/g, "")}`;

  // Resolved server-side (src/contact-overrides.js): `${url}/contact` by
  // default (verified working for 518/536 offices), with manual overrides
  // for the offices where that pattern 404s/403s.
  const contactHref = person.contactUrl || null;

  // Primary action matches which script was generated — a call script leads
  // with Call, a contact-form script leads with their contact page (we have
  // no verified individual email address for any office to send to instead).
  const primaryAction = kind === "call" || !contactHref
    ? `<a class="btn call-btn" href="${telHref}">Call ${person.phone || ""}</a>`
    : `<a class="btn call-btn" href="${contactHref}" target="_blank" rel="noopener">Open their contact form</a>`;
  const secondaryAction = kind === "call" || !contactHref
    ? (contactHref ? `<a class="contact-page-link" href="${contactHref}" target="_blank" rel="noopener">Or use their official contact form &rarr;</a>` : "")
    : `<a class="contact-page-link" href="${telHref}">Or call ${person.phone || ""} &rarr;</a>`;

  card.innerHTML = `
    <div class="person-head">
      <span class="person-name">${person.name}</span>
      <span class="person-role">${person.area}${person.party ? " · " + person.party : ""}</span>
      ${hasLeverage ? `<span class="person-leverage">&#9733; ${[...leverageReasons].join("; ")}</span>` : ""}
    </div>
    ${primaryAction}
    ${secondaryAction}
    <p class="script-text">${highlightPlaceholder(script)}</p>
    <button type="button" class="btn secondary copy-btn">Copy this ${kind === "call" ? "call script" : "message"}</button>
  `;
  card.querySelector(".copy-btn").addEventListener("click", (e) => copyToClipboard(script, e.target));
  return card;
}

function generateScript(kind) {
  const output = document.getElementById("script-output");
  const billIds = getCheckedBillIds();

  // Mark whichever button was clicked as active (white-on-navy), clear the other.
  document.getElementById("generate-call").classList.toggle("active", kind === "call");
  document.getElementById("generate-contact").classList.toggle("active", kind === "form");

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
  groups.forEach(({ person, items, leverageReasons }) => wrap.appendChild(combinedPersonCard(person, items, kind, leverageReasons)));
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
  document.getElementById("generate-contact").addEventListener("click", () => generateScript("form"));
});
