export interface Competition {
  id: string;
  name: string;
  url: string;
  platform: string;
  start_date: string | null;
  end_date: string | null;
  prize_raw: string | null;
  prize_usd: number | null;
  tags: string[];
  competition_type: string | null;
  organizer: string | null;
  co_authors: string | null;
  journal_venue: string | null;
  description: string | null;
  participants: number | null;
  category: string | null;
  is_research: boolean;
  sources: string[];
  first_seen: string | null;
  is_new: boolean;
}

export type SourceState = "ok" | "error" | "stale" | "skipped" | "cached";

export interface SourceStatus {
  status: SourceState;
  count: number;
  error: string | null;
  stale_since: string | null;
  seconds: number;
}

export interface Meta {
  generated_at: string;
  run_date: string;
  previous_run_date: string | null;
  total: number;
  raw_records: number;
  duplicates_merged: number;
  new_today: number;
  total_prize_usd: number;
  by_platform: Record<string, number>;
  fx_source: string;
  sources: Record<string, SourceStatus>;
}

export interface Dataset {
  meta: Meta;
  competitions: Competition[];
}

export interface Filters {
  search: string;
  platforms: string[];
  categories: string[];
  types: string[];
  minPrize: number;
  deadlineWithin: number | null;
  researchOnly: boolean;
  newOnly: boolean;
  includeOngoing: boolean;
  includeCommunity: boolean;
}

export const DEFAULT_FILTERS: Filters = {
  search: "",
  platforms: [],
  categories: [],
  types: [],
  minPrize: 0,
  deadlineWithin: null,
  researchOnly: false,
  newOnly: false,
  includeOngoing: false,
  includeCommunity: true,
};

