package com.essama.dresscode.donnees

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import androidx.room.Upsert
import kotlinx.coroutines.flow.Flow

/*
 * Les lectures rendent des Flow : l'ecran se remet a jour tout seul
 * quand une commande change de statut, sans qu'aucune vue n'ait a
 * savoir qui l'a modifiee.
 */

@Dao
interface ClientDao {
    @Query("SELECT * FROM clients ORDER BY majLe DESC")
    fun tout(): Flow<List<ClientEntite>>

    @Query("SELECT * FROM clients WHERE id = :id")
    fun parId(id: Long): Flow<ClientEntite?>

    @Query("SELECT * FROM clients WHERE id = :id")
    suspend fun lire(id: Long): ClientEntite?

    /* Un meme numero note deux fois, c'est deux fiches et un
       historique coupe en deux. On rattache au lieu de dupliquer. */
    @Query("SELECT * FROM clients WHERE replace(replace(telephone, ' ', ''), '-', '') = :numero LIMIT 1")
    suspend fun parNumero(numero: String): ClientEntite?

    @Upsert
    suspend fun enregistrer(client: ClientEntite): Long

    @Delete
    suspend fun supprimer(client: ClientEntite)
}

@Dao
interface ModeleDao {
    @Query("SELECT * FROM modeles ORDER BY creeLe DESC")
    fun tout(): Flow<List<ModeleEntite>>

    @Query("SELECT * FROM modeles WHERE photo = :photo LIMIT 1")
    suspend fun parPhoto(photo: String): ModeleEntite?

    @Upsert
    suspend fun enregistrer(modele: ModeleEntite): Long

    @Delete
    suspend fun supprimer(modele: ModeleEntite)
}

@Dao
interface CommandeDao {
    @Query("SELECT * FROM commandes ORDER BY dateLivraison ASC")
    fun tout(): Flow<List<CommandeEntite>>

    @Query("SELECT * FROM commandes WHERE id = :id")
    fun parId(id: Long): Flow<CommandeEntite?>

    @Query("SELECT * FROM commandes WHERE id = :id")
    suspend fun lire(id: Long): CommandeEntite?

    @Query("SELECT * FROM commandes WHERE clientId = :clientId ORDER BY dateLivraison DESC")
    fun parClient(clientId: Long): Flow<List<CommandeEntite>>

    /* Lecture ponctuelle pour le rappel du matin : le travailleur de
       fond n'observe rien, il lit une fois et s'arrete. */
    @Query("SELECT * FROM commandes")
    suspend fun instantane(): List<CommandeEntite>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun ajouter(commande: CommandeEntite): Long

    @Update
    suspend fun mettreAJour(commande: CommandeEntite)

    @Delete
    suspend fun supprimer(commande: CommandeEntite)
}

@Dao
interface EnvoiDao {
    @Query("SELECT * FROM envois WHERE clientId = :clientId ORDER BY le DESC LIMIT 1")
    fun dernierPourClient(clientId: Long): Flow<EnvoiEntite?>

    @Insert
    suspend fun ajouter(envoi: EnvoiEntite)
}
