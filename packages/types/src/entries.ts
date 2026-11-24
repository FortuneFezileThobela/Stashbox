export interface ListEntriesFilters {
  workspaceId: string;
  language?: string;
  search?: string;
}

export interface CreateEntryParams {
  workspaceId: string;
  createdById: string;
  title: string;
  description?: string;
  language: string;
  content: string;
}

export interface UpdateEntryParams {
  title?: string;
  description?: string;
  language?: string;
  content?: string;
}
