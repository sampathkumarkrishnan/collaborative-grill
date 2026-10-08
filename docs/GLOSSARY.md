# Collaborative grilling

Each room is owned by one host and is created together with its one grill. The server stores every room. A link admits members. Members may read the room and post replies while the daemon is asleep. Commands reach the daemon only when it is connected.

## Language

**Room**:
The collaboration around exactly one grill, owned by one host, created together with that grill.
_Avoid_: Session, group

**Grill**:
One design tree on a single topic, finished when its frontier is empty.
_Avoid_: Session, interview

**Frontier**:
The open questions in a grill whose prerequisites are already settled.

**Host**:
The member who owns the room and the only one who may relay to its agent. Once Trimble ID sign-in is required, the host is the Trimble user bound to the room.
_Avoid_: Operator, conductor

**Agent**:
The grill-with-docs interviewer for a single room, bound to that room's host. The host's first relay while the daemon is connected opens it, primed from that room's topic, draft, glossary, ADRs, and relays.
_Avoid_: Conductor, bot, session

**Daemon**:
The process on the host's machine that serves every room she hosts. It connects to the server with the host credential. It carries one room's relays to that room's agent, and carries that agent's rounds, draft, glossary updates, Handoffs, and ADRs back to that room.
_Avoid_: Bridge, bot, connector

**Server**:
The record of every room, including its transcript, draft, glossary, ADRs, and latest Handoff.
_Avoid_: Signaler, discovery server

**Link**:
An unguessable address that admits its opener to one room. Once Trimble ID sign-in is required, the opener must be a signed-in Trimble user.
_Avoid_: Invite, permalink

**Member**:
A person who has entered a room through its link and may post replies. The host is a member. Once Trimble ID sign-in is required, a member is a signed-in Trimble user.
_Avoid_: User, visitor

**Transcript**:
The ordered messages of a room: replies, relays, and rounds. The server keeps it for the life of the room.
_Avoid_: Chat, history, thread

**Round**:
The frontier questions the agent publishes into a room at one time.

**Glossary**:
The settled language of a room's grill, readable by every member and current after each agent update.
_Avoid_: Notes, dictionary

**ADR**:
A decision record for one grill, readable by every member.
_Avoid_: Spec, note

**Handoff**:
The latest compact of a grill, written so a fresh agent can continue without the full transcript. The host requests it. It is rejected while the agent is closed. It references the glossary, the draft, and any ADRs.
_Avoid_: Summary, catch-up

**Draft**:
The running PRD of a room's grill. A member opens it to read the problem, the settled decisions, and the open frontier as of the last round the agent published.
_Avoid_: Handoff, summary, spec

**Reply**:
Discussion posted to a room's transcript. A reply is not sent to the agent.
_Avoid_: Relay, comment

**Relay**:
The host's message to the agent, stored in the transcript when the daemon is connected. It is the only command that opens a closed agent.
_Avoid_: Answer, reply, chat

**Command**:
A host-only invocation in a room: a relay or a request for a Handoff. It is rejected when the daemon is asleep, and nothing is added to the transcript.
_Avoid_: Reply

**Transfer**:
An act that binds a new host to a room and primes that host's agent from the room's Handoff, glossary, rounds, and relays.
_Avoid_: Handoff
