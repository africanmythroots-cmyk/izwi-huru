# Izwi Huru — Pre-Launch Hardening Checklist

*Phase 12 — Run this in full before any public launch.*
*Self-review loop §8 embedded throughout.*

---

## Part A — Security Hardening

### A1. Account Enumeration Prevention

Test that the login endpoint does not reveal whether a handle exists:

```bash
# Both responses must take the same time and return the same error message
curl -s -X POST https://izwihuru.org/auth/login \
  -H "Content-Type: application/json" \
  -d '{"handle":"nonexistent_user_xyz","passphrase":"wrongpassphrase"}'

curl -s -X POST https://izwihuru.org/auth/login \
  -H "Content-Type: application/json" \
  -d '{"handle":"real_existing_user","passphrase":"wrongpassphrase"}'

# Both must return: {"error":"Invalid handle or passphrase"}
# Response times must be within ~100ms of each other (bcrypt fake work)
```

**Status**: [ ] Pass | [ ] Fail | [ ] Unsure

---

### A2. Session Token Security

```bash
# Verify token hash is stored, not raw token
# Connect to DB and confirm:
psql $DATABASE_URL -c "SELECT token_hash FROM sessions LIMIT 3;"
# token_hash must be 64-char hex (SHA-256), not a JWT or readable token

# Confirm sessions expire
psql $DATABASE_URL -c "SELECT COUNT(*) FROM sessions WHERE expires_at < NOW();"
# Should be 0 (cleanup cron running)
```

**Status**: [ ] Pass | [ ] Fail | [ ] Unsure

---

### A3. No IP Address in Any Log

```bash
# Check application logs for any IP addresses
grep -rE '\b([0-9]{1,3}\.){3}[0-9]{1,3}\b' /var/log/izwihuru/ 2>/dev/null
# Expected: no output

# Check PostgreSQL logs (must not log query params)
grep "password\|token\|ip\|address" /var/log/postgresql/*.log 2>/dev/null
# Expected: no sensitive params logged

# Verify nginx is not logging IPs in app access log
# (nginx access log is fine for reverse-proxy ops, but must not be forwarded to app)
grep "X-Real-IP\|X-Forwarded-For" /etc/nginx/sites-available/izwihuru
# Must show: proxy_set_header X-Forwarded-For "";
#            proxy_set_header X-Real-IP "";
```

**Status**: [ ] Pass | [ ] Fail | [ ] Unsure

---

### A4. Post Body Encryption Verification

```bash
# Confirm bodies are encrypted at rest — raw bytes, not plaintext
psql $DATABASE_URL -c "SELECT encode(body_encrypted, 'hex') FROM posts LIMIT 1;"
# Output must be opaque hex — NOT the post text

# Test round-trip (development only):
node -e "
const { encryptBody, decryptBody } = await import('./src/crypto.js');
const plain = 'Test post body';
const enc = encryptBody(plain);
const dec = decryptBody(enc);
console.assert(dec === plain, 'Decrypt mismatch!');
console.log('Encryption round-trip: OK');
"
```

**Status**: [ ] Pass | [ ] Fail | [ ] Unsure

---

### A5. Content Security Policy Headers

```bash
curl -sI https://izwihuru.org/ | grep -i "content-security-policy\|x-frame-options\|x-content-type"
# Must include:
# content-security-policy: default-src 'self'; script-src 'self'; ...
# x-frame-options: DENY (or CSP frame-ancestors: 'none')
# x-content-type-options: nosniff
```

**Status**: [ ] Pass | [ ] Fail | [ ] Unsure

---

## Part B — Tor & Privacy Verification

### B1. Full Registration Flow via Tor Browser

Using Tor Browser (not just curl):

1. Navigate to `http://[ONION_ADDRESS].onion/register`
2. Complete registration: pick handle, passphrase, solve PoW CAPTCHA
3. Write down recovery mnemonic — verify it is 12 words
4. Log in with the new handle
5. Post a reply to an existing thread
6. Log out

**Expected**: All steps complete without JavaScript errors, without IP-based blocks, without requiring Tor Browser to change security level.

**Status**: [ ] Pass | [ ] Fail | [ ] Unsure

---

### B2. Onion-Location Header

```bash
curl -sI https://izwihuru.org/ | grep -i "onion-location"
# Must return: Onion-Location: http://[ONION_ADDRESS].onion/
```

**Status**: [ ] Pass | [ ] Fail | [ ] Unsure

---

### B3. Mirror Domain Reachability

```bash
for domain in izwihuru.org izwi-huru.net izwihuru.io; do
  status=$(curl -s -o /dev/null -w "%{http_code}" "https://$domain/health")
  echo "$domain: $status"
done
# All must return: 200
```

**Status**: [ ] Pass | [ ] Fail | [ ] Unsure

---

## Part C — Adversarial Scenario Review

### C1. Hostile Government Tries to Enumerate Users

**Scenario**: A government sends a data-disclosure request for "all users from [Country]".

**Defence**:
- We store no country information linked to users
- We store no IP addresses → no geolocation possible
- Only handle + passphrase_hash in `users` table
- Response: "We have no data responsive to this request"

