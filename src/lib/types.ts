export type AdminRole = 'superadmin' | 'editor' | 'operator';

// ── Contracts ────────────────────────────────────────────────────────────────
export interface AdminContractListItem {
  id: number;
  player_id: number;
  player_last_name: string | null;
  player_first_name: string | null;
  player_sota_id: string | null;
  team_id: number;
  team_name: string | null;
  season_id: number;
  season_name: string | null;
  role: number | null;        // 1=Игрок, 2=Тренер, 3=Сотрудник, 4=Администрация
  amplua: number | null;      // 1=Вратарь, 2=Защитник, 3=Полузащитник, 4=Нападающий
  number: number | null;
  position_ru: string | null;
  position_kz: string | null;
  position_en: string | null;
  photo_url: string | null;
  is_active: boolean;
  is_hidden: boolean;
}

export interface AdminContractMetaPlayer {
  id: number;
  last_name: string | null;
  first_name: string | null;
  sota_id: string | null;
}

export interface AdminContractMetaSeason {
  id: number;
  name: string;
  championship_name: string | null;
}

export interface AdminContractMeta {
  players: AdminContractMetaPlayer[];
  teams: AdminMetaTeam[];
  seasons: AdminContractMetaSeason[];
}

export interface AdminContractsListResponse {
  items: AdminContractListItem[];
  total: number;
}
// ────────────────────────────────────────────────────────────────────────────

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
