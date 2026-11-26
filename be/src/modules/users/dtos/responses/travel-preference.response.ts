export class PreferenceTaxonomyResponse {
  code: string;
  name: string;
}

export class PreferenceOptionsResponse {
  categories: PreferenceTaxonomyResponse[];
  topics: PreferenceTaxonomyResponse[];
}

export class TravelPreferenceResponse {
  userId: string;
  categories: PreferenceTaxonomyResponse[];
  topics: PreferenceTaxonomyResponse[];
  budget: number;
  style: string;
  transport: string;
  destinations: string[];
  updatedAt: string;
}
