package com.essama.dresscode.charte

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import com.essama.dresscode.R

/*
 * Deux familles, comme le prescrit la charte : Roboto Flex pour les
 * titres et l'identite, Roboto pour tout le reste. Les fichiers sont
 * ceux du kit, convertis en TTF par outils/generer-polices-android.mjs.
 *
 * L'echelle reprend les 15 styles de Material 3. Ne pas inventer de
 * taille intermediaire : si 22 sp parait trop grand et 16 sp trop
 * petit, le probleme est la hierarchie, pas la taille.
 */

val Marque = FontFamily(Font(R.font.roboto_flex))
val Courant = FontFamily(Font(R.font.roboto))

private fun titre(taille: Int, hauteur: Int, graisse: FontWeight, interlettrage: Double) = TextStyle(
    fontFamily = Marque,
    fontWeight = graisse,
    fontSize = taille.sp,
    lineHeight = hauteur.sp,
    letterSpacing = interlettrage.sp,
)

private fun texte(taille: Int, hauteur: Int, graisse: FontWeight, interlettrage: Double) = TextStyle(
    fontFamily = Courant,
    fontWeight = graisse,
    fontSize = taille.sp,
    lineHeight = hauteur.sp,
    letterSpacing = interlettrage.sp,
)

val typographie = Typography(
    displayLarge = titre(57, 64, FontWeight.Normal, -0.25),
    displayMedium = titre(45, 52, FontWeight.Normal, 0.0),
    displaySmall = titre(36, 44, FontWeight.Normal, 0.0),

    headlineLarge = titre(32, 40, FontWeight.SemiBold, 0.0),
    headlineMedium = titre(28, 36, FontWeight.SemiBold, 0.0),
    headlineSmall = titre(24, 32, FontWeight.SemiBold, 0.0),

    titleLarge = texte(22, 28, FontWeight.Normal, 0.0),
    titleMedium = texte(16, 24, FontWeight.Medium, 0.15),
    titleSmall = texte(14, 20, FontWeight.Medium, 0.1),

    bodyLarge = texte(16, 24, FontWeight.Normal, 0.5),
    bodyMedium = texte(14, 20, FontWeight.Normal, 0.25),
    bodySmall = texte(12, 16, FontWeight.Normal, 0.4),

    labelLarge = texte(14, 20, FontWeight.Medium, 0.1),
    labelMedium = texte(12, 16, FontWeight.Medium, 0.5),
    labelSmall = texte(11, 16, FontWeight.Medium, 0.5),
)
