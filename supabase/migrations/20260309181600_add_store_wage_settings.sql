ALTER TABLE stores
ADD COLUMN wage_start_day integer DEFAULT 1,
ADD COLUMN wage_end_day integer DEFAULT 0, -- 0 represents the last day of the month
ADD COLUMN pay_day integer DEFAULT 10;
