package com.essama.dresscode.charte

import androidx.compose.runtime.Immutable

/*
 * Genere par outils/generer-icones-android.mjs — ne pas modifier a la main.
 *
 * Les icones sont les Material Symbols Rounded du kit, sous-ensemblees
 * aux 57 reellement utilisees. On les adresse par leur point de
 * code et non par leur ligature : le sous-ensemblage elague les regles
 * GSUB de la police, et une ligature perdue afficherait le mot
 * « straighten » a la place du glyphe.
 *
 * Ajouter une icone : la lister dans outils/icones-utilisees.txt,
 * relancer outils/sous-ensembler-icones.mjs puis
 * outils/generer-polices-android.mjs et ce script.
 */

@Immutable
@JvmInline
value class Icone(val glyphe: String)

object Icones {
    val Today = Icone("\ue8df")
    val Checkroom = Icone("\uf19e")
    val Group = Icone("\ue7ef")
    val PhotoLibrary = Icone("\ue413")
    val Storefront = Icone("\uea12")
    val ArrowBack = Icone("\ue5c4")
    val Close = Icone("\ue14c")
    val Search = Icone("\ue8b6")
    val MoreVert = Icone("\ue5d4")
    val Contrast = Icone("\ueb37")
    val Menu = Icone("\ue5d2")
    val ChevronRight = Icone("\ue409")
    val ExpandMore = Icone("\ue5cf")
    val ArrowForward = Icone("\ue5c8")
    val OpenInNew = Icone("\ue895")
    val Add = Icone("\ue145")
    val Edit = Icone("\ue150")
    val Delete = Icone("\ue872")
    val Check = Icone("\ue5ca")
    val CheckCircle = Icone("\ue86c")
    val Save = Icone("\ue161")
    val ContentCopy = Icone("\ue14d")
    val Download = Icone("\ue171")
    val Share = Icone("\ue80d")
    val Send = Icone("\ue163")
    val Call = Icone("\ue0b0")
    val PersonAdd = Icone("\ue7fe")
    val PhotoCamera = Icone("\ue3b0")
    val AddPhotoAlternate = Icone("\ue43e")
    val Image = Icone("\ue251")
    val CalendarMonth = Icone("\uebcc")
    val FilterList = Icone("\ue152")
    val Visibility = Icone("\ue417")
    val ContentCut = Icone("\ue14e")
    val Iron = Icone("\ue583")
    val Inventory2 = Icone("\ue1a1")
    val Schedule = Icone("\ue192")
    val Warning = Icone("\ue002")
    val PriorityHigh = Icone("\ue645")
    val Error = Icone("\ue000")
    val Info = Icone("\ue88e")
    val Notifications = Icone("\ue7f4")
    val NotificationsActive = Icone("\ue7f7")
    val Straighten = Icone("\ue41c")
    val Payments = Icone("\uef63")
    val Person = Icone("\ue7fd")
    val Upload = Icone("\ue2c6")
    val ReceiptLong = Icone("\uef6e")
    val Sell = Icone("\ue54e")
    val History = Icone("\ue28e")
    val PictureAsPdf = Icone("\ue415")
    val Celebration = Icone("\uea65")
    val CloudOff = Icone("\ue2c1")
    val WifiOff = Icone("\ue648")
    val Backup = Icone("\ue864")
    val SettingsBackupRestore = Icone("\ue8ba")
    val SentimentSatisfied = Icone("\ue0ed")
}
