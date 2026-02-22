export type AdminRole = 'superadmin' | 'editor' | 'operator';

export interface AdminUser {
  id: number;
  email: string;
  role: AdminRole;
  is_active: boolean;
}

export interface AdminPlayerTeamBindingInput {
  team_id: number;
  season_id: number;
  number: number | null;
}

export interface AdminPlayerTeamBindingResponse extends AdminPlayerTeamBindingInput {
  team_name: string | null;
  season_name: string | null;
}

export interface AdminPlayer {
  id: number;
  sota_id: string | null;
  first_name: string | null;
  first_name_kz: string | null;
  first_name_en: string | null;
  last_name: string | null;
  last_name_kz: string | null;
  last_name_en: string | null;
  birthday: string | null;
  player_type: string | null;
  country_id: number | null;
  photo_url: string | null;
  age: number | null;
  top_role: string | null;
  top_role_kz: string | null;
  top_role_en: string | null;
  team_bindings: AdminPlayerTeamBindingResponse[];
}

export interface AdminPlayersListResponse {
  items: AdminPlayer[];
  total: number;
}

export interface AdminMetaCountry {
  id: number;
  code: string | null;
  name: string;
}

export interface AdminMetaTeam {
  id: number;
  name: string;
}

export interface AdminMetaSeason {
  id: number;
  name: string;
}

export interface AdminPlayersMetaResponse {
  countries: AdminMetaCountry[];
  teams: AdminMetaTeam[];
  seasons: AdminMetaSeason[];
}
