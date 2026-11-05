import type { DocumentStatus, FileExt } from "@/constants/documents";

export type VersionRow = {
  id: string;
  document_id: string;
  version_number: number;
  original_filename: string;
  file_ext: FileExt;
  file_size: number;
  status: DocumentStatus;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  processed_at: string | null;
  uploaded_by: string | null;
  uploaded_by_name: string | null;
};

export type DocumentRow = {
  id: string;
  title: string;
  description: string | null;
  category_id: string | null;
  access_level: "company" | "restricted";
  current_version_id: string | null;
  latest_version_id: string | null;
  created_at: string;
  updated_at: string;
  category: { id: string; name: string } | null;
  latest: VersionRow | null;
  current: VersionRow | null;
};

/** PostgREST select for document lists/details (explicit FK hints because documents<->versions has 3 relationships). */
export const DOCUMENT_SELECT = `
  id, title, description, category_id, access_level, current_version_id, latest_version_id, created_at, updated_at,
  category:categories(id, name),
  latest:document_versions!documents_latest_version_fk(id, document_id, version_number, original_filename, file_ext, file_size, status, error_code, error_message, created_at, processed_at, uploaded_by, uploaded_by_name),
  current:document_versions!documents_current_version_fk(id, document_id, version_number, original_filename, file_ext, file_size, status, error_code, error_message, created_at, processed_at, uploaded_by, uploaded_by_name)
`;
