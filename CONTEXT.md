# Collaborative grilling (hackathon POC)

Each **Room** is owned by one **Host**, created with a **Topic**. The **Server** stores the **Transcript**. A **Link** admits **Members**. The **Daemon** on the Host's machine connects with the **Host credential** and is the only path to that Room's **Agent**.

## Language

**Room**:
The shared collaboration for one topic, owned by one Host.
_Avoid_: Session, group

**Host**:
The Member who created the Room and the only one whose messages may reach the Agent via `@agent`.
_Avoid_: Operator, conductor

**Member**:
Anyone who entered through the Link; may post to the Transcript. The Host is a Member.
_Avoid_: User, visitor

**Link**:
Unguessable address that admits an opener to one Room.
_Avoid_: Invite, session URL

**Transcript**:
Ordered messages in a Room: Member discussion and Agent-bound traffic that was accepted.
_Avoid_: Chat, history

**Reply**:
A Transcript message that does not invoke the Agent.
_Avoid_: Relay

**Relay**:
A Host message that invokes the Agent, marked with `@agent` in the composer. Accepted only while the Daemon is connected; rejected messages are not stored.
_Avoid_: Reply

**Agent**:
One Cursor SDK agent conversation per Room, on the Host's machine, receiving Relays and publishing assistant text back into the Transcript.
_Avoid_: Bot, session

**Daemon**:
Host-side process that holds the Host credential, receives Relays from the Server, talks to the Agent, and publishes assistant messages to the Server.
_Avoid_: Bridge, connector

**Server**:
System of record for Rooms, membership, Transcript, and Daemon connectivity.
_Avoid_: Signaler only

**Topic**:
The required subject string supplied when the Room is created.
