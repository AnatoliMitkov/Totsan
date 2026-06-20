-- Add pricing fields for remote consultations
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS remote_price_per_hour integer,
ADD COLUMN IF NOT EXISTS remote_is_free boolean DEFAULT false;
