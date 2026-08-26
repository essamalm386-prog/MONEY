package com.essama.dresscode.donnees

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.essama.dresscode.charte.Apparence
import com.essama.dresscode.metier.Atelier
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

/*
 * La fiche atelier se remplit une seule fois, en trente secondes, et
 * ressert a vie sur tous les envois. C'est elle qui fait qu'une
 * cliente qui montre son recapitulatif a ses soeurs leur montre
 * aussi le nom et le numero de l'atelier.
 */

private val Context.stockage by preferencesDataStore(name = "reglages")

private object Cles {
    val nom = stringPreferencesKey("atelier_nom")
    val telephone = stringPreferencesKey("atelier_telephone")
    val adresse = stringPreferencesKey("atelier_adresse")
    val indicatif = stringPreferencesKey("atelier_indicatif")
    val heureRappel = intPreferencesKey("heure_rappel")
    val rappelActif = booleanPreferencesKey("rappel_actif")
    val apparence = stringPreferencesKey("apparence")
    val dernierRappel = stringPreferencesKey("dernier_rappel")
}

class Reglages(private val contexte: Context) {

    val atelier: Flow<Atelier> = contexte.stockage.data.map { p ->
        Atelier(
            nom = p[Cles.nom] ?: "",
            telephone = p[Cles.telephone] ?: "",
            adresse = p[Cles.adresse] ?: "",
            indicatif = p[Cles.indicatif] ?: "221",
            heureRappel = p[Cles.heureRappel] ?: 7,
            rappelActif = p[Cles.rappelActif] ?: true,
        )
    }

    val apparence: Flow<Apparence> = contexte.stockage.data.map { p ->
        runCatching { Apparence.valueOf(p[Cles.apparence] ?: "") }.getOrDefault(Apparence.Systeme)
    }

    suspend fun enregistrerAtelier(atelier: Atelier) {
        contexte.stockage.edit { p ->
            p[Cles.nom] = atelier.nom
            p[Cles.telephone] = atelier.telephone
            p[Cles.adresse] = atelier.adresse
            p[Cles.indicatif] = atelier.indicatif
            p[Cles.heureRappel] = atelier.heureRappel
            p[Cles.rappelActif] = atelier.rappelActif
        }
    }

    suspend fun enregistrerApparence(apparence: Apparence) {
        contexte.stockage.edit { it[Cles.apparence] = apparence.name }
    }

    /** Date ISO du dernier rappel envoye : un par jour au maximum. */
    val dernierRappel: Flow<String?> = contexte.stockage.data.map { it[Cles.dernierRappel] }

    suspend fun marquerRappelEnvoye(jour: String) {
        contexte.stockage.edit { it[Cles.dernierRappel] = jour }
    }
}
