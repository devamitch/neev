package expo.modules.setunative.persistence

import expo.modules.setunative.models.SetuContent

internal class ContentRepositorySharedSpaceQuery(private val repository: ContentRepository) {
    fun getBySpace(spaceId: String): List<SetuContent> {
        val cursor = repository.getDb().query(
            "setu_content",
            null,
            "instr(metadata, ?) > 0",
            arrayOf("\"shared_space_id\":\"$spaceId\""),
            null,
            null,
            "modified_at DESC"
        )
        return cursor.use { rows ->
            val contents = mutableListOf<SetuContent>()
            while (rows.moveToNext()) contents.add(repository.mapContent(rows))
            contents
        }
    }
}
