-- store_members 테이블에 계약서 상태 및 모두싸인 문서 ID 추가
ALTER TABLE store_members ADD COLUMN contract_status text DEFAULT 'none' CHECK (contract_status IN ('none', 'sent', 'signed'));
ALTER TABLE store_members ADD COLUMN modusign_document_id text;

-- 인덱스 추가 (웹훅에서 문서 ID로 빠르게 찾기 위함)
CREATE INDEX IF NOT EXISTS idx_store_members_modusign_doc_id ON store_members(modusign_document_id);