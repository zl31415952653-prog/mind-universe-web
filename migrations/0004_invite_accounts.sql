-- Additive: preserve historical accounts and snapshots.
CREATE TABLE account_invites (code_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL, used_at INTEGER);
CREATE TABLE invite_accounts (
 user_id TEXT PRIMARY KEY REFERENCES users(id), username TEXT NOT NULL UNIQUE,
 password_hash TEXT NOT NULL, salt TEXT NOT NULL, recovery_hash TEXT NOT NULL,
 invite_hash TEXT NOT NULL REFERENCES account_invites(code_hash)
);
CREATE TABLE invite_sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES invite_accounts(user_id), expires_at INTEGER NOT NULL);
CREATE INDEX invite_sessions_user ON invite_sessions(user_id);
CREATE TABLE account_attempts (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE TRIGGER require_unused_invite BEFORE INSERT ON invite_accounts BEGIN
 SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM account_invites WHERE code_hash=NEW.invite_hash AND used_at IS NULL AND expires_at>unixepoch('now')*1000)
 THEN RAISE(ABORT, 'invite_unavailable') END;
END;
CREATE TRIGGER consume_invite AFTER INSERT ON invite_accounts BEGIN
 UPDATE account_invites SET used_at=unixepoch('now')*1000 WHERE code_hash=NEW.invite_hash;
END;
CREATE TRIGGER revoke_invite_sessions AFTER UPDATE OF password_hash ON invite_accounts BEGIN
 DELETE FROM invite_sessions WHERE user_id=NEW.user_id;
END;
