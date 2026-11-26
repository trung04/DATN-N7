export const TOURIST_PROFILE_REPOSITORY = Symbol('TOURIST_PROFILE_REPOSITORY');

export interface TouristProfileRepository {
  findBioByUserId(userId: string): Promise<string | null>;
  saveBio(userId: string, bio: string | null): Promise<string | null>;
}
