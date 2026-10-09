# Grill session: guest Agent participation

**Topic:** How guests (Members) participate in the same grill / Agent session as the Host  
**Room vocabulary:** `CONTEXT.md` (hackathon POC)  
**Status:** Round 2 settled (Q6–Q10 recorded below). Q7 **no** implies Agent access without Host Daemon online — not in current POC; needs follow-up design.

## Member responses

### Sampath — 2026-10-09

**Prompt (Round 1 / Q1):** Should “guest participate in the grill” mean Host-only `@agent`, or something else?

**Response (verbatim):**

> Right now only the host is able to converse with agent using agent command. But I want the guests also to continue the same grill session.

**Settled from this response:**

- **Goal:** Members (guests), not only the Host, must be able to drive the **same** per-Room **Agent** conversation (continue the grill), not a separate grill per person.
- **Not sufficient:** Reply-only participation with the Host as sole Relayer (current hackathon POC default in `docs/spec-hackathon-poc.md` user stories 21–22).

### Round 2 (Q6–Q10) — recorded 2026-10-09

| ID | Question | Answer | Implication |
|----|----------|--------|-------------|
| Q6 | Any Member with Link may `@agent`, or promoted co-grillers only? | **Yes** — any Member with the Link | Relax Host-only Relay rule; member join auth suffices for `@agent`. |
| Q7 | Accept Host Daemon online as gate for Agent turns? | **No** | Guests must reach the Agent when the Host Daemon is disconnected; conflicts with current POC (`409 daemon-disconnected`, Daemon-only SDK path). Requires new architecture (e.g. cloud/runtime on Server, relay queue, or always-on Daemon). |
| Q8 | Accept Host `CURSOR_API_KEY` spend by any Member Relayer? | **Yes** | Any Member Relay on a shared Room bills the Host’s key (hackathon-trusted Link). |
| Q9 | Single Relay path; member auth via join membership vs `hostCredential`? | **Yes** | One Relay kind in protocol; Members authenticate via membership from join, not `hostCredential`. |
| Q10 | Guests may send slash skills (e.g. `/grill-with-docs`) in Relay body? | **Yes** | Same `@agent` + body rules for all Members; Server still does not parse slash commands. |

**Settled from Round 2:**

- **Participation model:** Link-holding **Members** may send **Relays** (`@agent`) into the **same** per-Room Agent conversation as the Host.
- **Protocol:** Unify Relay posting for Host and Members; keep `hostCredential` for Daemon connect and Agent publication only.
- **Skills:** Members may include slash text in Relay payload; Host Daemon forwards body verbatim to SDK.
- **Open engineering gap (Q7):** Product rejects “Agent only while Daemon connected.” POC must be extended or superseded for offline/async Agent turns.

## Transcript-style entry (for Room parity)

| kind | author | body |
|------|--------|------|
| reply | Sampath | Right now only the host is able to converse with agent using agent command. But I want the guests also to continue the same grill session. |
| reply | (facilitator) | Q6 yes, Q7 no, Q8–Q10 yes. |
