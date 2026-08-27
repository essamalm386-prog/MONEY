plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.ksp)
}

android {
    namespace = "com.essama.dresscode"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.essama.dresscode"
        minSdk = 24
        targetSdk = 35
        versionCode = (project.findProperty("versionCode") as String?)?.toInt() ?: 1
        versionName = (project.findProperty("versionName") as String?) ?: "1.0.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        /* Sans ce service, les captures produites par un test
           instrumente restent prisonnieres du telephone : depuis
           Android 11, adb ne voit plus /sdcard/Android/data/<paquet>. */
        testInstrumentationRunnerArguments["useTestStorageService"] = "true"
        vectorDrawables { useSupportLibrary = true }
    }

    signingConfigs {
        create("publication") {
            // Renseignee par le workflow quand la cle existe dans les
            // secrets du depot. Sinon la construction retombe sur la
            // signature de debogage : suffisant pour installer
            // l'application a la main, pas pour le Play Store.
            val chemin = project.findProperty("storeFilePath") as String?
            if (chemin != null) {
                storeFile = file(chemin)
                storePassword = project.findProperty("storePassword") as String?
                keyAlias = project.findProperty("keyAlias") as String?
                keyPassword = project.findProperty("keyPassword") as String?
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = if (project.hasProperty("storeFilePath")) {
                signingConfigs.getByName("publication")
            } else {
                signingConfigs.getByName("debug")
            }
        }
        debug {
            applicationIdSuffix = ".debug"
        }
    }

    compileOptions {
        /* Tout le moteur metier raisonne en java.time, qui n'existe
           qu'a partir d'Android 8. Le desugaring le rend disponible
           des Android 7 : le produit vise des telephones d'entree de
           gamme, en exclure une generation entiere serait cher paye. */
        isCoreLibraryDesugaringEnabled = true
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        compose = true
    }
    packaging {
        resources.excludes += "/META-INF/{AL2.0,LGPL2.1}"
    }
    sourceSets {
        getByName("main").java.srcDirs("src/main/kotlin")
        getByName("test").java.srcDirs("src/test/kotlin")
        getByName("androidTest").java.srcDirs("src/androidTest/kotlin")
    }
}

ksp {
    // Le schema de la base est versionne : une migration oubliee se
    // voit alors dans la revue, pas sur le telephone d'un couturier.
    arg("room.schemaLocation", "$projectDir/schemas")
}

dependencies {
    coreLibraryDesugaring(libs.desugar.jdk.libs)

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.exifinterface)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.navigation.compose)

    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.ui.graphics)
    implementation(libs.compose.ui.tooling.preview)
    implementation(libs.compose.material3)
    debugImplementation(libs.compose.ui.tooling)

    implementation(libs.androidx.room.runtime)
    implementation(libs.androidx.room.ktx)
    ksp(libs.androidx.room.compiler)

    implementation(libs.androidx.datastore.preferences)
    implementation(libs.androidx.work.runtime.ktx)
    implementation(libs.coil.compose)

    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.coroutines.test)

    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.test.storage)
    androidTestUtil(libs.androidx.test.services)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(platform(libs.compose.bom))
    androidTestImplementation(libs.compose.ui.test.junit4)
    debugImplementation(libs.compose.ui.test.manifest)
}
