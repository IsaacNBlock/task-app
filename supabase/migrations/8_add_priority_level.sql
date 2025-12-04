-- Add priority_level field to tasks table
-- Priority levels: 1 (lowest) to 5 (highest)

alter table public.tasks
add column priority_level integer check (priority_level between 1 and 5) default 3;

comment on column public.tasks.priority_level is 'Task priority level from 1 (lowest) to 5 (highest). Default is 3 (medium).';

