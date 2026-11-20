-- The core booking invariant (docs/architecture/data-model.md): no two active
-- bookings may overlap. `held`, `proof_submitted` and `confirmed` block their
-- range; expired, rejected and cancelled do not. Range bounds are half-open
-- ('[)'), so a booking ending at 18:00 does not collide with one starting at
-- 18:00. `tstzrange` has a built-in GiST operator class, so btree_gist is not
-- needed for this single-column constraint.
ALTER TABLE "booking" ADD CONSTRAINT "booking_no_active_overlap" EXCLUDE USING gist (
	tstzrange("starts_at", "ends_at", '[)') WITH &&
) WHERE ("status" IN ('held', 'proof_submitted', 'confirmed'));
