import type { StoredRoomRef } from "../storage.js";

export interface RoomListProps {
  title: string;
  emptyLabel: string;
  rooms: StoredRoomRef[];
  onOpen: (link: string) => void;
}

/** Renders either the created-room or visited-room list (user stories 5, 11). */
export function RoomList({ title, emptyLabel, rooms, onOpen }: RoomListProps): JSX.Element {
  return (
    <section>
      <h2>{title}</h2>
      {rooms.length === 0 ? (
        <p>{emptyLabel}</p>
      ) : (
        <ul>
          {rooms.map((room) => (
            <li key={room.id}>
              <a
                href={room.link}
                onClick={(event) => {
                  event.preventDefault();
                  onOpen(room.link);
                }}
              >
                {room.topic}
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
