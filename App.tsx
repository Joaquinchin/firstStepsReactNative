import { useState } from "react";
import { View, Text, Pressable, StyleSheet, TextInput, ActivityIndicator } from "react-native";
import * as Location from "expo-location";

export default function App() {
  // Estado para dos contadores
  const [countA, setCountA] = useState<number>(0);
  const [countB, setCountB] = useState<number>(0);
  // Estado para el texto
  const [inputText, setInputText] = useState<string>("");

  // ==== Ubicación ====
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  async function handleGetLocation() {
    try {
      setLocError(null);
      setIsGettingLocation(true);

      // 1) Pedir permiso
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocError("Permiso de ubicación denegado. Podés habilitarlo desde Ajustes > Expo Go > Ubicación.");
        return;
      }

      // 2) Obtener posición actual
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced, // menor consumo que High
      });

      setLocation({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
    } catch (e: any) {
      setLocError(e?.message ?? "Ocurrió un error al obtener la ubicación.");
    } finally {
      setIsGettingLocation(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Estadio Santiago Bernabeu 9/12</Text>

      {/* Contador Equipo A */}
      <Text style={styles.paragraph}>
        River Plate tu grato Nombre: <Text style={styles.bold}>{countA}</Text>
      </Text>
      <Pressable style={styles.button} onPress={() => setCountA((c) => c + 1)}>
        <Text style={styles.buttonText}>Sumar CARP</Text>
      </Pressable>

      {/* Contador Equipo B */}
      <Text style={styles.paragraph}>
        boquita fallecido: <Text style={styles.bold}>{countB}</Text>
      </Text>
      <Pressable style={styles.button} onPress={() => setCountB((c) => c + 1)}>
        <Text style={styles.buttonText}>Sumar B</Text>
      </Pressable>

      {/* Botón único para reiniciar ambos contadores */}
      <Pressable
        style={[styles.button, styles.secondary]}
        onPress={() => {
          setCountA(0);
          setCountB(0);
        }}
      >
        <Text style={styles.buttonText}>Reiniciar Marcador</Text>
      </Pressable>

      {/* Input de texto y visualización */}
      <Text style={styles.title}>Escribe algo:</Text>
      <View style={styles.inputBox}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Escribe aquí..."
        />
      </View>

      {/* ===== Sección de Ubicación ===== */}
      <Text style={styles.title}>Ubicación actual</Text>

      <Pressable
        style={styles.button}
        onPress={handleGetLocation}
        disabled={isGettingLocation}
      >
        {isGettingLocation ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Obtener ubicación</Text>
        )}
      </Pressable>

      {locError && <Text style={styles.error}>{locError}</Text>}

      {location && (
        <View style={styles.displayBox}>
          <Text style={styles.displayText}>
            Lat: {location.latitude.toFixed(6)}
          </Text>
          <Text style={styles.displayText}>
            Lon: {location.longitude.toFixed(6)}
          </Text>
        </View>
      )}
    </View>
  );
}

// Estilos (parecido a CSS pero en JS/TS)
const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 80, paddingHorizontal: 20, backgroundColor: "#fff" },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 12 },
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
    alignItems: "center",
    marginBottom: 20,
  },
  displayText: {
    fontSize: 18,
    color: "#222",
  },
  error: {
    color: "#b00020",
    marginBottom: 10,
  },
});
