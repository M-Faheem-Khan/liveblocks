import type { Json, JsonObject } from "./Json";
import type { Op } from "./Op";

export enum ClientMsgCode {
  // For Presence
  UPDATE_PRESENCE = 100,
  BROADCAST_EVENT = 103,

  // For Storage
  FETCH_STORAGE = 200,
  UPDATE_STORAGE = 201,
}

/**
 * Messages that can be sent from the client to the server.
 */
export type ClientMsg<TPresence extends JsonObject> =
  // For Presence
  | BroadcastEventClientMsg
  | UpdatePresenceClientMsg<TPresence>

  // For Storage
  | UpdateStorageClientMsg
  | FetchStorageClientMsg;

export type BroadcastEventClientMsg = {
  type: ClientMsgCode.BROADCAST_EVENT;
  event: Json;
};

export type UpdatePresenceClientMsg<TPresence extends JsonObject> = {
  type: ClientMsgCode.UPDATE_PRESENCE;
  data: TPresence;
  targetActor?: number;
};

export type UpdateStorageClientMsg = {
  type: ClientMsgCode.UPDATE_STORAGE;
  ops: Op[];
};

export type FetchStorageClientMsg = {
  type: ClientMsgCode.FETCH_STORAGE;
};
