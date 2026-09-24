import citiesJson from './cities.json';

export interface City {
  name: string;
  state: string;
  popular?: boolean;
}

export const CITIES_DATA: City[] = citiesJson as City[];
