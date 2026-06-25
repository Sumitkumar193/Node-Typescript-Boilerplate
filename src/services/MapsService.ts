import ApiException from '@errors/ApiException';
import {
  Client,
  Language,
  GeocodingAddressComponentType,
  AddressType,
  AddressComponent,
} from '@googlemaps/google-maps-services-js';

export type NormalizedAddress = {
  placeId: string;
  formattedAddress: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  countryCode: string | null;
  postalCode: string | null;
  location: { lat: number; lng: number } | null;
};

type AddressComponentType = AddressType | GeocodingAddressComponentType;

export default class MapsService {
  private readonly apiKey: string;

  private readonly client: Client;

  constructor() {
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY!;
    if (!this.apiKey) {
      throw new ApiException('Google Maps API key not configured', 500);
    }

    this.client = new Client({});
  }

  /* --------------------------------------------------
   * TEXT SEARCH
   * -------------------------------------------------- */
  async textSearch(query: string) {
    const res = await this.client.textSearch({
      params: {
        query,
        key: this.apiKey,
        region: 'gb',
      },
    });

    if (res.data.status !== 'OK') {
      throw new ApiException(
        `Google Maps API error: ${res.data.error_message || res.data.status}`,
        400,
      );
    }

    return res.data.results;
  }

  /* --------------------------------------------------
   * PLACE DETAILS
   * -------------------------------------------------- */
  async getPlaceDetails(
    placeId: string,
    options: {
      language?: Language;
    } = {},
  ) {
    const res = await this.client.placeDetails({
      params: {
        place_id: placeId,
        key: this.apiKey,
        region: 'gb',
        language: options.language || Language.en,
      },
    });

    if (res.data.status !== 'OK' || !res.data.result) {
      throw new ApiException(
        `Google Maps API error: ${res.data.error_message || res.data.status}`,
        400,
      );
    }

    return res.data.result;
  }

  /* --------------------------------------------------
   * AUTOCOMPLETE
   * -------------------------------------------------- */
  async autocomplete(
    input: string,
    options: {
      location?: { lat: number; lng: number };
      radius?: number;
      types?: string;
      language?: Language;
    } = {},
  ) {
    const res = await this.client.placeAutocomplete({
      params: {
        input,
        key: this.apiKey,
        radius: options.radius,
        language: options.language || Language.en,
      },
    });

    if (res.data.status !== 'OK') {
      throw new ApiException(
        `Google Maps API error: ${res.data.error_message || res.data.status}`,
        400,
      );
    }

    return res.data.predictions;
  }

  /* --------------------------------------------------
   * NEARBY SEARCH
   * -------------------------------------------------- */
  async nearbySearch(options: {
    location: { lat: number; lng: number };
    radius: number;
    type?: string;
    keyword?: string;
    language?: Language;
  }) {
    const res = await this.client.placesNearby({
      params: {
        location: options.location,
        radius: options.radius,
        type: options.type as string,
        keyword: options.keyword,
        language: options.language || Language.en,
        key: this.apiKey,
      },
    });

    if (res.data.status !== 'OK') {
      throw new ApiException(
        `Google Maps API error: ${res.data.error_message || res.data.status}`,
        400,
      );
    }

    return res.data.results;
  }

  /* --------------------------------------------------
   * GEOCODE
   * -------------------------------------------------- */
  async geocode(address: string, language = 'en') {
    const res = await this.client.geocode({
      params: {
        address,
        language,
        region: 'gb',
        key: this.apiKey,
      },
    });

    if (res.data.status !== 'OK') {
      throw new ApiException(
        `Google Maps API error: ${res.data.error_message || res.data.status}`,
        400,
      );
    }

    return res.data.results;
  }

  /* --------------------------------------------------
   * REVERSE GEOCODE
   * -------------------------------------------------- */
  async reverseGeocode(
    location: { lat: number; lng: number },
    language: Language = Language.en,
  ) {
    const res = await this.client.reverseGeocode({
      params: {
        latlng: location,
        language,
        key: this.apiKey,
      },
    });

    if (res.data.status !== 'OK') {
      throw new ApiException(
        `Google Maps API error: ${res.data.error_message || res.data.status}`,
        400,
      );
    }

    return res.data.results;
  }

  /* --------------------------------------------------
   * PLACE PHOTO URL
   * -------------------------------------------------- */
  getPhotoUrl(
    photoReference: string,
    options: { maxWidth?: number; maxHeight?: number } = {},
  ) {
    const params = new URLSearchParams({
      photoreference: photoReference,
      key: this.apiKey,
    });

    if (options.maxWidth) params.append('maxwidth', String(options.maxWidth));
    if (options.maxHeight)
      params.append('maxheight', String(options.maxHeight));

    return `https://maps.googleapis.com/maps/api/place/photo?${params}`;
  }

  /* --------------------------------------------------
   * COMPLETE NORMALIZED ADDRESS (BEST PRACTICE)
   * -------------------------------------------------- */
  async getCompleteAddress(
    placeId: string,
    language: Language = Language.en,
  ): Promise<NormalizedAddress> {
    const place = await this.getPlaceDetails(placeId, {
      language,
    });

    const components: AddressComponent[] = place.address_components ?? [];

    const findComponent = (
      types: AddressComponentType[],
      useShortName = false,
    ): string | null => {
      const comp = components.find((c) =>
        types.some((t) =>
          c.types.includes(t as AddressType | GeocodingAddressComponentType),
        ),
      );
      if (!comp) return null;
      return useShortName ? comp.short_name : comp.long_name;
    };

    const location = place.geometry?.location
      ? { lat: place.geometry.location.lat, lng: place.geometry.location.lng }
      : null;

    let postalCode = findComponent([AddressType.postal_code]);

    // Fallback if postal code is missing
    if (!postalCode && location) {
      const reverse = await this.reverseGeocode(location, language);
      const pc = reverse
        .flatMap((r) => r.address_components ?? [])
        .find((c) => c.types.includes(AddressType.postal_code));
      postalCode = pc?.long_name ?? null;
    }

    const streetNumber = findComponent([AddressType.street_number]);
    const route = findComponent([AddressType.route]);

    console.log(place);

    return {
      placeId,
      formattedAddress: place.formatted_address ?? null,
      address:
        streetNumber && route ? `${streetNumber} ${route}` : route || null,
      city:
        findComponent([GeocodingAddressComponentType.postal_town]) ||
        findComponent([AddressType.locality]) ||
        findComponent([AddressType.administrative_area_level_3]),
      state: findComponent([AddressType.administrative_area_level_1]),
      country: findComponent([AddressType.country]),
      countryCode: findComponent([AddressType.country], true),
      postalCode,
      location,
    };
  }
}
