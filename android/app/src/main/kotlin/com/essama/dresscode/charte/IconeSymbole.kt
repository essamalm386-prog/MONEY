package com.essama.dresscode.charte

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.ExperimentalTextApi
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.essama.dresscode.R

/*
 * Pose une icone Material Symbols.
 *
 * Les quatre axes variables comptent autant que le trace, et c'est
 * la que se joue « joli / pas joli » :
 *   opsz  doit egaler la taille de rendu — l'erreur numero un ;
 *   wght  doit suivre la graisse du texte voisin ;
 *   GRAD  monte a 25 en mode sombre, pour compenser l'irradiation
 *         optique : un trait clair sur fond noir parait plus fin ;
 *   FILL  passe a 1 pour un etat actif.
 *
 * Les axes variables demandent Android 8. En deca, la police rend son
 * instance par defaut : le trait est correct, seul l'etat rempli ne
 * se distingue plus — d'ou la couleur et le libelle qui portent
 * toujours l'information en plus de l'icone.
 */

object Taille {
    /* Dans un texte, un chip, un badge. */
    val petite = 20.sp
    /* Interface par defaut. */
    val normale = 24.sp
    /* En-tete de section, carte. */
    val grande = 40.sp
    /* Etat vide, illustration. */
    val illustration = 48.sp
}

/* variationSettings est encore marque experimental : c'est
   pourtant la seule facon de piloter les quatre axes, et la
   charte les exige. */
@OptIn(ExperimentalTextApi::class)
@Composable
private fun familleSymboles(
    taille: TextUnit,
    graisse: Int,
    remplie: Boolean,
    grade: Int,
): FontFamily = FontFamily(
    Font(
        R.font.material_symbols_rounded,
        variationSettings = FontVariation.Settings(
            FontVariation.Setting("FILL", if (remplie) 1f else 0f),
            FontVariation.Setting("wght", graisse.toFloat()),
            FontVariation.Setting("GRAD", grade.toFloat()),
            FontVariation.Setting("opsz", taille.value),
        ),
    ),
)

/**
 * Icone decorative : le texte a cote dit deja la meme chose.
 * Pour une icone seule porteuse de sens, renseigner [description].
 */
@Composable
fun IconeSymbole(
    icone: Icone,
    modifier: Modifier = Modifier,
    taille: TextUnit = Taille.normale,
    couleur: Color = LocalContentColor.current,
    remplie: Boolean = false,
    graisse: Int = 400,
    description: String? = null,
) {
    val grade = if (isSystemInDarkTheme()) 25 else 0
    Text(
        text = icone.glyphe,
        color = couleur,
        modifier = if (description != null) {
            modifier.semantics { contentDescription = description }
        } else {
            modifier
        },
        style = TextStyle(
            fontFamily = familleSymboles(taille, graisse, remplie, grade),
            fontSize = taille,
            fontWeight = FontWeight.Normal,
            lineHeight = taille,
        ),
    )
}
