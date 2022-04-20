import { createRoom, InternalRoom } from "./room";
import { ClientOptions, Room, Client, Authentication } from "./types";
import { JsonObject } from "./json";
import { LsonObject } from "./lson";

/**
 * Create a client that will be responsible to communicate with liveblocks servers.
 *
 * @example
 * const client = createClient({
 *   authEndpoint: "/api/auth"
 * });
 *
 * // It's also possible to use a function to call your authentication endpoint.
 * // Useful to add additional headers or use an API wrapper (like Firebase functions)
 * const client = createClient({
 *   authEndpoint: async (room) => {
 *     const response = await fetch("/api/auth", {
 *       method: "POST",
 *       headers: {
 *          Authentication: "token",
 *          "Content-Type": "application/json"
 *       },
 *       body: JSON.stringify({ room })
 *     });
 *
 *     return await response.json();
 *   }
 * });
 */
export function createClient(options: ClientOptions): Client {
  const clientOptions = options;
  const throttleDelay = getThrottleDelayFromOptions(options);

  const rooms = new Map<string, InternalRoom<JsonObject, LsonObject>>();

  function getRoom<
    TPresence extends JsonObject,
    TStorageRoot extends LsonObject
  >(roomId: string): Room<TPresence, TStorageRoot> | null {
    const internalRoom = rooms.get(roomId);
    return internalRoom
      ? (internalRoom.room as unknown as Room<TPresence, TStorageRoot>)
      : null;
  }

  function enter<TPresence extends JsonObject, TStorageRoot extends LsonObject>(
    roomId: string,
    options: {
      defaultPresence?: TPresence;
      defaultStorageRoot?: TStorageRoot;
      /**
       * INTERNAL OPTION: Only used in a SSR context when you want an empty room to make sure your react tree is rendered properly without connecting to websocket
       */
      DO_NOT_USE_withoutConnecting?: boolean;
    } = {}
  ): Room<TPresence, TStorageRoot> {
    const existingInternalRoom = rooms.get(roomId);
    if (existingInternalRoom) {
      return existingInternalRoom.room as unknown as Room<
        TPresence,
        TStorageRoot
      >;
    }

    const newInternalRoom = createRoom<TPresence, TStorageRoot>(
      {
        defaultPresence: options.defaultPresence,
        defaultStorageRoot: options.defaultStorageRoot,
      },
      {
        room: roomId,
        throttleDelay,
        WebSocketPolyfill: clientOptions.WebSocketPolyfill,
        fetchPolyfill: clientOptions.fetchPolyfill,
        liveblocksServer:
          (clientOptions as any).liveblocksServer || "wss://liveblocks.net/v5",
        authentication: prepareAuthentication(clientOptions),
      }
    );
    rooms.set(
      roomId,
      newInternalRoom as unknown as InternalRoom<JsonObject, LsonObject>
    );
    if (!options.DO_NOT_USE_withoutConnecting) {
      newInternalRoom.connect();
    }
    return newInternalRoom.room;
  }

  function leave(roomId: string) {
    const room = rooms.get(roomId);
    if (room) {
      room.disconnect();
      rooms.delete(roomId);
    }
  }

  if (typeof window !== "undefined") {
    // TODO: Expose a way to clear these
    window.addEventListener("online", () => {
      for (const [, room] of rooms) {
        room.onNavigatorOnline();
      }
    });
  }

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      for (const [, room] of rooms) {
        room.onVisibilityChange(document.visibilityState);
      }
    });
  }

  return {
    getRoom,
    enter,
    leave,
  };
}

function getThrottleDelayFromOptions(options: ClientOptions): number {
  if (options.throttle === undefined) {
    return 100;
  }

  if (
    typeof options.throttle !== "number" ||
    options.throttle < 80 ||
    options.throttle > 1000
  ) {
    throw new Error("throttle should be a number between 80 and 1000.");
  }

  return options.throttle;
}

function prepareAuthentication(clientOptions: ClientOptions): Authentication {
  // TODO: throw descriptive errors for invalid options
  if (typeof clientOptions.publicApiKey === "string") {
    return {
      type: "public",
      publicApiKey: clientOptions.publicApiKey,
      url:
        (clientOptions as any).publicAuthorizeEndpoint ||
        "https://liveblocks.io/api/public/authorize",
    };
  } else if (typeof clientOptions.authEndpoint === "string") {
    return {
      type: "private",
      url: clientOptions.authEndpoint,
    };
  } else if (typeof clientOptions.authEndpoint === "function") {
    return {
      type: "custom",
      callback: clientOptions.authEndpoint,
    };
  }

  throw new Error(
    "Invalid Liveblocks client options. For more information: https://liveblocks.io/docs/api-reference/liveblocks-client#createClient"
  );
}
