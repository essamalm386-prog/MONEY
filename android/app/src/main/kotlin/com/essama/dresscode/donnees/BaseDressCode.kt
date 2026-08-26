package com.essama.dresscode.donnees

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(
    entities = [
        ClientEntite::class,
        ModeleEntite::class,
        CommandeEntite::class,
        EnvoiEntite::class,
    ],
    version = 1,
    exportSchema = true,
)
abstract class BaseDressCode : RoomDatabase() {
    abstract fun clients(): ClientDao
    abstract fun modeles(): ModeleDao
    abstract fun commandes(): CommandeDao
    abstract fun envois(): EnvoiDao

    companion object {
        @Volatile
        private var instance: BaseDressCode? = null

        fun obtenir(contexte: Context): BaseDressCode =
            instance ?: synchronized(this) {
                instance ?: Room.databaseBuilder(
                    contexte.applicationContext,
                    BaseDressCode::class.java,
                    "dress-code.db",
                )
                    .build()
                    .also { instance = it }
            }
    }
}
