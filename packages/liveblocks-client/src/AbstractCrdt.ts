import type {
  CreateChildOp,
  InternalLiveStructure,
  Op,
  SerializedCrdt,
  StorageUpdate,
} from "./types";
import { OpCode } from "./types";

export type ApplyResult =
  | { reverse: Op[]; modified: StorageUpdate }
  | { modified: false };

export interface Doc {
  //             ^^^ FIXME: Find a better name for "Doc". This is more or less
  //                        the "RoomContext".
  roomId: string;
  generateId: () => string;
  generateOpId: () => string;
  getItem: (id: string) => InternalLiveStructure | undefined;
  addItem: (id: string, liveItem: InternalLiveStructure) => void;
  deleteItem: (id: string) => void;

  /**
   * Dispatching has three responsibilities:
   * - Sends serialized ops to the WebSocket servers
   * - Add reverse operations to the undo/redo stack
   * - Notify room subscribers with updates (in-client, no networking)
   */
  dispatch: (
    ops: Op[],
    reverseOps: Op[],
    storageUpdates: Map<string, StorageUpdate>
  ) => void;
}

export enum OpSource {
  UNDOREDO_RECONNECT,
  REMOTE,
  ACK,
}

// XXX Temporary helper to help convert from AbstractCrdt -> InternalLiveStructure
// XXX Remove me later
// eslint-disable-next-line no-restricted-syntax
function crdtAsLive(value: AbstractCrdt): InternalLiveStructure {
  return value as InternalLiveStructure;
}

export abstract class AbstractCrdt {
  //                  ^^^^^^^^^^^^ XXX Make this an interface
  private __parent?: InternalLiveStructure;
  private __doc?: Doc;
  private __id?: string;
  private __parentKey?: string;

  /**
   * @internal
   */
  _getParentKeyOrThrow(): string {
    const key = this.__parentKey;
    if (key == null) {
      throw new Error("Parent key is missing");
    }
    return key;
  }

  /**
   * @internal
   */
  protected get _doc() {
    return this.__doc;
  }

  get roomId() {
    return this.__doc ? this.__doc.roomId : null;
  }

  /**
   * @internal
   */
  get _id() {
    return this.__id;
  }

  /**
   * @internal
   */
  get _parent() {
    return this.__parent;
  }

  /**
   * @internal
   */
  get _parentKey() {
    return this.__parentKey;
  }

  /**
   * @internal
   */
  _apply(op: Op, _isLocal: boolean): ApplyResult {
    switch (op.type) {
      case OpCode.DELETE_CRDT: {
        if (this._parent != null && this._parentKey != null) {
          return this._parent._detachChild(crdtAsLive(this));
        }

        return { modified: false };
      }
    }

    return { modified: false };
  }

  /**
   * @internal
   */
  _setParentLink(parent: InternalLiveStructure, key: string) {
    if (this.__parent != null && this.__parent !== parent) {
      throw new Error("Cannot attach parent if it already exist");
    }

    this.__parentKey = key;
    this.__parent = crdtAsLive(parent);
  }

  /**
   * @internal
   */
  _attach(id: string, doc: Doc) {
    if (this.__id || this.__doc) {
      throw new Error("Cannot attach if CRDT is already attached");
    }

    doc.addItem(id, crdtAsLive(this));

    this.__id = id;
    this.__doc = doc;
  }

  /**
   * @internal
   */
  abstract _attachChild(op: CreateChildOp, source: OpSource): ApplyResult;

  /**
   * @internal
   */
  _detach() {
    if (this.__doc && this.__id) {
      this.__doc.deleteItem(this.__id);
    }

    this.__parent = undefined;
    this.__doc = undefined;
  }

  /**
   * @internal
   */
  abstract _detachChild(crdt: InternalLiveStructure): ApplyResult;
  /**
   * @internal
   */
  abstract _serialize(parentId: string, parentKey: string, doc?: Doc): Op[];

  /**
   * @internal
   */
  abstract _toSerializedCrdt(): SerializedCrdt;
}
