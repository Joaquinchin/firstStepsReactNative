import { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  ScrollView,
  Image,
} from "react-native";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";

type Coords = { latitude: number; longitude: number };
type SavedLoc = { id: string; latitude: number; longitude: number; address?: string | null; timestamp: number; imageUri?: string | null };

const STORAGE_KEY = "@saved_locations";

export default function App() {
  const [countA, setCountA] = useState<number>(0);
  const [countB, setCountB] = useState<number>(0);

  // Ubicación 
  const [location, setLocation] = useState<Coords | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  const [saved, setSaved] = useState<SavedLoc[]>([]);
  const [isLoadingSaved, setIsLoadingSaved] = useState(true);

  useEffect(() => {
    loadSavedLocation();
  }, []);

  async function loadSavedLocation() {
    try {
      setIsLoadingSaved(true);
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: SavedLoc[] = JSON.parse(raw);
        setSaved(Array.isArray(parsed) ? parsed : []);
      } else {
        setSaved([]);
      }
    } catch (e) {
      console.warn("No se pudo cargar las ubicaciones guardadas", e);
      setSaved([]);
    } finally {
      setIsLoadingSaved(false);
    }
  }

  function formatAddress(p: Location.LocationGeocodedAddress) {
    // Campos útiles varían por plataforma y país
    const parts = [
      p.name, // a veces el número/POI
      p.street,
      p.district || p.subregion, // barrio/partido
      p.city || p.subregion,
      p.region, // provincia
      p.postalCode,
      p.country,
    ].filter(Boolean);
    return parts.join(", ");
  }

  async function handleGetLocation() {
    try {
      setLocError(null);
      setIsGettingLocation(true);

      // 1 Permiso
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocError(
          "Permiso de ubicación denegado. Activalo en Ajustes > Apps > Expo Go > Ubicación."
        );
        return;
      }

      // 2 Coordenadas
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      setLocation(coords);

      // 3Reverse geocoding → dirección
      let addr: string | null = null;
      try {
        const places = await Location.reverseGeocodeAsync(coords);
        if (places && places.length > 0) {
          addr = formatAddress(places[0]);
          setAddress(addr);
        } else {
          setAddress(null);
        }
      } catch {
        setAddress(null);
      }

      // 4 Guardar en AsyncStorage
      const toSave: SavedLoc = { 
        id: Date.now().toString(), 
        ...coords, 
        address: addr, 
        timestamp: Date.now() 
      };
      const newSaved = [...saved, toSave];
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newSaved));
      setSaved(newSaved);
    } catch (e: any) {
      setLocError(e?.message ?? "Ocurrió un error al obtener la ubicación.");
    } finally {
      setIsGettingLocation(false);
    }
  }

  async function clearSaved() {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setSaved([]);
    setLocation(null);
    setAddress(null);
  }

  async function removeSavedLocation(id: string) {
    const newSaved = saved.filter(loc => loc.id !== id);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newSaved));
    setSaved(newSaved);
  }

  async function openInMaps(target?: Coords) {
    const coords = target || location || (saved.length > 0 ? { latitude: saved[0].latitude, longitude: saved[0].longitude } : null);
    if (!coords) {
      Alert.alert("Sin ubicación", "Primero obtené tu ubicación.");
      return;
    }
    const { latitude, longitude } = coords;
    const label = address || (saved.length > 0 ? saved[0].address : null) || "Ubicación";
    const q = encodeURIComponent(label ?? "Ubicación");

    // iOS Apple Maps o fallback a Google Maps web
    const primary = Platform.select({
      ios: `http://maps.apple.com/?ll=${latitude},${longitude}&q=${q}`,

      default: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
    });

    const fallback = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;

    try {
      if (primary && (await Linking.canOpenURL(primary))) {
        await Linking.openURL(primary);
      } else {
        await Linking.openURL(fallback);
      }
    } catch {
      Alert.alert("No se pudo abrir Mapas", "Probá copiar las coordenadas y abrir Google Maps manualmente.");
    }
  }

  // funciones para la parte de fotos
  async function handleTakePhoto(locationId: string) {
    try {
      // Pedir permisos de cámara
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permisos requeridos', 'Necesitamos permisos de cámara para tomar fotos.');
        return;
      }

      // Mostrar opciones: cámara o galería
      Alert.alert(
        'Agregar foto',
        'Elige una opción',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Cámara', onPress: () => openCamera(locationId) },
          { text: 'Galería', onPress: () => openGallery(locationId) },
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'No se pudo acceder a la cámara');
    }
  }

  async function openCamera(locationId: string) {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await savePhotoToLocation(locationId, result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo tomar la foto');
    }
  }

  async function openGallery(locationId: string) {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await savePhotoToLocation(locationId, result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo seleccionar la foto');
    }
  }

  async function savePhotoToLocation(locationId: string, imageUri: string) {
    try {
      const updatedSaved = saved.map(loc => 
        loc.id === locationId 
          ? { ...loc, imageUri }
          : loc
      );
      
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSaved));
      setSaved(updatedSaved);
      Alert.alert('¡Éxito!', 'Foto agregada a la ubicación');
    } catch (error) {
      Alert.alert('Error', 'No se pudo guardar la foto');
    }
  }


  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}> {/*mostar o no el scroll bar*/}
        <Text style={styles.title}>Estadio Santiago Bernabeu 9/12</Text>

      {/*Primer contador*/}
      <Text style={styles.paragraph}>
        River Plate tu grato Nombre: <Text style={styles.bold}>{countA}</Text>
      </Text>
      <Pressable style={styles.button} onPress={() => setCountA((c) => c + 1)}>
        <Text style={styles.buttonText}>Sumar CARP</Text>
      </Pressable>

      {/*Segundo contador*/}
      <Text style={styles.paragraph}>
        boquita fallecido: <Text style={styles.bold}>{countB}</Text>
      </Text>
      <Pressable style={styles.button} onPress={() => setCountB((c) => c + 1)}>
        <Text style={styles.buttonText}>Sumar B</Text>
      </Pressable>

      {/*Reset ambos*/}
      <Pressable style={[styles.button, styles.secondary]} onPress={() => { setCountA(0); setCountB(0); }}>
        <Text style={styles.buttonText}>Reiniciar Marcador</Text>
      </Pressable>

      {/*Ubicación*/}
      <Text style={styles.title}>Ubicación</Text>

      <Pressable style={styles.button} onPress={handleGetLocation} disabled={isGettingLocation}>
        {isGettingLocation ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Obtener ubicación</Text>}
      </Pressable>

      {locError && <Text style={styles.error}>{locError}</Text>}

      {location && (
        <View style={styles.displayBox}>
          <Text style={styles.displayText}>Lat: {location.latitude.toFixed(6)}</Text>
          <Text style={styles.displayText}>Lon: {location.longitude.toFixed(6)}</Text>
          <Text style={[styles.displayText, { opacity: 0.85 }]}>
            {address ? address : "Dirección no disponible (quizá ubicación no precisa)."}
          </Text>

          <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
            <Pressable style={styles.button} onPress={() => openInMaps()}>
              <Text style={styles.buttonText}>Abrir en Mapas</Text>
            </Pressable>
            {saved.length > 0 && (
              <Pressable style={[styles.button, styles.secondary]} onPress={clearSaved}>
                <Text style={styles.buttonText}>Borrar todas</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      {/*Ubicaciones guardadas*/}
      <View style={styles.savedBox}>
        <Text style={styles.subtitle}>Ubicaciones guardadas ({saved.length})</Text>
        {isLoadingSaved ? (
          <ActivityIndicator />
        ) : saved.length > 0 ? (
          <>
            {saved.map((loc) => (
              <View key={loc.id} style={styles.savedItem}>
                <View style={styles.savedItemContent}>
                  <Text style={styles.displayText}>Lat: {loc.latitude.toFixed(6)}</Text>
                  <Text style={styles.displayText}>Lon: {loc.longitude.toFixed(6)}</Text>
                  <Text style={[styles.displayText, { opacity: 0.85 }]}>
                    {loc.address || "Dirección no disponible"}
                  </Text>
                  <Text style={{ opacity: 0.7, marginTop: 4, fontSize: 12 }}>
                    {new Date(loc.timestamp).toLocaleString()}
                  </Text>
                  
                  {/* Mostrar foto si existe */}
                  {loc.imageUri && (
                    <Image source={{ uri: loc.imageUri }} style={styles.locationPhoto} />
                  )}
                </View>
                <View style={styles.savedItemActions}>
                  <Pressable 
                    style={[styles.button, { marginBottom: 5 }]} 
                    onPress={() => openInMaps({ latitude: loc.latitude, longitude: loc.longitude })}
                  >
                    <Text style={styles.buttonText}>Abrir</Text>
                  </Pressable>
                  
                  {/* Botón de cámara */}
                  <Pressable 
                    style={[styles.button, styles.cameraButton, { marginBottom: 5 }]} 
                    onPress={() => handleTakePhoto(loc.id)}
                  >
                    <Text style={styles.buttonText}>📷</Text>
                  </Pressable>
                  
                  <Pressable 
                    style={styles.deleteButton} 
                    onPress={() => removeSavedLocation(loc.id)}
                  >
                    <Text style={styles.deleteButtonText}>✕</Text>
                  </Pressable>
                </View>
              </View>
            ))}
            <Pressable style={[styles.button, styles.secondary, { marginTop: 10 }]} onPress={clearSaved}>
              <Text style={styles.buttonText}>Borrar todas las ubicaciones</Text>
            </Pressable>
          </>
        ) : (
          <Text style={{ opacity: 0.6 }}>No hay ubicaciones guardadas.</Text>
        )}
      </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 80, paddingHorizontal: 20, backgroundColor: "#fff" },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 12 },
  subtitle: { fontSize: 18, fontWeight: "700", marginTop: 8, marginBottom: 6 },
  paragraph: { fontSize: 16, marginBottom: 12 },
  bold: { fontWeight: "700" },
  button: {
    backgroundColor: "#111",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 10,
    alignSelf: "flex-start",
  },
  secondary: { backgroundColor: "#444" },
  buttonText: { color: "#fff", fontWeight: "600" },
  inputBox: {
    borderWidth: 1,
    borderColor: "#888",
    borderRadius: 8,
    padding: 8,
    marginBottom: 12,
    backgroundColor: "#f9f9f9",
  },
  input: {
    height: 40,
    fontSize: 16,
    paddingHorizontal: 8,
    backgroundColor: "#fff",
    borderRadius: 4,
  },
  displayBox: {
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#eee",
    alignItems: "flex-start",
    gap: 2,
    marginBottom: 20,
  },
  savedBox: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#fafafa",
    alignItems: "flex-start",
    gap: 2,
    marginBottom: 20,
  },
  displayText: { fontSize: 16, color: "#222" },
  error: { color: "#b00020", marginBottom: 10 },
  savedItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    backgroundColor: "#f0f0f0",
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  savedItemContent: {
    flex: 1,
    gap: 2,
  },
  savedItemActions: {
    alignItems: "center",
    gap: 5,
    marginLeft: 10,
  },
  deleteButton: {
    backgroundColor: "#dc3545",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  cameraButton: {
    backgroundColor: "#28a745",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  locationPhoto: {
    width: 150,
    height: 112.5,
    borderRadius: 8,
    marginTop: 8,
    resizeMode: 'cover',
  },
});
