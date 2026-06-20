/**
 * Cached authentication data for a user, stored after TCP /api/user call
 * and retrieved during UDP handshake matching.
 */
export interface CachedAuth {
    /** EOS ProductUserId extracted from the JWT token. */
    puid: string;
    /** FriendCode in username#discriminator format, from Innersloth backend. */
    friendCode: string;
    /** When this cache entry expires. */
    expiresAt: number;
    /** The username from the /api/user request body. */
    username: string;
    /** The client IP address at the time of the /api/user request. */
    ip: string;
    /** The client version reported by the user. */
    clientVersion: number;
}

/**
 * In-memory cache that maps (IP + username) → CachedAuth.
 *
 * Used to associate a UDP connection (identified by IP + username from
 * the 0x08 Hello handshake) with the authentication data obtained during
 * the prior TCP /api/user call.
 *
 * Fallback matching strategy:
 * 1. Match by IP + username (most accurate)
 * 2. Match by username only (for NAT / IP changes)
 * 3. Match by IP only (for same-machine scenarios)
 */
export class AuthCache {
    /** Primary index: `${ip}:${username}` → CachedAuth */
    private byIpAndUsername = new Map<string, CachedAuth>();

    /** Secondary index: username → CachedAuth (for IP-change fallback) */
    private byUsername = new Map<string, CachedAuth>();

    /** Tertiary index: IP → CachedAuth[] (for username-change fallback) */
    private byIp = new Map<string, CachedAuth[]>();

    /** Default cache TTL: 10 minutes */
    static readonly DEFAULT_TTL_MS = 10 * 60 * 1000;

    constructor(private ttlMs: number = AuthCache.DEFAULT_TTL_MS) {}

    /**
     * Store an authentication entry.
     */
    addAuth(ip: string, username: string, puid: string, friendCode: string, clientVersion: number): CachedAuth {
        this.cleanExpired();

        const entry: CachedAuth = {
            puid,
            friendCode,
            expiresAt: Date.now() + this.ttlMs,
            username,
            ip,
            clientVersion,
        };

        const ipUsernameKey = `${ip}:${username}`;
        this.byIpAndUsername.set(ipUsernameKey, entry);
        this.byUsername.set(username, entry);

        const ipEntries = this.byIp.get(ip);
        if (ipEntries) {
            // Replace existing entry for this username, or add new
            const existingIdx = ipEntries.findIndex(e => e.username === username);
            if (existingIdx >= 0) {
                ipEntries[existingIdx] = entry;
            } else {
                ipEntries.push(entry);
            }
        } else {
            this.byIp.set(ip, [entry]);
        }

        return entry;
    }

    /**
     * Primary matching: IP + username.
     */
    findByIpAndUsername(ip: string, username: string): CachedAuth | null {
        this.cleanExpired();
        const key = `${ip}:${username}`;
        const entry = this.byIpAndUsername.get(key);
        if (entry && entry.expiresAt > Date.now()) {
            return entry;
        }
        return null;
    }

    /**
     * Fallback 1: match by username only (IP may have changed).
     */
    findByUsername(username: string): CachedAuth | null {
        this.cleanExpired();
        const entry = this.byUsername.get(username);
        if (entry && entry.expiresAt > Date.now()) {
            return entry;
        }
        return null;
    }

    /**
     * Fallback 2: match by IP only (useful for same-machine scenarios).
     * Returns the most recently added entry for this IP.
     */
    findByIp(ip: string): CachedAuth | null {
        this.cleanExpired();
        const entries = this.byIp.get(ip);
        if (entries && entries.length > 0) {
            // Return the most recent valid entry
            const valid = entries.filter(e => e.expiresAt > Date.now());
            if (valid.length > 0) {
                return valid.reduce((a, b) => a.expiresAt > b.expiresAt ? a : b);
            }
        }
        return null;
    }

    /**
     * Best-effort matching: try all strategies in order.
     */
    findBestMatch(ip: string, username: string): CachedAuth | null {
        return this.findByIpAndUsername(ip, username)
            || this.findByUsername(username)
            || this.findByIp(ip);
    }

    /**
     * Remove expired entries from all indexes.
     */
    cleanExpired(): void {
        const now = Date.now();

        for (const [key, entry] of this.byIpAndUsername) {
            if (entry.expiresAt <= now) {
                this.byIpAndUsername.delete(key);
                this.byUsername.delete(entry.username);

                const ipEntries = this.byIp.get(entry.ip);
                if (ipEntries) {
                    const idx = ipEntries.indexOf(entry);
                    if (idx >= 0) ipEntries.splice(idx, 1);
                    if (ipEntries.length === 0) this.byIp.delete(entry.ip);
                }
            }
        }
    }

    /**
     * Remove a specific entry (e.g., after successful association).
     */
    remove(ip: string, username: string): void {
        const key = `${ip}:${username}`;
        const entry = this.byIpAndUsername.get(key);
        if (entry) {
            this.byIpAndUsername.delete(key);
            this.byUsername.delete(username);

            const ipEntries = this.byIp.get(ip);
            if (ipEntries) {
                const idx = ipEntries.indexOf(entry);
                if (idx >= 0) ipEntries.splice(idx, 1);
                if (ipEntries.length === 0) this.byIp.delete(ip);
            }
        }
    }

    /**
     * Get the number of active cache entries.
     */
    get size(): number {
        this.cleanExpired();
        return this.byIpAndUsername.size;
    }
}