**Test**: Confirm `users` table has no `country`, `ip`, `email`, or `phone` column:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'users';
-- Must NOT include: country, ip_address, email, phone, device_id, location
```

**Status**: [ ] Pass | [ ] Fail | [ ] Unsure

---

### C2. Coordinated Brigading of a Space

**Scenario**: 50 coordinated accounts rapidly upvote one post and downvote legitimate posts in a space.

**Defence**:
- New accounts have reputation 1.0 (minimal trending influence)
- Trust-weighted trending means 50 × 1.0 weight votes = weak signal vs. established community
- The PoW CAPTCHA slows mass account creation
- Local moderators can escalate suspicious patterns to the panel

**Test**: Manually verify the trending score formula gives < 10% weight to accounts with reputation ≤ 1.0 vs. established accounts with reputation 3.0+.

**Status**: [ ] Pass | [ ] Fail | [ ] Unsure

---

### C3. Moderator Impersonation

**Scenario**: A malicious actor claims to be a moderator in threads, or attempts to access `/mod/` endpoints.

**Defence**:
- Moderator role is enforced at the API layer (`isModerator()` DB check)
- No moderator identity is displayed publicly (panel members' handles not exposed)
- The mod dashboard (`/mod/`) returns 403 for non-mods and redirects to `/feed`

**Test**:
```bash
curl -X GET https://izwihuru.org/mod/queue \
  -H "Cookie: session=fake_session_token"
# Must return 401 or redirect to /feed — never mod data
```

**Status**: [ ] Pass | [ ] Fail | [ ] Unsure

---

### C4. Mass False-Flagging to Suppress a Post

**Scenario**: 100 accounts mass-flag a legitimate political post to silence it.

**Defence**:
- 5 flags → `pending_review` (not removed)
- Only a moderator can act on flagged posts
- Moderator must cite a Charter clause (§3.x) — can't cite §3 for political speech
- Dismissed flags are logged → flag abuse pattern detectable in transparency events
- Panel oversight means local mod cannot be the sole decision-maker

**Test**: Verify that even with 100 flags, visibility becomes `pending_review` not `removed`:
```sql
SELECT visibility FROM posts WHERE id = '[test_post_id]';
-- Must be 'pending_review', never 'removed' without a mod_action row
```

**Status**: [ ] Pass | [ ] Fail | [ ] Unsure

---

### C5. Coordinated Disinformation / Impersonation of Real People

**Scenario**: Multiple accounts claim to be well-known journalists or activists, spreading false statements attributed to them.

**Defence**:
- Handles are pseudonymous — the platform never verifies real-world identity
- Charter §3.7 prohibits coordinated inauthenticity (impersonation + false attribution)
- Moderators can act on this with Charter clause citation
- Transparency reports show how many §3.7 actions were taken

**Status**: [ ] Mitigation documented | [ ] Needs enforcement test

---

## Part D — Legal & Infrastructure Review

### D1. Hosting Contract Review

- [ ] Contract explicitly states: no log retention of user IPs
- [ ] Contract explicitly states: no automated compliance with government requests without notifying Izwi Huru first
- [ ] Server is physically located in Iceland (not just billed in Iceland)
- [ ] Reviewed by a digital-rights lawyer

### D2. Swiss Nonprofit Entity

- [ ] Swiss Verein (association) registered
- [ ] Articles of association include the Charter by reference
- [ ] No individual founding member has unilateral editorial control

### D3. Data Retention Confirmation

- [ ] Confirm `sessions` cleanup cron is running
- [ ] Confirm no nginx access log retention beyond 24h for operational purposes
- [ ] Confirm PostgreSQL does not log query parameters in production
- [ ] Confirm Restic backups exclude `/var/log/` directories

---

## Part E — Charter External Review

- [ ] Draft of CHARTER.md sent to **Access Now** (https://www.accessnow.org) for review
- [ ] Draft of CHARTER.md sent to **Article 19** (https://www.article19.org) for review
- [ ] At least one organisation has provided written non-objection or endorsement
- [ ] Endorsement (or "reviewed by") noted in Charter preamble

---

## Part F — APK Size Verification

```bash
# Build the release APK
cd mobile && npx eas build --platform android --profile production --local

# Check APK size (must be < 15 MB for sideload APK)
ls -lh *.apk
# Also verify with aapt:
aapt dump badging *.apk | grep "package:\|sdkVersion"

# Check AAB size (Play Store — Google applies splits, final download ~8-12 MB)
ls -lh *.aab
```

**Target**: Sideload APK < 15 MB | Play Store download < 12 MB

**Status**: [ ] Pass | [ ] Fail | [ ] Unsure

---

## Part G — Final Pre-Release Checklist (§8 of Review Loop)

- [ ] **Charter published in full** at `/charter`, on all mirrors, on onion address
- [ ] **Charter in plain language** — no legal jargon in the prohibited/protected sections
- [ ] **Charter reviewed by external digital-rights org** (Part E above)
- [ ] **Takedown-request policy public** before first request can arrive (`/transparency`)
- [ ] **Legal/infrastructure review confirmed** (Part D above)
- [ ] **Adversarial review done** (Part C above — all scenarios documented)
- [ ] **Every open item has an owner** — create GitHub issues (on Forgejo) for anything not green
- [ ] **PGP key published** at `/pgp-key.asc` and on keys.openpgp.org
- [ ] **Transparency report structure tested** — run `triggerReportNow('TEST-Q1')` and verify output

---

## Signing Off

When all items above are checked:

1. Move the platform from `beta` to `public` in the settings
2. Publish the inaugural transparency report (even if it shows zeros — the
   structure and commitment matter)
3. Announce via the Charter page and the platform's own feed

> *"The loop is the point."*
