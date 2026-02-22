#!/bin/bash
echo "🚀 Début du processus de build Moodshare..."

# 1. Sync code Web
echo "📦 Synchronisation du code Web..."
# On utilise npx ici, à la racine du projet capacitor
npx cap copy android

# 2. Entrer dans android
cd android || exit

# 3. Build
echo "🏗️ Compilation de l'APK..."
./gradlew clean assembleDebug -Dorg.gradle.java.home=/usr/lib/jvm/java-17-openjdk-amd64

if [ $? -eq 0 ]; then
    echo "✅ Build réussi !"
    cp app/build/outputs/apk/debug/app-debug.apk ../../moodshare.apk
    echo "💾 APK copiée à la racine du projet : moodshare.apk"
else
    echo "❌ Le build a échoué."
    exit 1
fi