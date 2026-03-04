alter table public.schedules
add column title text;

comment on column public.schedules.title is '스케줄 명칭 (예: 오전 근무, 오픈 조)';