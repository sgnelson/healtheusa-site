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
    (r"contact[-_]?(me|us|austin|senator|\w+)$", 2),  # e.g. contact-austin
    (r"/email\b", 2),
    (r"/contact/email", 4),
    (r"email[-_]", 2),
    (r"contact", 1),
]
NEGATIVE_KEYWORDS = [
    "unsubscribe", "newsletter", "press", "media", "flag", "tour",
    "intern", "job", "career", "privacy", "sitemap", "accessibility",
    "office-locations", "offices", "casework", "district-office",
    "town-hall", "event", "subscribe", "location",
]

HREF_RE = re.compile(r'href=["\']([^"\']+)["\']', re.I)


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


def score_href(href, base_url):
    low = href.lower()
    for neg in NEGATIVE_KEYWORDS:
        if neg in low:
            return None  # disqualified
    score = 0
    matched = False
    for pattern, weight in POSITIVE_KEYWORDS:
        if re.search(pattern, low):
            score += weight
            matched = True
    if not matched:
        return None
    # Prefer shorter, more specific-looking paths slightly.
    score -= min(len(href) / 200.0, 1.0)
    return score


def find_candidates(html, base_url):
    hrefs = set(HREF_RE.findall(html))
    scored = []
    for href in hrefs:
        if href.startswith("#") or href.startswith("mailto:") or href.startswith("tel:"):
            continue
        full = urljoin(base_url, href)
        s = score_href(href, base_url)
        if s is not None:
            scored.append((s, full))
    scored.sort(key=lambda x: -x[0])
    # de-dup by url, keep order
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

    if contact_form:
        return (name, typ, hostname, contact_form, "dataset")

    html = curl_get(url)
    if not html:
        return (name, typ, hostname, url, "homepage_fallback")

    candidates = find_candidates(html, url)
    for score, cand_url in candidates[:5]:
        code = curl_status(cand_url)
        if code == "200":
            return (name, typ, hostname, cand_url, "scraped")

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
    with concurrent.futures.ThreadPoolExecutor(max_workers=16) as ex:
        for i, res in enumerate(ex.map(resolve_one, rows)):
            results.append(res)
            print(f"{i+1}/{len(rows)}  {res[4]:18s} {res[0]}", file=sys.stderr)

    with open(out_path, "w") as f:
        for r in results:
            f.write("\t".join(r) + "\n")


if __name__ == "__main__":
    main()
