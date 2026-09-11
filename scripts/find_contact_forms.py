#!/usr/bin/env python3
"""
Finds the real contact-form URL for every current member of Congress, instead
of guessing `${officeUrl}/contact`. Two sources, in priority order:

1. The `contact_form` field in the unitedstates/congress-legislators dataset
   (reliable for ~86/100 senators, almost never present for House members).
2. For everyone else: fetch the office homepage, scan every <a href> for
   contact/email/write-style links, score them by keyword, verify the best
   candidate actually returns 200, and use that.

Anything that still can't be resolved automatically gets flagged as
NEEDS_MANUAL in the output for a human to look up by hand.

Usage:
  python3 scripts/find_contact_forms.py <members_full.tsv> <output.tsv>

members_full.tsv columns: name<TAB>type(rep|sen)<TAB>url<TAB>contact_form
output.tsv columns: name<TAB>type<TAB>hostname<TAB>resolved_url<TAB>method
  method is one of: dataset, scraped, homepage_fallback, NEEDS_MANUAL
"""
import sys
import re
import subprocess
import concurrent.futures
from urllib.parse import urlparse, urljoin

POSITIVE_KEYWORDS = [
    (r"email[-_]?me", 4),
    (r"write[-_]?to", 4),
    (r"share[-_]?your[-_]?opinion", 4),
    (r"get[-_]?in[-_]?touch", 3),
    (r"contact[-_]?form", 3),
    (r"contact[-_]?(me|us|austin|senator|\w+)/?$", 2),  # e.g. contact-austin, contact-us/
    (r"/email\b", 2),
    (r"/contact/email", 4),
    (r"email[-_]", 2),
    (r"contact", 1),
]
# Same weights, checked against the anchor's visible text instead of the
# href — several sites (e.g. Kaine) use wording in the link text that isn't
# reflected in the URL slug at all.
POSITIVE_TEXT_KEYWORDS = [
    (r"\bemail\s*(me|us)?\b", 4),
    (r"write\s*to", 4),
    (r"share\s*your\s*opinion", 4),
    (r"get\s*in\s*touch", 3),
    (r"contact\s*form", 3),
    (r"\bcontact\b", 1),
]
# Disqualifies a candidate outright — checked against BOTH href and visible
# text, since a standardized nav item like "Website Problem" often lives at
# a URL containing nothing but the word "contact" (e.g. /contact/website-
# problem), which would otherwise tie or beat the real "Email Me" link.
NEGATIVE_KEYWORDS = [
    "unsubscribe", "newsletter", "press release", "press", "media", "flag",
    "tour", "intern", "job", "career", "privacy", "sitemap", "accessibility",
    "office location", "office-locations", "offices", "casework",
    "district office", "district-office", "town hall", "town-hall", "event",
    "subscribe", "location", "website problem", "website-problem",
    "web problem", "report a problem", "help with a federal agency",
    "help-federal-agency", "federal agency",
    "wp-content", "wp-includes", ".css", ".js", ".png", ".jpg", ".svg",
    ".woff", ".ico",
]

HREF_RE = re.compile(r'href=["\']([^"\']+)["\']', re.I)
ANCHOR_RE = re.compile(r'<a\s+[^>]*href=["\']([^"\']+)["\'][^>]*>(.*?)</a>', re.I | re.S)
TAG_RE = re.compile(r'<[^>]+>')


def curl_get(url, timeout=12):
    try:
        out = subprocess.run(
            ["curl", "-s", "-L", "--max-time", str(timeout), url],
            capture_output=True, timeout=timeout + 3,
        )
        return out.stdout.decode("utf-8", errors="ignore")
    except Exception:
        return ""


def curl_status(url, timeout=12):
    try:
        out = subprocess.run(
            ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", "-L",
             "--max-time", str(timeout), url],
            capture_output=True, timeout=timeout + 3,
        )
        return out.stdout.decode().strip()
    except Exception:
        return "000"


def score_candidate(href, text, base_url):
    low_href = href.lower()
    low_text = text.lower()
    combined = low_href + " " + low_text
    for neg in NEGATIVE_KEYWORDS:
        if neg in combined:
            return None  # disqualified

    score = 0
    matched = False
    for pattern, weight in POSITIVE_KEYWORDS:
        if re.search(pattern, low_href):
            score += weight
            matched = True
    for pattern, weight in POSITIVE_TEXT_KEYWORDS:
        if re.search(pattern, low_text):
            score += weight
            matched = True
    if not matched:
        return None

    # Mild length penalty based on the URL's path (ignore scheme+host, so an
    # external-domain link like palloneforms.house.gov/contact/ isn't
    # unfairly penalized next to a same-site relative href of similar
    # specificity).
    path = urlparse(urljoin(base_url, href)).path
    score -= min(len(path) / 200.0, 1.0)
    return score


def find_candidates(html, base_url):
    scored = []
    seen_pairs = set()
    for href, inner in ANCHOR_RE.findall(html):
        if href.startswith("#") or href.startswith("mailto:") or href.startswith("tel:"):
            continue
        text = TAG_RE.sub(" ", inner)
        text = re.sub(r"\s+", " ", text).strip()
        key = (href, text)
        if key in seen_pairs:
            continue
        seen_pairs.add(key)
        s = score_candidate(href, text, base_url)
        if s is not None:
            scored.append((s, urljoin(base_url, href)))

    scored.sort(key=lambda x: -x[0])
    # de-dup by resolved url, keep highest-scored occurrence
    seen = set()
    out = []
    for s, url in scored:
        if url not in seen:
            seen.add(url)
            out.append((s, url))
    return out


def resolve_one(row):
    name, typ, url, contact_form = row
    if not url:
        return (name, typ, "", "", "NEEDS_MANUAL")
    hostname = urlparse(url).hostname or ""

    html = curl_get(url)
    candidates = find_candidates(html, url) if html else []

    # The dataset's own contact_form field is authoritative-ish but often
    # just points at the generic hub page, not the actual form (e.g. Kaine:
    # dataset says /contact, but the site's own nav already links to the
    # more specific /contact/share-your-opinion). Treat it as one candidate
    # among the scraped ones, with a moderate bonus, rather than an
    # automatic override — best-scoring verified candidate wins.
    if contact_form:
        candidates.append((3.5, contact_form))
        candidates.sort(key=lambda x: -x[0])

    if not candidates:
        if not html:
            return (name, typ, hostname, url, "homepage_fallback")
        return (name, typ, hostname, url, "NEEDS_MANUAL")

    for score, cand_url in candidates[:6]:
        code = curl_status(cand_url)
        if code == "200":
            method = "dataset" if cand_url == contact_form else "scraped"
            return (name, typ, hostname, cand_url, method)

    return (name, typ, hostname, url, "NEEDS_MANUAL")


def main():
    in_path, out_path = sys.argv[1], sys.argv[2]
    rows = []
    with open(in_path) as f:
        for line in f:
            parts = line.rstrip("\n").split("\t")
            while len(parts) < 4:
                parts.append("")
            rows.append(tuple(parts[:4]))

    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
        for i, res in enumerate(ex.map(resolve_one, rows)):
            results.append(res)
            print(f"{i+1}/{len(rows)}  {res[4]:18s} {res[0]}", file=sys.stderr)

    with open(out_path, "w") as f:
        for r in results:
            f.write("\t".join(r) + "\n")


if __name__ == "__main__":
    main()
