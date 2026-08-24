import { supabase } from './supabase';

interface CityRef { id: string; country_code: string | null; }

export interface LaneMilesResult {
  us_miles: number | null;
  mx_miles: number | null;
  notes: string[];
}

async function resolveCity(cityText: string): Promise<CityRef | null> {
  const text = (cityText ?? "").trim();
  if (!text || text.toUpperCase() === "N/A") return null;
  const { data, error } = await supabase
    .from("cities")
    .select("id, country_code")
    .ilike("city_full_name", text)
    .limit(1);
  if (error || !data || data.length === 0) return null;
  return data[0] as CityRef;
}

async function getLegMiles(cityId: string, crossingId: string): Promise<number | null> {
  const { data, error } = await supabase.functions.invoke("get-lane-distance", {
    body: { city_id: cityId, border_crossing_city_id: crossingId },
  });
  if (error) { console.error("get-lane-distance error:", error); return null; }
  if (!data?.ok) { console.warn("get-lane-distance not-ok:", data?.error); return null; }
  return Number(data.distance_miles);
}

export async function fillLaneMiles(
  originText: string,
  destinationText: string,
  crossingText: string,
): Promise<LaneMilesResult> {
  const result: LaneMilesResult = { us_miles: null, mx_miles: null, notes: [] };
  const [origin, destination, crossing] = await Promise.all([
    resolveCity(originText),
    resolveCity(destinationText),
    resolveCity(crossingText),
  ]);
  if (!crossing) { result.notes.push("Sin cruce fronterizo — millas no autollenadas."); return result; }
  if (!origin) result.notes.push(`Origen "${originText}" no encontrado en cities.`);
  if (!destination) result.notes.push(`Destino "${destinationText}" no encontrado en cities.`);
  const assign = (city: CityRef | null, miles: number | null) => {
    if (!city || miles == null) return;
    if (city.country_code === "MEX") result.mx_miles = miles;
    else if (city.country_code === "USA") result.us_miles = miles;
  };
  if (origin) { const m = await getLegMiles(origin.id, crossing.id); assign(origin, m); }
  if (destination) { const m = await getLegMiles(destination.id, crossing.id); assign(destination, m); }
  return result;
}
