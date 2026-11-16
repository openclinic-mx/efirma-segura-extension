// Errors the vault throws. The UI shows some of them as they are and maps the others.

// Same message kdbxweb uses for a wrong password: the UI already maps it to "Contraseña incorrecta".
export const INVALID_KEY_ERROR = 'Error InvalidKey';

// The vault is locked: there is no session to read or write it with.
export const LOCKED_ERROR = "Credentials not found: Ensure database is open before interacting with it";

// The stored vault no longer opens with the unlocked session's key: it changed on another device.
export const SESSION_INVALIDATED_ERROR = 'La bóveda cambió en otro dispositivo, desbloquéala de nuevo.';

// The vault was written by a newer version (unknown lock format or key derivation): never treat it as a wrong password.
export const UNSUPPORTED_VAULT_ERROR = 'Esta bóveda usa un formato más reciente. Actualiza e.firma Segura para abrirla.';

// The password or passkey was right, but its lock still doesn't give the data key (damaged or tampered synced data):
// never treat it as a wrong password, the user would retry it forever.
export const DAMAGED_LOCK_ERROR = 'Los datos de desbloqueo de tu bóveda están dañados. Intenta desbloquearla de otra forma.';
