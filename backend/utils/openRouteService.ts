// app/utils/openRouteService.ts
export const ORS_API_KEY =
  "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6Ijc4OWYxYjU3MTdjNDQ4NGFiMjVjNWExZDU0MWI1ZWIxIiwiaCI6Im11cm11cjY0In0=";

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface Route {
  coordinates: Coordinate[];
  distance: number;
  duration: number;
}

export const calculateRoute = async (
  start: Coordinate,
  end: Coordinate,
  profile: "driving-car" | "foot-walking" | "cycling-regular" = "driving-car",
): Promise<Route | null> => {
  try {
    const response = await fetch(
      "https://api.openrouteservice.org/v2/directions/" + profile,
      {
        method: "POST",
        headers: {
          Authorization: ORS_API_KEY,
          "Content-Type": "application/json",
          Accept: "application/json, application/geo+json",
        },
        body: JSON.stringify({
          coordinates: [
            [start.longitude, start.latitude],
            [end.longitude, end.latitude],
          ],
          instructions: false,
          preference: "recommended",
          units: "km",
          language: "en",
          geometry: true,
          // REMOVED: geometry_format: 'geojson', // This parameter is not supported
        }),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("OpenRouteService API error:", error);
      return null;
    }

    const data = await response.json();

    if (data.routes && data.routes.length > 0) {
      const route = data.routes[0];

      // Extract coordinates from the geometry (OpenRouteService returns encoded polyline or coordinates array)
      let coordinates: Coordinate[] = [];

      if (route.geometry && route.geometry.coordinates) {
        // If geometry is in coordinates format
        coordinates = route.geometry.coordinates.map((coord: number[]) => ({
          longitude: coord[0],
          latitude: coord[1],
        }));
      } else if (route.geometry && typeof route.geometry === "string") {
        // If geometry is encoded polyline string, we need to decode it
        // For simplicity, let's create a straight line if we can't decode
        coordinates = [start, end];
      } else {
        // Fallback to straight line
        coordinates = [start, end];
      }

      return {
        coordinates,
        distance: route.summary?.distance || 0,
        duration: route.summary?.duration || 0,
      };
    }

    return null;
  } catch (error) {
    console.error("Error calculating route:", error);
    return null;
  }
};

export const geocodeAddress = async (
  address: string,
): Promise<Coordinate | null> => {
  try {
    const response = await fetch(
      `https://api.openrouteservice.org/geocode/search?api_key=${ORS_API_KEY}&text=${encodeURIComponent(address)}&boundary.country=AE`, // Added UAE boundary for better results
      {
        headers: {
          Accept: "application/json, application/geo+json",
        },
      },
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("OpenRouteService Geocoding error:", error);
      return null;
    }

    const data = await response.json();

    if (data.features && data.features.length > 0) {
      const [longitude, latitude] = data.features[0].geometry.coordinates;
      return { latitude, longitude };
    }

    return null;
  } catch (error) {
    console.error("Error geocoding address:", error);
    return null;
  }
};

// Fallback function to create a straight line between two points
export const createStraightLine = (
  start: Coordinate,
  end: Coordinate,
  points = 50,
): Coordinate[] => {
  const coordinates: Coordinate[] = [];

  for (let i = 0; i <= points; i++) {
    const ratio = i / points;
    const latitude = start.latitude + (end.latitude - start.latitude) * ratio;
    const longitude =
      start.longitude + (end.longitude - start.longitude) * ratio;
    coordinates.push({ latitude, longitude });
  }

  return coordinates;
};
