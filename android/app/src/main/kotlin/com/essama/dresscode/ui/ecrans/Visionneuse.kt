package com.essama.dresscode.ui.ecrans

import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import coil.compose.AsyncImage
import com.essama.dresscode.charte.Espace
import com.essama.dresscode.charte.IconeSymbole
import com.essama.dresscode.charte.Icones
import java.io.File

/*
 * Voir une photo en grand.
 *
 * Une vignette de 150 px ne sert qu'a reconnaitre ; c'est en grand
 * qu'on regarde une broderie, qu'on compte des plis, qu'on montre un
 * modele a une cliente par-dessus l'epaule. Sans cet ecran, la seule
 * facon de revoir une photo prise dans l'application etait de ne pas
 * la prendre dedans.
 *
 * Le pincement agrandit : sur une photo de finitions, c'est la
 * difference entre voir un point et le deviner.
 */
@Composable
fun VisionneusePhoto(fichier: File, description: String, surFermeture: () -> Unit) {
    Dialog(
        onDismissRequest = surFermeture,
        properties = DialogProperties(usePlatformDefaultWidth = false),
    ) {
        var echelle by remember { mutableFloatStateOf(1f) }
        var decalage by remember { mutableStateOf(Offset.Zero) }

        Box(
            modifier = Modifier
                .testTag("visionneuse")
                .fillMaxSize()
                .background(Color.Black),
            contentAlignment = Alignment.Center,
        ) {
            AsyncImage(
                model = fichier,
                contentDescription = description,
                contentScale = ContentScale.Fit,
                modifier = Modifier
                    .fillMaxSize()
                    .pointerInput(Unit) {
                        detectTransformGestures { _, panne, zoom, _ ->
                            echelle = (echelle * zoom).coerceIn(1f, 5f)
                            /* Revenu a la taille d'origine, la photo se
                               recentre : sinon elle reste de travers
                               apres un zoom arriere. */
                            decalage = if (echelle <= 1f) Offset.Zero else decalage + panne
                        }
                    }
                    .graphicsLayer(
                        scaleX = echelle,
                        scaleY = echelle,
                        translationX = decalage.x,
                        translationY = decalage.y,
                    ),
            )

            IconButton(
                onClick = surFermeture,
                modifier = Modifier.align(Alignment.TopEnd).padding(Espace.quatre),
            ) {
                IconeSymbole(icone = Icones.Close, couleur = Color.White)
            }
        }
    }
}
