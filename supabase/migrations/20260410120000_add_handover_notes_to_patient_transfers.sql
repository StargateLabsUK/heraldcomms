-- Optional freetext handover notes captured at transfer initiation.
-- Surfaced to the receiving crew alongside the clinical snapshot.
ALTER TABLE public.patient_transfers
  ADD COLUMN handover_notes text;
