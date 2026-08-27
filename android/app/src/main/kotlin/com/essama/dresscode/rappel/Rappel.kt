package com.essama.dresscode.rappel

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.essama.dresscode.DressCodeApplication
import com.essama.dresscode.MainActivity
import com.essama.dresscode.R
import com.essama.dresscode.metier.resumeDuJour
import com.essama.dresscode.metier.texteRappel
import kotlinx.coroutines.flow.first
import java.time.Duration
import java.util.concurrent.TimeUnit
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime

/*
 * C'est la fonction que le cahier ne pourra jamais imiter, et celle
 * qui justifie l'installation : le couturier ne programme rien, il
 * note une date de livraison et l'application vient le chercher.
 *
 * Deux garde-fous, tenus ici :
 *   — Une notification par jour au maximum. Un resume du matin,
 *     jamais une alerte par commande. Une application qui vibre huit
 *     fois dans la journee est desinstallee dans la semaine.
 *   — Rien a dire, rien a envoyer. Une journee calme ne declenche
 *     aucune notification.
 */

object Rappel {
    const val CANAL = "resume-du-jour"
    private const val TRAVAIL = "rappel-du-matin"
    const val IDENTIFIANT_NOTIFICATION = 1

    fun creerCanal(contexte: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val canal = NotificationChannel(
            CANAL,
            "Résumé du matin",
            NotificationManager.IMPORTANCE_DEFAULT,
        ).apply {
            description = "Une notification par jour, jamais une par commande."
        }
        contexte.getSystemService(NotificationManager::class.java).createNotificationChannel(canal)
    }

    /**
     * Programme le prochain resume. Appele au demarrage et a chaque
     * changement d'heure dans les reglages ; le travail est unique,
     * un rappel deja programme est simplement remplace.
     */
    fun replanifier(contexte: Context, heure: Int? = null) {
        val cible = heure ?: 7
        val travail = PeriodicWorkRequestBuilder<RappelWorker>(1, TimeUnit.DAYS)
            .setInitialDelay(delaiJusqua(cible).toMinutes(), TimeUnit.MINUTES)
            .build()

        WorkManager.getInstance(contexte).enqueueUniquePeriodicWork(
            TRAVAIL,
            ExistingPeriodicWorkPolicy.UPDATE,
            travail,
        )
    }

    /* Temps restant jusqu'a la prochaine occurrence de l'heure
       choisie : si elle est passee, ce sera demain. */
    internal fun delaiJusqua(heure: Int, maintenant: LocalDateTime = LocalDateTime.now()): Duration {
        var prochain = maintenant.toLocalDate().atTime(LocalTime.of(heure, 0))
        if (!prochain.isAfter(maintenant)) prochain = prochain.plusDays(1)
        return Duration.between(maintenant, prochain)
    }

    fun notifier(contexte: Context, texte: String) {
        val ouvrir = PendingIntent.getActivity(
            contexte,
            0,
            Intent(contexte, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )

        val notification = NotificationCompat.Builder(contexte, CANAL)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle("Aujourd’hui")
            .setContentText(texte)
            .setContentIntent(ouvrir)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .build()

        /* La permission peut avoir ete refusee : ne pas insister. */
        runCatching {
            NotificationManagerCompat.from(contexte)
                .notify(IDENTIFIANT_NOTIFICATION, notification)
        }
    }
}

class RappelWorker(
    contexte: Context,
    parametres: WorkerParameters,
) : CoroutineWorker(contexte, parametres) {

    override suspend fun doWork(): Result {
        val depot = (applicationContext as DressCodeApplication).depot
        val atelier = depot.reglages.atelier.first()
        if (!atelier.rappelActif) return Result.success()

        val ceJour = LocalDate.now().toString()
        if (depot.reglages.dernierRappel.first() == ceJour) return Result.success()

        val resume = resumeDuJour(depot.instantaneCommandes())
        val texte = resume.texteRappel()

        /* Journee calme : on marque le jour comme traite pour ne pas
           reevaluer, mais on n'envoie rien. */
        depot.reglages.marquerRappelEnvoye(ceJour)
        if (texte != null) Rappel.notifier(applicationContext, texte)

        return Result.success()
    }
}
