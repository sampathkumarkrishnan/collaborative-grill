import { useState } from "react";
import type { ApiClient } from "./api.js";
import { CreateRoomForm } from "./components/CreateRoomForm.js";
import { RoomList } from "./components/RoomList.js";
import {
  getCreatedRooms,
  getVisitedRooms,
  rememberCreatedRoom,
  rememberHostCredential,
  type StoredRoomRef
} from "./storage.js";

export interface HomePageProps {
  apiClient: ApiClient;
  onNavigate: (link: string) => void;
}

/** Created-room and visited-room lists, plus "Create Room with Topic" (ticket 3 scope). */
export function HomePage({ apiClient, onNavigate }: HomePageProps): JSX.Element {
  const [createdRooms, setCreatedRooms] = useState<StoredRoomRef[]>(() => getCreatedRooms());
  const [visitedRooms] = useState<StoredRoomRef[]>(() => getVisitedRooms());

  async function handleCreate(topic: string): Promise<void> {
    const { room, hostCredential } = await apiClient.createRoom(topic);
    const ref: StoredRoomRef = { id: room.id, topic: room.topic, link: room.link };
    rememberCreatedRoom(ref);
    rememberHostCredential(room.id, hostCredential);
    setCreatedRooms(getCreatedRooms());
    onNavigate(room.link);
  }

  return (
    <main>
      <h1>Collaborative Grill</h1>
      <CreateRoomForm onCreate={handleCreate} />
      <RoomList
        title="Rooms you created"
        emptyLabel="You haven't created a Room yet."
        rooms={createdRooms}
        onOpen={onNavigate}
      />
      <RoomList
        title="Rooms you've visited"
        emptyLabel="You haven't visited a Room yet."
        rooms={visitedRooms}
        onOpen={onNavigate}
      />
    </main>
  );
}
