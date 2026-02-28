/**
 * Location Service - Uses Google Maps API for geocoding and municipality assignment
 */

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

// Log API key status on startup
if (!GOOGLE_MAPS_API_KEY) {
  console.warn('⚠️ GOOGLE_MAPS_API_KEY is not set - geocoding will not work');
} else {
  console.log('✓ Google Maps API key loaded');
}

// Type definitions for Google Maps API response
interface GeocodeResponse {
  status: string;
  results: Array<{
    formatted_address: string;
    address_components: Array<{
      long_name: string;
      short_name: string;
      types: string[];
    }>;
  }>;
}

// Type definitions for Gemini API response
interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

// Municipality document type
interface MunicipalityDoc {
  id: string;
  name?: string;
  state?: string;
  district?: string;
  bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  [key: string]: unknown;
}

interface ReverseGeocodeResult {
  formattedAddress: string;
  state: string;
  district: string;
  city: string;
  locality: string;
  pincode: string;
  country: string;
}

interface MunicipalityMatch {
  municipalityId: string;
  name: string;
  confidence: number;
  matchType: 'BOUNDS' | 'DISTRICT' | 'STATE' | 'FALLBACK';
}

/**
 * Reverse geocode coordinates to get address components
 */
export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult | null> {
  try {
    if (!GOOGLE_MAPS_API_KEY) {
      console.error('Geocoding failed: GOOGLE_MAPS_API_KEY is not set');
      return null;
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}&language=en&region=in`;
    
    console.log(`Geocoding coordinates: ${lat}, ${lng}`);
    
    const response = await fetch(url);
    const data = await response.json() as GeocodeResponse;

    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      console.error('Geocoding API response error:', data.status, JSON.stringify(data).slice(0, 200));
      return null;
    }

    const result = data.results[0];
    const components = result.address_components || [];

    // Extract address components
    let state = '';
    let district = '';
    let city = '';
    let locality = '';
    let pincode = '';
    let country = '';

    for (const component of components) {
      const types = component.types || [];
      
      if (types.includes('administrative_area_level_1')) {
        state = component.long_name;
      }
      if (types.includes('administrative_area_level_2')) {
        district = component.long_name;
      }
      if (types.includes('administrative_area_level_3') || types.includes('locality')) {
        city = component.long_name;
      }
      if (types.includes('sublocality_level_1') || types.includes('sublocality')) {
        locality = component.long_name;
      }
      if (types.includes('postal_code')) {
        pincode = component.long_name;
      }
      if (types.includes('country')) {
        country = component.long_name;
      }
    }

    console.log(`Geocode result: state=${state}, district=${district}, city=${city}`);

    return {
      formattedAddress: result.formatted_address,
      state,
      district,
      city: city || locality,
      locality,
      pincode,
      country
    };
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return null;
  }
}

/**
 * Check if a point is within municipality bounds
 */
export function isPointInBounds(
  lat: number, 
  lng: number, 
  bounds: { north: number; south: number; east: number; west: number }
): boolean {
  return (
    lat <= bounds.north &&
    lat >= bounds.south &&
    lng <= bounds.east &&
    lng >= bounds.west
  );
}

/**
 * Find the best matching municipality for a location
 */
export async function findMunicipalityForLocation(
  lat: number,
  lng: number,
  db: FirebaseFirestore.Firestore
): Promise<MunicipalityMatch | null> {
  try {
    // First, reverse geocode to get address components
    const geocodeResult = await reverseGeocode(lat, lng);
    
    if (!geocodeResult) {
      console.warn('Could not geocode location, using fallback');
    }

    // Get all municipalities
    const municipalitiesSnapshot = await db.collection('municipalities').get();
    const municipalities: MunicipalityDoc[] = municipalitiesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as MunicipalityDoc));

    // Priority 1: Check if point is within any municipality bounds
    for (const muni of municipalities) {
      if (muni.bounds && isPointInBounds(lat, lng, muni.bounds)) {
        return {
          municipalityId: muni.id,
          name: muni.name || 'Unknown',
          confidence: 0.95,
          matchType: 'BOUNDS'
        };
      }
    }

    // Priority 2: Match by district
    if (geocodeResult?.district) {
      const districtMatch = municipalities.find(m => 
        m.district?.toLowerCase() === geocodeResult.district.toLowerCase() &&
        m.state?.toLowerCase() === geocodeResult.state.toLowerCase()
      );

      if (districtMatch) {
        return {
          municipalityId: districtMatch.id,
          name: districtMatch.name || 'Unknown',
          confidence: 0.8,
          matchType: 'DISTRICT'
        };
      }
    }

    // Priority 3: Match by state (less accurate)
    if (geocodeResult?.state) {
      const stateMatch = municipalities.find(m => 
        m.state?.toLowerCase() === geocodeResult.state.toLowerCase()
      );

      if (stateMatch) {
        return {
          municipalityId: stateMatch.id,
          name: stateMatch.name || 'Unknown',
          confidence: 0.5,
          matchType: 'STATE'
        };
      }
    }

    // Priority 4: Fallback to any municipality (for demo purposes)
    if (municipalities.length > 0) {
      return {
        municipalityId: municipalities[0].id,
        name: municipalities[0].name || 'Unknown',
        confidence: 0.1,
        matchType: 'FALLBACK'
      };
    }

    return null;
  } catch (error) {
    console.error('Error finding municipality for location:', error);
    return null;
  }
}

/**
 * Get the administrative region for a location
 */
export async function getAdministrativeRegion(lat: number, lng: number): Promise<{
  state: string;
  district: string;
  municipality: string;
  ward?: string;
  pincode?: string;
} | null> {
  const geocodeResult = await reverseGeocode(lat, lng);
  
  if (!geocodeResult) {
    return null;
  }

  return {
    state: geocodeResult.state,
    district: geocodeResult.district,
    municipality: geocodeResult.city || geocodeResult.locality || 'Unknown',
    pincode: geocodeResult.pincode || undefined
  };
}

/**
 * Get geographic bounds for a city/district/area using Google Geocoding API
 */
export async function getCityBounds(
  cityName: string, 
  district: string, 
  state: string
): Promise<{ north: number; south: number; east: number; west: number } | null> {
  try {
    // Try different search queries for better results
    const searchQueries = [
      `${cityName}, ${district}, ${state}, India`,
      `${district}, ${state}, India`,
      `${cityName}, ${state}, India`
    ];

    for (const query of searchQueries) {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GOOGLE_MAPS_API_KEY}`;
      
      const response = await fetch(url);
      const data = await response.json() as {
        status: string;
        results: Array<{
          geometry: {
            bounds?: {
              northeast: { lat: number; lng: number };
              southwest: { lat: number; lng: number };
            };
            viewport: {
              northeast: { lat: number; lng: number };
              southwest: { lat: number; lng: number };
            };
          };
        }>;
      };

      if (data.status === 'OK' && data.results && data.results.length > 0) {
        const geometry = data.results[0].geometry;
        
        // Prefer bounds over viewport (bounds is more accurate for cities)
        const boundsData = geometry.bounds || geometry.viewport;
        
        if (boundsData) {
          // Add a small buffer (about 5km) to the bounds for better coverage
          const latBuffer = 0.045; // ~5km
          const lngBuffer = 0.05;  // ~5km
          
          return {
            north: boundsData.northeast.lat + latBuffer,
            south: boundsData.southwest.lat - latBuffer,
            east: boundsData.northeast.lng + lngBuffer,
            west: boundsData.southwest.lng - lngBuffer
          };
        }
      }
    }

    console.warn(`Could not find bounds for: ${cityName}, ${district}, ${state}`);
    return null;
  } catch (error) {
    console.error('Error getting city bounds:', error);
    return null;
  }
}

