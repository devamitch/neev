package expo.modules.setunative.persistence

import android.content.Context
import expo.modules.setunative.models.*
import java.util.*

class ProviderMapRepository(private val dbHelper: SetuDatabase) {

    companion object {
        private const val TAG = "SETU_PROVIDER_REPO"
        
        fun create(context: Context): ProviderMapRepository {
            return ProviderMapRepository(SetuDatabase.getInstance(context))
        }
    }

    private val upsertHandler = ProviderMapRepositoryUpsert(this)
    private val queryHandler = ProviderMapRepositoryQuery(this)
    private val updateHandler = ProviderMapRepositoryUpdate(this)
    private val deleteHandler = ProviderMapRepositoryDelete(this)

    // CRUD operations
    fun upsert(entry: ProviderMapEntry): Boolean = upsertHandler.upsert(entry)
    fun getProviders(manifestId: String, pieceIndex: Int): List<ProviderMapEntry> = queryHandler.getProviders(manifestId, pieceIndex)
    fun getPiecesByProvider(manifestId: String, providerPeerId: String): List<ProviderMapEntry> = queryHandler.getPiecesByProvider(manifestId, providerPeerId)
    fun getProviderMap(manifestId: String): Map<Int, Set<String>> = queryHandler.getProviderMap(manifestId)
    fun getVerifiedProviders(manifestId: String, pieceIndex: Int): List<String> = queryHandler.getVerifiedProviders(manifestId, pieceIndex)
    fun markVerified(manifestId: String, pieceIndex: Int, providerPeerId: String): Boolean = updateHandler.markVerified(manifestId, pieceIndex, providerPeerId)
    fun updateLastAdvertised(manifestId: String, pieceIndex: Int, providerPeerId: String): Boolean = updateHandler.updateLastAdvertised(manifestId, pieceIndex, providerPeerId)
    fun removeProvider(manifestId: String, pieceIndex: Int, providerPeerId: String): Boolean = deleteHandler.removeProvider(manifestId, pieceIndex, providerPeerId)
    fun removeByManifest(manifestId: String): Int = deleteHandler.removeByManifest(manifestId)
    fun removeByProvider(providerPeerId: String): Int = deleteHandler.removeByProvider(providerPeerId)
    fun getPieceRarity(manifestId: String): Map<Int, Int> = queryHandler.getPieceRarity(manifestId)
    fun getRarePieces(manifestId: String): Set<Int> = queryHandler.getRarePieces(manifestId)
    fun getAtRiskPieces(manifestId: String, totalPieces: Int): Set<Int> = queryHandler.getAtRiskPieces(manifestId, totalPieces)
    fun getProvidedPiecesByPeer(providerPeerId: String): Map<String, Set<Int>> = queryHandler.getProvidedPiecesByPeer(providerPeerId)

    internal fun getDb() = dbHelper.readableDatabase
    internal fun getWritableDb() = dbHelper.writableDatabase
    internal fun getDbHelper() = dbHelper
}