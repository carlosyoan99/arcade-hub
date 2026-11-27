/**
 * Contrato de mensajes v1 del relay online.
 * Reexport del paquete compartido @arcade/protocol: mantiene los nombres
 * públicos de este módulo sin duplicar la validación del protocolo.
 * Este módulo no importa render/audio/ui/DOM: solo el contrato de red.
 */
export type {
  ClientMessage,
  DesyncMessage,
  ErrorMessage,
  HashEntry,
  HelloMessage,
  InputMessage,
  JoinedMessage,
  JoinMessage,
  LeftMessage,
  NetMessage,
  PeerJoinedMessage,
  PeerLeftMessage,
  PlayerInfo,
  RelayedHashMessage,
  RelayedInputMessage,
  Role,
  ServerMessage,
  WelcomeMessage,
} from '@arcade/protocol';
export {
  HASH_INTERVAL,
  MAX_ACTION_LENGTH,
  MAX_ACTIONS,
  MAX_CODE_LENGTH,
  MAX_HASH_LENGTH,
  MAX_NAME_LENGTH,
  NET_VERSION,
  ProtocolError,
  encode,
  parseClientMessage,
  parseClientText,
  parseServerMessage,
  parseServerText,
} from '@arcade/protocol';