/**
 * Get bounds for a municipality based on its registration data
 */
export async function getMunicipalityBounds(
  municipalityName: string,
  district: string,
  state: string
): Promise<{ north: number; south: number; east: number; west: number }> {
  // Try to get bounds from Google Maps
  const bounds = await getCityBounds(municipalityName, district, state);
  
  if (bounds) {
    console.log(`Got bounds for ${municipalityName}: N:${bounds.north} S:${bounds.south} E:${bounds.east} W:${bounds.west}`);
    return bounds;
  }

  // Fallback: Use approximate bounds for major Indian cities
  const cityBounds: Record<string, { north: number; south: number; east: number; west: number }> = {
    'hyderabad': { north: 17.60, south: 17.20, east: 78.70, west: 78.20 },
    'mumbai': { north: 19.30, south: 18.85, east: 73.00, west: 72.75 },
    'delhi': { north: 28.90, south: 28.40, east: 77.40, west: 76.80 },
    'bangalore': { north: 13.15, south: 12.75, east: 77.80, west: 77.40 },
    'chennai': { north: 13.30, south: 12.85, east: 80.35, west: 80.05 },
    'kolkata': { north: 22.70, south: 22.40, east: 88.50, west: 88.20 },
    'pune': { north: 18.65, south: 18.40, east: 73.95, west: 73.70 },
    'ahmedabad': { north: 23.15, south: 22.90, east: 72.70, west: 72.45 },
  };

  const cityKey = municipalityName.toLowerCase().replace(/[^a-z]/g, '');
  const districtKey = district.toLowerCase().replace(/[^a-z]/g, '');

  // Check if we have predefined bounds
  if (cityBounds[cityKey]) {
    console.log(`Using predefined bounds for ${cityKey}`);
    return cityBounds[cityKey];
  }
  if (cityBounds[districtKey]) {
    console.log(`Using predefined bounds for district ${districtKey}`);
    return cityBounds[districtKey];
  }

  // Last resort: Return zero bounds (will use district/state matching instead)
  console.warn(`No bounds available for ${municipalityName}, ${district}, ${state}`);
  return { north: 0, south: 0, east: 0, west: 0 };
}

