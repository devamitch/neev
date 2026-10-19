package expo.modules.setunative.ledger

internal class SetuChainForkDetector(private val quarantine: (String) -> Unit) {
    fun inspect(entries: List<SetuChainEntry>) {
        entries.groupBy { it.lamport to it.deviceId }
            .values.filter { group -> group.map { it.hash }.distinct().size > 1 }
            .forEach { group -> quarantine(group.first().deviceId) }
    }
}
