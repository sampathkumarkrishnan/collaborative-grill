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
    <section className="panel" aria-labelledby={`room-list-${title.replace(/\s+/g, "-").toLowerCase()}`}>
      <h2 className="panel__title" id={`room-list-${title.replace(/\s+/g, "-").toLowerCase()}`}>
        {title}
      </h2>
      {rooms.length === 0 ? (
        <p className="empty-state">{emptyLabel}</p>
      ) : (
        <ul className="room-list">
          {rooms.map((room) => (
            <li key={room.id} className="room-list__item">
              <a
                className="room-list__link"
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