/**
 * Use Gemini to classify issue type from description
 * (For later ML implementation)
 */
export async function classifyIssueWithGemini(description: string, imageUrl?: string): Promise<{
  type: string;
  confidence: number;
} | null> {
  if (!GEMINI_API_KEY) {
    console.warn('Gemini API key not configured');
    return null;
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    const prompt = `You are a civic issue classifier for an Indian municipal complaint system.
    
Classify the following issue description into one of these categories:
- POTHOLE: Road potholes, damaged road surface
- GARBAGE: Garbage accumulation, waste not collected
- DRAINAGE: Blocked drains, water logging, drainage issues
- ROAD_DAMAGE: Road cracks, damaged roads (not potholes)
- STREETLIGHT: Non-functional streetlights, lighting issues
- WATER_SUPPLY: Water supply problems, pipe leaks
- SEWAGE: Sewage overflow, sanitation issues
- ENCROACHMENT: Illegal construction, footpath blocking
- OTHER: Any other civic issue

Issue Description: "${description}"

Respond ONLY with a JSON object in this exact format:
{"type": "CATEGORY_NAME", "confidence": 0.0}

The confidence should be between 0 and 1.`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }]
      })
    });

    const data = await response.json() as GeminiResponse;
    
    if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
      const text = data.candidates[0].content.parts[0].text;
      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    }

    return null;
  } catch (error) {
    console.error('Gemini classification error:', error);
    return null;
  }
}

export default {
  reverseGeocode,
  isPointInBounds,
  findMunicipalityForLocation,
  getAdministrativeRegion,
  classifyIssueWithGemini,
  getCityBounds,
  getMunicipalityBounds
};
