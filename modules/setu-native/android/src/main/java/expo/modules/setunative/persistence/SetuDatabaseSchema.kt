package expo.modules.setunative.persistence

/**
 * Schema definitions for Setu SQLite database.
 * Contains all table creation SQL statements.
 */
object SetuDatabaseSchema {

    const val DATABASE_NAME = "setu_db"
    const val DATABASE_VERSION = 3

    // Content table
    const val CREATE_CONTENT_TABLE = """
        CREATE TABLE IF NOT EXISTS setu_content (
            content_id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            name TEXT NOT NULL,
            mime_type TEXT NOT NULL,
            size INTEGER NOT NULL,
            created_at INTEGER NOT NULL,
            modified_at INTEGER NOT NULL,
            source TEXT NOT NULL,
            source_uri TEXT,
            storage_mode TEXT NOT NULL,
            encryption_mode TEXT NOT NULL,
            manifest_id TEXT,
            owner_id TEXT NOT NULL,
            visibility TEXT NOT NULL,
            availability TEXT NOT NULL,
            state TEXT NOT NULL,
            thumbnail_uri TEXT,
            metadata TEXT
        )
    """

    // Manifests table
    const val CREATE_MANIFESTS_TABLE = """
        CREATE TABLE IF NOT EXISTS setu_manifests (
            manifest_id TEXT PRIMARY KEY,
            content_id TEXT NOT NULL,
            version INTEGER NOT NULL,
            file_name TEXT NOT NULL,
            mime_type TEXT NOT NULL,
            size INTEGER NOT NULL,
            piece_size INTEGER NOT NULL,
            piece_hashes BLOB NOT NULL,
            file_hash BLOB NOT NULL,
            manifest_hash BLOB NOT NULL,
            created_at INTEGER NOT NULL,
            owner_id TEXT NOT NULL,
            is_public INTEGER NOT NULL DEFAULT 0
        )
    """

    // Pieces table
    const val CREATE_PIECES_TABLE = """
        CREATE TABLE IF NOT EXISTS setu_pieces (
            piece_id TEXT PRIMARY KEY,
            manifest_id TEXT NOT NULL,
            content_id TEXT NOT NULL,
            piece_index INTEGER NOT NULL,
            piece_hash BLOB NOT NULL,
            piece_length INTEGER NOT NULL,
            state TEXT NOT NULL,
            storage_path TEXT,
            verified_at INTEGER,
            provider_peer_ids TEXT,
            FOREIGN KEY(manifest_id) REFERENCES setu_manifests(manifest_id)
        )
    """

    // Transfers table
    const val CREATE_TRANSFERS_TABLE = """
        CREATE TABLE IF NOT EXISTS setu_transfers (
            transfer_id TEXT PRIMARY KEY,
            content_id TEXT NOT NULL,
            manifest_id TEXT NOT NULL,
            direction TEXT NOT NULL,
            peer_id TEXT NOT NULL,
            session_id TEXT NOT NULL,
            state TEXT NOT NULL,
            total_bytes INTEGER NOT NULL,
            verified_bytes INTEGER NOT NULL DEFAULT 0,
            bitfield BLOB NOT NULL,
            requested_pieces TEXT,
            failed_pieces TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            destination TEXT NOT NULL,
            batch_id TEXT,
            error_message TEXT,
            completed_at INTEGER
        )
    """

    // Provider map table
    const val CREATE_PROVIDER_MAP_TABLE = """
        CREATE TABLE IF NOT EXISTS setu_provider_map (
            manifest_id TEXT NOT NULL,
            piece_index INTEGER NOT NULL,
            provider_peer_id TEXT NOT NULL,
            last_advertised_at INTEGER NOT NULL,
            is_verified INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (manifest_id, piece_index, provider_peer_id)
        )
    """

    // Swarm state table
    const val CREATE_SWARM_STATE_TABLE = """
        CREATE TABLE IF NOT EXISTS setu_swarm_state (
            manifest_id TEXT PRIMARY KEY,
            total_pieces INTEGER NOT NULL,
            available_pieces INTEGER NOT NULL DEFAULT 0,
            replication_factor INTEGER NOT NULL DEFAULT 1,
            rare_pieces TEXT,
            at_risk_pieces TEXT,
            last_updated_at INTEGER NOT NULL
        )
    """

    // Swarm session table
    const val CREATE_SWARM_SESSIONS_TABLE = """
        CREATE TABLE IF NOT EXISTS setu_swarm_sessions (
            session_id TEXT PRIMARY KEY,
            manifest_id TEXT NOT NULL,
            peer_id TEXT NOT NULL,
            role TEXT NOT NULL,
            state TEXT NOT NULL,
            joined_at INTEGER NOT NULL,
            bytes_contributed INTEGER NOT NULL DEFAULT 0,
            bytes_received INTEGER NOT NULL DEFAULT 0,
            active_pieces TEXT,
            FOREIGN KEY(manifest_id) REFERENCES setu_manifests(manifest_id)
        )
    """

    // Legacy: kept only so SharedSpaceStoreMigration can read rows written by older builds.
    const val CREATE_SHARED_SPACES_TABLE = """
        CREATE TABLE IF NOT EXISTS setu_shared_spaces (
            space_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            owner_id TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            members TEXT NOT NULL,
            invited_members TEXT NOT NULL,
            is_encrypted INTEGER NOT NULL DEFAULT 1,
            size_limit INTEGER NOT NULL,
            content_limit INTEGER NOT NULL,
            content_count INTEGER NOT NULL DEFAULT 0,
            total_size INTEGER NOT NULL DEFAULT 0,
            version INTEGER NOT NULL DEFAULT 1,
            encryption_key_id TEXT,
            is_active INTEGER NOT NULL DEFAULT 1
        )
    """

    const val CREATE_TOMBSTONES_TABLE = """
        CREATE TABLE IF NOT EXISTS setu_tombstones (
            tombstone_id TEXT PRIMARY KEY,
            space_id TEXT NOT NULL,
            content_id TEXT NOT NULL,
            creator_id TEXT NOT NULL,
            operation_type TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            version INTEGER NOT NULL DEFAULT 1,
            processed INTEGER NOT NULL DEFAULT 0,
            processed_at INTEGER
        )
    """

    // All tables array for easy iteration
    val ALL_TABLES = arrayOf(
        CREATE_CONTENT_TABLE,
        CREATE_MANIFESTS_TABLE,
        CREATE_PIECES_TABLE,
        CREATE_TRANSFERS_TABLE,
        CREATE_PROVIDER_MAP_TABLE,
        CREATE_SWARM_STATE_TABLE,
        CREATE_SWARM_SESSIONS_TABLE,
    )
}
