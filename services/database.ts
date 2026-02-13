import {CryptoEngine, KdbxEntry} from 'kdbxweb';
import argon2 from 'argon2-browser';
import {StorageService} from "./storage";

CryptoEngine.setArgon2Impl(
    (password, salt, memory, iterations, length, parallelism, type, version) => {
        console.log('Using argon2 implementation', version);
        return argon2
            .hash({
                pass: new Uint8Array(password),
                salt: new Uint8Array(salt),
                time: iterations,
                mem: memory,
                hashLen: length,
                parallelism,
                type,
                version,
            })
            .then((v) => v.hash);
    }
);

export class DatabaseService {
    constructor(storage: StorageService) {
    }

    isInitialized(): boolean {

    }

    isUnlocked(): boolean {

    }

    initialize() {

    }

    unlock(password: string) {

    }

    lock() {

    }

    getEntries(): KdbxEntry[] {

    }

    getEntry(): KdbxEntry {

    }

    addEntry(entry: KdbxEntry) {

    }

    updatePassword(oldPassword: string, newPassword: string) {

    }

    deleteDatabase() {

    }
}


function KeepassService(keepassHeader, settings, passwordFileStoreRegistry, keepassReference) {
    var my = {};

    /**
     * return Promise(arrayBufer)
     */
    my.getChosenDatabaseFile = function () {
        return passwordFileStoreRegistry.getChosenDatabaseFile(settings);
    };

    my.getMasterKey = function (bufferPromise, masterPassword, keyFileInfo) {
        /**
         * Validate that one of the following is true:
         * (password isn't empty OR keyfile isn't empty)
         * ELSE
         * (assume password is the empty string)
         */
        let protectedMasterPassword;
        if (masterPassword === undefined && keyFileInfo === undefined) {
            // Neither keyfile nor password provided.  Assume empty string password.
            protectedMasterPassword = kdbxweb.ProtectedValue.fromString('');
        } else if (masterPassword === '' && keyFileInfo !== undefined) {
            // Keyfile but empty password provided.  Assume password is unused.
            // This extension does not support the combo empty string + keyfile.
            protectedMasterPassword = null;
        } else {
            protectedMasterPassword = kdbxweb.ProtectedValue.fromString(masterPassword);
        }
        var fileKey = keyFileInfo ? Base64.decode(keyFileInfo.encodedKey) : null;
        return bufferPromise.then(function (buf) {
            var h = keepassHeader.readHeader(buf);
            return getKey(h.kdbx, protectedMasterPassword, fileKey);
        });
    };

    my.getDecryptedData = function (bufferPromise, masterKey) {
        var majorVersion;
        return bufferPromise
            .then(function (buf) {
                var h = keepassHeader.readHeader(buf);
                if (!h) throw new Error('Failed to read file header');

                if (h.kdbx) {
                    // KDBX - use kdbxweb library
                    var kdbxCreds = jsonCredentialsToKdbx(masterKey);
                    return kdbxweb.Kdbx.load(buf, kdbxCreds).then((db) => {
                        var entries = parseKdbxDb(db.groups);
                        majorVersion = db.header.versionMajor;
                        return processReferences(entries, majorVersion);
                    });
                } else {
                    // KDB - we don't support this anymore
                    throw 'Unsupported Database Version';
                }
            })
            .then(function (entries) {
                return {
                    entries: entries,
                    version: majorVersion,
                };
            });
    };

    function getKey(isKdbx, protectedMasterPassword, fileKey) {
        var creds = new kdbxweb.Credentials(protectedMasterPassword, fileKey);
        return creds.ready.then(() => {
            return kdbxCredentialsToJson(creds);
        });
    }

    /*
     * Takes a kdbxweb group object and transforms it into a list of entries.
     **/
    function parseKdbxDb(groups) {
        var results = [];
        for (var i = 0; i < groups.length; i++) {
            var group = groups[i];
            if (group.groups.length > 0) {
                // recursive case for subgroups.
                results = results.concat(parseKdbxDb(group.groups));
            }
            for (var j = 0; j < group.entries.length; j++) {
                var db_entry = group.entries[j];
                var entry = {
                    protectedData: {},
                    keys: [],
                };
                // Entry properties defined by the parent group
                entry.searchable = true;
                if (group.enableSearching === false) entry.searchable = false;
                entry.groupIconId = group.icon;
                entry.keys.push('groupName');
                entry.groupName = group.name;
                if (entry.searchable) results.push(entry);
                // Entry properties defined by the entry
                if (db_entry.uuid) {
                    if (db_entry.uuid.empty == false)
                        entry.id = convertArrayToUUID(Base64.decode(db_entry.uuid.id));
                }
                if (db_entry.icon) entry.iconId = db_entry.icon;
                if (db_entry.tags.length > 0) {
                    //verify
                    var tagstring = '';
                    for (let k = 0; k < db_entry.tags.length; k++) {
                        tagstring += db_entry.tags[k] + ',';
                    }
                    entry.tags = tagstring;
                    entry.keys.push('tags');
                }
                if (db_entry.fields) {
                    for (const [key, field] of db_entry.fields) {
                        const camelKey = Case.camel(key);
                        if (typeof field === 'object') {
                            // type = object ? protected value
                            entry.protectedData[camelKey] = protectedValueToJSON(field);
                        } else {
                            entry.keys.push(camelKey);
                            entry[camelKey] = field;
                        }
                    }
                }
                if (db_entry.times) {
                    if (db_entry.times.expires) {
                        let expiry_date = Date.parse(db_entry.times.expiryTime);
                        entry.expiry = db_entry.times.expiryTime.toString();
                        entry.is_expired = Date.now() - expiry_date > 0; // Both measured in milliseconds
                        entry.keys.push('expiry');
                    }
                }
            }
        }
        return results;
    }

    function convertArrayToUUID(arr) {
        var int8Arr = new Uint8Array(arr);
        var result = new Array(int8Arr.byteLength * 2);
        for (var i = 0; i < int8Arr.byteLength; i++) {
            var hexit = int8Arr[i].toString(16).toUpperCase();
            result[i * 2] = hexit.length == 2 ? hexit : '0' + hexit;
        }
        return result.join('');
    }

    /*
     * The following 3 methods are utilities for the KeeWeb protectedValue class.
     * Because it uses uint8 arrays that are not JSON serializable, we must transform them
     * in and out of JSON serializable formats for use.
     */

    function protectedValueToJSON(pv) {
        return {
            salt: Array.from(pv.salt),
            value: Array.from(pv.value),
        };
    }

    function kdbxCredentialsToJson(creds) {
        var jsonRet = {
            passwordHash: null,
            keyFileHash: null,
        };
        for (var key in jsonRet) if (creds[key]) jsonRet[key] = protectedValueToJSON(creds[key]);
        return jsonRet;
    }

    function jsonCredentialsToKdbx(jsonCreds) {
        var creds = new kdbxweb.Credentials(null, null);
        for (var key in jsonCreds)
            if (jsonCreds[key])
                creds[key] = new kdbxweb.ProtectedValue(jsonCreds[key].value, jsonCreds[key].salt);
        return creds;
    }

    return my;
}

export {KeepassService};
