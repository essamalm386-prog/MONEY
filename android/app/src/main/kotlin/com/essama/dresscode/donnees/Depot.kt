package com.essama.dresscode.donnees

import android.content.Context
import com.essama.dresscode.metier.Client
import com.essama.dresscode.metier.Commande
import com.essama.dresscode.metier.ModeleCatalogue
import com.essama.dresscode.metier.Statut
import com.essama.dresscode.metier.chiffresSeuls
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

/*
 * Le point d'entree unique des donnees. Les ecrans ne connaissent
 * que le vocabulaire du metier ; Room reste derriere.
 */
class Depot(contexte: Context) {

    private val base = BaseDressCode.obtenir(contexte)
    val photos = Photos(contexte)
    val reglages = Reglages(contexte)

    // ---------- Clientes ----------

    val clients: Flow<List<Client>> =
        base.clients().tout().map { liste -> liste.map { it.versMetier() } }

    fun client(id: Long): Flow<Client?> =
        base.clients().parId(id).map { it?.versMetier() }

    suspend fun enregistrerClient(client: Client): Long {
        val identifiant = base.clients().enregistrer(client.versEntite())
        /* Upsert rend -1 quand la ligne existait deja : dans ce cas
           l'identifiant d'origine est le bon. */
        return if (identifiant > 0) identifiant else client.id
    }

    /** Rattache a une fiche existante plutot que d'en creer une seconde. */
    suspend fun clientParNumero(telephone: String): Client? {
        val numero = chiffresSeuls(telephone)
        if (numero.isEmpty()) return null
        return base.clients().parNumero(numero)?.versMetier()
    }

    suspend fun supprimerClient(client: Client) {
        /* Les commandes partent avec, par cascade. Leurs photos, non :
           il faut les retirer du disque a la main. */
        base.commandes().instantane()
            .filter { it.clientId == client.id }
            .forEach { photos.supprimer(it.photo) }
        base.clients().supprimer(client.versEntite())
    }

    // ---------- Commandes ----------

    val commandes: Flow<List<Commande>> =
        base.commandes().tout().map { liste -> liste.map { it.versMetier() } }

    fun commande(id: Long): Flow<Commande?> =
        base.commandes().parId(id).map { it?.versMetier() }

    fun commandesDuClient(clientId: Long): Flow<List<Commande>> =
        base.commandes().parClient(clientId).map { liste -> liste.map { it.versMetier() } }

    suspend fun instantaneCommandes(): List<Commande> =
        base.commandes().instantane().map { it.versMetier() }

    suspend fun ajouterCommande(commande: Commande): Long =
        base.commandes().ajouter(commande.versEntite())

    suspend fun mettreAJourCommande(commande: Commande) {
        base.commandes().mettreAJour(commande.versEntite())
    }

    suspend fun supprimerCommande(commande: Commande) {
        /* La photo ne part que si le catalogue ne s'en sert pas. */
        val partagee = commande.photo != null &&
            base.modeles().parPhoto(commande.photo) != null
        if (!partagee) photos.supprimer(commande.photo)
        base.commandes().supprimer(commande.versEntite())
    }

    /**
     * Fait avancer une commande d'un statut. Rend la commande mise a
     * jour, ou null si elle etait deja au dernier statut.
     */
    suspend fun avancer(commande: Commande, soldeRegle: Boolean? = null): Commande? {
        val vise = commande.statut.suivant ?: return null
        val misAJour = commande.copy(
            statut = vise,
            soldeRegle = soldeRegle ?: commande.soldeRegle,
            livreeLe = if (vise == Statut.LIVREE) System.currentTimeMillis() else commande.livreeLe,
        )
        mettreAJourCommande(misAJour)
        return misAJour
    }

    // ---------- Catalogue ----------

    val modeles: Flow<List<ModeleCatalogue>> =
        base.modeles().tout().map { liste -> liste.map { it.versMetier() } }

    suspend fun enregistrerModele(modele: ModeleCatalogue): Long =
        base.modeles().enregistrer(modele.versEntite())

    suspend fun supprimerModele(modele: ModeleCatalogue) {
        /* Les commandes qui utilisent cette photo la gardent : on ne
           supprime le fichier que si plus rien n'y renvoie. */
        val utilisee = modele.photo != null &&
            base.commandes().instantane().any { it.photo == modele.photo }
        if (!utilisee) photos.supprimer(modele.photo)
        base.modeles().supprimer(modele.versEntite())
    }

    /**
     * Le catalogue se remplit tout seul : a chaque livraison la photo
     * et le prix existent deja. En deux mois d'usage normal, le
     * couturier a trente modeles sans avoir jamais fait l'effort d'en
     * constituer un.
     */
    suspend fun modelePeutEtreAjoute(commande: Commande): Boolean =
        commande.photo != null &&
            commande.modeleId == null &&
            base.modeles().parPhoto(commande.photo) == null

    // ---------- Envois ----------

    fun dernierEnvoi(clientId: Long): Flow<EnvoiEntite?> =
        base.envois().dernierPourClient(clientId)

    suspend fun noterEnvoi(clientId: Long, type: String, nombre: Int = 1) {
        base.envois().ajouter(EnvoiEntite(clientId = clientId, type = type, nombre = nombre))
    }
}
