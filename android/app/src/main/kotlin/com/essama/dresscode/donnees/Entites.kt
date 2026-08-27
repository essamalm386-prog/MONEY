package com.essama.dresscode.donnees

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

/*
 * Le schema de la base. Tout vit sur l'appareil : aucun compte,
 * aucun serveur, aucune mesure de cliente qui sorte du telephone.
 *
 * Les photos ne sont pas stockees ici. Une image de commande pese
 * plusieurs centaines de kilooctets ; les garder dans la base
 * ralentirait chaque lecture de liste. On enregistre le nom du
 * fichier, l'image vit dans le stockage prive de l'application.
 */

@Entity(tableName = "clients")
data class ClientEntite(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val nom: String,
    val telephone: String = "",
    /** Mesures serialisees « cle=valeur » separees par des points-virgules. */
    val mesures: String = "",
    val mesuresMajLe: Long? = null,
    val creeLe: Long = System.currentTimeMillis(),
    val majLe: Long = System.currentTimeMillis(),
)

@Entity(tableName = "modeles")
data class ModeleEntite(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val nom: String,
    val categorie: String? = null,
    val prixIndicatif: Long = 0,
    val photo: String? = null,
    val creeLe: Long = System.currentTimeMillis(),
)

@Entity(
    tableName = "commandes",
    foreignKeys = [
        ForeignKey(
            entity = ClientEntite::class,
            parentColumns = ["id"],
            childColumns = ["clientId"],
            /* Supprimer une cliente emporte ses commandes : garder des
               commandes orphelines fausserait tous les totaux. */
            onDelete = ForeignKey.CASCADE,
        ),
    ],
    indices = [Index("clientId"), Index("statut"), Index("dateLivraison")],
)
data class CommandeEntite(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val clientId: Long,
    val modeleNom: String,
    val modeleId: Long? = null,
    val photo: String? = null,
    val mesures: String = "",
    val cadence: String,
    val statut: String,
    /** Dates en ISO « 2026-08-26 » : triables telles quelles en SQL. */
    val dateCommande: String,
    val dateLivraison: String,
    val prixTotal: Long = 0,
    val acompte: Long = 0,
    val soldeRegle: Boolean = false,
    val recapEnvoyeLe: Long? = null,
    val livreeLe: Long? = null,
    val creeLe: Long = System.currentTimeMillis(),
    val majLe: Long = System.currentTimeMillis(),
)

/** Trace legere : « 3 modeles envoyes le 12/08 ». Une ligne, pas un
 *  historique de conversation. Elle sert a savoir qu'il faut relancer. */
@Entity(
    tableName = "envois",
    foreignKeys = [
        ForeignKey(
            entity = ClientEntite::class,
            parentColumns = ["id"],
            childColumns = ["clientId"],
            onDelete = ForeignKey.CASCADE,
        ),
    ],
    indices = [Index("clientId")],
)
data class EnvoiEntite(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val clientId: Long,
    val type: String,
    val nombre: Int = 1,
    val le: Long = System.currentTimeMillis(),
)
